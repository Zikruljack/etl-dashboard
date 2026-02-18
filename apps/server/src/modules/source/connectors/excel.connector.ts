/**
 * Excel Connector.
 * Parses .xlsx and .xls file buffers into a CellGrid (2D string array).
 * Does NOT interpret headers — returns raw cells for the extraction step.
 */

import * as XLSX from 'xlsx';
import type { CellGrid } from '@etl-dashboard/shared';
import { AppError } from '../../../core/errors.js';
import { logger } from '../../../core/logger.js';

const log = logger.child({ module: 'excel-connector' });

/** Result from parsing an Excel buffer */
export interface ExcelParseResult {
  /** Raw 2D cell grid */
  data: CellGrid;
  /** Total rows */
  totalRows: number;
  /** Total columns (max across all rows) */
  totalCols: number;
  /** Available sheet names in the workbook */
  sheetNames: string[];
}

/**
 * Parse an Excel (.xlsx/.xls) buffer into a raw CellGrid.
 * Returns all cells as string|null — no header interpretation, no type casting.
 * Rows are padded to uniform column count.
 *
 * @param buffer - Raw file buffer
 * @param sheetName - Sheet tab to parse (default: first sheet)
 * @returns Parsed cell grid with dimensions and sheet names
 * @throws AppError(400) if file is malformed, empty, or sheet not found
 */
export function parseExcelBuffer(buffer: Buffer, sheetName?: string): ExcelParseResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: false,
      cellNF: false,
      cellText: true,
      raw: false,
    });
  } catch (err) {
    log.error('Excel parse failed', { error: (err as Error).message });
    throw new AppError(400, `Invalid Excel file: ${(err as Error).message}`);
  }

  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    throw new AppError(400, 'Excel file contains no sheets');
  }

  const targetSheet = sheetName || sheetNames[0];
  const sheet = workbook.Sheets[targetSheet];
  if (!sheet) {
    throw new AppError(400, `Sheet "${targetSheet}" not found. Available: ${sheetNames.join(', ')}`);
  }

  // Convert to 2D array (header: 1 = no header interpretation, raw arrays)
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: true,
    rawNumbers: false,
  });

  if (rawRows.length === 0) {
    throw new AppError(400, 'Excel sheet contains no data');
  }

  // Find max column count across all rows
  const maxCols = Math.max(...rawRows.map((r) => r.length));

  // Normalize: pad rows to uniform width, convert all values to string|null
  const data: CellGrid = rawRows.map((row) => {
    const normalized: (string | null)[] = [];
    for (let i = 0; i < maxCols; i++) {
      const val = row[i];
      if (val === undefined || val === null || val === '') {
        normalized.push(null);
      } else {
        normalized.push(String(val));
      }
    }
    return normalized;
  });

  log.info('Excel parsed', { sheet: targetSheet, totalRows: data.length, totalCols: maxCols });

  return {
    data,
    totalRows: data.length,
    totalCols: maxCols,
    sheetNames,
  };
}
