import { AppError, assertFound } from '../../core/errors.js';
import { logger } from '../../core/logger.js';
import { datasetRepository, datasetRowRepository, type DatasetRecord } from './dataset.repository.js';
import { fetchAllCells, detectColumnType } from './google-sheets.service.js';
import { snapshotRepository } from '../source/snapshot.repository.js';
import { applyExtraction, previewToRowData } from '../source/extractor.service.js';
import type { CellGrid, ExtractionConfig } from '@etl-dashboard/shared';
import { createHash } from 'crypto';

/** Parameters for creating a new dataset */
interface CreateDatasetParams {
  name: string;
  description?: string;
  sourceType: 'google_sheets' | 'csv' | 'excel';
  sourceConfig: Record<string, unknown>;
  createdBy: string;
}

/**
 * Create a new dataset record.
 *
 * @param data - Dataset creation parameters
 * @returns Newly created dataset
 */
export async function createDataset(data: CreateDatasetParams): Promise<DatasetRecord> {
  return datasetRepository.create({
    name: data.name,
    description: data.description || null,
    sourceType: data.sourceType,
    sourceConfig: data.sourceConfig,
    createdBy: data.createdBy,
  });
}

/**
 * List all datasets ordered by creation date.
 *
 * @returns Array of all datasets
 */
export async function listDatasets(): Promise<DatasetRecord[]> {
  return datasetRepository.findAllOrdered();
}

/**
 * Get a single dataset by ID.
 *
 * @param id - Dataset UUID
 * @returns Dataset record
 * @throws AppError(404) if not found
 */
export async function getDataset(id: string): Promise<DatasetRecord> {
  const dataset = await datasetRepository.findById(id);
  assertFound(dataset, 'Dataset not found');
  return dataset;
}

/**
 * Update a dataset's metadata.
 *
 * @param id - Dataset UUID
 * @param data - Fields to update (name, description, sourceConfig)
 * @returns Updated dataset
 * @throws AppError(404) if not found
 */
export async function updateDataset(
  id: string,
  data: Partial<{ name: string; description: string; sourceConfig: Record<string, unknown> }>,
): Promise<DatasetRecord> {
  const dataset = await datasetRepository.update(id, { ...data, updatedAt: new Date() } as any);
  assertFound(dataset, 'Dataset not found');
  return dataset;
}

/**
 * Re-extract a dataset: update extraction config and re-apply to latest snapshot.
 * Replaces existing rows with newly extracted data.
 *
 * @param id - Dataset UUID
 * @param newConfig - New extraction configuration
 * @returns Re-extraction result with row count and detected columns
 * @throws AppError(404) if dataset or snapshot not found
 * @throws AppError(400) if no raw snapshot exists
 */
export async function reExtractDataset(
  id: string,
  newConfig: ExtractionConfig,
) {
  const dataset = await getDataset(id);

  // Find latest snapshot
  const snapshot = await snapshotRepository.findLatestByDataset(id);
  if (!snapshot) {
    throw new AppError(400, 'No raw snapshot found. Please sync or fetch raw data first.');
  }

  const grid = snapshot.snapshotData as unknown as CellGrid;
  const reExtractLog = logger.child({ module: 're-extract', datasetId: id });

  try {
    // 1. Apply new extraction config
    reExtractLog.info('Re-extracting with new config', {
      headerRows: newConfig.headerRowIndices,
      dataStartRow: newConfig.dataStartRow,
    });
    const preview = applyExtraction(grid, newConfig);
    const rowData = previewToRowData(preview);

    // 2. Detect column types
    const columns = preview.headers.map((header, idx) => {
      const values = preview.rows.map((row) => row[idx]);
      return {
        name: header,
        originalName: header,
        type: detectColumnType(values),
      };
    });

    // 3. Replace old rows with newly extracted rows
    await datasetRowRepository.deleteByDataset(id);

    if (rowData.length > 0) {
      const rowInserts = rowData.map((row) => ({
        datasetId: id,
        data: row.data,
        rowNumber: row.rowNumber,
      }));
      await datasetRowRepository.insertBatch(rowInserts);
    }

    // 4. Update dataset with new extraction config and columns
    await datasetRepository.update(id, {
      extractionConfig: newConfig as unknown as Record<string, unknown>,
      columns,
      updatedAt: new Date(),
    } as any);

    reExtractLog.info('Re-extraction completed', { rows: rowData.length, columns: columns.length });
    return { rowCount: rowData.length, columns };
  } catch (error) {
    reExtractLog.error('Re-extraction failed', { error: (error as Error).message });
    throw error;
  }
}

/**
 * Delete a dataset and all associated rows (cascade).
 *
 * @param id - Dataset UUID
 * @returns Deleted dataset
 * @throws AppError(404) if not found
 */
export async function deleteDataset(id: string): Promise<DatasetRecord> {
  const dataset = await datasetRepository.delete(id);
  assertFound(dataset, 'Dataset not found');
  return dataset;
}

/**
 * Sync dataset: fetch raw → save snapshot → apply extraction → replace rows.
 * Uses the stored extraction_config to produce clean data from new raw snapshot.
 *
 * @param id - Dataset UUID
 * @returns Sync result with row count and detected columns
 * @throws AppError(400) if extraction config is missing or source not supported
 * @throws AppError(502) if external source fails
 */
export async function syncDataset(id: string) {
  const dataset = await getDataset(id);

  if (dataset.sourceType !== 'google_sheets') {
    throw new AppError(400, 'Only Google Sheets sync is supported currently');
  }

  const extractionConfig = dataset.extractionConfig as unknown as ExtractionConfig | null;
  if (!extractionConfig) {
    throw new AppError(400, 'Dataset has no extraction config. Please configure extraction first.');
  }

  await datasetRepository.updateSyncStatus(id, 'syncing');
  const syncLog = logger.child({ module: 'sync', datasetId: id });

  try {
    const config = dataset.sourceConfig as {
      spreadsheetId: string;
      sheetName?: string;
    };

    // 1. Fetch raw data from source
    syncLog.info('Fetching raw data', { spreadsheetId: config.spreadsheetId });
    const rawResult = await fetchAllCells(config.spreadsheetId, config.sheetName);

    // 2. Save raw snapshot
    const sourceHash = createHash('sha256').update(JSON.stringify(rawResult.data)).digest('hex');
    await snapshotRepository.create({
      datasetId: id,
      snapshotData: rawResult.data,
      totalRows: rawResult.totalRows,
      totalCols: rawResult.totalCols,
      sourceHash,
    });

    // 3. Apply extraction config
    const preview = applyExtraction(rawResult.data, extractionConfig);
    const rowData = previewToRowData(preview);

    // 4. Detect column types
    const columns = preview.headers.map((header, idx) => {
      const values = preview.rows.map((row) => row[idx]);
      return {
        name: header,
        originalName: header,
        type: detectColumnType(values),
      };
    });

    // 5. Replace old rows with new
    await datasetRowRepository.deleteByDataset(id);

    if (rowData.length > 0) {
      const rowInserts = rowData.map((row) => ({
        datasetId: id,
        data: row.data,
        rowNumber: row.rowNumber,
      }));
      await datasetRowRepository.insertBatch(rowInserts);
    }

    await datasetRepository.updateSyncStatus(id, 'success', {
      columns,
      lastSyncedAt: new Date(),
    } as any);

    syncLog.info('Sync completed', { rows: rowData.length, columns: columns.length });
    return { rowCount: rowData.length, columns };
  } catch (error) {
    syncLog.error('Sync failed', { error: (error as Error).message });
    await datasetRepository.updateSyncStatus(id, 'error');
    throw error;
  }
}

/**
 * Get paginated row data for a dataset.
 *
 * @param id - Dataset UUID
 * @param options - Pagination options
 * @returns Paginated rows with metadata
 */
export async function getDatasetData(id: string, options: { page?: number; pageSize?: number } = {}) {
  const page = options.page || 1;
  const pageSize = options.pageSize || 50;
  const offset = (page - 1) * pageSize;

  const { data, total } = await datasetRowRepository.findByDataset(id, pageSize, offset);

  return {
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
