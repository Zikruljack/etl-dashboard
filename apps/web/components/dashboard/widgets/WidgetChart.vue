<template>
  <div class="h-full w-full" style="min-height: 0;">
    <div v-if="loading" class="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>
    <div v-else-if="!datasetId" class="flex items-center justify-center h-full text-gray-400 text-sm">
      Select a dataset
    </div>
    <div v-else-if="!config?.xAxis || !config?.yAxis" class="flex items-center justify-center h-full text-gray-400 text-sm">
      Configure X and Y axis
    </div>
    <div v-else-if="!echartsReady" class="flex items-center justify-center h-full text-gray-400 text-sm">
      Initializing chart...
    </div>
    <client-only v-else>
      <component v-if="VChartComponent" :is="VChartComponent" :option="chartOption" autoresize style="width: 100%; height: 100%; min-height: 120px;" />
    </client-only>
  </div>
</template>

<script setup lang="ts">
/**
 * Chart widget for dashboard — renders bar, line, or pie charts via ECharts.
 * Loads echarts components only on the client side to avoid SSR issues.
 */

const VChartComponent = shallowRef<any>(null);
const echartsReady = ref(false);

/**
 * Initialize echarts on the client side only.
 * CanvasRenderer and chart types require browser APIs unavailable during SSR.
 */
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
    charts.PieChart,
    components.TitleComponent,
    components.TooltipComponent,
    components.LegendComponent,
    components.GridComponent,
  ]);

  VChartComponent.value = vueEcharts.default;
  echartsReady.value = true;
});

const props = defineProps<{
  config: any;
  datasetId: string | null;
}>();

const { $api } = useApi();

const data = ref<Record<string, unknown>[]>([]);
const loading = ref(false);

watch(() => [props.datasetId, props.config?.xAxis, props.config?.yAxis], () => loadData(), { immediate: true });

async function loadData() {
  if (!props.datasetId || !props.config?.xAxis || !props.config?.yAxis) return;
  loading.value = true;
  try {
    const res = await $api<any>('/data/query', {
      method: 'POST',
      body: {
        datasetId: props.datasetId,
        columns: [props.config.xAxis, props.config.yAxis],
        limit: 1000,
      },
    });
    data.value = res.data.data;
  } catch (e) {
    console.error('Widget chart load failed', e);
  } finally {
    loading.value = false;
  }
}

const chartOption = computed(() => {
  const xData = data.value.map((d) => String(d[props.config.xAxis] ?? ''));
  const yData = data.value.map((d) => Number(d[props.config.yAxis]) || 0);
  const chartType = props.config.chartType || 'bar';

  if (chartType === 'pie') {
    return {
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: '60%',
        data: xData.map((name, i) => ({ name, value: yData[i] })),
      }],
    };
  }

  return {
    tooltip: { trigger: 'axis' },
    grid: { left: '10%', right: '5%', bottom: '15%', top: '10%' },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: { rotate: xData.length > 10 ? 45 : 0, fontSize: 10 },
    },
    yAxis: { type: 'value' },
    series: [{
      type: chartType,
      data: yData,
      smooth: chartType === 'line',
    }],
  };
});
</script>
