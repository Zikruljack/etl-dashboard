export type SourceType = 'google_sheets' | 'csv' | 'excel';
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';
export type ColumnType = 'text' | 'number' | 'date' | 'boolean';

export interface ColumnDefinition {
  name: string;
  originalName: string;
  type: ColumnType;
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  sheetName?: string;
  range?: string;
}

export type SourceConfig = GoogleSheetsConfig;

export interface Dataset {
  id: string;
  name: string;
  description: string | null;
  sourceType: SourceType;
  sourceConfig: SourceConfig;
  extractionConfig: Record<string, unknown> | null;
  columns: ColumnDefinition[];
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetRow {
  id: string;
  datasetId: string;
  data: Record<string, unknown>;
  rowNumber: number;
}

export interface CreateDatasetRequest {
  name: string;
  description?: string;
  sourceType: SourceType;
  sourceConfig: SourceConfig;
}

export interface DataQueryRequest {
  datasetId: string;
  columns?: string[];
  filters?: DataFilter[];
  sort?: DataSort;
  limit?: number;
  offset?: number;
  aggregation?: DataAggregation;
}

export interface DataFilter {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: unknown;
}

export interface DataSort {
  column: string;
  direction: 'asc' | 'desc';
}

export interface DataAggregation {
  groupBy: string[];
  measures: Array<{
    column: string;
    function: 'count' | 'sum' | 'avg' | 'min' | 'max';
    alias?: string;
  }>;
}
