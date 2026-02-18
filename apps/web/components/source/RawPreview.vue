<template>
  <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
    <div class="px-5 py-3.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
      <div>
        <h3 class="font-semibold text-gray-900 dark:text-gray-100">Raw Data Preview</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ totalRows }} rows &times; {{ totalCols }} columns</p>
      </div>
      <slot name="actions" />
    </div>

    <div v-if="data.length === 0" class="p-12 text-center">
      <p class="text-gray-400 dark:text-gray-500 text-sm">No data available</p>
    </div>

    <div v-else class="overflow-auto max-h-[70vh]">
      <table class="text-xs border-collapse">
        <thead class="sticky top-0 z-10">
          <tr class="bg-gray-100 dark:bg-gray-800">
            <!-- Row number column — not clickable -->
            <th class="px-2 py-1.5 text-gray-400 dark:text-gray-500 font-mono text-center border border-gray-200 dark:border-gray-700 sticky left-0 bg-gray-100 dark:bg-gray-800 z-20 min-w-[40px]">
              #
            </th>
            <!-- Column letter headers — only show non-excluded columns, click to toggle exclude -->
            <th
              v-for="colIdx in visibleColIndices"
              :key="colIdx"
              class="px-2 py-1.5 font-mono text-center border border-gray-200 dark:border-gray-700 min-w-[100px] select-none transition-colors cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-500 dark:hover:text-orange-400"
              :title="`Click to exclude column ${colLetter(colIdx)}`"
              @click="$emit('col-toggle', colIdx)"
            >
              {{ colLetter(colIdx) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, rowIdx) in displayRows"
            :key="rowIdx"
            :class="getRowClass(rowIdx)"
            @click="handleRowClick($event, rowIdx)"
          >
            <!-- Row number -->
            <td class="px-2 py-1 text-gray-400 dark:text-gray-500 font-mono text-center border border-gray-200 dark:border-gray-700 sticky left-0 z-10"
              :class="getRowNumberClass(rowIdx)">
              {{ rowIdx }}
            </td>
            <!-- Cell values (only visible/non-excluded columns) -->
            <td
              v-for="colIdx in visibleColIndices"
              :key="colIdx"
              class="px-2 py-1 border border-gray-200 dark:border-gray-700 whitespace-nowrap max-w-[200px] truncate"
              :class="getCellClass(rowIdx, colIdx)"
              :title="String(row[colIdx] ?? '')"
            >
              {{ row[colIdx] ?? '' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Legend -->
    <div v-if="showLegend" class="px-5 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center gap-5 text-xs text-gray-500 dark:text-gray-400">
      <span class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded-sm bg-blue-100 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-700 inline-block"></span>
        <span class="font-medium text-blue-700 dark:text-blue-400">Header</span>
      </span>
      <span class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded-sm bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 inline-block"></span>
        <span class="font-medium text-red-500 dark:text-red-400">Skipped</span>
      </span>
      <span class="flex items-center gap-1.5">
        <span class="w-3 h-3 rounded-sm bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-700 inline-block"></span>
        <span class="font-medium text-green-600 dark:text-green-400">Data</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CellGrid } from '@etl-dashboard/shared';

/**
 * RawPreview component props.
 */
const props = withDefaults(defineProps<{
  /** Raw cell grid data */
  data: CellGrid;
  /** Total row count */
  totalRows: number;
  /** Total column count */
  totalCols: number;
  /** Row indices marked as header */
  headerRows?: number[];
  /** Row indices marked as skipped */
  skipRows?: number[];
  /** Global column indices excluded from extraction */
  excludeColumns?: number[];
  /** Data start row index */
  dataStartRow?: number;
  /** Data end row index (null = to end) */
  dataEndRow?: number | null;
  /** Show the color legend */
  showLegend?: boolean;
  /** Max rows to display (performance) */
  maxDisplayRows?: number;
}>(), {
  headerRows: () => [],
  skipRows: () => [],
  excludeColumns: () => [],
  dataStartRow: 0,
  dataEndRow: null,
  showLegend: false,
  maxDisplayRows: 200,
});

const emit = defineEmits<{
  /** Emitted when a row is left-clicked (toggle header) */
  'row-click': [rowIndex: number];
  /** Emitted when a row is shift-clicked (toggle skip) */
  'row-skip': [rowIndex: number];
  /** Emitted when a column letter header is clicked (toggle exclude) */
  'col-toggle': [colIndex: number];
}>();

/** Rows to display (capped for performance) */
const displayRows = computed(() => {
  return props.data.slice(0, props.maxDisplayRows);
});

/** Number of columns to display (respect excludeColumns) */
const displayColCount = computed(() => {
  return props.totalCols;
});

/** Get list of visible column indices (non-excluded) */
const visibleColIndices = computed(() => {
  const indices: number[] = [];
  for (let i = 0; i < props.totalCols; i++) {
    if (!props.excludeColumns?.includes(i)) {
      indices.push(i);
    }
  }
  return indices;
});

/**
 * Handle row click: regular click = toggle header, shift+click = toggle skip.
 *
 * @param event - Mouse event
 * @param rowIdx - Row index
 */
function handleRowClick(event: MouseEvent, rowIdx: number) {
  if (event.shiftKey) {
    emit('row-skip', rowIdx);
  } else {
    emit('row-click', rowIdx);
  }
}

/**
 * Convert column index to spreadsheet-style letter (A, B, ..., Z, AA, AB, ...).
 *
 * @param index - 0-based column index
 * @returns Column letter
 */
function colLetter(index: number): string {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

/**
 * Get CSS class for a data row based on its role (header, skip, data).
 *
 * @param rowIdx - Row index
 */
function getRowClass(rowIdx: number): string {
  if (props.headerRows.includes(rowIdx)) {
    return 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer';
  }
  if (props.skipRows.includes(rowIdx)) {
    return 'bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 cursor-pointer opacity-60';
  }
  if (rowIdx >= props.dataStartRow && (props.dataEndRow === null || rowIdx <= props.dataEndRow)) {
    return 'bg-green-50/30 dark:bg-green-900/20 hover:bg-green-50 dark:hover:bg-green-900/30 cursor-pointer';
  }
  return 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer';
}

/**
 * Get CSS class for the row number cell.
 *
 * @param rowIdx - Row index
 */
function getRowNumberClass(rowIdx: number): string {
  if (props.headerRows.includes(rowIdx)) return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 font-bold';
  if (props.skipRows.includes(rowIdx)) return 'bg-red-50 dark:bg-red-900/30 text-red-400 dark:text-red-500 line-through';
  return 'bg-gray-50 dark:bg-gray-800';
}

/**
 * Get CSS class for an individual cell based on row role.
 *
 * @param rowIdx - Row index
 * @param _colIdx - Column index (unused)
 */
function getCellClass(rowIdx: number, _colIdx: number): string {
  if (props.headerRows.includes(rowIdx)) return 'font-semibold text-blue-800 dark:text-blue-300';
  if (props.skipRows.includes(rowIdx)) return 'text-gray-400 dark:text-gray-500 line-through';
  return '';
}
</script>
