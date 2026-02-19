<script setup lang="ts">
import type { StepType, StepConfig } from '@etl-dashboard/shared';

/**
 * PipelineEditor — Full pipeline editing UI.
 * Shows step list, add step menu, config forms, and preview.
 *
 * Props:
 * - datasetId: UUID of the dataset this pipeline belongs to
 * - sampleRows: sample data rows for preview (first 100 rows from dataset)
 * - columns: current column names (from dataset extraction)
 */
const props = defineProps<{
  datasetId: string;
  sampleRows?: Record<string, unknown>[];
  columns?: string[];
}>();

const emit = defineEmits<{
  (e: 'saved'): void;
}>();

const datasetIdRef = toRef(props, 'datasetId');

const {
  pipeline,
  steps,
  availableStepTypes,
  loading,
  saving,
  previewing,
  error,
  preview,
  isDirty,
  loadPipeline,
  loadStepTypes,
  addStep,
  removeStep,
  moveUp,
  moveDown,
  updateStepConfig,
  savePipeline,
  runPreview,
} = usePipeline(datasetIdRef);

onMounted(async () => {
  await Promise.all([loadPipeline(), loadStepTypes()]);
});

// ─── Add step menu ─────────────────────────────────────────────────────────
const showAddMenu = ref(false);

const STEP_TYPE_OPTIONS: { type: StepType; label: string; icon: string }[] = [
  { type: 'rename', label: 'Rename Column', icon: '✏️' },
  { type: 'change_type', label: 'Change Type', icon: '🔄' },
  { type: 'trim', label: 'Trim Whitespace', icon: '✂️' },
  { type: 'map_values', label: 'Map Values', icon: '🗺️' },
  { type: 'remove_duplicates', label: 'Remove Duplicates', icon: '🗑️' },
  { type: 'fill_missing', label: 'Fill Missing', icon: '📥' },
  { type: 'find_replace', label: 'Find & Replace', icon: '🔍' },
  { type: 'filter_rows', label: 'Filter Rows', icon: '🔽' },
  { type: 'split_column', label: 'Split Column', icon: '↔️' },
  { type: 'merge_columns', label: 'Merge Columns', icon: '🔗' },
];

function handleAddStep(type: StepType) {
  addStep(type);
  showAddMenu.value = false;
  expandedIdx.value = steps.value.length - 1;
}

// ─── Expand / collapse step cards ─────────────────────────────────────────
const expandedIdx = ref<number | null>(null);

function toggleExpand(idx: number) {
  expandedIdx.value = expandedIdx.value === idx ? null : idx;
}

// ─── Save ─────────────────────────────────────────────────────────────────
const pipelineName = ref('Default Pipeline');
const pipelineActive = ref(true);

watch(pipeline, (p) => {
  if (p) {
    pipelineName.value = p.name;
    pipelineActive.value = p.isActive;
  }
});

async function handleSave() {
  await savePipeline(pipelineName.value, pipelineActive.value);
  emit('saved');
}

// ─── Preview ──────────────────────────────────────────────────────────────
async function handlePreview() {
  const rows = props.sampleRows ?? [];
  if (rows.length === 0) return;
  await runPreview(rows);
}

// ─── Derived columns for config forms ─────────────────────────────────────
const effectiveColumns = computed(() => props.columns ?? []);
</script>

<template>
  <div class="space-y-4">
    <!-- Toolbar -->
    <div class="flex items-center gap-3 flex-wrap">
      <div class="flex-1 min-w-0">
        <input
          v-model="pipelineName"
          type="text"
          class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 bg-white dark:bg-gray-800 font-medium"
          placeholder="Pipeline name"
          @input="isDirty = true"
        />
      </div>

      <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
        <input v-model="pipelineActive" type="checkbox" class="rounded" />
        Active
      </label>

      <button
        :disabled="!sampleRows?.length || previewing"
        class="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
        @click="handlePreview"
      >
        {{ previewing ? 'Running...' : 'Run Preview' }}
      </button>

      <button
        :disabled="saving"
        class="px-4 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        :class="{ 'ring-2 ring-blue-300': isDirty }"
        @click="handleSave"
      >
        {{ saving ? 'Saving...' : isDirty ? 'Save *' : 'Save' }}
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-3 py-2">
      {{ error }}
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-2">
      <div v-for="i in 3" :key="i" class="h-14 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
    </div>

    <!-- Empty state -->
    <div v-else-if="steps.length === 0" class="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
      <p class="text-sm text-gray-400 dark:text-gray-500 mb-3">No steps yet. Add a step to start cleaning your data.</p>
    </div>

    <!-- Step list -->
    <div v-else class="space-y-2">
      <div v-for="(step, idx) in steps" :key="step._clientId">
        <StepCard
          :step="step"
          :index="idx"
          :total="steps.length"
          :expanded="expandedIdx === idx"
          @expand="toggleExpand(idx)"
          @move-up="moveUp(step._clientId)"
          @move-down="moveDown(step._clientId)"
          @remove="removeStep(step._clientId)"
        />
        <!-- Config form (inline expand) -->
        <div v-if="expandedIdx === idx">
          <StepConfig
            :step="step"
            :columns="effectiveColumns"
            @update="updateStepConfig(step._clientId, $event)"
          />
        </div>
      </div>
    </div>

    <!-- Add step button -->
    <div class="relative">
      <button
        class="w-full py-2 text-sm border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
        @click="showAddMenu = !showAddMenu"
      >
        + Add Step
      </button>

      <!-- Dropdown menu -->
      <div
        v-if="showAddMenu"
        class="absolute z-20 top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto"
      >
        <button
          v-for="opt in STEP_TYPE_OPTIONS"
          :key="opt.type"
          class="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3"
          @click="handleAddStep(opt.type)"
        >
          <span>{{ opt.icon }}</span>
          <span>{{ opt.label }}</span>
        </button>
      </div>
    </div>

    <!-- Preview panel -->
    <StepPreview :preview="preview" :loading="previewing" />
  </div>
</template>
