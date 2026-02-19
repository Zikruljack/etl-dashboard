/**
 * REST API Connector.
 * Fetches JSON data from any HTTP endpoint and converts it to a CellGrid.
 * Supports no-auth, Bearer token, API key in header, and Basic auth.
 */

import type { CellGrid } from '@etl-dashboard/shared';
import { AppError } from '../../../core/errors.js';
import { logger } from '../../../core/logger.js';

const log = logger.child({ module: 'rest-connector' });

/** Safety limit to prevent runaway fetches */
const MAX_ROWS = 10_000;

/** REST auth types */
export type RestAuthType = 'none' | 'bearer' | 'api_key_header' | 'basic';

/** Configuration for a REST API data fetch */
export interface RestConnectorConfig {
  url: string;
  method?: 'GET' | 'POST';
  authType: RestAuthType;
  authToken?: string;
  authHeaderName?: string;
  authUsername?: string;
  authPassword?: string;
  requestBody?: string;
  jsonPath?: string;
  extraHeaders?: Record<string, string>;
}

/** Result from fetching a REST endpoint */
export interface RestFetchResult {
  data: CellGrid;
  totalRows: number;
  totalCols: number;
}

/**
 * Build request headers from auth config.
 *
 * @param config - REST connector config
 * @returns Headers object for fetch
 */
function buildHeaders(config: RestConnectorConfig): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...config.extraHeaders,
  };

  if (config.authType === 'bearer' && config.authToken) {
    headers['Authorization'] = `Bearer ${config.authToken}`;
  }

  if (config.authType === 'api_key_header' && config.authHeaderName && config.authToken) {
    headers[config.authHeaderName] = config.authToken;
  }

  if (config.authType === 'basic' && config.authUsername) {
    const creds = Buffer.from(`${config.authUsername}:${config.authPassword ?? ''}`).toString('base64');
    headers['Authorization'] = `Basic ${creds}`;
  }

  if (config.method === 'POST' && config.requestBody) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

/**
 * Extract a nested value from an object using dot-notation path.
 * Example: path "data.items" on { data: { items: [...] } } returns the array.
 *
 * @param obj - Source object
 * @param path - Dot-notation path (e.g. "data.items")
 * @returns Extracted value or the original obj if path is empty
 */
function extractByPath(obj: unknown, path?: string): unknown {
  if (!path || path.trim() === '') return obj;

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      throw new AppError(422, `JSON path "${path}" is invalid: "${part}" not found in response`);
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Convert an array of objects to a CellGrid (2D string array).
 * First row = column headers (sorted keys of first object).
 * Subsequent rows = values corresponding to headers.
 *
 * @param rows - Array of row objects
 * @returns 2D cell grid with headers as first row
 */
function arrayOfObjectsToCellGrid(rows: Record<string, unknown>[]): CellGrid {
  if (rows.length === 0) return [];

  // Use keys from first object as column headers
  const headers = Object.keys(rows[0]);

  const grid: CellGrid = [
    headers.map((h) => h),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h];
        if (val === null || val === undefined) return null;
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      }),
    ),
  ];

  return grid;
}

/**
 * Fetch JSON data from a REST endpoint and convert to CellGrid.
 *
 * @param config - REST connector configuration
 * @returns Parsed cell grid with dimensions
 * @throws AppError(400) if URL is invalid or response is not JSON
 * @throws AppError(422) if JSON path is invalid or response is not an array
 * @throws AppError(502) if the remote endpoint returns an error
 */
export async function fetchRestApi(config: RestConnectorConfig): Promise<RestFetchResult> {
  log.info('Fetching REST API', { url: config.url, method: config.method ?? 'GET' });

  let response: Response;
  try {
    response = await fetch(config.url, {
      method: config.method ?? 'GET',
      headers: buildHeaders(config),
      body: config.method === 'POST' && config.requestBody ? config.requestBody : undefined,
    });
  } catch (err) {
    throw new AppError(502, `Failed to connect to "${config.url}": ${(err as Error).message}`);
  }

  if (!response.ok) {
    throw new AppError(502, `REST API returned ${response.status}: ${response.statusText}`);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new AppError(400, 'Response is not valid JSON');
  }

  // Extract nested data if jsonPath specified
  const extracted = extractByPath(json, config.jsonPath);

  // Wrap non-array in array
  let rows: Record<string, unknown>[];
  if (Array.isArray(extracted)) {
    rows = extracted as Record<string, unknown>[];
  } else if (extracted !== null && typeof extracted === 'object') {
    rows = [extracted as Record<string, unknown>];
  } else {
    throw new AppError(422, 'Extracted data is not an object or array. Check your JSON path setting.');
  }

  if (rows.length === 0) {
    // Return empty grid with no data
    return { data: [], totalRows: 0, totalCols: 0 };
  }

  // Apply row limit
  if (rows.length > MAX_ROWS) {
    log.warn('REST response truncated', { original: rows.length, limit: MAX_ROWS });
    rows = rows.slice(0, MAX_ROWS);
  }

  const data = arrayOfObjectsToCellGrid(rows);
  const totalRows = data.length;
  const totalCols = data[0]?.length ?? 0;

  log.info('REST API fetched', { totalRows, totalCols });

  return { data, totalRows, totalCols };
}

/**
 * Test connection to a REST endpoint — fetches first 5 rows only.
 *
 * @param config - REST connector configuration
 * @returns Sample data preview
 * @throws AppError if connection fails
 */
export async function testRestConnection(config: RestConnectorConfig): Promise<{ sampleRows: number; columns: string[] }> {
  const result = await fetchRestApi(config);

  const columns = result.data.length > 0 && result.data[0]
    ? result.data[0].map((h) => h ?? '')
    : [];

  return {
    sampleRows: Math.max(0, result.totalRows - 1), // minus header row
    columns,
  };
}
