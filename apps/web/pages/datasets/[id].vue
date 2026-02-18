<template>
  <div>
    <!-- Skeleton loading -->
    <template v-if="loading">
      <div class="mb-6">
        <SkeletonLoader variant="text" :lines="2" />
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SkeletonLoader v-for="n in 4" :key="n" variant="card" height="h-20" />
      </div>
      <SkeletonLoader variant="table" :rows="8" />
    </template>

    <div v-else-if="dataset">
      <!-- Editable Header -->
      <PageHeader
        v-if="!editingMeta"
        :title="dataset.name"
        :description="dataset.description || undefined"
        back-to="/datasets"
      >
        <template #badge>
          <StatusBadge :status="dataset.syncStatus" />
        </template>
        <template #actions>
          <button @click="startEditMeta" class="btn-secondary" title="Edit name & description">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            Edit
          </button>
          <button @click="syncDataset" :disabled="syncing" class="btn-success">
            <svg v-if="syncing" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
            {{ syncing ? 'Syncing...' : 'Sync Now' }}
          </button>
          <button @click="handleDelete" class="btn-danger">
            Delete
          </button>
        </template>
      </PageHeader>

      <!-- Inline Edit Mode for Name & Description -->
      <div v-else class="mb-6">
        <div class="flex items-center gap-2 mb-2">
          <NuxtLink to="/datasets" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
          </NuxtLink>
          <h1 class="text-lg font-semibold text-gray-500 dark:text-gray-400">Edit Dataset</h1>
        </div>
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div>
            <label class="form-label">Dataset Name *</label>
            <input
              v-model="editName"
              type="text"
              class="form-input"
              placeholder="Dataset name"
            />
          </div>
          <div>
            <label class="form-label">Description</label>
            <textarea
              v-model="editDescription"
              rows="2"
              class="form-input"
              placeholder="Optional description"
            ></textarea>
          </div>
          <div class="flex gap-3">
            <button @click="saveMetadata" :disabled="savingMeta || !editName.trim()" class="btn-primary">
              {{ savingMeta ? 'Saving...' : 'Save Changes' }}
            </button>
            <button @click="cancelEditMeta" class="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Info Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Source</p>
          <p class="font-semibold text-gray-900 dark:text-gray-100">
            {{ dataset.sourceType === 'google_sheets' ? 'Google Sheets' : dataset.sourceType }}
          </p>
        </div>
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Columns</p>
          <p class="font-semibold text-gray-900 dark:text-gray-100 text-xl">{{ dataset.columns?.length || 0 }}</p>
        </div>
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Last Synced</p>
          <p class="font-semibold text-gray-900 dark:text-gray-100 text-sm">{{ dataset.lastSyncedAt ? new Date(dataset.lastSyncedAt).toLocaleString() : 'Never' }}</p>
        </div>
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Extraction</p>
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full" :class="dataset.extractionConfig ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'"></span>
            <p class="font-semibold text-gray-900 dark:text-gray-100 text-sm">{{ dataset.extractionConfig ? 'Configured' : 'Not set' }}</p>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav class="flex gap-1">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="switchTab(tab.id)"
            class="px-4 pb-3 pt-1 text-sm font-medium transition-colors border-b-2 whitespace-nowrap"
            :class="activeTab === tab.id
              ? 'text-blue-600 border-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
          >
            {{ tab.label }}
          </button>
        </nav>
      </div>

      <!-- Tab: Data -->
      <div v-if="activeTab === 'data'">
        <div v-if="dataset.columns?.length" class="mb-4">
          <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Columns</h3>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="col in dataset.columns"
              :key="col.name"
              class="inline-flex items-center gap-1.5 text-xs px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
            >
              {{ col.name }}
              <span class="text-blue-500 bg-blue-50 px-1 rounded text-[10px]">{{ col.type }}</span>
            </span>
          </div>
        </div>
        <DatasetPreview :dataset-id="dataset.id" :columns="dataset.columns || []" />
      </div>

      <!-- Tab: Raw -->
      <div v-if="activeTab === 'raw'">
        <LoadingState v-if="rawLoading" message="Loading raw snapshot..." />
        <EmptyState
          v-else-if="!rawSnapshot"
          title="No Raw Snapshot"
          message="No raw data has been fetched yet. Sync the dataset to create a snapshot."
          icon="📸"
        />
        <div v-else>
          <div class="mb-3 flex items-center justify-between">
            <p class="text-sm text-gray-500">
              Snapshot from {{ new Date(rawSnapshot.fetchedAt).toLocaleString() }}
              &mdash; {{ rawSnapshot.totalRows }} rows &times; {{ rawSnapshot.totalCols }} cols
            </p>
          </div>
          <RawPreview
            :data="rawSnapshot.snapshotData"
            :total-rows="rawSnapshot.totalRows"
            :total-cols="rawSnapshot.totalCols"
            :header-rows="extractionConfig?.headerRowIndices || []"
            :skip-rows="extractionConfig?.skipRows || []"
            :data-start-row="extractionConfig?.dataStartRow || 0"
            :data-end-row="extractionConfig?.dataEndRow ?? null"
            show-legend
          />
        </div>
      </div>

      <!-- Tab: Extraction (View + Edit) -->
      <div v-if="activeTab === 'extraction'">
        <EmptyState
          v-if="!extractionConfig && !editingExtraction"
          title="No extraction config"
          message="Extraction config is set during dataset creation."
          icon="⚙️"
        />

        <!-- View Mode -->
        <div v-else-if="!editingExtraction" class="space-y-4">
          <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-semibold text-gray-900 dark:text-gray-100">Extraction Configuration</h3>
              <button @click="startEditExtraction" class="btn-secondary text-sm">
                <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Edit Extraction
              </button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <dt class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Header Rows</dt>
                <dd class="font-medium text-gray-900 dark:text-gray-100">{{ extractionConfig!.headerRowIndices.map((r: number) => r + 1).join(', ') || 'None' }}</dd>
              </div>
              <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <dt class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Header Separator</dt>
                <dd class="font-medium font-mono text-gray-900 dark:text-gray-100">{{ extractionConfig!.headerFlattenSeparator || '_' }}</dd>
              </div>
              <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <dt class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Data Start Row</dt>
                <dd class="font-medium text-gray-900 dark:text-gray-100">{{ extractionConfig!.dataStartRow + 1 }}</dd>
              </div>
              <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <dt class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Data End Row</dt>
                <dd class="font-medium text-gray-900 dark:text-gray-100">{{ extractionConfig!.dataEndRow !== null ? extractionConfig!.dataEndRow + 1 : 'Last' }}</dd>
              </div>
              <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <dt class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Column Range</dt>
                <dd class="font-medium text-gray-900 dark:text-gray-100">{{ extractionConfig!.columnStart }} – {{ extractionConfig!.columnEnd ?? 'end' }}</dd>
              </div>
              <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <dt class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Skipped Rows</dt>
                <dd class="font-medium text-gray-900 dark:text-gray-100">{{ extractionConfig!.skipRows?.length || 0 }} rows</dd>
              </div>
              <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <dt class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Key Columns</dt>
                <dd class="font-medium text-gray-900 dark:text-gray-100">{{ extractionConfig!.keyColumns?.join(', ') || 'None' }}</dd>
              </div>
              <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <dt class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Custom Labels</dt>
                <dd class="font-medium text-gray-900 dark:text-gray-100">{{ Object.keys(extractionConfig!.columnLabels || {}).length }} overrides</dd>
              </div>
            </div>
          </div>
        </div>

        <!-- Edit Mode: ExtractionGrid -->
        <div v-else class="space-y-4">
          <LoadingState v-if="extractionRawLoading" message="Loading raw data for extraction editing..." />
          <template v-else-if="extractionRawData.length > 0">
            <ExtractionGrid
              :data="extractionRawData"
              :total-rows="extractionRawTotalRows"
              :total-cols="extractionRawTotalCols"
              :config="editExtractionConfig!"
              :preview="editExtractionPreview"
              @update:config="editExtractionConfig = $event"
              @request-preview="loadEditPreview"
            />

            <!-- Key Columns Picker -->
            <div v-if="editExtractionPreview" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Key Columns (for change tracking)</label>
              <div class="flex flex-wrap gap-2">
                <label
                  v-for="header in editExtractionPreview.headers"
                  :key="header"
                  class="inline-flex items-center gap-1.5 px-2 py-1 border rounded text-sm cursor-pointer"
                  :class="editExtractionConfig!.keyColumns.includes(header) ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'"
                >
                  <input
                    type="checkbox"
                    :checked="editExtractionConfig!.keyColumns.includes(header)"
                    @change="toggleEditKeyColumn(header)"
                    class="sr-only"
                  />
                  {{ header }}
                </label>
              </div>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Columns that identify unique rows (used during re-sync to detect changes)</p>
            </div>

            <!-- Save / Cancel Buttons -->
            <div class="flex gap-3 items-center">
              <button
                @click="saveExtraction"
                :disabled="savingExtraction || !editExtractionPreview || editExtractionPreview.totalRows === 0"
                class="btn-primary"
              >
                {{ savingExtraction ? 'Re-extracting...' : 'Save & Re-extract' }}
              </button>
              <button @click="cancelEditExtraction" :disabled="savingExtraction" class="btn-secondary">
                Cancel
              </button>
              <p v-if="editExtractionPreview" class="text-sm text-gray-500 dark:text-gray-400 ml-2">
                {{ editExtractionPreview.totalRows }} rows &times; {{ editExtractionPreview.headers.length }} columns will be extracted
              </p>
            </div>
          </template>
          <EmptyState
            v-else
            title="No Raw Snapshot"
            message="Cannot edit extraction without a raw snapshot. Sync the dataset first."
            icon="📸"
          >
            <template #action>
              <button @click="cancelEditExtraction" class="btn-secondary">Go Back</button>
            </template>
          </EmptyState>
        </div>
      </div>

      <!-- Tab: Pipeline -->
      <div v-if="activeTab === 'pipeline'">
        <PipelinePipelineEditor
          :dataset-id="String(route.params.id)"
          :sample-rows="pipelineSampleRows"
          :columns="dataset.columns?.map(c => c.name) ?? []"
          @saved="onPipelineSaved"
        />
      </div>

      <!-- Tab: Changes -->
      <div v-if="activeTab === 'changes'">
        <DatasetChanges :dataset-id="String(route.params.id)" />
      </div>

      <!-- Tab: Syncs -->
      <div v-if="activeTab === 'syncs'">
        <SyncHistory ref="syncHistoryRef" :dataset-id="String(route.params.id)" />
      </div>

      <!-- Tab: Settings (View + Edit) -->
      <div v-if="activeTab === 'settings'">
        <!-- View Mode -->
        <div v-if="!editingSettings" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-gray-900 dark:text-gray-100">Source Configuration</h3>
            <button @click="startEditSettings" class="btn-secondary text-sm">
              <svg class="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              Edit Settings
            </button>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <dt class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Source Type</dt>
              <dd class="font-medium text-gray-900 dark:text-gray-100">{{ dataset.sourceType === 'google_sheets' ? 'Google Sheets' : dataset.sourceType }}</dd>
            </div>
            <template v-if="dataset.sourceType === 'google_sheets'">
              <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <dt class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Spreadsheet ID</dt>
                <dd class="font-medium text-gray-900 dark:text-gray-100 font-mono text-xs break-all">{{ (dataset.sourceConfig as unknown as Record<string, unknown>).spreadsheetId }}</dd>
              </div>
              <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <dt class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Sheet Name</dt>
                <dd class="font-medium text-gray-900 dark:text-gray-100">{{ (dataset.sourceConfig as unknown as Record<string, unknown>).sheetName || 'Default' }}</dd>
              </div>
            </template>
          </div>
        </div>

        <!-- Edit Mode -->
        <div v-else class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-4">Edit Source Configuration</h3>

          <template v-if="dataset.sourceType === 'google_sheets'">
            <div>
              <label class="form-label">Spreadsheet ID</label>
              <input
                v-model="editSpreadsheetId"
                type="text"
                class="form-input"
                placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              />
              <p class="form-hint">From the URL: /spreadsheets/d/<span class="font-medium">{ID}</span>/edit</p>
            </div>
            <div>
              <label class="form-label">Sheet Name (optional)</label>
              <input
                v-model="editSheetName"
                type="text"
                class="form-input"
                placeholder="Sheet1 (default)"
              />
            </div>
          </template>

          <div class="flex gap-3">
            <button @click="saveSettings" :disabled="savingSettings" class="btn-primary">
              {{ savingSettings ? 'Saving...' : 'Save Settings' }}
            </button>
            <button @click="cancelEditSettings" class="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirm dialog -->
    <ConfirmDialog
      :open="confirmState.isOpen.value"
      :title="confirmState.title.value"
      :message="confirmState.message.value"
      :variant="confirmState.variant.value"
      @confirm="confirmState.handleConfirm"
      @cancel="confirmState.handleCancel"
    />
  </div>
</template>

<script setup lang="ts">
import type { ApiResponse, Dataset, ExtractionConfig, ExtractionPreview, RawSnapshot, CellGrid } from '@etl-dashboard/shared';

definePageMeta({ middleware: 'auth' });

const route = useRoute();
const { $api } = useApi();
const confirmState = useConfirm();
const toast = useToast();

// ── Core state ──────────────────────────────────────────────
const syncing = ref(false);
const syncHistoryRef = ref<{ refresh: () => void } | null>(null);
const activeTab = ref<'data' | 'raw' | 'extraction' | 'pipeline' | 'changes' | 'syncs' | 'settings'>('data');

/** Tab definitions */
const tabs = [
  { id: 'data' as const, label: 'Data' },
  { id: 'raw' as const, label: 'Raw Snapshot' },
  { id: 'extraction' as const, label: 'Extraction' },
  { id: 'pipeline' as const, label: 'Pipeline' },
  { id: 'changes' as const, label: 'Changes' },
  { id: 'syncs' as const, label: 'Syncs' },
  { id: 'settings' as const, label: 'Settings' },
];

/** Load dataset metadata */
const { loading, data: dataset, execute: loadDataset } = useLoading(
  () => $api<ApiResponse<Dataset>>(`/datasets/${route.params.id}`).then((r) => r.data),
  { immediate: true },
);

/** Extraction config from dataset */
const extractionConfig = computed(() => {
  return (dataset.value?.extractionConfig as unknown as ExtractionConfig) || null;
});

// ── Raw snapshot (for Raw tab) ──────────────────────────────
const rawSnapshot = ref<RawSnapshot | null>(null);
const rawLoading = ref(false);

// ── Metadata editing ────────────────────────────────────────
const editingMeta = ref(false);
const editName = ref('');
const editDescription = ref('');
const savingMeta = ref(false);

/**
 * Enter metadata edit mode.
 */
function startEditMeta() {
  editName.value = dataset.value?.name || '';
  editDescription.value = dataset.value?.description || '';
  editingMeta.value = true;
}

/**
 * Cancel metadata editing.
 */
function cancelEditMeta() {
  editingMeta.value = false;
}

/**
 * Save updated metadata via PATCH.
 */
async function saveMetadata() {
  if (!editName.value.trim()) return;
  savingMeta.value = true;
  try {
    await $api(`/datasets/${route.params.id}`, {
      method: 'PATCH',
      body: {
        name: editName.value.trim(),
        description: editDescription.value.trim() || undefined,
      },
    });
    await loadDataset();
    editingMeta.value = false;
    toast.success('Dataset updated');
  } catch (e) {
    console.error('Update failed', e);
    toast.error('Failed to update dataset');
  } finally {
    savingMeta.value = false;
  }
}

// ── Extraction editing ──────────────────────────────────────
const editingExtraction = ref(false);
const editExtractionConfig = ref<ExtractionConfig | null>(null);
const editExtractionPreview = ref<ExtractionPreview | null>(null);
const extractionRawData = ref<CellGrid>([]);
const extractionRawTotalRows = ref(0);
const extractionRawTotalCols = ref(0);
const extractionRawLoading = ref(false);
const extractionSnapshotId = ref<string | null>(null);
const savingExtraction = ref(false);

/**
 * Enter extraction edit mode: load raw snapshot and show ExtractionGrid.
 */
async function startEditExtraction() {
  editingExtraction.value = true;
  extractionRawLoading.value = true;

  // Clone current extraction config
  if (extractionConfig.value) {
    editExtractionConfig.value = JSON.parse(JSON.stringify(extractionConfig.value));
  } else {
    editExtractionConfig.value = {
      headerRowIndices: [0],
      headerFlattenSeparator: '_',
      dataStartRow: 1,
      dataEndRow: null,
      columnStart: 0,
      columnEnd: null,
      excludeColumns: [],
      skipRows: [],
      keyColumns: [],
      columnLabels: {},
    };
  }

  try {
    // Load raw snapshot if not already loaded
    if (!rawSnapshot.value) {
      const res = await $api<ApiResponse<RawSnapshot | null>>(`/datasets/${route.params.id}/raw`);
      rawSnapshot.value = res.data;
    }

    if (rawSnapshot.value) {
      extractionRawData.value = rawSnapshot.value.snapshotData;
      extractionRawTotalRows.value = rawSnapshot.value.totalRows;
      extractionRawTotalCols.value = rawSnapshot.value.totalCols;
      extractionSnapshotId.value = rawSnapshot.value.id;

      // Load initial preview
      await loadEditPreview();
    }
  } catch (e) {
    console.error('Failed to load raw data for extraction editing', e);
    toast.error('Failed to load raw data');
  } finally {
    extractionRawLoading.value = false;
  }
}

/**
 * Load extraction preview with the current edit config.
 */
async function loadEditPreview() {
  if (!extractionSnapshotId.value || !editExtractionConfig.value) return;
  console.log('[loadEditPreview] config.excludeColumns:', editExtractionConfig.value.excludeColumns);
  try {
    const res = await $api<ApiResponse<ExtractionPreview>>('/sources/extract-preview', {
      method: 'POST',
      body: {
        snapshotId: extractionSnapshotId.value,
        config: editExtractionConfig.value,
      },
    });
    console.log('[loadEditPreview] Received preview headers:', res.data.headers);
    editExtractionPreview.value = res.data;
  } catch (e) {
    console.error('Failed to generate preview', e);
  }
}

/**
 * Toggle a key column in the edit extraction config.
 */
function toggleEditKeyColumn(column: string) {
  if (!editExtractionConfig.value) return;
  const idx = editExtractionConfig.value.keyColumns.indexOf(column);
  if (idx >= 0) {
    editExtractionConfig.value.keyColumns.splice(idx, 1);
  } else {
    editExtractionConfig.value.keyColumns.push(column);
  }
}

/**
 * Save the new extraction config: re-extract data from snapshot.
 */
async function saveExtraction() {
  if (!editExtractionConfig.value) return;

  const ok = await confirmState.confirm({
    title: 'Re-extract Dataset',
    message: 'This will replace all existing data with newly extracted data from the raw snapshot. Continue?',
    variant: 'warning',
  });
  if (!ok) return;

  savingExtraction.value = true;
  try {
    await $api(`/datasets/${route.params.id}/re-extract`, {
      method: 'POST',
      body: { extractionConfig: editExtractionConfig.value },
    });

    await loadDataset();
    editingExtraction.value = false;
    editExtractionPreview.value = null;
    toast.success('Dataset re-extracted successfully');
  } catch (e) {
    console.error('Re-extraction failed', e);
    toast.error('Failed to re-extract dataset');
  } finally {
    savingExtraction.value = false;
  }
}

/**
 * Cancel extraction editing.
 */
function cancelEditExtraction() {
  editingExtraction.value = false;
  editExtractionConfig.value = null;
  editExtractionPreview.value = null;
}

// ── Settings editing ────────────────────────────────────────
const editingSettings = ref(false);
const editSpreadsheetId = ref('');
const editSheetName = ref('');
const savingSettings = ref(false);

/**
 * Enter settings edit mode.
 */
function startEditSettings() {
  const sc = dataset.value?.sourceConfig as Record<string, unknown> | undefined;
  editSpreadsheetId.value = (sc?.spreadsheetId as string) || '';
  editSheetName.value = (sc?.sheetName as string) || '';
  editingSettings.value = true;
}

/**
 * Cancel settings editing.
 */
function cancelEditSettings() {
  editingSettings.value = false;
}

/**
 * Save updated source config via PATCH.
 */
async function saveSettings() {
  savingSettings.value = true;
  try {
    const sourceConfig: Record<string, unknown> = {
      spreadsheetId: editSpreadsheetId.value.trim(),
    };
    if (editSheetName.value.trim()) {
      sourceConfig.sheetName = editSheetName.value.trim();
    }

    await $api(`/datasets/${route.params.id}`, {
      method: 'PATCH',
      body: { sourceConfig },
    });
    await loadDataset();
    editingSettings.value = false;
    toast.success('Source settings updated');
  } catch (e) {
    console.error('Update failed', e);
    toast.error('Failed to update settings');
  } finally {
    savingSettings.value = false;
  }
}

// ── Pipeline sample rows ─────────────────────────────────────
/** Sample rows for pipeline preview (first 100 rows of clean data). */
const pipelineSampleRows = ref<Record<string, unknown>[]>([]);

/**
 * Load sample rows for the pipeline preview.
 */
async function loadPipelineSamples() {
  try {
    const res = await $api<ApiResponse<{ rows: Record<string, unknown>[] }>>(`/datasets/${route.params.id}/data?page=1&pageSize=100`);
    pipelineSampleRows.value = res.data?.rows ?? [];
  } catch (e) {
    console.error('Failed to load pipeline samples', e);
  }
}

/**
 * Called when pipeline is saved — refresh dataset.
 */
async function onPipelineSaved() {
  await loadDataset();
}

// ── Tab switching with lazy load ────────────────────────────
/**
 * Switch active tab and load data if needed.
 */
async function switchTab(tab: typeof activeTab.value) {
  activeTab.value = tab;

  // Load raw snapshot on first visit of these tabs
  if ((tab === 'raw' || tab === 'extraction') && !rawSnapshot.value) {
    rawLoading.value = true;
    try {
      const res = await $api<ApiResponse<RawSnapshot | null>>(`/datasets/${route.params.id}/raw`);
      rawSnapshot.value = res.data;
    } catch (e) {
      console.error('Failed to load raw snapshot', e);
    } finally {
      rawLoading.value = false;
    }
  }

  // Load sample rows for pipeline preview
  if (tab === 'pipeline' && pipelineSampleRows.value.length === 0) {
    await loadPipelineSamples();
  }
}

// ── Sync & Delete ───────────────────────────────────────────
/**
 * Trigger dataset sync and reload data.
 */
async function syncDataset() {
  syncing.value = true;
  try {
    await $api(`/datasets/${route.params.id}/sync`, { method: 'POST' });
    await loadDataset();
    rawSnapshot.value = null;
    syncHistoryRef.value?.refresh();
    toast.success('Dataset synced successfully');
  } catch (e) {
    console.error('Sync failed', e);
    toast.error('Failed to sync dataset');
  } finally {
    syncing.value = false;
  }
}

/**
 * Delete dataset with confirmation dialog.
 */
async function handleDelete() {
  const ok = await confirmState.confirm({
    title: 'Delete Dataset',
    message: 'Are you sure you want to delete this dataset? This action cannot be undone.',
  });
  if (!ok) return;

  try {
    await $api(`/datasets/${route.params.id}`, { method: 'DELETE' });
    toast.success('Dataset deleted');
    navigateTo('/datasets');
  } catch (e) {
    console.error('Delete failed', e);
    toast.error('Failed to delete dataset');
  }
}
</script>
