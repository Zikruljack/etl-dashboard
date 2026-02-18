<template>
  <div class="h-full w-full" style="min-height: 0">
    <div v-if="loading" class="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>
    <div v-else-if="error" class="flex items-center justify-center h-full text-red-500 text-sm">
      <svg class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {{ error }}
    </div>
    <div v-else-if="!datasetId" class="flex items-center justify-center h-full text-gray-400 text-sm">
      Select a dataset
    </div>
    <div
      v-else-if="!config?.useChangeHistory && (!config?.dateColumn || !config?.valueColumns?.length)"
      class="flex items-center justify-center h-full text-gray-400 text-sm"
    >
      Configure date column and at least one value column
    </div>
    <div v-else-if="!echartsReady" class="flex items-center justify-center h-full text-gray-400 text-sm">
      Initializing chart...
    </div>
    <client-only v-else>
      <component
        v-if="VChartComponent"
        :is="VChartComponent"
        :option="chartOption"
        autoresize
        style="width: 100%; height: 100%; min-height: 120px"
      />
    </client-only>
  </div>
</template>

<script setup lang="ts">
/**
 * Timeline widget — renders a time-series chart using ECharts.
 *
 * Two modes controlled by config.useChangeHistory:
 * - false (default): smooth line chart from dataset rows (dateColumn + valueColumns).
 * - true: stacked bar chart of rows added/changed/deleted per time period,
 *   fetched from /datasets/:id/changes API.
 */
import type { DashboardFilter } from '~/components/dashboard/GlobalFilter.vue';

const VChartComponent = shallowRef<any>(null);
const echartsReady = ref(false);

/** Lazy-load ECharts on the client only (avoids SSR browser-API issues). */
onMounted(async () => {
  const [{ use }, { CanvasRenderer }, charts, components, vueEcharts] = await Promise.all([
    import('echarts/core'),
    import('echarts/renderers'),
    import('echarts/charts'),
    import('echarts/components'),
    import('vue-echarts'),
  ]);

  use([
    CanvasRenderer,
    charts.BarChart,
    charts.LineChart,
    components.TitleComponent,
    components.TooltipComponent,
    components.LegendComponent,
    components.GridComponent,
    components.DataZoomComponent,
  ]);

  VChartComponent.value = vueEcharts.default;
  echartsReady.value = true;
});

const props = defineProps<{
  config: any;
  datasetId: string | null;
  globalFilter?: DashboardFilter | null;
}>();

const { $api } = useApi();
const apiFilters = useWidgetFilter(computed(() => props.config), computed(() => props.globalFilter));

/** Dataset rows — used in rows mode. */
const data = ref<Record<string, unknown>[]>([]);
/** Change records — used in change-history mode. */
const changes = ref<any[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

watch(
  () => ({
    datasetId: props.datasetId,
    useChangeHistory: props.config?.useChangeHistory,
    changeGroupBy: props.config?.changeGroupBy,
    dateColumn: props.config?.dateColumn,
    valueColumns: props.config?.valueColumns?.join(','),
    apiFilters: apiFilters.value,
  }),
  () => loadData(),
  { immediate: true },
);

async function loadData() {
  if (!props.datasetId) return;
  const useChangeHistory = !!props.config?.useChangeHistory;

  if (!useChangeHistory) {
    const valueCols: string[] = props.config?.valueColumns || [];
    if (!props.config?.dateColumn || !valueCols.length) return;
  }

  loading.value = true;
  error.value = null;

  try {
    if (useChangeHistory) {
      const res = await $api<any>(`/datasets/${props.datasetId}/changes?pageSize=2000`);
      changes.value = res.data || [];
      data.value = [];
    } else {
      const valueCols: string[] = props.config?.valueColumns || [];
      const res = await $api<any>('/data/query', {
        method: 'POST',
        body: {
          datasetId: props.datasetId,
          columns: [props.config.dateColumn, ...valueCols],
          filters: apiFilters.value.length > 0 ? apiFilters.value : undefined,
          limit: 2000,
        },
      });
      data.value = res.data.data;
      changes.value = [];
    }
  } catch (e) {
    error.value = 'Failed to load timeline data';
    console.error('Widget timeline load failed', e);
  } finally {
    loading.value = false;
  }
}

/** Palette for multi-series lines. */
const COLORS = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

/**
 * Truncate an ISO timestamp to a grouping key.
 *
 * @param isoDate - ISO date string (changedAt field)
 * @param groupBy - Grouping resolution: 'day' | 'week' | 'month'
 * @returns Date key string (YYYY-MM-DD for day/week, YYYY-MM for month)
 */
function dateGroupKey(isoDate: string, groupBy: string): string {
  const d = new Date(isoDate);
  if (groupBy === 'month') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  if (groupBy === 'week') {
    // Find Monday of the ISO week
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    return monday.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Group change records by time period, counting distinct row keys per change type.
 *
 * @param changeList - Raw DatasetChange records from the API
 * @param groupBy - Grouping period: 'day' | 'week' | 'month'
 * @returns Sorted x-axis labels and per-series count arrays
 */
function buildChangeGroups(changeList: any[], groupBy: string) {
  const groups = new Map<string, { added: Set<string>; changed: Set<string>; deleted: Set<string> }>();

  for (const ch of changeList) {
    const key = dateGroupKey(ch.changedAt, groupBy);
    if (!groups.has(key)) {
      groups.set(key, { added: new Set(), changed: new Set(), deleted: new Set() });
    }
    const g = groups.get(key)!;
    if (ch.changeType === 'new') g.added.add(ch.rowKey);
    else if (ch.changeType === 'changed') g.changed.add(ch.rowKey);
    else if (ch.changeType === 'deleted') g.deleted.add(ch.rowKey);
  }

  const xData = Array.from(groups.keys()).sort();
  return {
    xData,
    added: xData.map((k) => groups.get(k)!.added.size),
    changed: xData.map((k) => groups.get(k)!.changed.size),
    deleted: xData.map((k) => groups.get(k)!.deleted.size),
  };
}

/**
 * Build ECharts option for the active mode.
 * - Change-history mode: stacked bar chart (added=green, changed=amber, deleted=red).
 * - Rows mode: smooth area line chart (one line per valueColumn).
 */
const chartOption = computed(() => {
  if (props.config?.useChangeHistory) {
    if (!changes.value.length) return {};
    const groupBy: string = props.config?.changeGroupBy || 'day';
    const { xData, added, changed, deleted } = buildChangeGroups(changes.value, groupBy);

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 4, type: 'scroll', textStyle: { fontSize: 11 } },
      grid: { left: '8%', right: '4%', bottom: xData.length > 10 ? '18%' : '12%', top: '14%' },
      xAxis: {
        type: 'category',
        data: xData,
        axisLabel: { rotate: xData.length > 10 ? 45 : 0, fontSize: 10 },
      },
      yAxis: { type: 'value', name: 'Rows', splitLine: { lineStyle: { color: '#F1F5F9' } } },
      dataZoom: xData.length > 20
        ? [{ type: 'inside', start: 0, end: 100 }, { start: 0, end: 100, height: 18, bottom: 4 }]
        : undefined,
      series: [
        { name: 'Added', type: 'bar', stack: 'total', data: added, itemStyle: { color: '#10B981' } },
        { name: 'Changed', type: 'bar', stack: 'total', data: changed, itemStyle: { color: '#F59E0B' } },
        { name: 'Deleted', type: 'bar', stack: 'total', data: deleted, itemStyle: { color: '#EF4444' } },
      ],
    };
  }

  // Dataset rows mode — multi-series line chart
  const dateCol: string = props.config?.dateColumn;
  const valueCols: string[] = props.config?.valueColumns || [];
  if (!dateCol || !valueCols.length || !data.value.length) return {};

  const xData = data.value.map((row) => String(row[dateCol] ?? ''));
  const showLegend = valueCols.length > 1;

  const series = valueCols.map((col, i) => ({
    name: col,
    type: 'line' as const,
    smooth: true,
    symbolSize: 4,
    data: data.value.map((row) => Number(row[col]) || 0),
    areaStyle: { opacity: 0.12 },
    lineStyle: { width: 2 },
    itemStyle: { color: COLORS[i % COLORS.length] },
    color: COLORS[i % COLORS.length],
  }));

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', crossStyle: { color: '#94A3B8' } },
    },
    legend: showLegend ? { top: 4, type: 'scroll', textStyle: { fontSize: 11 } } : undefined,
    grid: {
      left: '8%',
      right: '4%',
      bottom: xData.length > 20 ? '18%' : '12%',
      top: showLegend ? '14%' : '8%',
    },
    xAxis: {
      type: 'category',
      data: xData,
      boundaryGap: false,
      axisLabel: {
        rotate: xData.length > 15 ? 45 : 0,
        fontSize: 10,
        interval: xData.length > 60 ? Math.floor(xData.length / 30) : 'auto',
      },
      axisLine: { lineStyle: { color: '#E2E8F0' } },
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#F1F5F9' } } },
    dataZoom: xData.length > 30
      ? [{ type: 'inside', start: 0, end: 100 }, { start: 0, end: 100, height: 18, bottom: 4 }]
      : undefined,
    series,
  };
});
</script>
