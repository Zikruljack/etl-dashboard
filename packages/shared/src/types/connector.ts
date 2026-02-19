/**
 * Connector types and configs.
 * Defines all supported data source connectors and their configuration shapes.
 */

/** Supported connector types */
export type ConnectorType = 'google_sheets' | 'csv_upload' | 'excel_upload' | 'rest_api';

/** Authentication methods for REST API connector */
export type RestAuthType = 'none' | 'bearer' | 'api_key_header' | 'basic';

/**
 * Google Sheets connector config.
 */
export interface GoogleSheetsConnectorConfig {
  connector: 'google_sheets';
  /** Spreadsheet ID from Google Sheets URL */
  spreadsheetId: string;
  /** Tab name to fetch (default: first sheet) */
  sheetName?: string;
}

/**
 * CSV file upload connector config.
 */
export interface CsvUploadConnectorConfig {
  connector: 'csv_upload';
  /** Server-side path to the uploaded file */
  filePath: string;
  /** Text encoding (default: utf-8) */
  encoding?: string;
}

/**
 * Excel file upload connector config.
 */
export interface ExcelUploadConnectorConfig {
  connector: 'excel_upload';
  /** Server-side path to the uploaded file */
  filePath: string;
  /** Sheet tab to read (default: first sheet) */
  sheetName?: string;
}

/**
 * REST API connector config.
 * Fetches JSON data from any HTTP endpoint.
 */
export interface RestApiConnectorConfig {
  connector: 'rest_api';
  /** Full URL to the API endpoint */
  url: string;
  /** HTTP method (default: GET) */
  method?: 'GET' | 'POST';
  /** Authentication type */
  authType: RestAuthType;
  /** Token value for bearer or api_key_header auth */
  authToken?: string;
  /** Header name for api_key_header auth (e.g. "X-API-Key") */
  authHeaderName?: string;
  /** Username for basic auth */
  authUsername?: string;
  /** Password for basic auth */
  authPassword?: string;
  /** JSON body for POST requests */
  requestBody?: string;
  /**
   * Dot-notation path to extract array from response.
   * Example: "data.items" extracts response.data.items
   * Leave empty if response root is already an array.
   */
  jsonPath?: string;
  /** Additional request headers */
  extraHeaders?: Record<string, string>;
}

/** Union of all connector configs */
export type ConnectorConfig =
  | GoogleSheetsConnectorConfig
  | CsvUploadConnectorConfig
  | ExcelUploadConnectorConfig
  | RestApiConnectorConfig;
