<template>
  <div class="h-full overflow-auto">
    <div v-if="loading" class="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>
    <div v-else-if="!datasetId" class="flex items-center justify-center h-full text-gray-400 text-sm">
      Select a dataset
    </div>
    <div v-else-if="!config?.dateColumn || !config?.titleColumn" class="flex items-center justify-center h-full text-gray-400 text-sm">
      Configure date and title columns
    </div>
    <div v-else-if="events.length === 0" class="flex items-center justify-center h-full text-gray-400 text-sm">
      No events
    </div>
    <div v-else class="relative pl-6 py-2">
      <!-- Timeline line -->
      <div class="absolute left-3 top-0 bottom-0 w-0.5 bg-blue-200"></div>

      <div
        v-for="(event, idx) in events"
        :key="idx"
        class="relative mb-4 last:mb-0"
      >
        <!-- Dot -->
        <div class="absolute -left-3 top-1 w-3 h-3 rounded-full border-2 border-blue-500 bg-white"></div>

        <!-- Content -->
        <div class="bg-gray-50 rounded-lg p-3 ml-2">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              {{ event.date }}
            </span>
            <span v-if="event.category" class="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
              {{ event.category }}
            </span>
          </div>
          <h4 class="text-sm font-semibold text-gray-900">{{ event.title }}</h4>
          <p v-if="event.description" class="text-xs text-gray-500 mt-1">{{ event.description }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  config: any;
  datasetId: string | null;
}>();

const { $api } = useApi();

const data = ref<Record<string, unknown>[]>([]);
const loading = ref(false);

const events = computed(() => {
  return data.value
    .map((row) => ({
      date: String(row[props.config.dateColumn] ?? ''),
      title: String(row[props.config.titleColumn] ?? ''),
      description: props.config.descriptionColumn ? String(row[props.config.descriptionColumn] ?? '') : '',
      category: props.config.categoryColumn ? String(row[props.config.categoryColumn] ?? '') : '',
      _sortDate: new Date(String(row[props.config.dateColumn] ?? '')).getTime(),
    }))
    .filter((e) => e.title && e.date)
    .sort((a, b) => a._sortDate - b._sortDate);
});

watch(() => [props.datasetId, props.config?.dateColumn, props.config?.titleColumn], () => loadData(), { immediate: true });

async function loadData() {
  if (!props.datasetId || !props.config?.dateColumn || !props.config?.titleColumn) return;
  loading.value = true;
  try {
    const res = await $api<any>('/data/query', {
      method: 'POST',
      body: {
        datasetId: props.datasetId,
        limit: 1000,
      },
    });
    data.value = res.data.data;
  } catch (e) {
    console.error('Widget timeline load failed', e);
  } finally {
    loading.value = false;
  }
}
</script>
