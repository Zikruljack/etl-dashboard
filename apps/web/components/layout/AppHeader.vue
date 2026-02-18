<!--
  AppHeader — Top navigation bar with page title, breadcrumbs, and user actions.
  Includes a mobile hamburger toggle for the sidebar and dark mode toggle.

  @emit toggle-sidebar - Emitted when the hamburger button is clicked (mobile only)
-->
<template>
  <header class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
    <div class="flex items-center gap-3">
      <!-- Hamburger for mobile -->
      <button
        class="lg:hidden p-1.5 -ml-1 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
        @click="$emit('toggle-sidebar')"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ pageTitle }}</h2>
      <span v-if="pageDescription" class="text-sm text-gray-400 hidden md:inline dark:text-gray-500">{{ pageDescription }}</span>
    </div>
    <div class="flex items-center gap-2 sm:gap-4">
      <!-- Dark mode toggle -->
      <button
        @click="toggleColorMode()"
        class="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
        :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
      >
        <!-- Sun icon (shown in dark mode) -->
        <svg v-if="isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
        <!-- Moon icon (shown in light mode) -->
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
      </button>
      <span class="text-sm text-gray-500 hidden sm:inline dark:text-gray-400">{{ authStore.user?.name }}</span>
      <button
        @click="authStore.logout()"
        class="text-sm text-gray-500 hover:text-gray-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800"
      >
        Logout
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
/**
 * AppHeader component.
 * Displays contextual page title based on current route and user controls.
 */
const authStore = useAuthStore();
const route = useRoute();
const { isDark, toggleColorMode } = useColorMode();

defineEmits<{
  /** Emitted when the mobile hamburger is clicked */
  'toggle-sidebar': [];
}>();

/** Dynamic page title based on current route path. */
const pageTitle = computed(() => {
  const path = route.path;
  if (path === '/dashboard' || path.startsWith('/dashboard/')) return 'Dashboards';
  if (path.startsWith('/datasets')) return 'Datasets';
  if (path.startsWith('/admin')) return 'Admin';
  return 'ETL Dashboard';
});

/** Dynamic page description based on current route path. */
const pageDescription = computed(() => {
  const path = route.path;
  if (path === '/dashboard') return 'Visualize your data';
  if (path === '/datasets') return 'Manage data sources';
  return '';
});
</script>
