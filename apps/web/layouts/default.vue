<!--
  Default layout — Sidebar + Header + Main content.
  Sidebar is collapsible on mobile via hamburger toggle.
-->
<template>
  <div class="min-h-screen flex bg-gray-50">
    <AppSidebar v-model:open="sidebarOpen" />
    <div class="flex-1 flex flex-col min-w-0">
      <AppHeader @toggle-sidebar="sidebarOpen = !sidebarOpen" />
      <main class="flex-1 p-4 sm:p-6 overflow-auto">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
/** Whether the mobile sidebar is open */
const sidebarOpen = ref(false);
</script>
