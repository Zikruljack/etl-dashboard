/**
 * Auth initialization plugin.
 * Restores auth state from localStorage before the first route navigation,
 * preventing the auth middleware from redirecting authenticated users to login.
 *
 * This runs as a Nuxt plugin (before page render) instead of onMounted (after render),
 * solving the race condition where the auth middleware checks isAuthenticated
 * before the token is restored from localStorage.
 */
export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore();
  await authStore.init();
});
