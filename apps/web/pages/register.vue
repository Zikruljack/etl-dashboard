<template>
  <div>
    <div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">Create an account</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Get started with ETL Dashboard</p>

      <form @submit.prevent="handleRegister" class="space-y-4">
        <div>
          <label class="form-label">Name</label>
          <input
            v-model="form.name"
            type="text"
            required
            autocomplete="name"
            class="form-input"
            placeholder="Your name"
          />
        </div>

        <div>
          <label class="form-label">Email</label>
          <input
            v-model="form.email"
            type="email"
            required
            autocomplete="email"
            class="form-input"
            placeholder="email@example.com"
          />
        </div>

        <div>
          <label class="form-label">Password</label>
          <input
            v-model="form.password"
            type="password"
            required
            minlength="6"
            autocomplete="new-password"
            class="form-input"
            placeholder="Min. 6 characters"
          />
          <p v-if="form.password && form.password.length < 6" class="form-hint text-yellow-600 dark:text-yellow-400">Password must be at least 6 characters</p>
        </div>

        <Transition name="fade">
          <div v-if="error" class="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
            <span class="shrink-0">&#9888;</span>
            {{ error }}
          </div>
        </Transition>

        <button
          type="submit"
          :disabled="loading"
          class="btn-primary w-full py-2.5"
        >
          <svg v-if="loading" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
          {{ loading ? 'Creating account...' : 'Create Account' }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?
        <NuxtLink to="/login" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium">Sign in</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApiResponse, AuthResponse, RegisterRequest } from '@etl-dashboard/shared';

definePageMeta({ layout: 'auth' });

const authStore = useAuthStore();
const { $api } = useApi();

const form = reactive<RegisterRequest>({ name: '', email: '', password: '' });
const loading = ref(false);
const error = ref('');

/**
 * Handle registration form submission.
 */
async function handleRegister() {
  loading.value = true;
  error.value = '';
  try {
    const res = await $api<ApiResponse<AuthResponse>>('/auth/register', {
      method: 'POST',
      body: form,
    });
    authStore.setAuth(res.data);
    navigateTo(authStore.isAdmin ? '/admin/dashboard' : '/dashboard');
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    error.value = err?.data?.message || 'Registration failed';
  } finally {
    loading.value = false;
  }
}
</script>
