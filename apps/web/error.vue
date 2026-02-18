<!--
  Error page — Shown for 404 and other unhandled errors.
  Provides a friendly error message and navigation back to safety.
-->
<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
    <div class="text-center max-w-md">
      <p class="text-6xl mb-4">{{ is404 ? '🔍' : '😵' }}</p>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        {{ is404 ? 'Page Not Found' : 'Something Went Wrong' }}
      </h1>
      <p class="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
        {{ is404
          ? "The page you're looking for doesn't exist or has been moved."
          : error?.message || 'An unexpected error occurred. Please try again.'
        }}
      </p>
      <div class="flex items-center justify-center gap-3">
        <button
          @click="handleError"
          class="btn-primary"
        >
          {{ is404 ? 'Go Home' : 'Try Again' }}
        </button>
        <NuxtLink v-if="!is404" to="/dashboard" class="btn-secondary">
          Go to Dashboard
        </NuxtLink>
      </div>
      <p v-if="error?.statusCode && !is404" class="mt-6 text-xs text-gray-400 dark:text-gray-500">
        Error {{ error.statusCode }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Error page component.
 * Handles 404 and other errors gracefully.
 */
const props = defineProps<{
  error: {
    statusCode: number;
    message: string;
    url?: string;
  };
}>();

/** Whether this is a 404 error */
const is404 = computed(() => props.error?.statusCode === 404);

/**
 * Handle the primary action button click.
 * For 404: navigate home. For other errors: clear error and retry.
 */
function handleError() {
  clearError({ redirect: '/' });
}
</script>
