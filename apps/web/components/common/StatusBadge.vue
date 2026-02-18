<!--
  StatusBadge — Colored pill badge based on status string.
  Extracts the duplicated syncStatus :class logic from datasets pages.

  @prop status - Status string value (e.g. 'success', 'syncing', 'error', 'idle')
  @prop label - Optional custom display text (defaults to status value)
-->
<template>
  <span
    class="text-xs px-2 py-0.5 rounded-full inline-block"
    :class="statusClass"
  >
    {{ label || status }}
  </span>
</template>

<script setup lang="ts">
/**
 * StatusBadge component props.
 */
const props = withDefaults(defineProps<{
  /** Status string value */
  status: string;
  /** Custom display text (defaults to status value) */
  label?: string;
}>(), {
  label: '',
});

/**
 * Map of status values to Tailwind CSS classes.
 */
const statusColorMap: Record<string, string> = {
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  syncing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  running: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  idle: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  draft: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

/**
 * Computed CSS class based on the status prop.
 */
const statusClass = computed(() =>
  statusColorMap[props.status] || 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
);
</script>
