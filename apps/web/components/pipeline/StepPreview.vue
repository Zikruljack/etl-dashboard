<script setup lang="ts">
import type { PipelinePreviewResponse } from '@etl-dashboard/shared';

/**
 * StepPreview — Display before/after data for a pipeline preview run.
 * Shows stats and a sample of the output rows.
 */
const props = defineProps<{
  preview: PipelinePreviewResponse | null;
  loading: boolean;
}>();

const activeTab = ref<'output' | 'steps'>('output');

const outputColumns = computed(() => {
  if (!props.preview?.output?.length) return [];
  return Object.keys(props.preview.output[0]);
});

const inputColumns = computed(() => {
  if (!props.preview?.input?.length) return [];
  return Object.keys(props.preview.input[0]);
});
</script>

<template>
  <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
    <!-- Header -->
    <div class="bg-gray-50 dark:bg-gray-800 px-4 py-2 flex items-center gap-4 border-b border-gray-200 dark:border-gray-700">
      <span class="font-medium text-sm text-gray-700 dark:text-gray-200">Pipeline Preview</span>
      <div class="flex gap-2 ml-auto">
        <button
          class="text-xs px-3 py-1 rounded"
          :class="activeTab === 'output' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300'"
          @click="activeTab = 'output'"
        >
          Output
        </button>
        <button
          class="text-xs px-3 py-1 rounded"
          :class="activeTab === 'steps' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300'"
          @click="activeTab = 'steps'"
        >
          Per Step
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="p-8 text-center text-sm text-gray-400">
      Running preview...
    </div>

    <!-- No preview yet -->
    <div v-else-if="!preview" class="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
      Click "Run Preview" to see how your pipeline transforms the data.
    </div>

    <template v-else>
      <!-- Stats bar -->
      <div class="px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex gap-6 text-xs text-gray-500 dark:text-gray-400">
        <span>Rows in: <strong class="text-gray-800 dark:text-gray-100">{{ preview.stats.rowsIn }}</strong></span>
        <span>Rows out: <strong class="text-gray-800 dark:text-gray-100">{{ preview.stats.rowsOut }}</strong></span>
        <span>Steps: <strong class="text-gray-800 dark:text-gray-100">{{ preview.stats.stepsExecuted }}</strong></span>
        <span v-if="preview.stats.rowsIn !== preview.stats.rowsOut" class="text-orange-500">
          {{ preview.stats.rowsIn - preview.stats.rowsOut }} rows filtered
        </span>
      </div>

      <!-- Output tab: sample table -->
      <div v-if="activeTab === 'output'" class="overflow-x-auto max-h-80">
        <table class="min-w-full text-xs">
          <thead class="bg-gray-50 dark:bg-gray-800 sticky top-0">
            <tr>
              <th
                v-for="col in outputColumns"
                :key="col"
                class="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap border-b border-gray-200 dark:border-gray-700"
              >
                {{ col }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, ri) in preview.output"
              :key="ri"
              class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <td
                v-for="col in outputColumns"
                :key="col"
                class="px-3 py-1.5 text-gray-700 dark:text-gray-300 whitespace-nowrap max-w-40 truncate"
                :title="String(row[col] ?? '')"
              >
                {{ row[col] ?? '' }}
              </td>
            </tr>
            <tr v-if="preview.output.length === 0">
              <td :colspan="outputColumns.length" class="px-3 py-4 text-center text-gray-400">
                No rows in output
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Steps tab: per-step stats -->
      <div v-else class="p-3 space-y-2 max-h-80 overflow-y-auto">
        <div
          v-for="step in preview.steps"
          :key="step.stepIndex"
          class="border border-gray-200 dark:border-gray-700 rounded p-3"
        >
          <div class="flex items-center gap-3 mb-2">
            <span class="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{{ step.stepIndex + 1 }}</span>
            <span class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ step.stepType }}</span>
            <span class="ml-auto text-xs text-gray-400">{{ step.rowsIn }} → {{ step.rowsOut }} rows</span>
          </div>

          <!-- Warnings -->
          <div v-if="step.warnings.length" class="text-xs text-yellow-600 dark:text-yellow-400 space-y-0.5">
            <p v-for="w in step.warnings" :key="w" class="flex items-start gap-1">
              <span>⚠️</span> {{ w }}
            </p>
          </div>

          <!-- Sample output (first 3 rows) -->
          <div v-if="step.sample.length && step.columns.length" class="mt-2 overflow-x-auto">
            <table class="text-xs w-full">
              <thead>
                <tr class="text-gray-400">
                  <th v-for="col in step.columns.slice(0, 6)" :key="col" class="text-left pr-4 py-0.5">{{ col }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, ri) in step.sample.slice(0, 3)" :key="ri" class="text-gray-600 dark:text-gray-400">
                  <td v-for="col in step.columns.slice(0, 6)" :key="col" class="pr-4 py-0.5 truncate max-w-24">{{ row[col] ?? '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
