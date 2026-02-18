<template>
  <div class="h-full flex flex-col">
    <div v-if="loading" class="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>
    <div v-else-if="!datasetId" class="flex items-center justify-center h-full text-gray-400 text-sm">
      Select a dataset
    </div>
    <template v-else>
      <div class="flex-1 overflow-auto">
        <table class="w-full text-xs">
          <thead class="bg-gray-50 sticky top-0">
            <tr>
              <th
                v-for="col in displayColumns"
                :key="col"
                @click="toggleSort(col)"
                class="text-left px-3 py-2 font-medium text-gray-500 whitespace-nowrap cursor-pointer hover:bg-gray-100"
              >
                {{ col }}
                <span v-if="sortColumn === col" class="ml-1">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in sortedData" :key="idx" class="border-t border-gray-100 hover:bg-gray-50">
              <td v-for="col in displayColumns" :key="col" class="px-3 py-1.5 whitespace-nowrap">
                {{ row[col] ?? '-' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="total > pageSize" class="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50 shrink-0">
        <span class="text-xs text-gray-500">{{ total }} rows</span>
        <div class="flex gap-1">
          <button @click="page--; loadData()" :disabled="page <= 1" class="px-2 py-0.5 text-xs border rounded disabled:opacity-50">Prev</button>
          <button @click="page++; loadData()" :disabled="page * pageSize >= total" class="px-2 py-0.5 text-xs border rounded disabled:opacity-50">Next</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { DashboardFilter } from '~/components/dashboard/GlobalFilter.vue';

const props = defineProps<{
  config: any;
  datasetId: string | null;
  globalFilter?: DashboardFilter | null;
}>();

const { $api } = useApi();
const apiFilters = useWidgetFilter(computed(() => props.config), computed(() => props.globalFilter));

const data = ref<Record<string, unknown>[]>([]);
const loading = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = computed(() => props.config?.pageSize || 20);
const sortColumn = ref('');
const sortDir = ref<'asc' | 'desc'>('asc');

const displayColumns = computed(() => {
  if (props.config?.columns?.length > 0) return props.config.columns;
  if (data.value.length > 0) return Object.keys(data.value[0]);
  return [];
});

const sortedData = computed(() => {
  if (!sortColumn.value) return data.value;
  return [...data.value].sort((a, b) => {
    const av = String(a[sortColumn.value] ?? '');
    const bv = String(b[sortColumn.value] ?? '');
    const cmp = av.localeCompare(bv, undefined, { numeric: true });
    return sortDir.value === 'desc' ? -cmp : cmp;
  });
});

function toggleSort(col: string) {
  if (sortColumn.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn.value = col;
    sortDir.value = 'asc';
  }
}

watch(
  () => [props.datasetId, apiFilters.value],
  () => { page.value = 1; loadData(); },
  { immediate: true },
);

async function loadData() {
  if (!props.datasetId) return;
  loading.value = true;
  try {
    const res = await $api<any>('/data/query', {
      method: 'POST',
      body: {
        datasetId: props.datasetId,
        columns: props.config?.columns?.length > 0 ? props.config.columns : undefined,
        filters: apiFilters.value.length > 0 ? apiFilters.value : undefined,
        limit: pageSize.value,
        offset: (page.value - 1) * pageSize.value,
      },
    });
    data.value = res.data.data;
    total.value = res.data.total;
  } catch (e) {
    console.error('Widget table load failed', e);
  } finally {
    loading.value = false;
  }
}
</script>
