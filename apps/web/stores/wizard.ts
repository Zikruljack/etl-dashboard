/**
 * Wizard store for dataset creation flow.
 * Manages multi-step state: Connect → Raw Preview → Extract → Configure → Load.
 */

import { defineStore } from 'pinia';
import type {
  ExtractionConfig,
  CellGrid,
  ExtractionPreview,
} from '@etl-dashboard/shared';

/** Active wizard step */
export type WizardStep = 'connect' | 'preview' | 'extract' | 'configure' | 'loading';

/** Source connection info */
interface SourceInfo {
  sourceType: 'google_sheets' | 'csv' | 'excel';
  sourceConfig: Record<string, unknown>;
  meta: { title: string; sheets: string[] } | null;
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
      sourceType: 'google_sheets' | 'csv' | 'excel',
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
     * Reset the entire wizard state to initial values.
     */
    reset() {
      this.$reset();
    },
  },
});
