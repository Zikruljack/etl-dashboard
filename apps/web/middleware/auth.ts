/**
 * Auth route middleware.
 * Redirects unauthenticated users to /login.
 * Skips check during SSR since token lives in localStorage (client-only).
 */
export default defineNuxtRouteMiddleware((to) => {
  // Skip auth check on server — token is in localStorage (client-only)
  if (import.meta.server) return;

  const authStore = useAuthStore();

  if (!authStore.isAuthenticated && to.path !== '/login' && to.path !== '/register') {
    return navigateTo('/login');
  }
});
