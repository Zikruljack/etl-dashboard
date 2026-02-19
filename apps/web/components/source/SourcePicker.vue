<template>
  <div class="space-y-4">
    <label class="form-label">Source Type</label>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <button
        v-for="option in sourceOptions"
        :key="option.value"
        type="button"
        class="relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center"
        :class="modelValue === option.value
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200 dark:ring-blue-800'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900'"
        @click="$emit('update:modelValue', option.value)"
      >
        <span class="text-2xl">{{ option.icon }}</span>
        <span
          class="text-sm font-semibold"
          :class="modelValue === option.value ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'"
        >
          {{ option.label }}
        </span>
        <span class="text-xs text-gray-400 dark:text-gray-500">{{ option.description }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Source type picker component.
 * Displays available data source connectors as selectable cards.
 */

interface Props {
  /** Currently selected source type */
  modelValue: 'google_sheets' | 'csv' | 'excel' | 'rest_api';
}

defineProps<Props>();
defineEmits<{
  'update:modelValue': [value: 'google_sheets' | 'csv' | 'excel' | 'rest_api'];
}>();

const sourceOptions = [
  {
    value: 'google_sheets' as const,
    label: 'Google Sheets',
    icon: '\uD83D\uDCCA',
    description: 'Connect via Spreadsheet ID',
  },
  {
    value: 'csv' as const,
    label: 'CSV File',
    icon: '\uD83D\uDCC4',
    description: 'Upload .csv file',
  },
  {
    value: 'excel' as const,
    label: 'Excel File',
    icon: '\uD83D\uDCCB',
    description: 'Upload .xlsx or .xls file',
  },
  {
    value: 'rest_api' as const,
    label: 'REST API',
    icon: '\uD83C\uDF10',
    description: 'Fetch from any HTTP endpoint',
  },
];
</script>
