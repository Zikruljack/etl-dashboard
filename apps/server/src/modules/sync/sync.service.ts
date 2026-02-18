/**
 * Sync service — Phase 3 implementation.
 * Orchestrates: fetch raw → save snapshot → extract → transform → diff → update rows → save changes.
 */

import { createHash } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { AppError, assertFound } from '../../core/errors.js';
import { logger } from '../../core/logger.js';
import { db } from '../../config/database.js';
import { datasetRepository, datasetRowRepository } from '../dataset/dataset.repository.js';
import { snapshotRepository } from '../source/snapshot.repository.js';
import { pipelineRepository } from '../pipeline/pipeline.repository.js';
import { syncRepository } from './sync.repository.js';
import { changeRepository } from './change.repository.js';
import { diffRows, computeRowKey, computeRowHash } from './diff-engine.js';
import { applyExtraction, previewToRowData } from '../source/extractor.service.js';
import { fetchAllCells, detectColumnType } from '../dataset/google-sheets.service.js';
import { PipelineExecutor } from '../pipeline/pipeline.executor.js';
import { datasetRows } from '../../db/schema/index.js';
import type { ExtractionConfig, SyncResponse, DatasetSync, StepType, StepConfig, CellGrid } from '@etl-dashboard/shared';

/**
 * Convert a SyncRecord to the shared DatasetSync type.
 *
 * @param r - DB record
 * @returns Serialized DatasetSync DTO
 */
function toSyncDto(r: Awaited<ReturnType<typeof syncRepository.findById>>): DatasetSync {
  if (!r) throw new Error('sync record not found');
  return {
    id: r.id,
    datasetId: r.datasetId,
    syncedAt: r.syncedAt.toISOString(),
    status: r.status as DatasetSync['status'],
    rowsTotal: r.rowsTotal,
    rowsNew: r.rowsNew,
    rowsChanged: r.rowsChanged,
    rowsDeleted: r.rowsDeleted,
    rowsUnchanged: r.rowsUnchanged,
    sourceSnapshotHash: r.sourceSnapshotHash,
    errorLog: r.errorLog,
    durationMs: r.durationMs,
  };
}

/**
 * Trigger a full sync for a dataset.
 * Supports Google Sheets (re-fetches), CSV/Excel (re-uses latest snapshot).
 *
 * Flow:
 * 1. Create sync run record (status: running)
 * 2. Fetch raw data from source (or re-use last snapshot for file sources)
 * 3. Save raw snapshot
 * 4. Apply extraction config
 * 5. Apply pipeline transforms (if active pipeline exists)
 * 6. Diff new rows against existing DB rows using key columns
 * 7. Update dataset_rows (insert/update/delete)
 * 8. Save change records to dataset_changes
 * 9. Finalize sync record with stats
 * 10. Update dataset sync status
 *
 * @param datasetId - UUID of the dataset to sync
 * @returns Sync result with stats and sync record
 * @throws AppError(400) if extraction config missing or source not supported for re-sync
 * @throws AppError(404) if dataset not found
 * @throws AppError(502) if external source unavailable
 */
export async function runSync(datasetId: string): Promise<SyncResponse> {
  const dataset = await datasetRepository.findById(datasetId);
  assertFound(dataset, 'Dataset not found');

  const extractionConfig = dataset.extractionConfig as unknown as ExtractionConfig | null;
  if (!extractionConfig) {
    throw new AppError(400, 'Dataset has no extraction config. Please configure extraction first.');
  }

  const syncLog = logger.child({ module: 'sync', datasetId });
  const startedAt = Date.now();

  // 1. Create sync run record
  const syncRecord = await syncRepository.create({
    datasetId,
    status: 'running',
    rowsTotal: 0,
    rowsNew: 0,
    rowsChanged: 0,
    rowsDeleted: 0,
    rowsUnchanged: 0,
  });

  // Update dataset status to syncing
  await datasetRepository.updateSyncStatus(datasetId, 'syncing');

  try {
    // 2. Fetch raw data from source
    let rawGrid: CellGrid;
    let sourceHash: string;

    if (dataset.sourceType === 'google_sheets') {
      const config = dataset.sourceConfig as { spreadsheetId: string; sheetName?: string };
      syncLog.info('Fetching raw data from Google Sheets', { spreadsheetId: config.spreadsheetId });
      const rawResult = await fetchAllCells(config.spreadsheetId, config.sheetName);
      rawGrid = rawResult.data;
      sourceHash = createHash('sha256').update(JSON.stringify(rawGrid)).digest('hex');

      // 3. Save raw snapshot
      await snapshotRepository.create({
        datasetId,
        snapshotData: rawGrid,
        totalRows: rawResult.totalRows,
        totalCols: rawResult.totalCols,
        sourceHash,
      });
    } else {
      // CSV/Excel: re-use latest snapshot (file already uploaded)
      const snapshot = await snapshotRepository.findLatestByDataset(datasetId);
      if (!snapshot) {
        throw new AppError(400, 'No raw snapshot found. Please re-upload the file to sync.');
      }
      rawGrid = snapshot.snapshotData as unknown as CellGrid;
      sourceHash = snapshot.sourceHash || '';
      syncLog.info('Re-using latest snapshot for file source', { snapshotId: snapshot.id });
    }

    // Update sync record with source hash
    await syncRepository.update(syncRecord.id, { sourceSnapshotHash: sourceHash } as any);

    // 4. Apply extraction config
    const preview = applyExtraction(rawGrid, extractionConfig);
    const rawRowData = previewToRowData(preview);

    // 5. Apply pipeline transforms (if active pipeline exists)
    let finalRows: Record<string, unknown>[];
    let finalColumns: string[];

    const pipeline = await pipelineRepository.findByDataset(datasetId);
    if (pipeline && pipeline.isActive && pipeline.steps.length > 0) {
      syncLog.info('Applying pipeline transforms', { steps: pipeline.steps.length });
      const executor = new PipelineExecutor();
      const tabularInput = {
        columns: preview.headers,
        rows: rawRowData.map((r) => r.data),
      };
      const execSteps = pipeline.steps.map((s) => ({
        sortOrder: s.sortOrder,
        type: s.type as StepType,
        config: s.config as unknown as StepConfig,
      }));
      const result = executor.execute(tabularInput, execSteps);
      finalRows = result.data.rows;
      finalColumns = result.data.columns;
    } else {
      finalRows = rawRowData.map((r) => r.data);
      finalColumns = preview.headers;
    }

    // Detect column types
    const columnDefs = finalColumns.map((header) => {
      const values = finalRows.map((row) => row[header]);
      return { name: header, originalName: header, type: detectColumnType(values) };
    });

    // 6. Diff new rows against existing DB rows
    const keyColumns = extractionConfig.keyColumns || [];
    const existingRows = await datasetRowRepository.findAllByDataset(datasetId);

    // Check if existing rows have rowKey populated (from a previous Phase 3 sync)
    const hasRowKeys = existingRows.length > 0 && existingRows[0].rowKey !== null;
    const oldRowData = existingRows.map((r) => r.data as Record<string, unknown>);
    const diff = diffRows(oldRowData, finalRows, keyColumns);

    syncLog.info('Diff result', {
      added: diff.added.length,
      changed: diff.changed.length,
      deleted: diff.deleted.length,
      unchanged: diff.unchanged.length,
    });

    // 7. Update dataset_rows based on diff
    const now = new Date();

    if (!hasRowKeys && existingRows.length > 0) {
      // Legacy rows have no rowKey — do a clean replace with proper tracking
      syncLog.info('Legacy rows detected, performing clean sync with tracking');
      await datasetRowRepository.deleteByDataset(datasetId);
    } else {
      // Phase 3 sync — selective update
      // Build map of existing rows by rowKey for fast lookup
      const existingMap = new Map(
        existingRows
          .filter((r) => r.rowKey !== null)
          .map((r) => [r.rowKey!, r]),
      );

      // Delete removed rows
      for (const del of diff.deleted) {
        const existing = existingMap.get(del.rowKey);
        if (existing) {
          await datasetRowRepository.delete(existing.id);
        }
      }

      // Update changed rows
      for (const changed of diff.changed) {
        const existing = existingMap.get(changed.rowKey);
        if (existing) {
          const newHash = computeRowHash(changed.newData);
          await db
            .update(datasetRows)
            .set({
              data: changed.newData,
              rowHash: newHash,
              lastChangedAt: now,
              syncId: syncRecord.id,
            })
            .where(eq(datasetRows.id, existing.id));
        }
      }

      // Update unchanged rows — just update syncId (mark as seen)
      for (const unchanged of diff.unchanged) {
        const existing = existingMap.get(unchanged.rowKey);
        if (existing) {
          await db
            .update(datasetRows)
            .set({ syncId: syncRecord.id })
            .where(eq(datasetRows.id, existing.id));
        }
      }
    }

    // Insert new rows (and re-insert legacy clean-synced rows as "added")
    const rowsToInsert = !hasRowKeys && existingRows.length > 0
      ? finalRows  // all rows after clean replace
      : diff.added.map((r) => r.data);

    if (rowsToInsert.length > 0) {
      const rowInserts = rowsToInsert.map((rowData, idx) => {
        const rowKey = computeRowKey(rowData, keyColumns);
        const rowHash = computeRowHash(rowData);
        return {
          datasetId,
          data: rowData,
          rowNumber: idx + 1,
          rowKey,
          rowHash,
          firstSeenAt: now,
          lastChangedAt: now,
          syncId: syncRecord.id,
        };
      });
      await datasetRowRepository.insertBatch(rowInserts as any);
    }

    // 8. Save change records
    const changeInserts: Parameters<typeof changeRepository.insertBatch>[0] = [];

    for (const added of diff.added) {
      changeInserts.push({
        datasetId,
        syncId: syncRecord.id,
        rowKey: added.rowKey,
        changeType: 'new',
        columnName: null,
        oldValue: null,
        newValue: null,
        changedAt: now,
      });
    }

    for (const changed of diff.changed) {
      for (const col of changed.changedColumns) {
        changeInserts.push({
          datasetId,
          syncId: syncRecord.id,
          rowKey: changed.rowKey,
          changeType: 'changed',
          columnName: col.column,
          oldValue: col.oldValue,
          newValue: col.newValue,
          changedAt: now,
        });
      }
    }

    for (const deleted of diff.deleted) {
      changeInserts.push({
        datasetId,
        syncId: syncRecord.id,
        rowKey: deleted.rowKey,
        changeType: 'deleted',
        columnName: null,
        oldValue: null,
        newValue: null,
        changedAt: now,
      });
    }

    if (changeInserts.length > 0) {
      await changeRepository.insertBatch(changeInserts);
    }

    // 9. Finalize sync record
    const durationMs = Date.now() - startedAt;
    const stats = {
      rowsTotal: finalRows.length,
      rowsNew: diff.added.length,
      rowsChanged: diff.changed.length,
      rowsDeleted: diff.deleted.length,
      rowsUnchanged: diff.unchanged.length,
    };
    const finalized = await syncRepository.markSuccess(syncRecord.id, stats, durationMs);

    // 10. Update dataset sync status
    await datasetRepository.updateSyncStatus(datasetId, 'success', {
      columns: columnDefs,
      lastSyncedAt: now,
    } as any);

    syncLog.info('Sync completed', { ...stats, durationMs });

    return {
      sync: toSyncDto(finalized),
      stats: { ...stats, durationMs },
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const errMsg = error instanceof Error ? error.message : String(error);
    syncLog.error('Sync failed', { error: errMsg });

    await syncRepository.markFailed(syncRecord.id, errMsg, durationMs);
    await datasetRepository.updateSyncStatus(datasetId, 'error');
    throw error;
  }
}

/**
 * Get paginated sync history for a dataset.
 *
 * @param datasetId - UUID of the dataset
 * @returns Array of sync records (newest first)
 */
export async function getSyncHistory(datasetId: string) {
  await datasetRepository.findById(datasetId).then((d) => assertFound(d, 'Dataset not found'));
  const records = await syncRepository.findByDataset(datasetId);
  return records.map(toSyncDto);
}

/**
 * Get paginated change timeline for a dataset.
 *
 * @param datasetId - UUID of the dataset
 * @param options - Filter and pagination options
 * @returns Paginated change records
 */
export async function getChangeHistory(
  datasetId: string,
  options: {
    page?: number;
    pageSize?: number;
    syncId?: string;
    changeType?: 'new' | 'changed' | 'deleted';
  } = {},
) {
  await datasetRepository.findById(datasetId).then((d) => assertFound(d, 'Dataset not found'));

  const page = options.page || 1;
  const pageSize = options.pageSize || 50;
  const offset = (page - 1) * pageSize;

  const { data, total } = await changeRepository.findByDataset(datasetId, {
    limit: pageSize,
    offset,
    syncId: options.syncId,
    changeType: options.changeType,
  });

  return {
    data: data.map((r) => ({
      id: r.id,
      datasetId: r.datasetId,
      syncId: r.syncId,
      rowKey: r.rowKey,
      changeType: r.changeType,
      columnName: r.columnName,
      oldValue: r.oldValue,
      newValue: r.newValue,
      changedAt: r.changedAt.toISOString(),
    })),
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Get full change history for a single row (all syncs where this row changed).
 *
 * @param datasetId - UUID of the dataset
 * @param rowKey - Stringified key column values identifying the row
 * @returns Array of changes for this row across all syncs
 */
export async function getRowHistory(datasetId: string, rowKey: string) {
  await datasetRepository.findById(datasetId).then((d) => assertFound(d, 'Dataset not found'));
  const records = await changeRepository.findByRowKey(datasetId, rowKey);
  return records.map((r) => ({
    id: r.id,
    syncId: r.syncId,
    changeType: r.changeType,
    columnName: r.columnName,
    oldValue: r.oldValue,
    newValue: r.newValue,
    changedAt: r.changedAt.toISOString(),
  }));
}
