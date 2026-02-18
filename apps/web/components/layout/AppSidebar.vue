<!--
  AppSidebar — Main navigation sidebar.
  Collapsible on mobile with hamburger toggle, fixed on desktop.

  @slot none — No slots; navigation is driven by internal item arrays.
-->
<template>
  <!-- Mobile overlay backdrop -->
  <Transition name="sidebar-backdrop">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-40 bg-black/50 lg:hidden"
      @click="close"
    />
  </Transition>

  <aside
    class="fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white flex flex-col transform transition-transform duration-200 ease-in-out lg:translate-x-0"
    :class="isOpen ? 'translate-x-0' : '-translate-x-full'"
  >
    <div class="p-4 border-b border-gray-700 flex items-center justify-between">
      <NuxtLink to="/" class="flex items-center gap-2 group" @click="close">
        <span class="text-2xl">📊</span>
        <h1 class="text-xl font-bold group-hover:text-blue-300 transition-colors">ETL Dashboard</h1>
      </NuxtLink>
      <button class="lg:hidden text-gray-400 hover:text-white p-1" @click="close">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>

    <nav class="flex-1 p-4 space-y-1 overflow-y-auto">
      <p class="text-xs text-gray-500 uppercase tracking-wider mb-2 px-3">Main</p>
      <NuxtLink
        v-for="item in mainItems"
        :key="item.to"
        :to="item.to"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
        :class="isActive(item.to) ? 'bg-blue-600/20 text-blue-300 font-medium' : 'text-gray-300 hover:bg-gray-800 hover:text-white'"
        @click="close"
      >
        <span class="text-lg w-6 text-center">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </NuxtLink>

      <template v-if="authStore.isAdmin">
        <p class="text-xs text-gray-500 uppercase tracking-wider mt-5 mb-2 px-3">Admin</p>
        <NuxtLink
          v-for="item in adminItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
          :class="isActive(item.to) ? 'bg-red-600/20 text-red-300 font-medium' : 'text-gray-400 hover:bg-gray-800 hover:text-white'"
          @click="close"
        >
          <span class="text-lg w-6 text-center">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </NuxtLink>
      </template>
    </nav>

    <div class="p-4 border-t border-gray-700">
      <div class="flex items-center gap-3">
        <div
          class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium shrink-0"
          :class="authStore.isAdmin ? 'bg-red-700' : 'bg-blue-700'"
        >
          {{ userInitials }}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">{{ authStore.user?.name }}</p>
          <p class="text-xs truncate" :class="authStore.isAdmin ? 'text-red-300' : 'text-gray-400'">
            {{ authStore.user?.role }}
          </p>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
/**
 * AppSidebar component.
 * Provides responsive navigation: mobile-collapsible with backdrop, fixed on desktop.
 */
const authStore = useAuthStore();
const route = useRoute();

/** Whether the sidebar is open on mobile */
const isOpen = defineModel<boolean>('open', { default: false });

/** Close sidebar (mobile only) */
function close() {
  isOpen.value = false;
}

/** Auto-close on route change (mobile) */
watch(() => route.path, () => close());

const mainItems = [
  { to: '/dashboard', label: 'Dashboards', icon: '📊' },
  { to: '/datasets', label: 'Datasets', icon: '📁' },
];

const adminItems = [
  { to: '/admin/users', label: 'Users', icon: '👥' },
  { to: '/admin/datasets', label: 'Datasets', icon: '🗂️' },
  { to: '/admin/dashboard', label: 'Dashboards', icon: '📋' },
  { to: '/admin/system', label: 'System', icon: '🖥️' },
];

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
  if (path === '/dashboard') {
    return route.path === '/dashboard' || route.path.startsWith('/dashboard/');
  }
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
