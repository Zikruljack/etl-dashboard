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

    <!-- Sheet selector for Excel files -->
    <div v-if="sheetNames.length > 1">
      <label class="form-label">Sheet</label>
      <select v-model="selectedSheet" class="form-input">
        <option v-for="name in sheetNames" :key="name" :value="name">{{ name }}</option>
      </select>
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
  /** Emitted when sheet selection changes (Excel) */
  'sheet-changed': [sheetName: string];
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const selectedFile = ref<File | null>(null);
const uploadError = ref<string | null>(null);
const sheetNames = ref<string[]>([]);
const selectedSheet = ref('');

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
 * Clear selected file.
 */
function clearFile() {
  selectedFile.value = null;
  sheetNames.value = [];
  selectedSheet.value = '';
  uploadError.value = null;
  emit('file-cleared');
}

/**
 * Set available sheet names (called from parent after upload response).
 */
function setSheetNames(names: string[]) {
  sheetNames.value = names;
  if (names.length > 0 && !selectedSheet.value) {
    selectedSheet.value = names[0];
  }
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
