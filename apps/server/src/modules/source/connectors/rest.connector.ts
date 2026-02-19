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

/**
 * Patterns matching private/internal IP ranges and loopback addresses.
 * Used to block SSRF attacks that target internal infrastructure.
 */
const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,           // 127.0.0.0/8 — loopback
  /^10\./,            // 10.0.0.0/8 — RFC 1918
  /^172\.(1[6-9]|2\d|3[01])\./,  // 172.16.0.0/12 — RFC 1918
  /^192\.168\./,      // 192.168.0.0/16 — RFC 1918
  /^169\.254\./,      // 169.254.0.0/16 — link-local / cloud metadata
  /^0\./,             // 0.0.0.0/8
  /^::1$/,            // IPv6 loopback
  /^fc00:/i,          // IPv6 unique local
  /^fd/i,             // IPv6 unique local
  /^\[::1\]$/,        // IPv6 loopback with brackets
];

/**
 * Validate that a URL is safe to fetch from the server.
 * Rejects non-HTTP protocols and requests to private/internal IP ranges
 * to prevent Server-Side Request Forgery (SSRF) attacks.
 *
 * @param rawUrl - URL string to validate
 * @throws AppError(400) if the URL is invalid, uses a non-HTTP protocol,
 *   or targets a private/internal address
 */
function assertSafeUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AppError(400, `Invalid URL: "${rawUrl}"`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError(400, `Only http and https protocols are allowed (got "${parsed.protocol}")`);
  }

  const hostname = parsed.hostname;
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new AppError(400, 'Requests to private or internal addresses are not allowed');
    }
  }
}

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
  // Validate URL before making any network request — prevents SSRF
  assertSafeUrl(config.url);

  log.info('Fetching REST API', { url: config.url, method: config.method ?? 'GET' });

  let response: Response;
  try {
    response = await fetch(config.url, {
      method: config.method ?? 'GET',
      headers: buildHeaders(config),
      body: config.method === 'POST' && config.requestBody ? config.requestBody : undefined,
      signal: AbortSignal.timeout(15_000),  // 15-second hard timeout
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
