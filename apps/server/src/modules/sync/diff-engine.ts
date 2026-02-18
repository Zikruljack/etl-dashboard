import { createHash } from 'crypto';
import type { DiffResult, DiffRow, DiffChangedRow } from '@etl-dashboard/shared';

/**
 * Compute a stable row key string from a data row by concatenating
 * the values of the specified key columns.
 * Falls back to SHA256 of the full row if no key columns are given.
 *
 * @param data - Row data as key-value map
 * @param keyColumns - Column names to use as identity
 * @returns Stable string key for this row
 */
export function computeRowKey(data: Record<string, unknown>, keyColumns: string[]): string {
  if (keyColumns.length === 0) {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }
  return keyColumns.map((col) => String(data[col] ?? '')).join('||');
}

/**
 * Compute a SHA256 hash of a row's data for change detection.
 * Uses a deterministic JSON representation (sorted keys).
 *
 * @param data - Row data
 * @returns SHA256 hex digest
 */
export function computeRowHash(data: Record<string, unknown>): string {
  const sorted = Object.fromEntries(
    Object.entries(data).sort(([a], [b]) => a.localeCompare(b)),
  );
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

/**
 * Compare old and new datasets row-by-row using key columns.
 * Returns which rows were added, changed, deleted, or unchanged.
 *
 * Algorithm:
 * 1. Build a Map<rowKey, rowData> for each dataset.
 * 2. Iterate new rows — if key exists in old: compare hashes → changed/unchanged; else → new.
 * 3. Keys in old but not in new → deleted.
 *
 * @param oldRows - Previous extraction result (from DB)
 * @param newRows - New extraction result (just fetched)
 * @param keyColumns - Columns used as row identity
 * @returns DiffResult with added/changed/deleted/unchanged buckets
 */
export function diffRows(
  oldRows: Array<Record<string, unknown>>,
  newRows: Array<Record<string, unknown>>,
  keyColumns: string[],
): DiffResult {
  const oldMap = new Map<string, Record<string, unknown>>();
  for (const row of oldRows) {
    const key = computeRowKey(row, keyColumns);
    oldMap.set(key, row);
  }

  const added: DiffRow[] = [];
  const changed: DiffChangedRow[] = [];
  const unchanged: DiffRow[] = [];
  const seenKeys = new Set<string>();

  for (const newRow of newRows) {
    const key = computeRowKey(newRow, keyColumns);
    seenKeys.add(key);

    if (!oldMap.has(key)) {
      added.push({ rowKey: key, data: newRow });
      continue;
    }

    const oldRow = oldMap.get(key)!;
    const oldHash = computeRowHash(oldRow);
    const newHash = computeRowHash(newRow);

    if (oldHash === newHash) {
      unchanged.push({ rowKey: key, data: newRow });
      continue;
    }

    // Detect per-column changes
    const allColumns = new Set([...Object.keys(oldRow), ...Object.keys(newRow)]);
    const changedColumns: DiffChangedRow['changedColumns'] = [];

    for (const col of allColumns) {
      const oldVal = String(oldRow[col] ?? '');
      const newVal = String(newRow[col] ?? '');
      if (oldVal !== newVal) {
        changedColumns.push({ column: col, oldValue: oldVal || null, newValue: newVal || null });
      }
    }

    changed.push({ rowKey: key, oldData: oldRow, newData: newRow, changedColumns });
  }

  // Rows in old but not seen in new → deleted
  const deleted: DiffRow[] = [];
  for (const [key, data] of oldMap.entries()) {
    if (!seenKeys.has(key)) {
      deleted.push({ rowKey: key, data });
    }
  }

  return { added, changed, deleted, unchanged };
}
