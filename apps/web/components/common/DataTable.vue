<!--
  DataTable — Generic reusable data table with sorting support.
  Replaces hand-rolled tables in admin/users, datasets/[id] columns, etc.

  @prop columns - Column definitions with key, label, and optional config
  @prop rows - Array of data objects
  @prop loading - Whether data is currently loading
  @prop emptyTitle - Title text when no rows (default: 'No data')
  @prop emptyMessage - Description text when no rows
  @prop rowKey - Key field for :key binding (default: 'id')
  @emit row-click - Emitted with the row object when a row is clicked
  @slot cell-{key} - Named slot for custom cell rendering, receives { row, value }
  @slot actions - Slot for per-row action buttons, receives { row }
  @slot empty - Custom empty state content
-->
<template>
  <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
    <!-- Loading overlay -->
    <LoadingState v-if="loading" message="Loading data..." />

    <!-- Empty state -->
    <div v-else-if="rows.length === 0" class="p-6">
      <slot name="empty">
        <EmptyState :title="emptyTitle" :message="emptyMessage" icon="📋" />
      </slot>
    </div>

    <!-- Table -->
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              class="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap"
              :class="[col.align === 'right' ? 'text-right' : 'text-left', col.headerClass]"
            >
              {{ col.label }}
            </th>
            <th v-if="$slots.actions" class="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="getRowKey(row)"
            class="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            :class="{ 'cursor-pointer': hasRowClick }"
            @click="hasRowClick ? $emit('row-click', row) : undefined"
          >
            <td
              v-for="col in columns"
              :key="col.key"
              class="px-4 py-3"
              :class="[col.align === 'right' ? 'text-right' : '', col.cellClass]"
            >
              <slot :name="`cell-${col.key}`" :row="row" :value="getCellValue(row, col.key)">
                {{ getCellValue(row, col.key) ?? '-' }}
              </slot>
            </td>
            <td v-if="$slots.actions" class="px-4 py-3 text-right">
              <slot name="actions" :row="row" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Column definition for DataTable.
 */
export interface DataTableColumn {
  /** Object key to access the cell value */
  key: string;
  /** Column header label */
  label: string;
  /** Text alignment — 'left' (default) or 'right' */
  align?: 'left' | 'right';
  /** Additional CSS class for the header cell */
  headerClass?: string;
  /** Additional CSS class for body cells */
  cellClass?: string;
}

/**
 * DataTable component props.
 */
const props = withDefaults(defineProps<{
  /** Column definitions */
  columns: DataTableColumn[];
  /** Data rows */
  rows: Record<string, unknown>[];
  /** Whether data is loading */
  loading?: boolean;
  /** Empty state title */
  emptyTitle?: string;
  /** Empty state description */
  emptyMessage?: string;
  /** Row key field for :key binding */
  rowKey?: string;
}>(), {
  loading: false,
  emptyTitle: 'No data',
  emptyMessage: '',
  rowKey: 'id',
});

const emit = defineEmits<{
  /** Emitted when a row is clicked */
  'row-click': [row: Record<string, unknown>];
}>();

/** Whether the parent registered a row-click handler */
const hasRowClick = computed(() => !!getCurrentInstance()?.vnode.props?.['onRow-click']);

/**
 * Get the row key value for :key binding.
 *
 * @param row - Data row object
 * @returns The key value
 */
function getRowKey(row: Record<string, unknown>): string {
  return String(row[props.rowKey] ?? Math.random());
}

/**
 * Get a cell value from a row object, supporting dot-notation paths.
 *
 * @param row - Data row object
 * @param key - Property key (supports dot notation like 'data.name')
 * @returns The cell value
 */
function getCellValue(row: Record<string, unknown>, key: string): unknown {
  if (key.includes('.')) {
    return key.split('.').reduce((obj: unknown, k) => {
      if (obj && typeof obj === 'object') return (obj as Record<string, unknown>)[k];
      return undefined;
    }, row);
  }
  return row[key];
}
</script>
