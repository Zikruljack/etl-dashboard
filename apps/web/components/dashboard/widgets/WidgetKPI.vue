<!--
  WidgetKPI — Key Performance Indicator widget.
  Displays a single large aggregated value with label, unit, and color accent.

  @prop config - KPIConfig: valueColumn, aggregation, unit, decimals, color
  @prop datasetId - UUID of the source dataset
-->
<template>
  <div class="h-full flex flex-col items-center justify-center p-4 relative overflow-hidden" :class="accentBg">
    <!-- Decorative circle -->
    <div class="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-10" :class="accentCircle" />

    <div v-if="loading" class="text-gray-400 text-sm">Loading...</div>

    <div v-else-if="!datasetId || !config?.valueColumn" class="text-center text-gray-400 text-sm">
      <svg class="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      Configure KPI
    </div>

    <template v-else>
      <!-- Value display -->
      <div class="text-4xl font-bold tracking-tight" :class="accentText">
        {{ formattedValue }}
        <span v-if="config.unit" class="text-lg font-normal ml-1 opacity-70">{{ config.unit }}</span>
      </div>

      <!-- Aggregation label -->
      <div class="text-xs font-medium uppercase tracking-widest mt-1 opacity-60" :class="accentText">
        {{ aggregationLabel }}
      </div>

      <!-- Column name -->
      <div class="text-sm font-medium mt-3 text-center opacity-80" :class="accentText">
        {{ config.valueColumn }}
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { KPIConfig } from '@etl-dashboard/shared';

const props = defineProps<{
  config: KPIConfig | null;
  datasetId: string | null;
}>();

const { $api } = useApi();

const rawValue = ref<number | null>(null);
const loading = ref(false);

/** Color scheme maps */
const colorMap = {
  blue:   { bg: 'bg-blue-50 dark:bg-blue-950/30',   text: 'text-blue-700 dark:text-blue-300',   circle: 'bg-blue-400' },
  green:  { bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-300', circle: 'bg-green-400' },
  red:    { bg: 'bg-red-50 dark:bg-red-950/30',     text: 'text-red-700 dark:text-red-300',     circle: 'bg-red-400' },
  yellow: { bg: 'bg-yellow-50 dark:bg-yellow-950/30', text: 'text-yellow-700 dark:text-yellow-300', circle: 'bg-yellow-400' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-700 dark:text-purple-300', circle: 'bg-purple-400' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-300', circle: 'bg-orange-400' },
};

const color = computed(() => props.config?.color || 'blue');
const accentBg = computed(() => colorMap[color.value]?.bg ?? colorMap.blue.bg);
const accentText = computed(() => colorMap[color.value]?.text ?? colorMap.blue.text);
const accentCircle = computed(() => colorMap[color.value]?.circle ?? colorMap.blue.circle);

/** Human-readable aggregation label. */
const aggregationLabel = computed(() => {
  const map: Record<string, string> = {
    sum: 'Total', avg: 'Average', count: 'Count', min: 'Minimum', max: 'Maximum',
  };
  return map[props.config?.aggregation ?? 'sum'] ?? 'Value';
});

/** Format number with locale and decimals. */
const formattedValue = computed(() => {
  if (rawValue.value === null) return '—';
  const decimals = props.config?.decimals ?? 0;
  return rawValue.value.toLocaleString('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
});

/**
 * Load and aggregate data from the dataset.
 * Fetches all rows (max 5000) and applies the aggregation client-side.
 */
async function loadData() {
  if (!props.datasetId || !props.config?.valueColumn) return;

  loading.value = true;
  rawValue.value = null;

  try {
    const res = await $api<{ data: { data: Record<string, unknown>[]; total: number } }>('/data/query', {
      method: 'POST',
      body: {
        datasetId: props.datasetId,
        columns: [props.config.valueColumn],
        limit: 5000,
        offset: 0,
      },
    });

    const rows = res.data?.data ?? [];
    const col = props.config.valueColumn;
    const nums = rows
      .map((r) => Number(r[col]))
      .filter((n) => !isNaN(n));

    if (nums.length === 0) {
      rawValue.value = 0;
      return;
    }

    switch (props.config.aggregation) {
      case 'sum':   rawValue.value = nums.reduce((a, b) => a + b, 0); break;
      case 'avg':   rawValue.value = nums.reduce((a, b) => a + b, 0) / nums.length; break;
      case 'count': rawValue.value = nums.length; break;
      case 'min':   rawValue.value = Math.min(...nums); break;
      case 'max':   rawValue.value = Math.max(...nums); break;
      default:      rawValue.value = nums.reduce((a, b) => a + b, 0);
    }
  } catch (e) {
    console.error('WidgetKPI load failed', e);
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.datasetId, props.config?.valueColumn, props.config?.aggregation],
  loadData,
  { immediate: true },
);
</script>
