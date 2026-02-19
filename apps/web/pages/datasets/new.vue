<template>
  <div class="max-w-5xl mx-auto">
    <PageHeader title="Create Dataset" back-to="/datasets">
      <template #badge>
        <span class="text-sm text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 rounded-full">Step {{ currentStepIndex + 1 }}/{{ wizard.steps.length }}</span>
      </template>
    </PageHeader>

    <!-- Step Indicator -->
    <div class="mb-8 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div class="flex items-center">
        <template v-for="(step, idx) in wizard.steps" :key="step.id">
          <div class="flex items-center">
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all shadow-sm"
              :class="{
                'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900': step.active,
                'bg-green-500 text-white': step.completed,
                'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500': !step.active && !step.completed,
              }"
            >
              <span v-if="step.completed">&#10003;</span>
              <span v-else>{{ idx + 1 }}</span>
            </div>
            <span
              class="ml-2 text-sm font-medium hidden sm:inline"
              :class="step.active ? 'text-blue-700 dark:text-blue-400' : step.completed ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'"
            >
              {{ step.label }}
            </span>
          </div>
          <div
            v-if="idx < wizard.steps.length - 1"
            class="flex-1 h-0.5 mx-3 rounded-full transition-colors"
            :class="step.completed ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'"
          ></div>
        </template>
      </div>
    </div>

    <!-- Multi-Sheet Batch Progress -->
    <div
      v-if="wizard.multiSheet.mode === 'separate' && wizard.multiSheet.sheets.length > 0"
      class="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl"
    >
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold text-blue-900 dark:text-blue-200">
            Sheet {{ wizard.multiSheet.currentIndex + 1 }} of {{ wizard.multiSheet.sheets.length }}:
            {{ wizard.multiSheet.sheets[wizard.multiSheet.currentIndex]?.sheetName }}
          </p>
          <p class="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
            {{ wizard.multiSheet.completedDatasetIds.length }} sheet(s) completed
          </p>
        </div>
        <div class="flex gap-1.5">
          <div
            v-for="(_, idx) in wizard.multiSheet.sheets"
            :key="idx"
            class="w-2.5 h-2.5 rounded-full transition-colors"
            :class="{
              'bg-green-500': idx < wizard.multiSheet.currentIndex,
              'bg-blue-500': idx === wizard.multiSheet.currentIndex,
              'bg-gray-300 dark:bg-gray-600': idx > wizard.multiSheet.currentIndex,
            }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Error Banner -->
    <div v-if="wizard.error" class="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
      <span class="text-red-500 mt-0.5">&#9888;</span>
      <span>{{ wizard.error }}</span>
    </div>

    <!-- Step 1: Connect -->
    <div v-if="wizard.step === 'connect'" class="space-y-6">
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Connect to Data Source</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Choose your data source and configure the connection.</p>

        <!-- Source Type Picker -->
        <SourcePicker v-model="sourceType" />

        <!-- Google Sheets Config -->
        <template v-if="sourceType === 'google_sheets'">
          <div class="mt-4 space-y-4">
            <div>
              <label class="form-label">Spreadsheet ID</label>
              <input
                v-model="spreadsheetId"
                type="text"
                class="form-input"
                placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              />
              <p class="form-hint">From the URL: /spreadsheets/d/<span class="font-medium">{ID}</span>/edit</p>
            </div>

            <div>
              <label class="form-label">Sheet Name (optional)</label>
              <select
                v-if="availableSheets.length > 0"
                v-model="sheetName"
                class="form-input"
              >
                <option value="">-- Select sheet --</option>
                <option v-for="s in availableSheets" :key="s" :value="s">{{ s }}</option>
              </select>
              <input
                v-else
                v-model="sheetName"
                type="text"
                class="form-input"
                placeholder="Sheet1 (default)"
              />
            </div>
          </div>

          <!-- Connection status -->
          <div v-if="wizard.source.meta" class="mt-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl flex items-start gap-3">
            <span class="text-green-600 dark:text-green-400 text-lg">&#10003;</span>
            <div>
              <p class="text-sm text-green-800 dark:text-green-300 font-semibold">Connected: {{ wizard.source.meta.title }}</p>
              <p class="text-xs text-green-600 dark:text-green-400 mt-0.5">Available sheets: {{ wizard.source.meta.sheets.join(', ') }}</p>
            </div>
          </div>

          <div class="mt-6 flex gap-3">
            <button
              @click="testConnection"
              :disabled="!spreadsheetId || connecting"
              class="btn-secondary"
            >
              {{ connecting ? 'Connecting...' : 'Test Connection' }}
            </button>
          </div>
        </template>

        <!-- CSV/Excel File Upload Config -->
        <template v-if="sourceType === 'csv' || sourceType === 'excel'">
          <div class="mt-4">
            <FileUploadConfig
              ref="fileUploadRef"
              :source-type="sourceType"
              :uploading="uploadingFile"
              @file-selected="handleFileSelected"
              @file-cleared="handleFileCleared"
              @sheet-changed="handleSheetChanged"
              @multi-sheet-configured="handleMultiSheetConfigured"
            />
          </div>

          <!-- Upload success -->
          <div v-if="wizard.source.meta && isFileSource" class="mt-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl flex items-start gap-3">
            <span class="text-green-600 dark:text-green-400 text-lg">&#10003;</span>
            <div>
              <p class="text-sm text-green-800 dark:text-green-300 font-semibold">File uploaded: {{ wizard.source.meta.title }}</p>
              <p class="text-xs text-green-600 dark:text-green-400 mt-0.5">{{ wizard.totalRows }} rows &times; {{ wizard.totalCols }} columns</p>
            </div>
          </div>
        </template>

        <!-- REST API Config -->
        <template v-if="sourceType === 'rest_api'">
          <div class="mt-4">
            <RestApiConfig ref="restApiConfigRef" />
          </div>

          <!-- Fetch success -->
          <div v-if="wizard.source.meta && isRestApiSource" class="mt-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl flex items-start gap-3">
            <span class="text-green-600 dark:text-green-400 text-lg">&#10003;</span>
            <div>
              <p class="text-sm text-green-800 dark:text-green-300 font-semibold">Connected: {{ wizard.source.meta.title }}</p>
              <p class="text-xs text-green-600 dark:text-green-400 mt-0.5">{{ wizard.totalRows }} rows &times; {{ wizard.totalCols }} columns fetched</p>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Step 2: Raw Preview -->
    <div v-if="wizard.step === 'preview'" class="space-y-4">
      <div v-if="wizard.rawData.length === 0" class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
        <p class="text-gray-500 dark:text-gray-400 mb-4">Fetch raw data from source to preview</p>
        <button
          @click="fetchRawData"
          :disabled="fetchingRaw"
          class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
        >
          {{ fetchingRaw ? 'Fetching...' : 'Fetch Raw Data' }}
        </button>
      </div>

      <RawPreview
        v-else
        :data="wizard.rawData"
        :total-rows="wizard.totalRows"
        :total-cols="wizard.totalCols"
      >
        <template #actions>
          <button
            v-if="sourceType === 'google_sheets'"
            @click="fetchRawData"
            :disabled="fetchingRaw"
            class="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {{ fetchingRaw ? 'Refreshing...' : 'Refresh' }}
          </button>
        </template>
      </RawPreview>
    </div>

    <!-- Step 3: Extract -->
    <div v-if="wizard.step === 'extract'">
      <ExtractionGrid
        :data="wizard.rawData"
        :total-rows="wizard.totalRows"
        :total-cols="wizard.totalCols"
        :config="wizard.extractionConfig"
        :preview="wizard.preview"
        @update:config="wizard.extractionConfig = $event"
        @request-preview="loadPreview"
      />
    </div>

    <!-- Step 4: Configure -->
    <div v-if="wizard.step === 'configure'" class="space-y-6">
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Dataset Configuration</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Name your dataset and set up change tracking.</p>

        <div class="space-y-4">
          <div>
            <label class="form-label">Dataset Name *</label>
            <input
              v-model="wizard.datasetName"
              type="text"
              required
              class="form-input"
              placeholder="e.g. Data Bencana Aceh 2025"
            />
          </div>

          <div>
            <label class="form-label">Description</label>
            <textarea
              v-model="wizard.datasetDescription"
              rows="2"
              class="form-input"
              placeholder="Optional description"
            ></textarea>
          </div>

          <div v-if="wizard.preview">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Key Columns (for change tracking)</label>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="header in wizard.preview.headers"
                :key="header"
                class="inline-flex items-center gap-1.5 px-2 py-1 border rounded text-sm cursor-pointer"
                :class="wizard.extractionConfig.keyColumns.includes(header) ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'"
              >
                <input
                  type="checkbox"
                  :checked="wizard.extractionConfig.keyColumns.includes(header)"
                  @change="toggleKeyColumn(header)"
                  class="sr-only"
                />
                {{ header }}
              </label>
            </div>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Columns that identify unique rows (used during re-sync to detect changes)</p>
          </div>
        </div>
      </div>

      <!-- Summary -->
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-4">Summary</h3>
        <dl class="grid grid-cols-2 gap-3">
          <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <dt class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Source</dt>
            <dd class="font-medium text-gray-900 dark:text-gray-100 text-sm">{{ wizard.source.meta?.title || wizard.source.sourceType }}</dd>
          </div>
          <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <dt class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Type</dt>
            <dd class="font-medium text-gray-900 dark:text-gray-100 text-sm">{{ sourceTypeLabel }}</dd>
          </div>
          <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <dt class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Raw Data</dt>
            <dd class="font-medium text-gray-900 dark:text-gray-100 text-sm">{{ wizard.totalRows }} rows &times; {{ wizard.totalCols }} cols</dd>
          </div>
          <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <dt class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Extracted</dt>
            <dd class="font-medium text-gray-900 dark:text-gray-100 text-sm">{{ wizard.preview?.totalRows || 0 }} rows &times; {{ wizard.preview?.headers.length || 0 }} cols</dd>
          </div>
          <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <dt class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Header Rows</dt>
            <dd class="font-medium text-gray-900 dark:text-gray-100 text-sm">{{ wizard.extractionConfig.headerRowIndices.map((r: number) => r + 1).join(', ') || 'None' }}</dd>
          </div>
          <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <dt class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Skipped Rows</dt>
            <dd class="font-medium text-gray-900 dark:text-gray-100 text-sm">{{ wizard.extractionConfig.skipRows.length || 'None' }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Step: Loading -->
    <div v-if="wizard.step === 'loading'" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-16 text-center">
      <LoadingState message="Creating dataset and loading data..." />
    </div>

    <!-- Navigation Buttons -->
    <div v-if="wizard.step !== 'loading'" class="mt-8 flex justify-between">
      <button
        v-if="wizard.step !== 'connect'"
        @click="wizard.prevStep()"
        class="btn-secondary"
      >
        &larr; Back
      </button>
      <div v-else></div>

      <div class="flex gap-3">
        <NuxtLink
          to="/datasets"
          class="btn-secondary"
        >
          Cancel
        </NuxtLink>
        <button
          v-if="wizard.step === 'connect'"
          @click="handleConnectNext"
          :disabled="(!wizard.canProceed && !isRestApiSource) || uploadingFile || fetchingRaw"
          class="btn-primary"
        >
          {{ uploadingFile ? 'Uploading...' : fetchingRaw ? 'Fetching...' : isRestApiSource ? 'Fetch Data &rarr;' : 'Next &rarr;' }}
        </button>
        <button
          v-else-if="wizard.step === 'preview'"
          @click="handlePreviewNext"
          :disabled="!wizard.canProceed"
          class="btn-primary"
        >
          Next &rarr;
        </button>
        <button
          v-else-if="wizard.step === 'extract'"
          @click="handleExtractNext"
          :disabled="!wizard.canProceed"
          class="btn-primary"
        >
          Next &rarr;
        </button>
        <button
          v-else-if="wizard.step === 'configure'"
          @click="handleCreateDataset"
          :disabled="!wizard.canProceed || wizard.isProcessing"
          class="btn-success"
        >
          {{ wizard.isProcessing ? 'Creating...' : 'Create Dataset' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApiResponse, FetchRawResponse, ExtractionPreview, SheetUploadResult } from '@etl-dashboard/shared';
import FileUploadConfig from '~/components/source/FileUploadConfig.vue';
import RestApiConfig from '~/components/source/RestApiConfig.vue';

definePageMeta({ middleware: 'auth' });

const { $api } = useApi();
const config = useRuntimeConfig();
const authStore = useAuthStore();
const wizard = useWizardStore();

// Component refs
const fileUploadRef = ref<InstanceType<typeof FileUploadConfig> | null>(null);
const restApiConfigRef = ref<InstanceType<typeof RestApiConfig> | null>(null);

// Local state
const sourceType = ref<'google_sheets' | 'csv' | 'excel' | 'rest_api'>(wizard.source.sourceType);
const spreadsheetId = ref((wizard.source.sourceConfig.spreadsheetId as string) || '');
const sheetName = ref((wizard.source.sourceConfig.sheetName as string) || '');
const availableSheets = ref<string[]>(wizard.source.meta?.sheets || []);
const connecting = ref(false);
const fetchingRaw = ref(false);
const uploadingFile = ref(false);
const pendingFile = ref<File | null>(null);
const selectedSheetName = ref('');

/** Whether the current source type is file-based */
const isFileSource = computed(() => sourceType.value === 'csv' || sourceType.value === 'excel');

/** Whether the current source type is REST API */
const isRestApiSource = computed(() => sourceType.value === 'rest_api');

/** Human-readable source type label */
const sourceTypeLabel = computed(() => {
  const labels: Record<string, string> = {
    google_sheets: 'Google Sheets',
    csv: 'CSV File',
    excel: 'Excel File',
    rest_api: 'REST API',
  };
  return labels[wizard.source.sourceType] || wizard.source.sourceType;
});

/** Current step index (0-based) */
const currentStepIndex = computed(() => {
  const order = ['connect', 'preview', 'extract', 'configure'];
  return order.indexOf(wizard.step);
});

// Reset wizard on mount
onMounted(() => {
  wizard.reset();
});

onUnmounted(() => {
  wizard.reset();
});

// When source type changes, clear previous connection state
watch(sourceType, () => {
  wizard.source.meta = null;
  wizard.snapshotId = null;
  wizard.rawData = [];
  wizard.totalRows = 0;
  wizard.totalCols = 0;
  wizard.preview = null;
  wizard.error = null;
  pendingFile.value = null;
});

/**
 * Test connection to a Google Sheets data source.
 */
async function testConnection() {
  connecting.value = true;
  wizard.error = null;
  try {
    const sourceConfig: Record<string, unknown> = { spreadsheetId: spreadsheetId.value };
    if (sheetName.value) sourceConfig.sheetName = sheetName.value;

    const res = await $api<ApiResponse<{ title: string; sheets: string[]; locale: string }>>(
      '/sources/connect',
      {
        method: 'POST',
        body: { sourceType: sourceType.value, sourceConfig },
      },
    );

    const meta = { title: res.data.title, sheets: res.data.sheets };
    availableSheets.value = res.data.sheets;
    wizard.setSource(sourceType.value, sourceConfig, meta);
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    wizard.error = err?.data?.message || 'Failed to connect';
  } finally {
    connecting.value = false;
  }
}

/**
 * Handle file selected from FileUploadConfig.
 * Uploads immediately and parses into raw snapshot.
 */
async function handleFileSelected(file: File) {
  pendingFile.value = file;
  await uploadFile(file);
}

/**
 * Handle file cleared from FileUploadConfig.
 */
function handleFileCleared() {
  pendingFile.value = null;
  wizard.source.meta = null;
  wizard.snapshotId = null;
  wizard.rawData = [];
  wizard.totalRows = 0;
  wizard.totalCols = 0;
}

/**
 * Handle sheet change from FileUploadConfig (Excel only).
 * Re-uploads with the selected sheet name.
 */
async function handleSheetChanged(newSheetName: string) {
  selectedSheetName.value = newSheetName;
  if (pendingFile.value) {
    await uploadFile(pendingFile.value, newSheetName);
  }
}

/**
 * Upload file to server via multipart/form-data.
 * Parses file and saves as raw snapshot on the backend.
 */
async function uploadFile(file: File, sheetNameOverride?: string) {
  uploadingFile.value = true;
  wizard.error = null;

  try {
    const formData = new FormData();
    formData.append('file', file);
    if (sheetNameOverride) {
      formData.append('sheetName', sheetNameOverride);
    }

    const res = await $fetch<ApiResponse<FetchRawResponse & { sourceType: string; sheetNames?: string[] }>>(
      `${config.public.apiBase}/sources/upload`,
      {
        method: 'POST',
        body: formData,
        headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
      },
    );

    const { snapshotId, data, totalRows, totalCols } = res.data;

    // Set raw data in wizard
    wizard.setRawData(snapshotId, data, totalRows, totalCols);

    // Set source info
    const sourceConfig: Record<string, unknown> = {
      filename: file.name,
      fileSize: file.size,
    };
    if (sheetNameOverride) sourceConfig.sheetName = sheetNameOverride;

    wizard.setSource(
      sourceType.value,
      sourceConfig,
      { title: file.name, sheets: res.data.sheetNames || [] },
    );

    // If Excel and multiple sheets, let the component know
    if (res.data.sheetNames && res.data.sheetNames.length > 1) {
      fileUploadRef.value?.setSheetNames(res.data.sheetNames);
    }
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    wizard.error = err?.data?.message || 'Failed to upload file';
  } finally {
    uploadingFile.value = false;
  }
}

/**
 * Fetch raw data from Google Sheets or REST API source.
 */
async function fetchRawData() {
  fetchingRaw.value = true;
  wizard.error = null;
  try {
    const res = await $api<ApiResponse<FetchRawResponse>>('/sources/fetch-raw', {
      method: 'POST',
      body: {
        sourceType: wizard.source.sourceType,
        sourceConfig: wizard.source.sourceConfig,
      },
    });

    wizard.setRawData(res.data.snapshotId, res.data.data, res.data.totalRows, res.data.totalCols);
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    wizard.error = err?.data?.message || 'Failed to fetch raw data';
  } finally {
    fetchingRaw.value = false;
  }
}

/**
 * Handle multi-sheet configuration emitted from FileUploadConfig.
 * Initializes wizard batch mode and navigates to the preview step.
 *
 * @param payload - Mode + loaded sheet snapshots from the upload-multi-sheet API
 */
async function handleMultiSheetConfigured(payload: { mode: 'separate' | 'merge'; sheets: SheetUploadResult[] }) {
  wizard.error = null;

  if (payload.mode === 'separate') {
    // Batch mode: process each sheet independently
    wizard.initMultiSheet('separate', payload.sheets);
    wizard.setSource(
      sourceType.value as 'csv' | 'excel',
      wizard.source.sourceConfig,
      { title: wizard.source.meta?.title || '', sheets: payload.sheets.map((s) => s.sheetName) },
    );
    wizard.goTo('preview');
  } else {
    // Merge mode: save merged snapshot on backend, then use as single wizard flow
    wizard.isProcessing = true;
    try {
      const snapshotIds = payload.sheets.map((s) => s.snapshotId);
      const res = await $api<ApiResponse<FetchRawResponse>>('/sources/merge-snapshot', {
        method: 'POST',
        body: { snapshotIds },
      });
      wizard.setRawData(res.data.snapshotId, res.data.data, res.data.totalRows, res.data.totalCols);
      wizard.setSource(
        sourceType.value as 'csv' | 'excel',
        wizard.source.sourceConfig,
        { title: wizard.source.meta?.title || '', sheets: payload.sheets.map((s) => s.sheetName) },
      );
      wizard.goTo('preview');
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      wizard.error = err?.data?.message || 'Failed to merge sheets';
    } finally {
      wizard.isProcessing = false;
    }
  }
}

/**
 * Load extraction preview from the API.
 */
async function loadPreview() {
  if (!wizard.snapshotId) return;
  console.log('[loadPreview] Sending config:', wizard.extractionConfig);
  try {
    const res = await $api<ApiResponse<ExtractionPreview>>('/sources/extract-preview', {
      method: 'POST',
      body: {
        snapshotId: wizard.snapshotId,
        config: wizard.extractionConfig,
      },
    });
    console.log('[loadPreview] Received preview:', res.data);
    wizard.setPreview(res.data);
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    wizard.error = err?.data?.message || 'Failed to generate preview';
  }
}

/**
 * Toggle key column selection.
 */
function toggleKeyColumn(column: string) {
  const idx = wizard.extractionConfig.keyColumns.indexOf(column);
  if (idx >= 0) {
    wizard.extractionConfig.keyColumns.splice(idx, 1);
  } else {
    wizard.extractionConfig.keyColumns.push(column);
  }
}

/** Step navigation: Connect -> Preview */
async function handleConnectNext() {
  // REST API bypasses canProceed check — source.meta is set after fetch, not before
  if (!isRestApiSource.value && !wizard.canProceed) return;

  if (isFileSource.value) {
    // File already uploaded and parsed — raw data is already in wizard
    // Skip the fetch-raw step and go directly to preview
    wizard.nextStep();
  } else if (isRestApiSource.value) {
    // REST API: fetch raw data now using the config from RestApiConfig component
    const restConfig = restApiConfigRef.value?.config;
    if (!restConfig?.url) {
      wizard.error = 'Please enter a valid URL and test the connection first.';
      return;
    }

    fetchingRaw.value = true;
    wizard.error = null;
    try {
      const sourceConfig: Record<string, unknown> = {
        connector: 'rest_api',
        url: restConfig.url,
        method: restConfig.method,
        authType: restConfig.authType,
        authToken: restConfig.authToken || undefined,
        authHeaderName: restConfig.authHeaderName || undefined,
        authUsername: restConfig.authUsername || undefined,
        authPassword: restConfig.authPassword || undefined,
        requestBody: restConfig.requestBody || undefined,
        jsonPath: restConfig.jsonPath || undefined,
        extraHeaders: Object.keys(restConfig.extraHeaders ?? {}).length ? restConfig.extraHeaders : undefined,
      };

      const res = await $api<ApiResponse<FetchRawResponse>>('/sources/fetch-raw', {
        method: 'POST',
        body: { sourceType: 'rest_api', sourceConfig },
      });

      wizard.setRawData(res.data.snapshotId, res.data.data, res.data.totalRows, res.data.totalCols);
      wizard.setSource('rest_api', sourceConfig, { title: restConfig.url, sheets: [] });
      wizard.nextStep();
    } catch (e: unknown) {
      const err = e as { data?: { message?: string } };
      wizard.error = err?.data?.message || 'Failed to fetch data from REST API';
    } finally {
      fetchingRaw.value = false;
    }
  } else {
    wizard.nextStep();
    // Auto-fetch if no raw data yet (Google Sheets)
    if (wizard.rawData.length === 0) {
      await fetchRawData();
    }
  }
}

/** Step navigation: Preview -> Extract */
async function handlePreviewNext() {
  if (!wizard.canProceed) return;
  wizard.nextStep();
  // Auto-generate initial preview
  if (!wizard.preview) {
    await loadPreview();
  }
}

/** Step navigation: Extract -> Configure */
async function handleExtractNext() {
  // Ensure we have a preview
  if (!wizard.preview) {
    await loadPreview();
  }
  if (!wizard.canProceed) return;

  // Auto-fill dataset name from source title
  if (!wizard.datasetName && wizard.source.meta?.title) {
    wizard.datasetName = wizard.source.meta.title;
  }
  wizard.nextStep();
}

/**
 * Final step: create dataset from extraction.
 * In multi-sheet batch (separate) mode, advances to the next sheet after creation.
 */
async function handleCreateDataset() {
  if (!wizard.canProceed || wizard.isProcessing) return;
  wizard.isProcessing = true;
  wizard.error = null;
  wizard.goTo('loading');

  try {
    const res = await $api<ApiResponse<{ dataset: { id: string }; rowCount: number }>>(
      '/sources/create-dataset',
      {
        method: 'POST',
        body: {
          name: wizard.datasetName,
          description: wizard.datasetDescription || undefined,
          sourceType: wizard.source.sourceType,
          sourceConfig: wizard.source.sourceConfig,
          snapshotId: wizard.snapshotId,
          extractionConfig: wizard.extractionConfig,
        },
      },
    );

    const createdId = res.data.dataset.id;

    // Multi-sheet batch mode: advance to next sheet or finish
    if (wizard.multiSheet.mode === 'separate') {
      const isLast = wizard.multiSheet.currentIndex >= wizard.multiSheet.sheets.length - 1;
      if (isLast) {
        // All sheets done — navigate to datasets list
        wizard.multiSheet.completedDatasetIds.push(createdId);
        navigateTo('/datasets');
      } else {
        // Advance to next sheet
        wizard.advanceToNextSheet(createdId);
        // Preview step for next sheet
        wizard.preview = null;
        await loadPreview();
      }
    } else {
      navigateTo(`/datasets/${createdId}`);
    }
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } };
    wizard.error = err?.data?.message || 'Failed to create dataset';
    wizard.goTo('configure');
  } finally {
    wizard.isProcessing = false;
  }
}
</script>
