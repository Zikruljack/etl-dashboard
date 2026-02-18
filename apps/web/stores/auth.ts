import { defineStore } from 'pinia';
import type { User, AuthResponse } from '@etl-dashboard/shared';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    token: null as string | null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
    isAdmin: (state) => state.user?.role === 'admin',
    isEditor: (state) => state.user?.role === 'editor' || state.user?.role === 'admin',
  },

  actions: {
    setAuth(data: AuthResponse) {
      this.user = data.user;
      this.token = data.token;
      if (import.meta.client) {
        localStorage.setItem('token', data.token);
      }
    },

    logout() {
      this.user = null;
      this.token = null;
      if (import.meta.client) {
        localStorage.removeItem('token');
      }
      navigateTo('/login');
    },

    async init() {
      if (!import.meta.client) return;
      const token = localStorage.getItem('token');
      if (!token) return;

      this.token = token;
      try {
        const config = useRuntimeConfig();
        const res = await $fetch<{ success: boolean; data: User }>(`${config.public.apiBase}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        this.user = res.data;
      } catch {
        this.logout();
      }
    },
  },
});
