/**
 * Connector factory.
 * Maps source type string to the appropriate parser function.
 * Used by source.service to parse uploaded file buffers into CellGrid.
 */

import type { CellGrid } from '@etl-dashboard/shared';
import { parseCsvBuffer } from './csv.connector.js';
import { parseExcelBuffer } from './excel.connector.js';
import { AppError } from '../../../core/errors.js';

/** Standard result from any file connector */
export interface FileParseResult {
  /** Raw 2D cell grid */
  data: CellGrid;
  /** Total rows */
  totalRows: number;
  /** Total columns */
  totalCols: number;
  /** Available sheet names (Excel only) */
  sheetNames?: string[];
}

/**
 * Parse a file buffer into a CellGrid based on source type.
 *
 * @param sourceType - File type: 'csv' or 'excel'
 * @param buffer - Raw file buffer
 * @param options - Optional parsing options (sheetName for Excel, encoding for CSV)
 * @returns Parsed cell grid with dimensions
 * @throws AppError(400) if source type is not a file type
 */
export function parseFileBuffer(
  sourceType: 'csv' | 'excel',
  buffer: Buffer,
  options?: { sheetName?: string; encoding?: BufferEncoding },
): FileParseResult {
  if (sourceType === 'csv') {
    return parseCsvBuffer(buffer, options?.encoding);
  }

  if (sourceType === 'excel') {
    const result = parseExcelBuffer(buffer, options?.sheetName);
    return {
      data: result.data,
      totalRows: result.totalRows,
      totalCols: result.totalCols,
      sheetNames: result.sheetNames,
    };
  }

  throw new AppError(400, `"${sourceType}" is not a file-based source type`);
}
