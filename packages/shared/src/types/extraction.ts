/**
 * Extraction & raw snapshot types.
 * Used across backend (source module, extractor) and frontend (wizard, raw preview).
 */

/** 2D cell data from a raw source fetch */
export type CellGrid = (string | null)[][];

/**
 * Raw snapshot stored per fetch from source.
 * Contains the complete cell grid as fetched from the source.
 */
export interface RawSnapshot {
  id: string;
  datasetId: string | null;
  snapshotData: CellGrid;
  totalRows: number;
  totalCols: number;
  sourceHash: string | null;
  fetchedAt: string;
}

/**
 * Extraction config saved per dataset.
 * Defines how to read clean data from a raw snapshot.
 * Applied on every sync to produce dataset_rows.
 */
export interface ExtractionConfig {
  /** Row indices (0-based) that form the header. Multi-header: [0, 1] */
  headerRowIndices: number[];
  /** Separator for flattening multi-level headers (default: "_") */
  headerFlattenSeparator: string;
  /** Row index where data starts (after headers) */
  dataStartRow: number;
  /** Row index where data ends (null = until last row) */
  dataEndRow: number | null;
  /** Column start index (0-based, A=0) */
  columnStart: number;
  /** Column end index (null = until last column) */
  columnEnd: number | null;
  /** Row indices to skip (totals, footnotes, empty) */
  skipRows: number[];
  /** Global column indices (0-based) to exclude from extraction */
  excludeColumns: number[] | null;
  /** Columns used for row identity during change tracking */
  keyColumns: string[];
  /** Manual label overrides per column index or auto-name */
  columnLabels: Record<string, string>;
}

/**
 * Result of applying extraction config to a raw snapshot.
 * Used for preview before saving.
 */
export interface ExtractionPreview {
  /** Flattened column headers after extraction */
  headers: string[];
  /** Extracted rows as arrays of values */
  rows: (string | null)[][];
  /** Total extracted row count */
  totalRows: number;
}

/**
 * Request to fetch raw data from a source.
 */
export interface FetchRawRequest {
  /** Source type */
  sourceType: 'google_sheets' | 'csv' | 'excel';
  /** Source-specific config */
  sourceConfig: Record<string, unknown>;
}

/**
 * Response from fetching raw data.
 */
export interface FetchRawResponse {
  /** Saved snapshot ID */
  snapshotId: string;
  /** The raw cell grid */
  data: CellGrid;
  /** Total rows */
  totalRows: number;
  /** Total columns */
  totalCols: number;
}

/**
 * Request body for extraction preview.
 */
export interface ExtractPreviewRequest {
  /** Snapshot ID to extract from */
  snapshotId: string;
  /** Extraction configuration to apply */
  config: ExtractionConfig;
}

/**
 * Request body for creating dataset from extraction.
 */
export interface CreateDatasetFromExtractionRequest {
  /** Dataset name */
  name: string;
  /** Dataset description */
  description?: string;
  /** Source type */
  sourceType: 'google_sheets' | 'csv' | 'excel';
  /** Source config for re-sync */
  sourceConfig: Record<string, unknown>;
  /** Snapshot to extract from */
  snapshotId: string;
  /** Extraction configuration */
  extractionConfig: ExtractionConfig;
}
