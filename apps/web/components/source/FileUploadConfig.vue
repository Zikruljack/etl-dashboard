<template>
  <div class="space-y-4">
    <!-- Drop Zone -->
    <div
      ref="dropZone"
      class="relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer"
      :class="isDragging
        ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
        : selectedFile
          ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-900'"
      @click="openFilePicker"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
    >
      <input
        ref="fileInput"
        type="file"
        :accept="acceptString"
        class="hidden"
        @change="handleFileSelect"
      />

      <template v-if="selectedFile">
        <div class="flex flex-col items-center gap-2">
          <span class="text-3xl">{{ fileIcon }}</span>
          <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ selectedFile.name }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ formatSize(selectedFile.size) }}</p>
          <button
            type="button"
            class="text-xs text-red-500 hover:text-red-700 font-medium mt-1"
            @click.stop="clearFile"
          >
            Remove file
          </button>
        </div>
      </template>

      <template v-else>
        <div class="flex flex-col items-center gap-2">
          <span class="text-3xl text-gray-400">{{ isDragging ? '\u2B07\uFE0F' : '\uD83D\uDCC1' }}</span>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            <span class="font-semibold text-blue-600 dark:text-blue-400">Click to browse</span>
            or drag and drop
          </p>
          <p class="text-xs text-gray-400 dark:text-gray-500">{{ acceptLabel }} (max 50MB)</p>
        </div>
      </template>
    </div>

    <!-- Multi-sheet UI for Excel files with multiple sheets -->
    <div v-if="sheetNames.length > 1" class="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
      <div>
        <h4 class="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">Multiple Sheets Detected ({{ sheetNames.length }} sheets)</h4>
        <p class="text-xs text-blue-600 dark:text-blue-400">Select which sheets to include and choose a mode.</p>
      </div>

      <!-- Sheet checkboxes -->
      <div>
        <label class="form-label text-blue-800 dark:text-blue-300 mb-2 block">Select Sheets</label>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="name in sheetNames"
            :key="name"
            class="inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-sm cursor-pointer transition-all"
            :class="selectedSheets.includes(name)
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'"
          >
            <input
              type="checkbox"
              :checked="selectedSheets.includes(name)"
              class="sr-only"
              @change="toggleSheetSelection(name)"
            />
            {{ name }}
          </label>
        </div>
      </div>

      <!-- Mode selection -->
      <div>
        <label class="form-label text-blue-800 dark:text-blue-300 mb-2 block">Mode</label>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label
            class="flex items-start gap-2.5 p-3 border rounded-lg cursor-pointer transition-all"
            :class="multiSheetMode === 'separate' ? 'bg-white dark:bg-gray-800 border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'"
          >
            <input v-model="multiSheetMode" type="radio" value="separate" class="mt-0.5" />
            <div>
              <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">Separate Datasets</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">Create one dataset per sheet (independent extraction config)</p>
            </div>
          </label>
          <label
            class="flex items-start gap-2.5 p-3 border rounded-lg cursor-pointer transition-all"
            :class="multiSheetMode === 'merge' ? 'bg-white dark:bg-gray-800 border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'"
          >
            <input v-model="multiSheetMode" type="radio" value="merge" class="mt-0.5" />
            <div>
              <p class="text-sm font-semibold text-gray-900 dark:text-gray-100">Merge into One</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">Combine all selected sheets row-wise (same column structure required)</p>
            </div>
          </label>
        </div>
      </div>

      <!-- Apply button -->
      <button
        v-if="multiSheetMode && selectedSheets.length > 0"
        type="button"
        class="btn-primary text-sm"
        :disabled="loadingMultiSheet"
        @click="applyMultiSheet"
      >
        {{ loadingMultiSheet ? 'Loading Sheets...' : `Load ${selectedSheets.length} Sheet(s)` }}
      </button>
    </div>

    <!-- Error -->
    <div v-if="uploadError" class="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
      {{ uploadError }}
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * File upload configuration component.
 * Provides drag-and-drop file upload for CSV and Excel files.
 * After upload, emits the parsed result (same shape as fetch-raw).
 */

import type { SheetUploadResult } from '@etl-dashboard/shared';

const { $api } = useNuxtApp();

interface Props {
  /** Source type: 'csv' or 'excel' */
  sourceType: 'csv' | 'excel';
  /** Whether upload is in progress */
  uploading?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  /** Emitted when a file is selected and ready to upload */
  'file-selected': [file: File];
  /** Emitted when the file is cleared */
  'file-cleared': [];
  /** Emitted when sheet selection changes (Excel, single sheet) */
  'sheet-changed': [sheetName: string];
  /** Emitted when multi-sheet mode is applied and sheets are loaded */
  'multi-sheet-configured': [payload: { mode: 'separate' | 'merge'; sheets: SheetUploadResult[] }];
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const selectedFile = ref<File | null>(null);
const uploadError = ref<string | null>(null);
const sheetNames = ref<string[]>([]);
const selectedSheet = ref('');

// Multi-sheet state
const selectedSheets = ref<string[]>([]);
const multiSheetMode = ref<'separate' | 'merge' | null>(null);
const loadingMultiSheet = ref(false);

/**
 * Toggle a sheet's inclusion in the selection.
 *
 * @param name - Sheet name to toggle
 */
function toggleSheetSelection(name: string) {
  const idx = selectedSheets.value.indexOf(name);
  if (idx >= 0) {
    selectedSheets.value.splice(idx, 1);
  } else {
    selectedSheets.value.push(name);
  }
}

/**
 * Upload selected sheets to the multi-sheet endpoint and emit the result.
 * Calls POST /sources/upload-multi-sheet with selected sheet names.
 */
async function applyMultiSheet() {
  if (!selectedFile.value || !multiSheetMode.value || selectedSheets.value.length === 0) return;

  loadingMultiSheet.value = true;
  uploadError.value = null;

  try {
    const formData = new FormData();
    formData.append('file', selectedFile.value);
    formData.append('sheetNames', JSON.stringify(selectedSheets.value));

    const res = await $api<{ success: boolean; data: { sheets: SheetUploadResult[] } }>(
      '/sources/upload-multi-sheet',
      { method: 'POST', body: formData },
    );

    emit('multi-sheet-configured', {
      mode: multiSheetMode.value,
      sheets: res.data.sheets,
    });
  } catch (err: unknown) {
    uploadError.value = (err as Error).message ?? 'Failed to load sheets.';
  } finally {
    loadingMultiSheet.value = false;
  }
}

/** File accept attribute based on source type */
const acceptString = computed(() => {
  return props.sourceType === 'csv' ? '.csv' : '.xlsx,.xls';
});

/** Human-readable label for accepted files */
const acceptLabel = computed(() => {
  return props.sourceType === 'csv' ? 'CSV files (.csv)' : 'Excel files (.xlsx, .xls)';
});

/** Icon for the selected file */
const fileIcon = computed(() => {
  if (!selectedFile.value) return '\uD83D\uDCC1';
  const ext = selectedFile.value.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return '\uD83D\uDCC4';
  return '\uD83D\uDCCB';
});

/** Allowed extensions for validation */
const allowedExtensions = computed(() => {
  return props.sourceType === 'csv' ? ['csv'] : ['xlsx', 'xls'];
});

/** Watch sheet selection changes */
watch(selectedSheet, (name) => {
  if (name) emit('sheet-changed', name);
});

/**
 * Open native file picker dialog.
 */
function openFilePicker() {
  fileInput.value?.click();
}

/**
 * Handle file selection from input element.
 */
function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) validateAndSet(file);
  // Reset input so the same file can be re-selected
  input.value = '';
}

/**
 * Handle file drop event.
 */
function handleDrop(event: DragEvent) {
  isDragging.value = false;
  const file = event.dataTransfer?.files[0];
  if (file) validateAndSet(file);
}

/**
 * Validate file type and size, then emit selection.
 */
function validateAndSet(file: File) {
  uploadError.value = null;

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !allowedExtensions.value.includes(ext)) {
    uploadError.value = `Invalid file type. Please upload a ${acceptLabel.value} file.`;
    return;
  }

  if (file.size > 50 * 1024 * 1024) {
    uploadError.value = 'File is too large. Maximum size is 50MB.';
    return;
  }

  if (file.size === 0) {
    uploadError.value = 'File is empty.';
    return;
  }

  selectedFile.value = file;
  emit('file-selected', file);
}

/**
 * Clear selected file and reset all state.
 */
function clearFile() {
  selectedFile.value = null;
  sheetNames.value = [];
  selectedSheet.value = '';
  uploadError.value = null;
  selectedSheets.value = [];
  multiSheetMode.value = null;
  loadingMultiSheet.value = false;
  emit('file-cleared');
}

/**
 * Set available sheet names (called from parent after upload response).
 * Auto-selects all sheets by default for multi-sheet mode.
 *
 * @param names - Array of sheet names from the uploaded Excel file
 */
function setSheetNames(names: string[]) {
  sheetNames.value = names;
  if (names.length > 0 && !selectedSheet.value) {
    selectedSheet.value = names[0];
  }
  // Auto-select all sheets for multi-sheet selection
  selectedSheets.value = [...names];
}

/**
 * Format file size in human-readable format.
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

defineExpose({ setSheetNames, clearFile });
</script>
