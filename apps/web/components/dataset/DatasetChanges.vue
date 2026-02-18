<!--
  DatasetChanges — Change timeline for a dataset.
  Shows paginated list of row changes (new/changed/deleted) with optional filters.
  Expandable detail: click a changed row to see column-level diffs.

  @prop datasetId - UUID of the dataset
  @prop syncId - Optional: filter to a single sync run
-->
<template>
  <div class="flex flex-col gap-4">

    <!-- Filters -->
    <div class="flex items-center gap-3 flex-wrap">
      <select
        v-model="filterChangeType"
        class="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        @change="resetAndFetch"
      >
        <option value="">All changes</option>
        <option value="new">New rows</option>
        <option value="changed">Changed rows</option>
        <option value="deleted">Deleted rows</option>
      </select>

      <span class="text-xs text-gray-400 dark:text-gray-500 ml-auto">
        {{ total }} record{{ total !== 1 ? 's' : '' }}
      </span>
    </div>

    <LoadingState v-if="loading" message="Loading changes..." />

    <div v-else-if="error" class="text-center py-8 text-red-500 text-sm">{{ error }}</div>

    <EmptyState
      v-else-if="changes.length === 0"
      title="No changes found"
      message="No changes match the current filter."
    />

    <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
      <div
        v-for="change in changes"
        :key="change.id"
        class="py-3"
      >
        <!-- Row header -->
        <div
          class="flex items-center gap-2 cursor-pointer"
          @click="toggleExpand(change.id)"
        >
          <!-- Change type badge -->
          <span
            class="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
            :class="changeTypeClass(change.changeType)"
          >
            {{ changeTypeLabel(change.changeType) }}
          </span>

          <!-- Row key -->
          <span class="text-sm font-mono text-gray-700 dark:text-gray-300 truncate flex-1">
            {{ change.rowKey }}
          </span>

          <!-- Column name if it's a column-level change -->
          <span v-if="change.columnName" class="text-xs text-gray-400 shrink-0">
            {{ change.columnName }}
          </span>

          <!-- Time -->
          <span class="text-xs text-gray-400 shrink-0">{{ formatDate(change.changedAt) }}</span>

          <!-- Expand icon -->
          <svg
            v-if="change.changeType === 'changed'"
            class="w-4 h-4 text-gray-400 shrink-0 transition-transform"
            :class="expanded.has(change.id) ? 'rotate-90' : ''"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>

        <!-- Expanded diff detail -->
        <div v-if="expanded.has(change.id) && change.changeType === 'changed'" class="mt-2 ml-2 pl-3 border-l-2 border-yellow-300 dark:border-yellow-700">
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="text-gray-500 dark:text-gray-400 font-medium">Before</div>
            <div class="text-gray-500 dark:text-gray-400 font-medium">After</div>
            <div class="font-mono bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-2 py-1 rounded break-all">
              {{ change.oldValue ?? '—' }}
            </div>
            <div class="font-mono bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2 py-1 rounded break-all">
              {{ change.newValue ?? '—' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between pt-2">
      <button
        class="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40"
        :disabled="page === 1"
        @click="goPage(page - 1)"
      >
        Previous
      </button>
      <span class="text-sm text-gray-500">{{ page }} / {{ totalPages }}</span>
      <button
        class="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40"
        :disabled="page >= totalPages"
        @click="goPage(page + 1)"
      >
        Next
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * DatasetChanges component props.
 */
const props = withDefaults(defineProps<{
  /** UUID of the dataset. */
  datasetId: string;
  /** Optional sync ID to filter to a specific sync run. */
  syncId?: string;
}>(), {
  syncId: undefined,
});

const { $api } = useNuxtApp();

interface ChangeRecord {
  id: string;
  datasetId: string;
  syncId: string;
  rowKey: string;
  changeType: 'new' | 'changed' | 'deleted';
  columnName: string | null;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
}

const changes = ref<ChangeRecord[]>([]);
const loading = ref(false);
const error = ref('');
const total = ref(0);
const page = ref(1);
const pageSize = 30;
const totalPages = computed(() => Math.ceil(total.value / pageSize));
const filterChangeType = ref('');
const expanded = ref(new Set<string>());

/**
 * Fetch change records from the API.
 */
async function fetchChanges() {
  loading.value = true;
  error.value = '';
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      pageSize: String(pageSize),
    });
    if (props.syncId) params.set('syncId', props.syncId);
    if (filterChangeType.value) params.set('changeType', filterChangeType.value);

    const res = await $api<{ data: ChangeRecord[]; pagination: { total: number } }>(
      `/api/datasets/${props.datasetId}/changes?${params}`,
    );
    changes.value = res.data ?? [];
    total.value = res.pagination?.total ?? 0;
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to load changes';
  } finally {
    loading.value = false;
  }
}

/**
 * Reset to page 1 and re-fetch (used when filter changes).
 */
function resetAndFetch() {
  page.value = 1;
  fetchChanges();
}

/**
 * Navigate to a specific page.
 *
 * @param p - Target page number
 */
function goPage(p: number) {
  page.value = p;
  fetchChanges();
}

/**
 * Toggle expanded diff view for a change record.
 *
 * @param id - Change record UUID
 */
function toggleExpand(id: string) {
  if (expanded.value.has(id)) {
    expanded.value.delete(id);
  } else {
    expanded.value.add(id);
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
  return map[type] ?? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
}

/**
 * Human-readable label for change type.
 *
 * @param type - 'new' | 'changed' | 'deleted'
 */
function changeTypeLabel(type: string): string {
  const map: Record<string, string> = { new: 'New', changed: 'Changed', deleted: 'Deleted' };
  return map[type] ?? type;
}

/**
 * Format ISO timestamp to localized short form.
 *
 * @param iso - ISO 8601 timestamp string
 */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

onMounted(fetchChanges);
watch(() => props.syncId, resetAndFetch);

/** Expose refresh for parent use. */
defineExpose({ refresh: fetchChanges });
</script>
