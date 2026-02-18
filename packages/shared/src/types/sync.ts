/**
 * Shared types for Phase 3: Sync & Change History tracking.
 * Used by both server (diff engine, sync service) and client (UI display).
 */

/** Status of a single sync run execution. */
export type SyncRunStatus = 'running' | 'success' | 'failed';

/** Type of change detected on a row between syncs. */
export type ChangeType = 'new' | 'changed' | 'deleted';

/**
 * Record of a single sync run for a dataset.
 * Stored in dataset_syncs table.
 */
export interface DatasetSync {
  id: string;
  datasetId: string;
  syncedAt: string;           // ISO timestamp
  status: SyncRunStatus;
  rowsTotal: number;
  rowsNew: number;
  rowsChanged: number;
  rowsDeleted: number;
  rowsUnchanged: number;
  sourceSnapshotHash: string | null;
  errorLog: string | null;
  durationMs: number | null;
}

/**
 * A single cell-level change detected during a sync.
 * If change_type is 'new' or 'deleted', column_name / old_value / new_value may be null.
 * For 'changed', one record per modified column.
 */
export interface DatasetChange {
  id: string;
  datasetId: string;
  syncId: string;
  rowKey: string;             // Stringified key column values, e.g. "Banda Aceh"
  changeType: ChangeType;
  columnName: string | null;  // null for row-level new/deleted
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;          // ISO timestamp
}

/**
 * Result of comparing old vs new rows by key columns.
 * Produced by DiffEngine, consumed by SyncService.
 */
export interface DiffResult {
  /** Rows that exist in new data but not in old. */
  added: DiffRow[];
  /** Rows that exist in both, but with at least one column changed. */
  changed: DiffChangedRow[];
  /** Rows that exist in old data but not in new. */
  deleted: DiffRow[];
  /** Rows identical in both old and new data. */
  unchanged: DiffRow[];
}

/** A single data row with its key for diffing. */
export interface DiffRow {
  rowKey: string;
  data: Record<string, unknown>;
}

/** A row with per-column change details. */
export interface DiffChangedRow {
  rowKey: string;
  oldData: Record<string, unknown>;
  newData: Record<string, unknown>;
  /** Columns that changed, with old and new values. */
  changedColumns: Array<{
    column: string;
    oldValue: string | null;
    newValue: string | null;
  }>;
}

/** Summary stats from a sync run. */
export interface SyncStats {
  rowsTotal: number;
  rowsNew: number;
  rowsChanged: number;
  rowsDeleted: number;
  rowsUnchanged: number;
  durationMs: number;
}

/** Response from POST /api/datasets/:id/sync */
export interface SyncResponse {
  sync: DatasetSync;
  stats: SyncStats;
}

/** Query params for GET /api/datasets/:id/changes */
export interface ChangeQueryParams {
  page?: number;
  pageSize?: number;
  syncId?: string;
  changeType?: ChangeType;
  rowKey?: string;
}
