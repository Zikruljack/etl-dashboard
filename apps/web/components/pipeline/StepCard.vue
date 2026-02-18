<script setup lang="ts">
import type { StepType } from '@etl-dashboard/shared';
import type { DraftStep } from '~/composables/usePipeline';

/**
 * StepCard — Display one pipeline step in the step list.
 * Shows step type, summary, and action buttons (move up/down, remove).
 */
const props = defineProps<{
  step: DraftStep;
  index: number;
  total: number;
  /** Whether this step card is currently expanded (showing config form). */
  expanded: boolean;
}>();

const emit = defineEmits<{
  (e: 'expand'): void;
  (e: 'move-up'): void;
  (e: 'move-down'): void;
  (e: 'remove'): void;
}>();

/** Human-readable labels per step type. */
const STEP_LABELS: Record<StepType, string> = {
  rename: 'Rename Column',
  change_type: 'Change Type',
  trim: 'Trim Whitespace',
  map_values: 'Map Values',
  remove_duplicates: 'Remove Duplicates',
  fill_missing: 'Fill Missing',
  find_replace: 'Find & Replace',
  filter_rows: 'Filter Rows',
  split_column: 'Split Column',
  merge_columns: 'Merge Columns',
};

/** Icon class per step type (Heroicons via @nuxtjs/icon or inline SVG). */
const STEP_ICONS: Record<StepType, string> = {
  rename: '✏️',
  change_type: '🔄',
  trim: '✂️',
  map_values: '🗺️',
  remove_duplicates: '🗑️',
  fill_missing: '📥',
  find_replace: '🔍',
  filter_rows: '🔽',
  split_column: '↔️',
  merge_columns: '🔗',
};

const label = computed(() => STEP_LABELS[props.step.type] ?? props.step.type);
const icon = computed(() => STEP_ICONS[props.step.type] ?? '⚙️');
const isFirst = computed(() => props.index === 0);
const isLast = computed(() => props.index === props.total - 1);
</script>

<template>
  <div
    class="border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 overflow-hidden"
    :class="{ 'ring-2 ring-blue-500': expanded }"
  >
    <!-- Header row -->
    <div
      class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 select-none"
      @click="emit('expand')"
    >
      <!-- Step number -->
      <span class="flex-none w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-mono flex items-center justify-center text-gray-600 dark:text-gray-300">
        {{ index + 1 }}
      </span>

      <!-- Icon + label -->
      <span class="text-lg leading-none">{{ icon }}</span>
      <span class="flex-1 font-medium text-sm text-gray-800 dark:text-gray-100">{{ label }}</span>

      <!-- Config summary -->
      <span class="text-xs text-gray-400 dark:text-gray-500 truncate max-w-32 hidden sm:block">
        {{ step.type }}
      </span>

      <!-- Expand indicator -->
      <span class="text-gray-400 text-xs">{{ expanded ? '▲' : '▼' }}</span>
    </div>

    <!-- Actions row (always visible) -->
    <div class="flex items-center gap-1 px-4 pb-2 border-t border-gray-100 dark:border-gray-700 pt-2">
      <button
        :disabled="isFirst"
        class="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-600"
        title="Move up"
        @click.stop="emit('move-up')"
      >
        ↑
      </button>
      <button
        :disabled="isLast"
        class="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-600"
        title="Move down"
        @click.stop="emit('move-down')"
      >
        ↓
      </button>
      <div class="flex-1" />
      <button
        class="text-xs px-2 py-1 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40"
        title="Remove step"
        @click.stop="emit('remove')"
      >
        Remove
      </button>
    </div>
  </div>
</template>
