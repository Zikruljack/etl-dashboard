<!--
  SyncHistory — List of sync run records for a dataset.
  Shows status badge, timestamps, duration, and row-count stats per sync run.

  @prop datasetId - UUID of the dataset to show syncs for
-->
<template>
  <div>
    <LoadingState v-if="loading" message="Loading sync history..." />

    <div v-else-if="error" class="text-center py-8 text-red-500 dark:text-red-400 text-sm">
      {{ error }}
    </div>

    <EmptyState
      v-else-if="syncs.length === 0"
      title="No syncs yet"
      message="Run a sync to see the history here."
    />

    <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
      <div
        v-for="sync in syncs"
        :key="sync.id"
        class="py-4 flex flex-col gap-2"
      >
        <!-- Header row: status + time + duration -->
        <div class="flex items-center gap-3 flex-wrap">
          <StatusBadge :status="sync.status" />
          <span class="text-sm font-medium text-gray-800 dark:text-gray-200">
            {{ formatDate(sync.syncedAt) }}
          </span>
          <span v-if="sync.durationMs !== null" class="text-xs text-gray-400 dark:text-gray-500">
            {{ formatDuration(sync.durationMs) }}
          </span>
          <span class="ml-auto text-xs text-gray-400 font-mono">
            {{ sync.id.slice(0, 8) }}
          </span>
        </div>

        <!-- Stats row -->
        <div class="flex gap-3 flex-wrap text-xs">
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            +{{ sync.rowsNew }} new
          </span>
          <span
            v-if="sync.rowsChanged > 0"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
          >
            ~{{ sync.rowsChanged }} changed
          </span>
          <span
            v-if="sync.rowsDeleted > 0"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          >
            -{{ sync.rowsDeleted }} deleted
          </span>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            {{ sync.rowsTotal }} total
          </span>
        </div>

        <!-- Error log if failed -->
        <div
          v-if="sync.status === 'failed' && sync.errorLog"
          class="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2 font-mono break-all"
        >
          {{ sync.errorLog }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DatasetSync } from '@etl-dashboard/shared';

/**
 * SyncHistory component props.
 */
const props = defineProps<{
  /** UUID of the dataset to show syncs for. */
  datasetId: string;
}>();

const { $api } = useApi();

const syncs = ref<DatasetSync[]>([]);
const loading = ref(false);
const error = ref('');

/**
 * Fetch sync history from the API.
 */
async function fetchSyncs() {
  loading.value = true;
  error.value = '';
  try {
    const res = await $api<{ data: DatasetSync[] }>(`/datasets/${props.datasetId}/syncs`);
    syncs.value = res.data ?? [];
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to load sync history';
  } finally {
    loading.value = false;
  }
}

/**
 * Format ISO timestamp to localized date + time string.
 *
 * @param iso - ISO 8601 timestamp string
 * @returns Human-readable date time
 */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format duration in milliseconds to a human-readable string.
 *
 * @param ms - Duration in milliseconds
 * @returns e.g. "2.4s" or "1m 3s"
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `${min}m ${rem}s`;
}

onMounted(fetchSyncs);

/**
 * Expose refresh method so parent can trigger reload after sync.
 */
defineExpose({ refresh: fetchSyncs });
</script>
