/**
 * Source service.
 * Handles connecting to data sources, fetching raw data, saving snapshots,
 * applying extraction preview, and creating datasets from extraction.
 */

import { createHash } from 'crypto';
import path from 'path';
import { AppError, assertFound } from '../../core/errors.js';
import { logger } from '../../core/logger.js';
import { snapshotRepository, type SnapshotRecord } from './snapshot.repository.js';
import { datasetRepository, datasetRowRepository } from '../dataset/dataset.repository.js';
import { testConnection as gsTestConnection, fetchAllCells, detectColumnType } from '../dataset/google-sheets.service.js';
import { applyExtraction, previewToRowData } from './extractor.service.js';
import { parseFileBuffer } from './connectors/connector.factory.js';
import { fetchRestApi, testRestConnection, type RestConnectorConfig } from './connectors/rest.connector.js';
import { parseExcelBuffer } from './connectors/excel.connector.js';
import type {
  CellGrid,
  ExtractionConfig,
  ExtractionPreview,
  FetchRawResponse,
  RawSnapshot,
  SheetUploadResult,
  MultiSheetUploadResponse,
} from '@etl-dashboard/shared';

const log = logger.child({ module: 'source' });

/**
 * Test connection to a data source without fetching data.
 *
 * @param sourceType - Type of source connector
 * @param sourceConfig - Connector-specific configuration
 * @returns Source metadata (title, sheets, etc.)
 * @throws AppError(400) if source type not supported
 * @throws AppError(502) if connection fails
 */
export async function connectSource(
  sourceType: string,
  sourceConfig: Record<string, unknown>,
) {
  if (sourceType === 'google_sheets') {
    const spreadsheetId = sourceConfig.spreadsheetId as string;
    if (!spreadsheetId) {
      throw new AppError(400, 'spreadsheetId is required');
    }
    return gsTestConnection(spreadsheetId);
  }

  if (sourceType === 'csv' || sourceType === 'excel') {
    // File-based sources don't need a connection test — return basic info
    return { type: sourceType, status: 'ready' };
  }

  if (sourceType === 'rest_api') {
    const config = sourceConfig as unknown as RestConnectorConfig;
    if (!config.url) throw new AppError(400, 'url is required for REST API connector');
    return testRestConnection(config);
  }

  throw new AppError(400, `Unsupported source type: ${sourceType}`);
}

/**
 * Hash a cell grid for detecting changes between snapshots.
 *
 * @param data - Raw cell grid
 * @returns SHA-256 hash string
 */
function hashGrid(data: CellGrid): string {
  const content = JSON.stringify(data);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Fetch all raw cells from a source and save as snapshot.
 * If datasetId is provided, links snapshot to the dataset.
 *
 * @param sourceType - Type of source connector
 * @param sourceConfig - Connector-specific configuration
 * @param datasetId - Optional dataset to link snapshot to
 * @returns Fetch result with snapshot ID and cell grid
 * @throws AppError(400) if source type not supported
 * @throws AppError(502) if fetch fails
 */
export async function fetchRaw(
  sourceType: string,
  sourceConfig: Record<string, unknown>,
  datasetId?: string,
): Promise<FetchRawResponse> {
  log.info('Fetching raw data', { sourceType, datasetId });

  let data: CellGrid;
  let totalRows: number;
  let totalCols: number;

  if (sourceType === 'google_sheets') {
    const spreadsheetId = sourceConfig.spreadsheetId as string;
    const sheetName = sourceConfig.sheetName as string | undefined;
    if (!spreadsheetId) {
      throw new AppError(400, 'spreadsheetId is required');
    }

    const result = await fetchAllCells(spreadsheetId, sheetName);
    data = result.data;
    totalRows = result.totalRows;
    totalCols = result.totalCols;
  } else if (sourceType === 'rest_api') {
    const config = sourceConfig as unknown as RestConnectorConfig;
    if (!config.url) throw new AppError(400, 'url is required for REST API connector');
    const result = await fetchRestApi(config);
    data = result.data;
    totalRows = result.totalRows;
    totalCols = result.totalCols;
  } else {
    throw new AppError(400, `Unsupported source type: ${sourceType}`);
  }

  // Save snapshot
  const sourceHash = hashGrid(data);
  const snapshot = await snapshotRepository.create({
    datasetId: datasetId || null,
    snapshotData: data,
    totalRows,
    totalCols,
    sourceHash,
  });

  log.info('Raw snapshot saved', { snapshotId: snapshot.id, totalRows, totalCols });

  return {
    snapshotId: snapshot.id,
    data,
    totalRows,
    totalCols,
  };
}

/**
 * Get a raw snapshot by ID.
 *
 * @param snapshotId - UUID of the snapshot
 * @returns Snapshot record
 * @throws AppError(404) if not found
 */
export async function getSnapshot(snapshotId: string): Promise<SnapshotRecord> {
  const snapshot = await snapshotRepository.findById(snapshotId);
  assertFound(snapshot, 'Snapshot not found');
  return snapshot;
}

/**
 * Get the latest raw snapshot for a dataset.
 *
 * @param datasetId - UUID of the dataset
 * @returns Snapshot record or null
 */
export async function getLatestSnapshot(datasetId: string): Promise<SnapshotRecord | null> {
  return snapshotRepository.findLatestByDataset(datasetId);
}

/**
 * Determine source type from file extension.
 *
 * @param filename - Original filename
 * @returns 'csv' or 'excel'
 * @throws AppError(400) if extension is not supported
 */
function detectSourceType(filename: string): 'csv' | 'excel' {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls') return 'excel';
  throw new AppError(400, `Unsupported file extension: .${ext}`);
}

/**
 * Handle file upload: parse buffer into CellGrid and save as raw snapshot.
 * This is the file-based equivalent of fetchRaw() for Google Sheets.
 *
 * @param buffer - File content buffer from multer
 * @param originalName - Sanitized original filename
 * @param options - Optional parsing options (sheetName for Excel)
 * @returns Fetch result with snapshot ID and cell grid (same shape as fetchRaw)
 * @throws AppError(400) if file is malformed or empty
 */
export async function uploadFileSource(
  buffer: Buffer,
  originalName: string,
  options?: { sheetName?: string; datasetId?: string },
): Promise<FetchRawResponse & { sourceType: 'csv' | 'excel'; sheetNames?: string[] }> {
  const sourceType = detectSourceType(originalName);

  log.info('Parsing uploaded file', { sourceType, filename: originalName });

  const result = parseFileBuffer(sourceType, buffer, {
    sheetName: options?.sheetName,
  });

  // Save snapshot
  const sourceHash = hashGrid(result.data);
  const snapshot = await snapshotRepository.create({
    datasetId: options?.datasetId || null,
    snapshotData: result.data,
    totalRows: result.totalRows,
    totalCols: result.totalCols,
    sourceHash,
  });

  log.info('File snapshot saved', {
    snapshotId: snapshot.id,
    sourceType,
    totalRows: result.totalRows,
    totalCols: result.totalCols,
  });

  return {
    snapshotId: snapshot.id,
    data: result.data,
    totalRows: result.totalRows,
    totalCols: result.totalCols,
    sourceType,
    sheetNames: result.sheetNames,
  };
}

/**
 * Apply extraction config to a snapshot and return preview (no save).
 *
 * @param snapshotId - UUID of the snapshot to extract from
 * @param config - Extraction configuration
 * @returns Extraction preview with headers and clean rows
 * @throws AppError(404) if snapshot not found
 */
export async function extractPreview(
  snapshotId: string,
  config: ExtractionConfig,
): Promise<ExtractionPreview> {
  console.log('[extractPreview] snapshotId:', snapshotId);
  console.log('[extractPreview] config.excludeColumns:', config.excludeColumns);
  console.log('[extractPreview] config.columnStart:', config.columnStart);
  console.log('[extractPreview] config.columnEnd:', config.columnEnd);
  const snapshot = await getSnapshot(snapshotId);
  const grid = snapshot.snapshotData as CellGrid;
  const result = applyExtraction(grid, config);
  console.log('[extractPreview] result.headers:', result.headers);
  console.log('[extractPreview] result.totalRows:', result.totalRows);
  return result;
}

/**
 * Create a dataset from extraction: apply config to snapshot, save clean rows.
 *
 * @param params - Creation parameters
 * @returns Created dataset with row count info
 * @throws AppError(404) if snapshot not found
 */
export async function createDatasetFromExtraction(params: {
  name: string;
  description?: string;
  sourceType: 'google_sheets' | 'csv' | 'excel' | 'rest_api';
  sourceConfig: Record<string, unknown>;
  snapshotId: string;
  extractionConfig: ExtractionConfig;
  createdBy: string;
}) {
  const snapshot = await getSnapshot(params.snapshotId);
  const grid = snapshot.snapshotData as CellGrid;

  // Apply extraction
  const preview = applyExtraction(grid, params.extractionConfig);
  const rowData = previewToRowData(preview);

  // Detect column types from extracted data
  const columns = preview.headers.map((header, idx) => {
    const values = preview.rows.map((row) => row[idx]);
    return {
      name: header,
      originalName: header,
      type: detectColumnType(values),
    };
  });

  // Create dataset
  const dataset = await datasetRepository.create({
    name: params.name,
    description: params.description || null,
    sourceType: params.sourceType,
    sourceConfig: params.sourceConfig,
    extractionConfig: params.extractionConfig as unknown as Record<string, unknown>,
    columns,
    createdBy: params.createdBy,
    syncStatus: 'success',
    lastSyncedAt: new Date(),
  });

  // Link snapshot to dataset
  await snapshotRepository.linkToDataset(params.snapshotId, dataset.id);

  // Insert rows
  if (rowData.length > 0) {
    const rowInserts = rowData.map((row) => ({
      datasetId: dataset.id,
      data: row.data,
      rowNumber: row.rowNumber,
    }));
    await datasetRowRepository.insertBatch(rowInserts);
  }

  log.info('Dataset created from extraction', {
    datasetId: dataset.id,
    rows: rowData.length,
    columns: columns.length,
  });

  return {
    dataset,
    rowCount: rowData.length,
    columns,
  };
}

/**
 * Parse multiple sheets from an Excel buffer and save each as a raw snapshot.
 * Used for multi-sheet wizard: "separate datasets" or "merge" mode.
 *
 * @param buffer - Excel file buffer
 * @param originalName - Original filename (used to detect type)
 * @param sheetNames - Which sheets to parse (empty = all sheets)
 * @returns All available sheet names + parsed results per requested sheet
 * @throws AppError(400) if file is not Excel or sheets not found
 */
export async function uploadMultipleSheets(
  buffer: Buffer,
  originalName: string,
  sheetNames: string[],
): Promise<MultiSheetUploadResponse> {
  const ext = path.extname(originalName).toLowerCase().replace('.', '');
  if (ext !== 'xlsx' && ext !== 'xls') {
    throw new AppError(400, 'Multi-sheet upload only supported for Excel (.xlsx, .xls) files');
  }

  log.info('Uploading multiple sheets', { sheets: sheetNames });

  // Get all sheet names from workbook first
  const firstResult = parseExcelBuffer(buffer);
  const allSheetNames = firstResult.sheetNames;

  // If no specific sheets requested, use all
  const targetSheets = sheetNames.length > 0 ? sheetNames : allSheetNames;

  // Parse each sheet and save as separate snapshot
  const sheets: SheetUploadResult[] = [];

  for (const sheetName of targetSheets) {
    const result = parseExcelBuffer(buffer, sheetName);
    const sourceHash = hashGrid(result.data);

    const snapshot = await snapshotRepository.create({
      datasetId: null,
      snapshotData: result.data,
      totalRows: result.totalRows,
      totalCols: result.totalCols,
      sourceHash,
    });

    sheets.push({
      sheetName,
      snapshotId: snapshot.id,
      data: result.data,
      totalRows: result.totalRows,
      totalCols: result.totalCols,
    });

    log.info('Sheet snapshot saved', { sheetName, snapshotId: snapshot.id });
  }

  return { allSheetNames, sheets };
}

/**
 * Merge multiple snapshots row-wise into a single CellGrid for preview.
 * All snapshots must have the same column structure.
 * Headers are taken from the first snapshot; subsequent snapshots skip their header rows.
 *
 * @param snapshotIds - Snapshot IDs to merge in order
 * @param config - Extraction config to apply to merged data
 * @returns Extraction preview of merged dataset
 * @throws AppError(404) if any snapshot not found
 */
export async function mergeSheetsPreview(
  snapshotIds: string[],
  config: ExtractionConfig,
): Promise<ExtractionPreview> {
  if (snapshotIds.length === 0) {
    throw new AppError(400, 'At least one snapshot ID is required');
  }

  const grids: CellGrid[] = [];

  for (const id of snapshotIds) {
    const snapshot = await getSnapshot(id);
    grids.push(snapshot.snapshotData as CellGrid);
  }

  // Merge: first grid as-is, subsequent grids skip header rows
  const headerRows = config.headerRowIndices.length > 0
    ? Math.max(...config.headerRowIndices) + 1
    : config.dataStartRow;

  const merged: CellGrid = [...grids[0]];
  for (let i = 1; i < grids.length; i++) {
    // Skip header rows from subsequent grids
    merged.push(...grids[i].slice(headerRows));
  }

  log.info('Sheets merged for preview', {
    sheets: snapshotIds.length,
    totalRows: merged.length,
  });

  return applyExtraction(merged, config);
}

/**
 * Merge multiple sheet snapshots row-wise, save as a new raw snapshot.
 * Used for the wizard merge-mode flow to get a combined snapshotId for extraction.
 * Subsequent grids skip their first row (assumed header row).
 *
 * @param snapshotIds - Snapshot IDs to merge in order
 * @returns Merged snapshot info (same shape as fetch-raw)
 * @throws AppError(404) if any snapshot not found
 */
export async function mergeAndSaveSnapshot(snapshotIds: string[]): Promise<{
  snapshotId: string;
  data: CellGrid;
  totalRows: number;
  totalCols: number;
}> {
  if (snapshotIds.length === 0) {
    throw new AppError(400, 'At least one snapshot ID is required');
  }

  const grids: CellGrid[] = [];
  for (const id of snapshotIds) {
    const snapshot = await getSnapshot(id);
    grids.push(snapshot.snapshotData as CellGrid);
  }

  // Merge: first grid as-is, subsequent grids skip first row (header)
  const merged: CellGrid = [...grids[0]!];
  for (let i = 1; i < grids.length; i++) {
    merged.push(...grids[i]!.slice(1));
  }

  const sourceHash = hashGrid(merged);
  const snapshot = await snapshotRepository.create({
    datasetId: null,
    snapshotData: merged,
    totalRows: merged.length,
    totalCols: merged[0]?.length ?? 0,
    sourceHash,
  });

  log.info('Merged snapshot saved', {
    sheets: snapshotIds.length,
    snapshotId: snapshot.id,
    totalRows: merged.length,
  });

  return {
    snapshotId: snapshot.id,
    data: merged,
    totalRows: merged.length,
    totalCols: merged[0]?.length ?? 0,
  };
}
