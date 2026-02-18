<!--
  ToastContainer — Renders toast notifications in a fixed overlay.
  Place once in app.vue. Works with the useToast() composable.

  Supports 4 variants: success, error, warning, info.
  Auto-dismisses and allows manual dismiss via click.
-->
<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <TransitionGroup
        enter-active-class="transition-all duration-300 ease-out"
        leave-active-class="transition-all duration-200 ease-in"
        enter-from-class="opacity-0 translate-x-4 scale-95"
        enter-to-class="opacity-100 translate-x-0 scale-100"
        leave-from-class="opacity-100 translate-x-0 scale-100"
        leave-to-class="opacity-0 translate-x-4 scale-95"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-sm cursor-pointer"
          :class="toastClass(toast.type)"
          role="alert"
          @click="dismiss(toast.id)"
        >
          <!-- Icon -->
          <span class="text-lg shrink-0 mt-0.5" v-html="toastIcon(toast.type)" />

          <!-- Message -->
          <p class="text-sm font-medium flex-1 leading-snug">{{ toast.message }}</p>

          <!-- Close button -->
          <button
            class="shrink-0 opacity-60 hover:opacity-100 transition-opacity text-current"
            @click.stop="dismiss(toast.id)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '~/composables/useToast';

/**
 * ToastContainer component.
 * Renders all active toast notifications with transitions.
 */
const { toasts, dismiss } = useToast();

/**
 * Get Tailwind classes for toast variant.
 *
 * @param type - Toast variant type
 * @returns CSS class string
 */
function toastClass(type: string): string {
  switch (type) {
    case 'success': return 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/40 dark:border-green-800 dark:text-green-300';
    case 'error': return 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/40 dark:border-red-800 dark:text-red-300';
    case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/40 dark:border-yellow-800 dark:text-yellow-300';
    case 'info': return 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300';
    default: return 'bg-gray-50 border-gray-200 text-gray-800 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300';
  }
}

/**
 * Get emoji icon for toast variant.
 *
 * @param type - Toast variant type
 * @returns Icon HTML string
 */
function toastIcon(type: string): string {
  switch (type) {
    case 'success': return '&#10003;';
    case 'error': return '&#10007;';
    case 'warning': return '&#9888;';
    case 'info': return '&#8505;';
    default: return '&#8505;';
  }
}
</script>
