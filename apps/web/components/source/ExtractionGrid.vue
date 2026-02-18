<template>
  <div class="space-y-5">
    <!-- Toolbar -->
    <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
      <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-1">Extraction Settings</h3>
      <p class="text-xs text-gray-400 dark:text-gray-500 mb-4">Configure how raw data should be interpreted</p>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Header Rows</label>
          <p class="font-semibold text-blue-600 dark:text-blue-400">
            {{ config.headerRowIndices.length > 0
              ? config.headerRowIndices.map(r => r + 1).join(', ')
              : 'None (click rows below)' }}
          </p>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Data Start Row</label>
          <input
            type="number"
            :value="config.dataStartRow"
            @input="updateConfig('dataStartRow', Number(($event.target as HTMLInputElement).value))"
            min="0"
            class="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors bg-white dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Data End Row</label>
          <input
            type="number"
            :value="config.dataEndRow ?? ''"
            @input="updateConfig('dataEndRow', ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : null)"
            :placeholder="`${totalRows - 1} (last)`"
            min="0"
            class="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors bg-white dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Header Separator</label>
          <input
            type="text"
            :value="config.headerFlattenSeparator"
            @input="updateConfig('headerFlattenSeparator', ($event.target as HTMLInputElement).value)"
            class="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors bg-white dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      </div>
      <div class="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Column Start (0-based)</label>
          <input
            type="number"
            :value="config.columnStart"
            @input="updateConfig('columnStart', Number(($event.target as HTMLInputElement).value))"
            min="0"
            class="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors bg-white dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Column End (0-based)</label>
          <input
            type="number"
            :value="config.columnEnd ?? ''"
            @input="updateConfig('columnEnd', ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : null)"
            :placeholder="`${totalCols - 1} (last)`"
            min="0"
            class="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors bg-white dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      </div>
      <div class="mt-4 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800">
        <p class="text-xs text-blue-700 dark:text-blue-400 space-y-0.5">
          💡 <span class="font-semibold">Click row</span> = toggle header &nbsp;·&nbsp;
          <span class="font-semibold">Shift+Click row</span> = <span class="text-red-600 font-semibold">skip row</span> (totals, footnotes) &nbsp;·&nbsp;
          <span class="font-semibold">Click column letter</span> = <span class="text-orange-600 font-semibold">hide column</span> (exclude from extraction)
        </p>
      </div>
    </div>

    <!-- Raw grid with interactive selection -->
    <RawPreview
      :data="data"
      :total-rows="totalRows"
      :total-cols="totalCols"
      :header-rows="config.headerRowIndices"
      :skip-rows="config.skipRows"
      :exclude-columns="config.excludeColumns || []"
      :data-start-row="config.dataStartRow"
      :data-end-row="config.dataEndRow"
      show-legend
      @row-click="handleRowClick"
      @row-skip="handleRowSkip"
      @col-toggle="handleColToggle"
    />

    <!-- Extraction Preview -->
    <div v-if="preview" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
      <div class="px-5 py-3.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <h3 class="font-semibold text-gray-900 dark:text-gray-100">Extraction Preview</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {{ preview.totalRows }} rows &times; {{ preview.headers.length }} columns extracted
        </p>
      </div>

      <!-- Column Labels Editor -->
      <div v-if="preview.headers.length > 0" class="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Column Labels <span class="font-normal normal-case tracking-normal text-gray-400 dark:text-gray-500">(click to rename)</span></p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="(header, idx) in preview.headers"
            :key="idx"
            class="inline-flex items-center text-xs"
          >
            <input
              :value="getColumnLabel(idx, header)"
              @blur="setColumnLabel(idx, header, ($event.target as HTMLInputElement).value)"
              class="px-2.5 py-1.5 border border-gray-200 dark:border-gray-600 rounded-md text-xs hover:border-blue-300 dark:hover:border-blue-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors bg-white dark:bg-gray-800 dark:text-gray-100"
              :class="config.columnLabels[String(idx + config.columnStart)] ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700' : ''"
            />
          </span>
        </div>
      </div>

      <!-- Preview Table -->
      <div v-if="preview.rows.length > 0" class="overflow-auto max-h-[300px]">
        <table class="w-full text-xs border-collapse">
          <thead class="sticky top-0 bg-gray-100 dark:bg-gray-800">
            <tr>
              <th class="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">#</th>
              <th
                v-for="(header, idx) in preview.headers"
                :key="idx"
                class="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 whitespace-nowrap"
              >
                {{ getColumnLabel(idx, header) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIdx) in previewDisplayRows" :key="rowIdx" class="hover:bg-gray-50 dark:hover:bg-gray-800">
              <td class="px-3 py-1.5 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700">{{ rowIdx + 1 }}</td>
              <td
                v-for="(cell, colIdx) in row"
                :key="colIdx"
                class="px-3 py-1.5 border border-gray-200 dark:border-gray-700 whitespace-nowrap max-w-[200px] truncate"
                :title="String(cell ?? '')"
              >
                {{ cell ?? '' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="preview.rows.length > 50" class="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700">
        Showing first 50 of {{ preview.totalRows }} rows
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CellGrid, ExtractionConfig, ExtractionPreview } from '@etl-dashboard/shared';

/**
 * ExtractionGrid component props.
 */
const props = defineProps<{
  /** Raw cell grid data */
  data: CellGrid;
  /** Total row count */
  totalRows: number;
  /** Total column count */
  totalCols: number;
  /** Current extraction config (v-model) */
  config: ExtractionConfig;
  /** Live extraction preview */
  preview: ExtractionPreview | null;
}>();

const emit = defineEmits<{
  /** Emitted when extraction config changes */
  'update:config': [config: ExtractionConfig];
  /** Emitted when config changes and preview should refresh */
  'request-preview': [];
}>();

/** Limit preview display rows for performance */
const previewDisplayRows = computed(() => {
  return props.preview?.rows.slice(0, 50) ?? [];
});

/**
 * Update a specific config field and emit change.
 */
function updateConfig(field: keyof ExtractionConfig, value: unknown) {
  const updated = { ...props.config, [field]: value };
  emit('update:config', updated);
  // Debounce preview request
  requestPreviewDebounced();
}

/** Debounce timer for preview requests */
let previewTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Request preview with debounce to avoid excessive API calls.
 */
function requestPreviewDebounced() {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    emit('request-preview');
  }, 500);
}

/**
 * Handle row click: toggle as header row.
 * Left-click: toggle header. Uses store action if available.
 */
function handleRowClick(rowIdx: number) {
  const headerIndices = [...props.config.headerRowIndices];
  const idx = headerIndices.indexOf(rowIdx);

  if (idx >= 0) {
    headerIndices.splice(idx, 1);
  } else {
    headerIndices.push(rowIdx);
    headerIndices.sort((a, b) => a - b);
  }

  // Auto-adjust data start row
  let dataStartRow = props.config.dataStartRow;
  if (headerIndices.length > 0) {
    const lastHeader = Math.max(...headerIndices);
    dataStartRow = lastHeader + 1;
  }

  const updated = {
    ...props.config,
    headerRowIndices: headerIndices,
    dataStartRow,
  };
  emit('update:config', updated);
  requestPreviewDebounced();
}

/**
 * Handle shift+click on a row: toggle skip row.
 *
 * @param rowIdx - Row index
 */
function handleRowSkip(rowIdx: number) {
  const skipRows = [...props.config.skipRows];
  const idx = skipRows.indexOf(rowIdx);
  if (idx >= 0) {
    skipRows.splice(idx, 1);
  } else {
    skipRows.push(rowIdx);
    skipRows.sort((a, b) => a - b);
  }
  const updated = { ...props.config, skipRows };
  emit('update:config', updated);
  requestPreviewDebounced();
}

/**
 * Handle click on a column letter header: toggle column exclusion.
 *
 * @param colIdx - 0-based global column index
 */
function handleColToggle(colIdx: number) {
  const excludeColumns = [...(props.config.excludeColumns || [])];
  const idx = excludeColumns.indexOf(colIdx);
  if (idx >= 0) {
    excludeColumns.splice(idx, 1);
  } else {
    excludeColumns.push(colIdx);
    excludeColumns.sort((a, b) => a - b);
  }
  const updated = { ...props.config, excludeColumns };
  console.log('[ExtractionGrid] Column toggle:', colIdx, 'New excludeColumns:', excludeColumns);
  emit('update:config', updated);
  // Request preview immediately for column toggle (no debounce)
  emit('request-preview');
}

/**
 * Get the display label for a column.
 */
function getColumnLabel(idx: number, defaultHeader: string): string {
  const globalIdx = idx + (props.config.columnStart || 0);
  return props.config.columnLabels[String(globalIdx)] || defaultHeader;
}

/**
 * Set a custom label for a column.
 */
function setColumnLabel(idx: number, originalHeader: string, newLabel: string) {
  const globalIdx = idx + (props.config.columnStart || 0);
  const labels = { ...props.config.columnLabels };

  if (newLabel.trim() && newLabel.trim() !== originalHeader) {
    labels[String(globalIdx)] = newLabel.trim();
  } else {
    delete labels[String(globalIdx)];
  }

  const updated = { ...props.config, columnLabels: labels };
  emit('update:config', updated);
}
</script>
