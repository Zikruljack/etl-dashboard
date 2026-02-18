<script setup lang="ts">
/**
 * Root index page — redirects to the appropriate landing page.
 */
definePageMeta({ middleware: 'auth' });

const authStore = useAuthStore();
const target = authStore.isAdmin ? '/admin/dashboard' : '/dashboard';
await navigateTo(target, { replace: true });
</script>

<template>
  <div class="flex items-center justify-center py-20">
    <LoadingState message="Redirecting..." />
  </div>
</template>
