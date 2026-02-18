<!--
  LoadingState — Centered loading spinner with customizable message.
  Replaces inline "Loading..." text used across all pages.

  @prop message - Text to display below the spinner (default: 'Loading...')
  @slot default - Optional custom content to replace the default spinner + message
-->
<template>
  <div class="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
    <slot>
      <svg
        class="animate-spin h-8 w-8 text-blue-500 mb-3"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <p class="text-sm">{{ message }}</p>
    </slot>
  </div>
</template>

<script setup lang="ts">
/**
 * LoadingState component props.
 */
withDefaults(defineProps<{
  /** Text displayed below the spinner */
  message?: string;
}>(), {
  message: 'Loading...',
});
</script>
