import type { StepConfig, StepDescription } from '@etl-dashboard/shared';
import type { IPipelineStep, TabularData, ValidationResult } from './step.interface';

/**
 * TrimStep — Strip leading/trailing whitespace from string values.
 * Operates on specified columns, or all columns if empty array.
 */
export class TrimStep implements IPipelineStep {
  /**
   * Execute trim on specified columns (or all if empty).
   *
   * @param data - Input tabular data
   * @param config - Must be type 'trim' with columns list
   * @returns Data with whitespace trimmed
   */
  execute(data: TabularData, config: StepConfig): TabularData {
    if (config.type !== 'trim') throw new Error('Invalid config type for TrimStep');
    const targets = config.columns.length > 0 ? config.columns : data.columns;

    const rows = data.rows.map((row) => {
      const newRow: Record<string, unknown> = { ...row };
      for (const col of targets) {
        if (col in newRow && typeof newRow[col] === 'string') {
          newRow[col] = (newRow[col] as string).trim();
        }
      }
      return newRow;
    });

    return { columns: data.columns, rows };
  }

  /**
   * Validate trim config: all specified columns must exist.
   *
   * @param config - Step config
   * @param availableColumns - Current columns
   * @returns Validation result
   */
  validate(config: StepConfig, availableColumns: string[]): ValidationResult {
    if (config.type !== 'trim') return { valid: false, errors: ['Wrong step type'] };
    const errors: string[] = [];
    for (const col of config.columns) {
      if (!availableColumns.includes(col)) errors.push(`Column "${col}" not found`);
    }
    return { valid: errors.length === 0, errors };
  }

  /** @returns Description for UI display */
  describe(): StepDescription {
    return { type: 'trim', label: 'Trim Whitespace', summary: 'Remove leading/trailing whitespace from text columns', icon: 'i-heroicons-scissors' };
  }
}
