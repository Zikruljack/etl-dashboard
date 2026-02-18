import { google } from 'googleapis';
import { env } from '../../config/env.js';
import { AppError } from '../../core/errors.js';
import type { CellGrid } from '@etl-dashboard/shared';

/**
 * Get Google Sheets JWT auth client.
 * Uses service account credentials from environment.
 *
 * @returns Authenticated JWT client
 * @throws AppError(500) if credentials are not configured
 */
function getAuth() {
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
    throw new AppError(500, 'Google Sheets credentials not configured');
  }
  return new google.auth.JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: env.GOOGLE_PRIVATE_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

/** Sheet metadata returned from test connection */
export interface SheetMeta {
  title: string;
  sheets: string[];
  locale: string;
}

/** Result from fetching all cells as raw grid */
export interface RawCellResult {
  data: CellGrid;
  totalRows: number;
  totalCols: number;
}

/**
 * Test connection to a Google Sheets spreadsheet and return metadata.
 *
 * @param spreadsheetId - Google Sheets document ID
 * @returns Sheet metadata (title, sheet names, locale)
 * @throws AppError(502) if Google API call fails
 */
export async function testConnection(spreadsheetId: string): Promise<SheetMeta> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title,properties.locale,sheets.properties.title',
    });

    return {
      title: response.data.properties?.title || '',
      sheets: response.data.sheets?.map((s) => s.properties?.title || '') || [],
      locale: response.data.properties?.locale || '',
    };
  } catch (error) {
    throw new AppError(502, `Cannot connect to Google Sheet: ${(error as Error).message}`);
  }
}

/**
 * Fetch ALL cells from a Google Sheet starting from A1.
 * Returns raw 2D array — no header assumption, no parsing.
 * Cells are either string or null. Rows padded to uniform column count.
 *
 * @param spreadsheetId - Google Sheets document ID
 * @param sheetName - Sheet tab name (default: first sheet)
 * @returns Raw cell grid with dimensions
 * @throws AppError(502) if Google API call fails
 */
export async function fetchAllCells(
  spreadsheetId: string,
  sheetName?: string,
): Promise<RawCellResult> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const range = sheetName || 'Sheet1';

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return { data: [], totalRows: 0, totalCols: 0 };
    }

    // Find max column count across all rows
    const maxCols = Math.max(...rows.map((r) => r.length));

    // Normalize all rows to the same column count, convert values to string|null
    const data: CellGrid = rows.map((row) => {
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

    return {
      data,
      totalRows: data.length,
      totalCols: maxCols,
    };
  } catch (error) {
    throw new AppError(502, `Failed to fetch sheet data: ${(error as Error).message}`);
  }
}

/**
 * Get list of sheet names from a spreadsheet.
 *
 * @param spreadsheetId - Google Sheets document ID
 * @returns Array of sheet tab names
 */
export async function getSheetNames(spreadsheetId: string): Promise<string[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });

  return response.data.sheets?.map((s) => s.properties?.title || '') || [];
}

/**
 * Detect the most likely column type from sample values.
 * Uses heuristic: if >80% of non-null values match a type, use that type.
 *
 * @param values - Sample values from a column
 * @returns Detected type: 'number', 'date', 'boolean', or 'text'
 */
export function detectColumnType(values: unknown[]): string {
  const nonNull = values.filter((v) => v !== null && v !== undefined && v !== '');
  if (nonNull.length === 0) return 'text';

  const numberCount = nonNull.filter((v) => !isNaN(Number(v))).length;
  if (numberCount / nonNull.length > 0.8) return 'number';

  const dateCount = nonNull.filter((v) => !isNaN(Date.parse(String(v)))).length;
  if (dateCount / nonNull.length > 0.8) return 'date';

  const boolCount = nonNull.filter((v) =>
    ['true', 'false', '0', '1'].includes(String(v).toLowerCase()),
  ).length;
  if (boolCount / nonNull.length > 0.8) return 'boolean';

  return 'text';
}
