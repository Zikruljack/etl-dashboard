/**
 * Extractor service.
 * Applies ExtractionConfig to a raw CellGrid to produce clean tabular data.
 * Handles multi-header flattening, data range selection, row skipping, and column labeling.
 */

import type { CellGrid, ExtractionConfig, ExtractionPreview } from '@etl-dashboard/shared';

/**
 * Flatten multi-level header rows into a single header array.
 * Merged cells propagate downward — empty cells inherit the value from above.
 *
 * @example
 * ```
 * row0: ["", "Korban", "Korban", "Kerusakan"]
 * row1: ["Kecamatan", "Meninggal", "Luka", "Rumah"]
 * separator: "_"
 * result: ["Kecamatan", "Korban_Meninggal", "Korban_Luka", "Kerusakan_Rumah"]
 * ```
 *
 * @param headerRows - Array of header row arrays (from CellGrid)
 * @param separator - Join character for multi-level (default: "_")
 * @returns Flattened column names array
 */
export function flattenHeaders(headerRows: (string | null)[][], separator = '_'): string[] {
  if (headerRows.length === 0) return [];
  if (headerRows.length === 1) {
    return headerRows[0].map((cell, i) => cell?.trim() || `Column_${i + 1}`);
  }

  const colCount = Math.max(...headerRows.map((r) => r.length));
  const result: string[] = [];

  for (let col = 0; col < colCount; col++) {
    const parts: string[] = [];
    let lastNonEmpty = '';

    for (let row = 0; row < headerRows.length; row++) {
      const cell = headerRows[row]?.[col]?.trim() || '';
      if (cell) {
        // Only add if different from previous level (avoid "Korban_Korban")
        if (cell !== lastNonEmpty) {
          parts.push(cell);
        }
        lastNonEmpty = cell;
      }
    }

    result.push(parts.length > 0 ? parts.join(separator) : `Column_${col + 1}`);
  }

  return result;
}

/**
 * Apply extraction config to a raw cell grid, producing clean rows.
 * This is the core extraction logic used both for preview and actual loading.
 *
 * @param grid - Raw 2D cell grid from snapshot
 * @param config - Extraction configuration
 * @returns Extraction preview with headers and clean rows
 */
export function applyExtraction(grid: CellGrid, config: ExtractionConfig): ExtractionPreview {
  if (grid.length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  console.log('[applyExtraction] config.excludeColumns:', config.excludeColumns);
  console.log('[applyExtraction] config.columnStart:', config.columnStart);
  console.log('[applyExtraction] config.columnEnd:', config.columnEnd);

  // 1. Extract header rows
  const headerRows = config.headerRowIndices.map((idx) => grid[idx] || []);

  // 2. Flatten multi-level headers (produces array indexed by raw column position)
  const rawHeaders = flattenHeaders(headerRows, config.headerFlattenSeparator || '_');

  // 3. Determine column indices to include: range [colStart, rawColEnd) minus excludeColumns
  const colStart = config.columnStart || 0;
  const rawColEnd = config.columnEnd !== null && config.columnEnd !== undefined
    ? config.columnEnd + 1
    : rawHeaders.length;

  const excludeSet = new Set(config.excludeColumns || []);
  // Build list of global column indices to include, in order
  const includeIndices: number[] = [];
  for (let gi = colStart; gi < rawColEnd && gi < rawHeaders.length; gi++) {
    if (!excludeSet.has(gi)) includeIndices.push(gi);
  }

  console.log('[applyExtraction] includeIndices:', includeIndices);
  console.log('[applyExtraction] rawHeaders:', rawHeaders);

  // 4. Build final headers with label overrides applied
  const headers = includeIndices.map((gi) => {
    const rawHeader = rawHeaders[gi] || `Column_${gi + 1}`;
    // Check by global index (string key)
    if (config.columnLabels[String(gi)]) {
      return config.columnLabels[String(gi)];
    }
    // Check by auto-name
    if (config.columnLabels[rawHeader]) {
      return config.columnLabels[rawHeader];
    }
    return rawHeader;
  });

  // 5. Extract data rows
  const dataStartRow = config.dataStartRow;
  const dataEndRow = config.dataEndRow !== null && config.dataEndRow !== undefined
    ? config.dataEndRow + 1
    : grid.length;

  const skipSet = new Set(config.skipRows || []);
  const rows: (string | null)[][] = [];

  for (let i = dataStartRow; i < dataEndRow && i < grid.length; i++) {
    // Skip header rows and explicitly skipped rows
    if (config.headerRowIndices.includes(i) || skipSet.has(i)) {
      continue;
    }

    const row = grid[i] || [];
    // Pick only the included column indices
    const filteredRow = includeIndices.map((gi) => row[gi] ?? null);

    // Skip completely empty rows
    if (filteredRow.every((cell) => cell === null || cell === '')) {
      continue;
    }

    rows.push(filteredRow);
  }

  return {
    headers,
    rows,
    totalRows: rows.length,
  };
}

/**
 * Convert extraction preview rows to dataset row objects (JSONB format).
 * Each row becomes a Record<headerName, cellValue>.
 *
 * @param preview - Extraction preview result
 * @returns Array of row data objects ready for dataset_rows table
 */
export function previewToRowData(
  preview: ExtractionPreview,
): Array<{ data: Record<string, unknown>; rowNumber: number }> {
  return preview.rows.map((row, idx) => {
    const obj: Record<string, unknown> = {};
    preview.headers.forEach((header, colIdx) => {
      obj[header] = row[colIdx];
    });
    return { data: obj, rowNumber: idx + 1 };
  });
}
