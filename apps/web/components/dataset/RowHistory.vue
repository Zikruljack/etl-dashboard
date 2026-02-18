<!--
  RowHistory — Per-row value change history across all syncs.
  Shows a table of column-level changes for a specific rowKey over time.

  @prop datasetId - UUID of the dataset
  @prop rowKey - Stringified key column values identifying the row
-->
<template>
  <div class="flex flex-col gap-4">
    <!-- Row key header -->
    <div class="flex items-center gap-2">
      <span class="text-sm text-gray-500 dark:text-gray-400">Row:</span>
      <span class="text-sm font-mono font-medium text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
        {{ rowKey }}
      </span>
    </div>

    <LoadingState v-if="loading" message="Loading row history..." />

    <div v-else-if="error" class="text-center py-8 text-red-500 text-sm">{{ error }}</div>

    <EmptyState
      v-else-if="history.length === 0"
      title="No history found"
      message="No changes recorded for this row."
    />

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-700">
            <th class="text-left py-2 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Time
            </th>
            <th class="text-left py-2 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Type
            </th>
            <th class="text-left py-2 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Column
            </th>
            <th class="text-left py-2 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Before
            </th>
            <th class="text-left py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              After
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr
            v-for="entry in history"
            :key="entry.id"
            class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <td class="py-2 pr-4 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ formatDate(entry.changedAt) }}
            </td>
            <td class="py-2 pr-4">
              <span
                class="text-xs px-2 py-0.5 rounded-full font-medium"
                :class="changeTypeClass(entry.changeType)"
              >
                {{ entry.changeType }}
              </span>
            </td>
            <td class="py-2 pr-4 text-xs font-mono text-gray-700 dark:text-gray-300">
              {{ entry.columnName ?? '—' }}
            </td>
            <td class="py-2 pr-4">
              <span
                v-if="entry.oldValue !== null"
                class="text-xs font-mono bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded break-all"
              >
                {{ entry.oldValue }}
              </span>
              <span v-else class="text-xs text-gray-300 dark:text-gray-600">—</span>
            </td>
            <td class="py-2">
              <span
                v-if="entry.newValue !== null"
                class="text-xs font-mono bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded break-all"
              >
                {{ entry.newValue }}
              </span>
              <span v-else class="text-xs text-gray-300 dark:text-gray-600">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * RowHistory component props.
 */
const props = defineProps<{
  /** UUID of the parent dataset. */
  datasetId: string;
  /** Stringified key column values identifying the row. */
  rowKey: string;
}>();

const { $api } = useNuxtApp();

interface HistoryEntry {
  id: string;
  syncId: string;
  changeType: 'new' | 'changed' | 'deleted';
  columnName: string | null;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
}

const history = ref<HistoryEntry[]>([]);
const loading = ref(false);
const error = ref('');

/**
 * Fetch row change history from the API.
 */
async function fetchHistory() {
  if (!props.rowKey) return;
  loading.value = true;
  error.value = '';
  try {
    const encoded = encodeURIComponent(props.rowKey);
    const res = await $api<{ data: HistoryEntry[] }>(
      `/api/datasets/${props.datasetId}/changes/${encoded}`,
    );
    history.value = res.data ?? [];
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to load row history';
  } finally {
    loading.value = false;
  }
}

/**
 * CSS classes for change type badge.
 *
 * @param type - 'new' | 'changed' | 'deleted'
 */
function changeTypeClass(type: string): string {
  const map: Record<string, string> = {
    new: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    changed: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    deleted: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return map[type] ?? 'bg-gray-100 text-gray-500';
}

/**
 * Format ISO timestamp to localized string.
 *
 * @param iso - ISO 8601 timestamp
 */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

onMounted(fetchHistory);
watch(() => props.rowKey, fetchHistory);
</script>
