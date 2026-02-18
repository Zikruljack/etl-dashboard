<!--
  Admin layout — Responsive sidebar + header for admin panel.
  Same mobile pattern as default layout: slide-in sidebar + hamburger toggle.
-->
<template>
  <div class="min-h-screen flex bg-gray-50">
    <!-- Mobile overlay backdrop -->
    <Transition name="sidebar-backdrop">
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-40 bg-black/50 lg:hidden"
        @click="sidebarOpen = false"
      />
    </Transition>

    <!-- Admin Sidebar -->
    <aside
      class="fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white flex flex-col transform transition-transform duration-200 ease-in-out lg:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="p-4 border-b border-gray-700 flex items-center justify-between">
        <div>
          <NuxtLink to="/dashboard" class="text-xs text-gray-400 hover:text-white transition-colors" @click="sidebarOpen = false">&larr; Back to app</NuxtLink>
          <h1 class="text-xl font-bold mt-1">Admin Panel</h1>
        </div>
        <button class="lg:hidden text-gray-400 hover:text-white p-1" @click="sidebarOpen = false">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <nav class="flex-1 p-4 space-y-1 overflow-y-auto">
        <NuxtLink
          v-for="item in menuItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
          :class="isActive(item.to)
            ? 'bg-red-600/20 text-red-300 font-medium'
            : 'text-gray-300 hover:bg-gray-800 hover:text-white'"
          @click="sidebarOpen = false"
        >
          <span class="text-lg w-6 text-center">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>

      <div class="p-4 border-t border-gray-700">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-red-700 flex items-center justify-center text-sm font-medium shrink-0">
            {{ userInitials }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{{ authStore.user?.name }}</p>
            <p class="text-xs text-red-300">admin</p>
          </div>
        </div>
      </div>
    </aside>

    <!-- Content -->
    <div class="flex-1 flex flex-col min-w-0">
      <header class="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div class="flex items-center gap-3">
          <!-- Hamburger for mobile -->
          <button
            class="lg:hidden p-1.5 -ml-1 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
            @click="sidebarOpen = !sidebarOpen"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ pageTitle }}</h2>
        </div>
        <div class="flex items-center gap-2 sm:gap-4">
          <!-- Dark mode toggle -->
          <button
            @click="toggleColorMode()"
            class="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
            :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          >
            <svg v-if="isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
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
      <main class="flex-1 p-4 sm:p-6 overflow-auto">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Admin layout — responsive sidebar with mobile toggle.
 */
const authStore = useAuthStore();
const route = useRoute();
const { isDark, toggleColorMode } = useColorMode();

/** Whether the mobile sidebar is open */
const sidebarOpen = ref(false);

/** Auto-close sidebar on route change (mobile) */
watch(() => route.path, () => { sidebarOpen.value = false; });

const menuItems = [
  { to: '/admin/users', label: 'Users', icon: '👥' },
  { to: '/admin/datasets', label: 'Datasets', icon: '📁' },
  { to: '/admin/dashboard', label: 'Dashboards', icon: '📊' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
  { to: '/admin/logs', label: 'Activity Logs', icon: '📋' },
  { to: '/admin/system', label: 'System Info', icon: '🖥️' },
];

/**
 * Compute the page title from the current route.
 *
 * @returns Matching menu item label, or 'Admin' as fallback
 */
const pageTitle = computed(() => {
  const match = menuItems.find((m) => route.path.startsWith(m.to));
  return match?.label || 'Admin';
});

/** User initials for avatar display. */
const userInitials = computed(() => {
  const name = authStore.user?.name || '';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
});

/**
 * Check if a nav item is active based on the current route.
 *
 * @param path - The nav item's route path
 * @returns Whether the item should be highlighted as active
 */
function isActive(path: string): boolean {
  return route.path === path || route.path.startsWith(path + '/');
}
</script>

<style scoped>
.sidebar-backdrop-enter-active,
.sidebar-backdrop-leave-active {
  transition: opacity 0.2s ease;
}
.sidebar-backdrop-enter-from,
.sidebar-backdrop-leave-to {
  opacity: 0;
}
</style>
