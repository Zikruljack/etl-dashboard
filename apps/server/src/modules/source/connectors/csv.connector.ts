/**
 * CSV Connector.
 * Parses a CSV file buffer into a CellGrid (2D string array).
 * Does NOT interpret headers — returns raw cells for the extraction step.
 */

import { parse } from 'csv-parse/sync';
import type { CellGrid } from '@etl-dashboard/shared';
import { AppError } from '../../../core/errors.js';
import { logger } from '../../../core/logger.js';

const log = logger.child({ module: 'csv-connector' });

/** Result from parsing a CSV buffer */
export interface CsvParseResult {
  /** Raw 2D cell grid */
  data: CellGrid;
  /** Total rows */
  totalRows: number;
  /** Total columns (max across all rows) */
  totalCols: number;
}

/**
 * Parse a CSV buffer into a raw CellGrid.
 * Returns all cells as string|null — no header interpretation, no type casting.
 * Rows are padded to uniform column count.
 *
 * @param buffer - Raw file buffer
 * @param encoding - Text encoding (default: utf-8)
 * @returns Parsed cell grid with dimensions
 * @throws AppError(400) if CSV is malformed or empty
 */
export function parseCsvBuffer(buffer: Buffer, encoding: BufferEncoding = 'utf-8'): CsvParseResult {
  const content = buffer.toString(encoding);

  if (!content.trim()) {
    throw new AppError(400, 'CSV file is empty');
  }

  let rawRows: string[][];
  try {
    rawRows = parse(content, {
      columns: false,
      skip_empty_lines: false,
      relax_column_count: true,
      trim: false,
      cast: false,
      bom: true,
    });
  } catch (err) {
    log.error('CSV parse failed', { error: (err as Error).message });
    throw new AppError(400, `Invalid CSV format: ${(err as Error).message}`);
  }

  if (rawRows.length === 0) {
    throw new AppError(400, 'CSV file contains no data');
  }

  // Find max column count across all rows
  const maxCols = Math.max(...rawRows.map((r) => r.length));

  // Normalize: pad rows to uniform width, convert empty strings to null
  const data: CellGrid = rawRows.map((row) => {
    const normalized: (string | null)[] = [];
    for (let i = 0; i < maxCols; i++) {
      const val = row[i];
      if (val === undefined || val === null || val === '') {
        normalized.push(null);
      } else {
        normalized.push(val);
      }
    }
    return normalized;
  });

  log.info('CSV parsed', { totalRows: data.length, totalCols: maxCols });

  return {
    data,
    totalRows: data.length,
    totalCols: maxCols,
  };
}
