import type { StepConfig, StepDescription } from '@etl-dashboard/shared';
import type { IPipelineStep, TabularData, ValidationResult } from './step.interface';

/**
 * MergeColumnsStep — Join multiple columns into a single new column.
 * Source columns are optionally dropped after merging.
 */
export class MergeColumnsStep implements IPipelineStep {
  /**
   * Execute column merge: concatenate source columns into new column.
   *
   * @param data - Input tabular data
   * @param config - Must be type 'merge_columns' with columns + separator + newColumn
   * @returns Data with merged column added (and source columns optionally removed)
   */
  execute(data: TabularData, config: StepConfig): TabularData {
    if (config.type !== 'merge_columns') throw new Error('Invalid config type for MergeColumnsStep');
    const { columns: srcCols, separator, newColumn, dropOriginals = true } = config;

    // Build new column list: insert newColumn at position of first source column
    const firstIdx = data.columns.indexOf(srcCols[0]);
    let columns = [...data.columns];
    if (dropOriginals) {
      columns = columns.filter((c) => !srcCols.includes(c));
    }
    columns.splice(dropOriginals ? firstIdx : firstIdx + 1, 0, newColumn);

    const rows = data.rows.map((row) => {
      const parts = srcCols.map((c) => {
        const v = row[c];
        return v === null || v === undefined ? '' : String(v);
      });
      const merged = parts.join(separator);

      const newRow: Record<string, unknown> = { ...row };
      if (dropOriginals) {
        for (const c of srcCols) delete newRow[c];
      }
      newRow[newColumn] = merged;
      return newRow;
    });

    return { columns, rows };
  }

  /**
   * Validate merge_columns config: all source columns must exist, newColumn must not be empty.
   *
   * @param config - Step config
   * @param availableColumns - Current columns
   * @returns Validation result
   */
  validate(config: StepConfig, availableColumns: string[]): ValidationResult {
    if (config.type !== 'merge_columns') return { valid: false, errors: ['Wrong step type'] };
    const errors: string[] = [];
    if (!config.columns || config.columns.length < 2) errors.push('At least 2 source columns required');
    else {
      for (const col of config.columns) {
        if (!availableColumns.includes(col)) errors.push(`Column "${col}" not found`);
      }
    }
    if (!config.newColumn || config.newColumn.trim() === '') errors.push('New column name is required');
    else if (availableColumns.includes(config.newColumn) && !config.columns.includes(config.newColumn))
      errors.push(`Column "${config.newColumn}" already exists`);
    return { valid: errors.length === 0, errors };
  }

  /** @returns Description for UI display */
  describe(): StepDescription {
    return { type: 'merge_columns', label: 'Merge Columns', summary: 'Join multiple columns into a single new column', icon: 'i-heroicons-link' };
  }
}
