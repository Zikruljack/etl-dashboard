/**
 * Wizard store for dataset creation flow.
 * Manages multi-step state: Connect → Raw Preview → Extract → Configure → Load.
 */

import { defineStore } from 'pinia';
import type {
  ExtractionConfig,
  CellGrid,
  ExtractionPreview,
  SheetUploadResult,
  MultiSheetMode,
} from '@etl-dashboard/shared';

/** Active wizard step */
export type WizardStep = 'connect' | 'preview' | 'extract' | 'configure' | 'loading';

/** Source connection info */
interface SourceInfo {
  sourceType: 'google_sheets' | 'csv' | 'excel' | 'rest_api';
  sourceConfig: Record<string, unknown>;
  meta: { title: string; sheets: string[] } | null;
}

/** Multi-sheet batch state */
interface MultiSheetState {
  /** null = not in batch mode */
  mode: MultiSheetMode | null;
  /** All sheets to process */
  sheets: SheetUploadResult[];
  /** Current sheet index being processed */
  currentIndex: number;
  /** Dataset IDs created so far */
  completedDatasetIds: string[];
}

/** Wizard state */
interface WizardState {
  /** Current active step */
  step: WizardStep;
  /** Source connection info */
  source: SourceInfo;
  /** Snapshot data from raw fetch */
  snapshotId: string | null;
  rawData: CellGrid;
  totalRows: number;
  totalCols: number;
  /** Extraction configuration */
  extractionConfig: ExtractionConfig;
  /** Live extraction preview */
  preview: ExtractionPreview | null;
  /** Dataset metadata */
  datasetName: string;
  datasetDescription: string;
  /** Loading/error states */
  isProcessing: boolean;
  error: string | null;
  /** Multi-sheet batch mode state */
  multiSheet: MultiSheetState;
}

/**
 * Default extraction config for new datasets.
 */
function defaultExtractionConfig(): ExtractionConfig {
  return {
    headerRowIndices: [0],
    headerFlattenSeparator: '_',
    dataStartRow: 1,
    dataEndRow: null,
    columnStart: 0,
    columnEnd: null,
    skipRows: [],
    excludeColumns: [],
    keyColumns: [],
    columnLabels: {},
  };
}

export const useWizardStore = defineStore('wizard', {
  state: (): WizardState => ({
    step: 'connect',
    source: {
      sourceType: 'google_sheets',
      sourceConfig: {},
      meta: null,
    },
    snapshotId: null,
    rawData: [],
    totalRows: 0,
    totalCols: 0,
    extractionConfig: defaultExtractionConfig(),
    preview: null,
    datasetName: '',
    datasetDescription: '',
    isProcessing: false,
    error: null,
    multiSheet: {
      mode: null,
      sheets: [],
      currentIndex: 0,
      completedDatasetIds: [],
    },
  }),

  getters: {
    /** Whether user can proceed to the next step */
    canProceed(): boolean {
      switch (this.step) {
        case 'connect':
          return !!this.source.meta;
        case 'preview':
          return !!this.snapshotId && this.rawData.length > 0;
        case 'extract':
          return !!this.preview && this.preview.totalRows > 0;
        case 'configure':
          return !!this.datasetName.trim();
        default:
          return false;
      }
    },

    /** Whether currently on the last sheet in batch mode */
    isLastSheet(): boolean {
      return this.multiSheet.mode === 'separate'
        && this.multiSheet.currentIndex >= this.multiSheet.sheets.length - 1;
    },

    /** Steps list with completion status */
    steps(): Array<{ id: WizardStep; label: string; completed: boolean; active: boolean }> {
      const order: WizardStep[] = ['connect', 'preview', 'extract', 'configure'];
      const labels: Record<WizardStep, string> = {
        connect: 'Connect',
        preview: 'Raw Preview',
        extract: 'Extract',
        configure: 'Configure',
        loading: 'Loading',
      };
      const currentIdx = order.indexOf(this.step);
      return order.map((id, idx) => ({
        id,
        label: labels[id],
        completed: idx < currentIdx,
        active: id === this.step,
      }));
    },
  },

  actions: {
    /**
     * Set the source connection info after successful connection test.
     *
     * @param sourceType - Type of source connector
     * @param sourceConfig - Connector-specific config
     * @param meta - Source metadata (title, sheets)
     */
    setSource(
      sourceType: 'google_sheets' | 'csv' | 'excel' | 'rest_api',
      sourceConfig: Record<string, unknown>,
      meta: { title: string; sheets: string[] },
    ) {
      this.source = { sourceType, sourceConfig, meta };
      this.error = null;
    },

    /**
     * Set the raw data from a snapshot fetch.
     *
     * @param snapshotId - UUID of the saved snapshot
     * @param data - Raw cell grid
     * @param totalRows - Number of rows
     * @param totalCols - Number of columns
     */
    setRawData(snapshotId: string, data: CellGrid, totalRows: number, totalCols: number) {
      this.snapshotId = snapshotId;
      this.rawData = data;
      this.totalRows = totalRows;
      this.totalCols = totalCols;

      // Auto-detect initial extraction config
      this.extractionConfig = defaultExtractionConfig();
      if (totalRows > 0) {
        this.extractionConfig.dataStartRow = 1;
      }
    },

    /**
     * Set extraction preview result.
     */
    setPreview(preview: ExtractionPreview) {
      this.preview = preview;
    },

    /**
     * Toggle header row selection.
     * If row is already a header, remove it. Otherwise add it.
     *
     * @param rowIndex - 0-based row index to toggle
     */
    toggleHeaderRow(rowIndex: number) {
      const idx = this.extractionConfig.headerRowIndices.indexOf(rowIndex);
      if (idx >= 0) {
        this.extractionConfig.headerRowIndices.splice(idx, 1);
      } else {
        this.extractionConfig.headerRowIndices.push(rowIndex);
        this.extractionConfig.headerRowIndices.sort((a, b) => a - b);
      }
      // Auto-adjust data start row to be after last header row
      if (this.extractionConfig.headerRowIndices.length > 0) {
        const lastHeader = Math.max(...this.extractionConfig.headerRowIndices);
        this.extractionConfig.dataStartRow = lastHeader + 1;
      }
    },

    /**
     * Toggle a row as skipped (totals, footnotes, etc.).
     *
     * @param rowIndex - 0-based row index to toggle
     */
    toggleSkipRow(rowIndex: number) {
      const idx = this.extractionConfig.skipRows.indexOf(rowIndex);
      if (idx >= 0) {
        this.extractionConfig.skipRows.splice(idx, 1);
      } else {
        this.extractionConfig.skipRows.push(rowIndex);
        this.extractionConfig.skipRows.sort((a, b) => a - b);
      }
    },

    /**
     * Go to a specific step.
     */
    goTo(step: WizardStep) {
      this.step = step;
      this.error = null;
    },

    /**
     * Go to next step.
     */
    nextStep() {
      const order: WizardStep[] = ['connect', 'preview', 'extract', 'configure'];
      const currentIdx = order.indexOf(this.step);
      if (currentIdx < order.length - 1) {
        this.step = order[currentIdx + 1]!;
        this.error = null;
      }
    },

    /**
     * Go to previous step.
     */
    prevStep() {
      const order: WizardStep[] = ['connect', 'preview', 'extract', 'configure'];
      const currentIdx = order.indexOf(this.step);
      if (currentIdx > 0) {
        this.step = order[currentIdx - 1]!;
        this.error = null;
      }
    },

    /**
     * Initialize multi-sheet batch mode.
     *
     * @param mode - 'separate' or 'merge'
     * @param sheets - Parsed sheet results from backend
     */
    initMultiSheet(mode: MultiSheetMode, sheets: SheetUploadResult[]) {
      this.multiSheet = {
        mode,
        sheets,
        currentIndex: 0,
        completedDatasetIds: [],
      };
      // Load first sheet into wizard
      const first = sheets[0];
      if (first) {
        this.setRawData(first.snapshotId, first.data, first.totalRows, first.totalCols);
        this.datasetName = first.sheetName;
      }
    },

    /**
     * Advance to the next sheet in batch mode.
     * Resets extraction config and preview for the new sheet.
     *
     * @param completedDatasetId - Dataset ID just created
     */
    advanceToNextSheet(completedDatasetId: string) {
      this.multiSheet.completedDatasetIds.push(completedDatasetId);
      this.multiSheet.currentIndex++;

      const next = this.multiSheet.sheets[this.multiSheet.currentIndex];
      if (next) {
        this.setRawData(next.snapshotId, next.data, next.totalRows, next.totalCols);
        this.datasetName = next.sheetName;
        this.datasetDescription = '';
        this.preview = null;
        this.step = 'preview';
      }
    },

    /**
     * Reset the entire wizard state to initial values.
     */
    reset() {
      this.$reset();
    },
  },
});
