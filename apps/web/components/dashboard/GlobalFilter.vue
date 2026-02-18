<template>
  <div class="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl mb-4">
    <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Filter</span>

    <!-- Date From -->
    <div class="flex items-center gap-1.5">
      <label class="text-xs text-gray-400">From</label>
      <input
        :value="modelValue.dateFrom"
        type="date"
        @input="emit('update:modelValue', { ...modelValue, dateFrom: ($event.target as HTMLInputElement).value })"
        class="text-xs px-2 py-1 border border-gray-200 dark:border-gray-700 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 dark:text-gray-200"
      />
    </div>

    <!-- Date To -->
    <div class="flex items-center gap-1.5">
      <label class="text-xs text-gray-400">To</label>
      <input
        :value="modelValue.dateTo"
        type="date"
        @input="emit('update:modelValue', { ...modelValue, dateTo: ($event.target as HTMLInputElement).value })"
        class="text-xs px-2 py-1 border border-gray-200 dark:border-gray-700 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 dark:text-gray-200"
      />
    </div>

    <!-- Extra text filter (category/location) -->
    <div v-for="field in extraFields" :key="field.key" class="flex items-center gap-1.5">
      <label class="text-xs text-gray-400">{{ field.label }}</label>
      <input
        :value="modelValue.extra?.[field.key] ?? ''"
        type="text"
        :placeholder="field.placeholder || ''"
        @input="updateExtra(field.key, ($event.target as HTMLInputElement).value)"
        class="text-xs px-2 py-1 border border-gray-200 dark:border-gray-700 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white dark:bg-gray-800 dark:text-gray-200 w-32"
      />
    </div>

    <!-- Clear button (only when anything is set) -->
    <button
      v-if="hasActiveFilters"
      @click="clear"
      class="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-auto"
    >
      Clear filters
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * Global filter bar for dashboard pages.
 * Provides date range + optional extra text filters.
 * Emits a filter value object — parent passes it to widgets via prop.
 */

export interface DashboardFilter {
  /** ISO date string (YYYY-MM-DD) */
  dateFrom: string;
  /** ISO date string (YYYY-MM-DD) */
  dateTo: string;
  /** Additional free-form filters keyed by field name */
  extra: Record<string, string>;
}

export interface ExtraFilterField {
  key: string;
  label: string;
  placeholder?: string;
}

const props = defineProps<{
  modelValue: DashboardFilter;
  /** Optional extra filter fields (e.g. category, location) */
  extraFields?: ExtraFilterField[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: DashboardFilter];
}>();

const hasActiveFilters = computed(() =>
  !!props.modelValue.dateFrom ||
  !!props.modelValue.dateTo ||
  Object.values(props.modelValue.extra || {}).some(Boolean),
);

function updateExtra(key: string, value: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    extra: { ...(props.modelValue.extra || {}), [key]: value },
  });
}

function clear() {
  emit('update:modelValue', { dateFrom: '', dateTo: '', extra: {} });
}
</script>
