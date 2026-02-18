<template>
  <div
    class="h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
    :class="{ 'ring-2 ring-blue-500': isSelected }"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 shrink-0">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
        {{ component?.title || component?.type || 'Widget' }}
      </span>
      <div v-if="editable" class="flex items-center gap-1">
        <button
          @click.stop="$emit('select')"
          class="text-gray-400 hover:text-blue-600 p-1"
          title="Configure"
        >
          &#9881;
        </button>
        <button
          @click.stop="$emit('remove')"
          class="text-gray-400 hover:text-red-600 p-1"
          title="Remove"
        >
          &times;
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 min-h-0 overflow-auto p-2">
      <WidgetTable
        v-if="component?.type === 'table'"
        :config="component.config"
        :dataset-id="component.datasetId"
        :global-filter="globalFilter"
      />
      <WidgetChart
        v-else-if="component?.type === 'chart'"
        :config="component.config"
        :dataset-id="component.datasetId"
        :global-filter="globalFilter"
      />
      <WidgetMap
        v-else-if="component?.type === 'map'"
        :config="component.config"
        :dataset-id="component.datasetId"
      />
      <WidgetTimeline
        v-else-if="component?.type === 'timeline'"
        :config="component.config"
        :dataset-id="component.datasetId"
        :global-filter="globalFilter"
      />
      <WidgetKPI
        v-else-if="component?.type === 'kpi'"
        :config="component.config"
        :dataset-id="component.datasetId"
        :global-filter="globalFilter"
      />
      <div v-else class="flex items-center justify-center h-full text-gray-400 text-sm">
        Configure this widget
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DashboardFilter } from '~/components/dashboard/GlobalFilter.vue';

const props = defineProps<{
  component: any;
  editable: boolean;
  globalFilter?: DashboardFilter | null;
}>();

defineEmits<{
  select: [];
  remove: [];
}>();

const editorStore = useEditorStore();
const isSelected = computed(() => editorStore.selectedComponentId === props.component?.id);
</script>
