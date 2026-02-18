<script setup lang="ts">
import type { StepType, StepConfig } from '@etl-dashboard/shared';
import type { DraftStep } from '~/composables/usePipeline';

/**
 * StepConfig — Config form for a single pipeline step.
 * Renders different form fields based on step.type.
 */
const props = defineProps<{
  step: DraftStep;
  /** Available columns in the dataset at this point in the pipeline. */
  columns: string[];
}>();

const emit = defineEmits<{
  (e: 'update', config: Partial<StepConfig>): void;
}>();

/** Local mutable copy of config to drive form fields. */
const local = ref<Record<string, unknown>>({ ...props.step.config });

watch(() => props.step.config, (val) => {
  local.value = { ...val };
});

function update(key: string, value: unknown) {
  local.value[key] = value;
  emit('update', { type: props.step.type, ...local.value } as Partial<StepConfig>);
}

/** For map_values: parse the mapping from textarea lines "old → new". */
const mappingText = computed({
  get() {
    const m = local.value.mapping as Record<string, string> | undefined;
    if (!m) return '';
    return Object.entries(m).map(([k, v]) => `${k} → ${v}`).join('\n');
  },
  set(text: string) {
    const mapping: Record<string, string> = {};
    for (const line of text.split('\n')) {
      const parts = line.split('→');
      if (parts.length === 2) {
        const k = parts[0].trim();
        const v = parts[1].trim();
        if (k) mapping[k] = v;
      }
    }
    update('mapping', mapping);
  },
});

/** For split_column: parse new column names from comma-separated input. */
const newColumnsText = computed({
  get() {
    return ((local.value.newColumns as string[] | undefined) ?? []).join(', ');
  },
  set(text: string) {
    update('newColumns', text.split(',').map((s) => s.trim()).filter(Boolean));
  },
});

/** For merge_columns: selected columns list (multi-select). */
const mergeColumnsSelected = computed({
  get() {
    return (local.value.columns as string[] | undefined) ?? [];
  },
  set(val: string[]) {
    update('columns', val);
  },
});

/** For trim: selected columns list. */
const trimColumnsSelected = computed({
  get() {
    return (local.value.columns as string[] | undefined) ?? [];
  },
  set(val: string[]) {
    update('columns', val);
  },
});

/** For remove_duplicates: selected columns list. */
const dedupColumnsSelected = computed({
  get() {
    return (local.value.columns as string[] | undefined) ?? [];
  },
  set(val: string[]) {
    update('columns', val);
  },
});

const filterOperators = [
  { value: '=', label: 'equals' },
  { value: '!=', label: 'not equals' },
  { value: '>', label: 'greater than' },
  { value: '>=', label: 'greater or equal' },
  { value: '<', label: 'less than' },
  { value: '<=', label: 'less or equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
];

const fillStrategies = [
  { value: 'forward_fill', label: 'Forward Fill (carry last value down)' },
  { value: 'backward_fill', label: 'Backward Fill (carry next value up)' },
  { value: 'constant', label: 'Constant Value' },
  { value: 'mean', label: 'Mean (average of column)' },
  { value: 'median', label: 'Median (middle value of column)' },
];

const targetTypes = [
  { value: 'text', label: 'Text (string)' },
  { value: 'number', label: 'Number (numeric)' },
  { value: 'date', label: 'Date (YYYY-MM-DD)' },
  { value: 'boolean', label: 'Boolean (true/false)' },
];

function getFilterCondition(): Record<string, unknown> {
  return (local.value.condition as Record<string, unknown>) ?? {};
}

function updateCondition(key: string, value: unknown) {
  const cond = { ...getFilterCondition(), [key]: value };
  update('condition', cond);
}

const needsValue = computed(() => {
  const op = (getFilterCondition().operator as string) ?? '';
  return !['is_empty', 'is_not_empty'].includes(op);
});
</script>

<template>
  <div class="px-4 pb-4 pt-2 space-y-3 border-t border-gray-100 dark:border-gray-700">

    <!-- RENAME -->
    <template v-if="step.type === 'rename'">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Column to rename</label>
          <select
            :value="local.column"
            class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
            @change="update('column', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">— select column —</option>
            <option v-for="col in columns" :key="col" :value="col">{{ col }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">New name</label>
          <input
            type="text"
            :value="local.newName"
            placeholder="New column name"
            class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
            @input="update('newName', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </template>

    <!-- CHANGE TYPE -->
    <template v-else-if="step.type === 'change_type'">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Column</label>
          <select
            :value="local.column"
            class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
            @change="update('column', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">— select column —</option>
            <option v-for="col in columns" :key="col" :value="col">{{ col }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Target type</label>
          <select
            :value="local.targetType"
            class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
            @change="update('targetType', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="t in targetTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </div>
      </div>
      <div v-if="local.targetType === 'date'">
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date format (optional)</label>
        <input
          type="text"
          :value="local.dateFormat"
          placeholder="e.g. DD/MM/YYYY"
          class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
          @input="update('dateFormat', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </template>

    <!-- TRIM -->
    <template v-else-if="step.type === 'trim'">
      <div>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Columns to trim (empty = all)</label>
        <div class="flex flex-wrap gap-2">
          <label v-for="col in columns" :key="col" class="flex items-center gap-1 text-sm cursor-pointer">
            <input
              type="checkbox"
              :value="col"
              :checked="trimColumnsSelected.includes(col)"
              @change="(e) => {
                const checked = (e.target as HTMLInputElement).checked;
                const next = checked
                  ? [...trimColumnsSelected, col]
                  : trimColumnsSelected.filter(c => c !== col);
                trimColumnsSelected = next;
              }"
            />
            {{ col }}
          </label>
        </div>
      </div>
    </template>

    <!-- MAP VALUES -->
    <template v-else-if="step.type === 'map_values'">
      <div>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Column</label>
        <select
          :value="local.column"
          class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
          @change="update('column', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">— select column —</option>
          <option v-for="col in columns" :key="col" :value="col">{{ col }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Mapping (one per line: old → new)</label>
        <textarea
          v-model="mappingText"
          rows="5"
          placeholder="L → Laki-laki&#10;P → Perempuan"
          class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 font-mono"
        />
      </div>
      <div class="flex items-center gap-2">
        <input
          type="checkbox"
          :checked="local.keepUnmapped !== false"
          @change="update('keepUnmapped', ($event.target as HTMLInputElement).checked)"
        />
        <label class="text-sm text-gray-600 dark:text-gray-400">Keep unmapped values unchanged</label>
      </div>
    </template>

    <!-- REMOVE DUPLICATES -->
    <template v-else-if="step.type === 'remove_duplicates'">
      <div>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Key columns (empty = all)</label>
        <div class="flex flex-wrap gap-2">
          <label v-for="col in columns" :key="col" class="flex items-center gap-1 text-sm cursor-pointer">
            <input
              type="checkbox"
              :value="col"
              :checked="dedupColumnsSelected.includes(col)"
              @change="(e) => {
                const checked = (e.target as HTMLInputElement).checked;
                const next = checked
                  ? [...dedupColumnsSelected, col]
                  : dedupColumnsSelected.filter(c => c !== col);
                dedupColumnsSelected = next;
              }"
            />
            {{ col }}
          </label>
        </div>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Keep</label>
        <select
          :value="local.keep ?? 'first'"
          class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
          @change="update('keep', ($event.target as HTMLSelectElement).value)"
        >
          <option value="first">First occurrence</option>
          <option value="last">Last occurrence</option>
        </select>
      </div>
    </template>

    <!-- FILL MISSING -->
    <template v-else-if="step.type === 'fill_missing'">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Column</label>
          <select
            :value="local.column"
            class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
            @change="update('column', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">— select column —</option>
            <option v-for="col in columns" :key="col" :value="col">{{ col }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Strategy</label>
          <select
            :value="local.strategy"
            class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
            @change="update('strategy', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="s in fillStrategies" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </div>
      </div>
      <div v-if="local.strategy === 'constant'">
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Constant value</label>
        <input
          type="text"
          :value="local.constantValue"
          placeholder="e.g. N/A or 0"
          class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
          @input="update('constantValue', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </template>

    <!-- FIND REPLACE -->
    <template v-else-if="step.type === 'find_replace'">
      <div>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Column</label>
        <select
          :value="local.column"
          class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
          @change="update('column', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">— select column —</option>
          <option v-for="col in columns" :key="col" :value="col">{{ col }}</option>
        </select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Find</label>
          <input
            type="text"
            :value="local.find"
            placeholder="Text to find"
            class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
            @input="update('find', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Replace with</label>
          <input
            type="text"
            :value="local.replace"
            placeholder="Replacement text"
            class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
            @input="update('replace', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
      <div class="flex gap-4">
        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          <input type="checkbox" :checked="!!local.useRegex" @change="update('useRegex', ($event.target as HTMLInputElement).checked)" />
          Use regex
        </label>
        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          <input type="checkbox" :checked="local.replaceAll !== false" @change="update('replaceAll', ($event.target as HTMLInputElement).checked)" />
          Replace all occurrences
        </label>
      </div>
    </template>

    <!-- FILTER ROWS -->
    <template v-else-if="step.type === 'filter_rows'">
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Column</label>
          <select
            :value="getFilterCondition().column"
            class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
            @change="updateCondition('column', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">— select —</option>
            <option v-for="col in columns" :key="col" :value="col">{{ col }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Operator</label>
          <select
            :value="getFilterCondition().operator"
            class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
            @change="updateCondition('operator', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="op in filterOperators" :key="op.value" :value="op.value">{{ op.label }}</option>
          </select>
        </div>
        <div v-if="needsValue">
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Value</label>
          <input
            type="text"
            :value="getFilterCondition().value as string"
            placeholder="Compare value"
            class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
            @input="updateCondition('value', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
    </template>

    <!-- SPLIT COLUMN -->
    <template v-else-if="step.type === 'split_column'">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Column to split</label>
          <select
            :value="local.column"
            class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
            @change="update('column', ($event.target as HTMLSelectElement).value)"
          >
            <option value="">— select column —</option>
            <option v-for="col in columns" :key="col" :value="col">{{ col }}</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Separator</label>
          <input
            type="text"
            :value="local.separator"
            placeholder=", or ; or space"
            class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
            @input="update('separator', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">New column names (comma-separated)</label>
        <input
          type="text"
          v-model="newColumnsText"
          placeholder="City, Province"
          class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
        />
      </div>
      <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
        <input type="checkbox" :checked="local.dropOriginal !== false" @change="update('dropOriginal', ($event.target as HTMLInputElement).checked)" />
        Remove original column
      </label>
    </template>

    <!-- MERGE COLUMNS -->
    <template v-else-if="step.type === 'merge_columns'">
      <div>
        <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Columns to merge (select 2+)</label>
        <div class="flex flex-wrap gap-2">
          <label v-for="col in columns" :key="col" class="flex items-center gap-1 text-sm cursor-pointer">
            <input
              type="checkbox"
              :value="col"
              :checked="mergeColumnsSelected.includes(col)"
              @change="(e) => {
                const checked = (e.target as HTMLInputElement).checked;
                const next = checked
                  ? [...mergeColumnsSelected, col]
                  : mergeColumnsSelected.filter(c => c !== col);
                mergeColumnsSelected = next;
              }"
            />
            {{ col }}
          </label>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Separator</label>
          <input
            type="text"
            :value="local.separator"
            placeholder="e.g. ', ' or ' '"
            class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
            @input="update('separator', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">New column name</label>
          <input
            type="text"
            :value="local.newColumn"
            placeholder="e.g. Full Location"
            class="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700"
            @input="update('newColumn', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
      <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
        <input type="checkbox" :checked="local.dropOriginals !== false" @change="update('dropOriginals', ($event.target as HTMLInputElement).checked)" />
        Remove source columns
      </label>
    </template>

    <!-- Unknown type fallback -->
    <template v-else>
      <p class="text-xs text-gray-400 italic">No config form for step type: {{ step.type }}</p>
    </template>
  </div>
</template>
