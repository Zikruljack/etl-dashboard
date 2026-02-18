<template>
  <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
    <LoadingState v-if="loading" message="Loading data..." />
    <EmptyState v-else-if="rows.length === 0" title="No data" icon="📋" />
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th v-for="col in columns" :key="col.name" class="text-left px-4 py-2 font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {{ col.name }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id" class="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <td v-for="col in columns" :key="col.name" class="px-4 py-2 whitespace-nowrap">
              {{ row.data[col.name] ?? '-' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="pagination.totalPages.value > 1" class="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
      <p class="text-sm text-gray-500">
        Page {{ pagination.page.value }} of {{ pagination.totalPages.value }} ({{ pagination.total.value }} rows)
      </p>
      <div class="flex gap-2">
        <button
          @click="pagination.prev(); loadData()"
          :disabled="!pagination.hasPrev.value"
          class="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
        >
          Prev
        </button>
        <button
          @click="pagination.next(); loadData()"
          :disabled="!pagination.hasNext.value"
          class="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PaginatedResponse, DatasetRow, ColumnDefinition } from '@etl-dashboard/shared';

/**
 * DatasetPreview component props.
 */
const props = defineProps<{
  /** Dataset ID to fetch data from */
  datasetId: string;
  /** Column definitions for table headers */
  columns: ColumnDefinition[];
}>();

const { $api } = useApi();
const pagination = usePagination({ initialPageSize: 20 });

const rows = ref<DatasetRow[]>([]);
const loading = ref(true);

onMounted(() => loadData());

/**
 * Fetch paginated dataset rows from the API.
 */
async function loadData() {
  loading.value = true;
  try {
    const res = await $api<PaginatedResponse<DatasetRow>>(
      `/datasets/${props.datasetId}/data`,
      { params: { page: pagination.page.value, pageSize: pagination.pageSize.value } },
    );
    rows.value = res.data;
    pagination.setFromResponse(res.pagination);
  } catch (e) {
    console.error('Failed to load data', e);
  } finally {
    loading.value = false;
  }
}
</script>
