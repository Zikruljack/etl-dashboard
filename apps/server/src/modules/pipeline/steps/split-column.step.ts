import type { StepConfig, StepDescription } from '@etl-dashboard/shared';
import type { IPipelineStep, TabularData, ValidationResult } from './step.interface';

/**
 * SplitColumnStep — Split one column into multiple columns by a separator.
 * Original column is optionally dropped after splitting.
 */
export class SplitColumnStep implements IPipelineStep {
  /**
   * Execute column split on the specified column.
   *
   * @param data - Input tabular data
   * @param config - Must be type 'split_column' with column + separator + newColumns
   * @returns Data with new columns added (and original optionally removed)
   */
  execute(data: TabularData, config: StepConfig): TabularData {
    if (config.type !== 'split_column') throw new Error('Invalid config type for SplitColumnStep');
    const { column, separator, newColumns, dropOriginal = true } = config;

    // Build new column list
    let columns = [...data.columns];
    if (dropOriginal) {
      columns = columns.filter((c) => c !== column);
    }
    // Add new columns after original position (or at end)
    const insertAt = dropOriginal
      ? data.columns.indexOf(column)
      : data.columns.indexOf(column) + 1;
    columns.splice(insertAt, 0, ...newColumns);

    const rows = data.rows.map((row) => {
      const val = row[column];
      const str = val === null || val === undefined ? '' : String(val);
      const parts = str.split(separator);

      const newRow: Record<string, unknown> = { ...row };
      if (dropOriginal) delete newRow[column];

      newColumns.forEach((colName, i) => {
        newRow[colName] = parts[i] !== undefined ? parts[i].trim() : null;
      });

      return newRow;
    });

    return { columns, rows };
  }

  /**
   * Validate split_column config: column must exist, newColumns must not be empty.
   *
   * @param config - Step config
   * @param availableColumns - Current columns
   * @returns Validation result
   */
  validate(config: StepConfig, availableColumns: string[]): ValidationResult {
    if (config.type !== 'split_column') return { valid: false, errors: ['Wrong step type'] };
    const errors: string[] = [];
    if (!config.column) errors.push('Column is required');
    else if (!availableColumns.includes(config.column)) errors.push(`Column "${config.column}" not found`);
    if (!config.separator) errors.push('Separator is required');
    if (!config.newColumns || config.newColumns.length < 2) errors.push('At least 2 new column names required');
    return { valid: errors.length === 0, errors };
  }

  /** @returns Description for UI display */
  describe(): StepDescription {
    return { type: 'split_column', label: 'Split Column', summary: 'Split one column into multiple columns by a separator', icon: 'i-heroicons-arrows-right-left' };
  }
}
