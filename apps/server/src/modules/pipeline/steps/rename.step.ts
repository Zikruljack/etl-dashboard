import type { StepConfig, StepDescription } from '@etl-dashboard/shared';
import type { IPipelineStep, TabularData, ValidationResult } from './step.interface';

/**
 * RenameStep — Rename a single column.
 * Renames the key in all rows and updates the columns list.
 */
export class RenameStep implements IPipelineStep {
  /**
   * Execute rename: replace old column name with new name in columns array and all rows.
   *
   * @param data - Input tabular data
   * @param config - Must be type 'rename' with column + newName
   * @returns Data with column renamed
   */
  execute(data: TabularData, config: StepConfig): TabularData {
    if (config.type !== 'rename') throw new Error('Invalid config type for RenameStep');
    const { column, newName } = config;

    const columns = data.columns.map((c) => (c === column ? newName : c));
    const rows = data.rows.map((row) => {
      const newRow: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        newRow[k === column ? newName : k] = v;
      }
      return newRow;
    });

    return { columns, rows };
  }

  /**
   * Validate rename config: column must exist, newName must not be empty or duplicate.
   *
   * @param config - Step config
   * @param availableColumns - Current columns in the dataset
   * @returns Validation result
   */
  validate(config: StepConfig, availableColumns: string[]): ValidationResult {
    if (config.type !== 'rename') return { valid: false, errors: ['Wrong step type'] };
    const errors: string[] = [];
    if (!config.column) errors.push('Column is required');
    else if (!availableColumns.includes(config.column)) errors.push(`Column "${config.column}" not found`);
    if (!config.newName || config.newName.trim() === '') errors.push('New name is required');
    else if (availableColumns.includes(config.newName) && config.newName !== config.column)
      errors.push(`Column "${config.newName}" already exists`);
    return { valid: errors.length === 0, errors };
  }

  /** @returns Description for UI display */
  describe(): StepDescription {
    return { type: 'rename', label: 'Rename Column', summary: 'Rename a column to a new name', icon: 'i-heroicons-pencil' };
  }
}
