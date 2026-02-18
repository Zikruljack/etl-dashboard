import { datasetRowRepository } from './dataset.repository.js';

/** Data query request matching shared DataQueryRequest type */
interface DataQueryRequest {
  datasetId: string;
  columns?: string[];
  filters?: Array<{
    column: string;
    operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
    value: unknown;
  }>;
  sort?: { column: string; direction: 'asc' | 'desc' };
  limit?: number;
  offset?: number;
  aggregation?: {
    groupBy: string[];
    measures: Array<{
      column: string;
      function: 'count' | 'sum' | 'avg' | 'min' | 'max';
      alias?: string;
    }>;
  };
}

/**
 * Apply filter condition to a row value.
 *
 * @param val - Row value for the filter column
 * @param operator - Filter operator
 * @param filterValue - Value to compare against
 * @returns true if row passes the filter
 */
function applyFilter(val: unknown, operator: string, filterValue: unknown): boolean {
  switch (operator) {
    case 'eq': return val == filterValue;
    case 'neq': return val != filterValue;
    case 'gt': return Number(val) > Number(filterValue);
    case 'gte': return Number(val) >= Number(filterValue);
    case 'lt': return Number(val) < Number(filterValue);
    case 'lte': return Number(val) <= Number(filterValue);
    case 'contains': return String(val).toLowerCase().includes(String(filterValue).toLowerCase());
    case 'in': return Array.isArray(filterValue) && filterValue.includes(val);
    default: return true;
  }
}

/**
 * Execute aggregate functions on grouped data.
 *
 * @param groupRows - Array of rows in the group
 * @param measures - Aggregation measures to compute
 * @returns Object with aggregated values keyed by alias
 */
function computeAggregates(
  groupRows: Record<string, unknown>[],
  measures: NonNullable<DataQueryRequest['aggregation']>['measures'],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const measure of measures) {
    const alias = measure.alias || `${measure.function}_${measure.column}`;
    const values = groupRows.map((r) => Number(r[measure.column]) || 0);

    switch (measure.function) {
      case 'count': result[alias] = groupRows.length; break;
      case 'sum': result[alias] = values.reduce((a, b) => a + b, 0); break;
      case 'avg': result[alias] = values.reduce((a, b) => a + b, 0) / values.length; break;
      case 'min': result[alias] = Math.min(...values); break;
      case 'max': result[alias] = Math.max(...values); break;
    }
  }

  return result;
}

/**
 * Flexible data query engine for dashboard widgets.
 * Supports filtering, sorting, aggregation, column selection, and pagination.
 *
 * Operates in-memory on JSONB row data for maximum flexibility
 * across different dataset schemas.
 *
 * @param query - Query parameters (filters, sort, aggregation, etc.)
 * @returns Query result with data array and total count
 */
export async function queryData(query: DataQueryRequest) {
  const { datasetId, columns, filters, sort, limit, offset, aggregation } = query;

  const rows = await datasetRowRepository.findAllByDataset(datasetId);
  let data = rows.map((r) => r.data as Record<string, unknown>);

  // Apply filters
  if (filters && filters.length > 0) {
    data = data.filter((row) =>
      filters.every((f) => applyFilter(row[f.column], f.operator, f.value)),
    );
  }

  // Apply sorting
  if (sort) {
    data.sort((a, b) => {
      const cmp = String(a[sort.column] ?? '').localeCompare(
        String(b[sort.column] ?? ''),
        undefined,
        { numeric: true },
      );
      return sort.direction === 'desc' ? -cmp : cmp;
    });
  }

  // Apply aggregation
  if (aggregation) {
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const row of data) {
      const key = aggregation.groupBy.map((col) => String(row[col])).join('|||');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    data = Array.from(groups.entries()).map(([key, groupRows]) => {
      const result: Record<string, unknown> = {};
      const keyParts = key.split('|||');
      aggregation.groupBy.forEach((col, i) => { result[col] = keyParts[i]; });
      Object.assign(result, computeAggregates(groupRows, aggregation.measures));
      return result;
    });
  }

  // Select columns
  if (columns && columns.length > 0) {
    data = data.map((row) => {
      const filtered: Record<string, unknown> = {};
      for (const col of columns) filtered[col] = row[col];
      return filtered;
    });
  }

  const total = data.length;

  // Apply pagination
  const actualOffset = offset || 0;
  const actualLimit = limit || 1000;
  data = data.slice(actualOffset, actualOffset + actualLimit);

  return { data, total };
}
