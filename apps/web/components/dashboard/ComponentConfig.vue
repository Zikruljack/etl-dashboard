<template>
  <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-semibold text-gray-900 dark:text-gray-100">Configure Widget</h3>
      <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">&times;</button>
    </div>

    <div class="space-y-4">
      <!-- Title -->
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">Title</label>
        <input
          :value="component.title"
          @input="update('title', ($event.target as HTMLInputElement).value)"
          class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </div>

      <!-- Dataset selector -->
      <div>
        <label class="block text-xs font-medium text-gray-500 mb-1">Dataset</label>
        <select
          :value="component.datasetId || ''"
          @change="onDatasetChange(($event.target as HTMLSelectElement).value)"
          class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
        >
          <option value="">Select dataset</option>
          <option v-for="ds in datasets" :key="ds.id" :value="ds.id">{{ ds.name }}</option>
        </select>
      </div>

      <!-- Type-specific config -->
      <template v-if="component.type === 'table'">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Columns to show</label>
          <div class="space-y-1 max-h-40 overflow-y-auto">
            <label v-for="col in availableColumns" :key="col" class="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                :checked="(component.config as any).columns?.includes(col)"
                @change="toggleColumn(col)"
                class="rounded"
              />
              {{ col }}
            </label>
          </div>
        </div>
      </template>

      <template v-else-if="component.type === 'chart'">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Chart Type</label>
          <select
            :value="(component.config as any).chartType || 'bar'"
            @change="updateConfig('chartType', ($event.target as HTMLSelectElement).value)"
            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">X Axis</label>
          <select
            :value="(component.config as any).xAxis || ''"
            @change="updateConfig('xAxis', ($event.target as HTMLSelectElement).value)"
            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="">Select column</option>
            <option v-for="col in availableColumns" :key="col" :value="col">{{ col }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Y Axis</label>
          <select
            :value="(component.config as any).yAxis || ''"
            @change="updateConfig('yAxis', ($event.target as HTMLSelectElement).value)"
            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="">Select column</option>
            <option v-for="col in availableColumns" :key="col" :value="col">{{ col }}</option>
          </select>
        </div>
      </template>

      <template v-else-if="component.type === 'map'">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Latitude Column</label>
          <select
            :value="(component.config as any).latitudeColumn || ''"
            @change="updateConfig('latitudeColumn', ($event.target as HTMLSelectElement).value)"
            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="">Select column</option>
            <option v-for="col in availableColumns" :key="col" :value="col">{{ col }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Longitude Column</label>
          <select
            :value="(component.config as any).longitudeColumn || ''"
            @change="updateConfig('longitudeColumn', ($event.target as HTMLSelectElement).value)"
            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="">Select column</option>
            <option v-for="col in availableColumns" :key="col" :value="col">{{ col }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Label Column</label>
          <select
            :value="(component.config as any).labelColumn || ''"
            @change="updateConfig('labelColumn', ($event.target as HTMLSelectElement).value)"
            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="">Select column</option>
            <option v-for="col in availableColumns" :key="col" :value="col">{{ col }}</option>
          </select>
        </div>
      </template>

      <template v-else-if="component.type === 'timeline'">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Date Column</label>
          <select
            :value="(component.config as any).dateColumn || ''"
            @change="updateConfig('dateColumn', ($event.target as HTMLSelectElement).value)"
            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="">Select column</option>
            <option v-for="col in availableColumns" :key="col" :value="col">{{ col }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Title Column</label>
          <select
            :value="(component.config as any).titleColumn || ''"
            @change="updateConfig('titleColumn', ($event.target as HTMLSelectElement).value)"
            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="">Select column</option>
            <option v-for="col in availableColumns" :key="col" :value="col">{{ col }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Description Column</label>
          <select
            :value="(component.config as any).descriptionColumn || ''"
            @change="updateConfig('descriptionColumn', ($event.target as HTMLSelectElement).value)"
            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="">None</option>
            <option v-for="col in availableColumns" :key="col" :value="col">{{ col }}</option>
          </select>
        </div>
      </template>

      <!-- KPI config -->
      <template v-else-if="component.type === 'kpi'">
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Value Column</label>
          <select
            :value="(component.config as any).valueColumn || ''"
            @change="updateConfig('valueColumn', ($event.target as HTMLSelectElement).value)"
            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="">Select column</option>
            <option v-for="col in availableColumns" :key="col" :value="col">{{ col }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Aggregation</label>
          <select
            :value="(component.config as any).aggregation || 'sum'"
            @change="updateConfig('aggregation', ($event.target as HTMLSelectElement).value)"
            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="sum">Sum (Total)</option>
            <option value="avg">Average</option>
            <option value="count">Count</option>
            <option value="min">Minimum</option>
            <option value="max">Maximum</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Unit (optional)</label>
          <input
            :value="(component.config as any).unit || ''"
            @input="updateConfig('unit', ($event.target as HTMLInputElement).value)"
            placeholder="e.g. jiwa, %, km"
            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Decimal Places</label>
          <input
            type="number"
            min="0"
            max="4"
            :value="(component.config as any).decimals ?? 0"
            @input="updateConfig('decimals', Number(($event.target as HTMLInputElement).value))"
            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Accent Color</label>
          <select
            :value="(component.config as any).color || 'blue'"
            @change="updateConfig('color', ($event.target as HTMLSelectElement).value)"
            class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
          >
            <option value="blue">Blue</option>
            <option value="green">Green</option>
            <option value="red">Red</option>
            <option value="yellow">Yellow</option>
            <option value="purple">Purple</option>
            <option value="orange">Orange</option>
          </select>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  component: any;
}>();

const emit = defineEmits<{
  update: [updates: any];
  close: [];
}>();

const { $api } = useApi();

const datasets = ref<any[]>([]);
const availableColumns = ref<string[]>([]);

onMounted(async () => {
  try {
    const res = await $api<{ success: boolean; data: any[] }>('/datasets');
    datasets.value = res.data;
  } catch (e) {
    console.error('Failed to load datasets', e);
  }

  if (props.component.datasetId) {
    await loadColumns(props.component.datasetId);
  }
});

async function loadColumns(datasetId: string) {
  try {
    const res = await $api<{ success: boolean; data: any[] }>(`/datasets/${datasetId}/columns`);
    availableColumns.value = res.data.map((c: any) => c.name);
  } catch (e) {
    console.error('Failed to load columns', e);
  }
}

function update(key: string, value: any) {
  emit('update', { [key]: value });
}

function updateConfig(key: string, value: any) {
  emit('update', { config: { ...props.component.config, [key]: value } });
}

async function onDatasetChange(datasetId: string) {
  emit('update', { datasetId: datasetId || null });
  if (datasetId) {
    await loadColumns(datasetId);
  } else {
    availableColumns.value = [];
  }
}

function toggleColumn(col: string) {
  const current = (props.component.config as any).columns || [];
  const newCols = current.includes(col)
    ? current.filter((c: string) => c !== col)
    : [...current, col];
  updateConfig('columns', newCols);
}
</script>
