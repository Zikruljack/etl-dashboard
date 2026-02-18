import type { StepConfig, StepDescription } from '@etl-dashboard/shared';
import type { IPipelineStep, TabularData, ValidationResult } from './step.interface';

/**
 * FillMissingStep — Fill null/empty values in a column using a strategy.
 * Supports: forward_fill, backward_fill, constant, mean, median.
 */
export class FillMissingStep implements IPipelineStep {
  /**
   * Execute fill strategy on the specified column.
   *
   * @param data - Input tabular data
   * @param config - Must be type 'fill_missing' with column + strategy
   * @returns Data with missing values filled
   */
  execute(data: TabularData, config: StepConfig): TabularData {
    if (config.type !== 'fill_missing') throw new Error('Invalid config type for FillMissingStep');
    const { column, strategy, constantValue } = config;

    const isEmpty = (v: unknown) => v === null || v === undefined || String(v).trim() === '';

    let rows = data.rows.map((r) => ({ ...r }));

    if (strategy === 'constant') {
      rows = rows.map((r) => ({ ...r, [column]: isEmpty(r[column]) ? (constantValue ?? '') : r[column] }));
    } else if (strategy === 'forward_fill') {
      let last: unknown = null;
      rows = rows.map((r) => {
        if (!isEmpty(r[column])) { last = r[column]; return r; }
        return { ...r, [column]: last };
      });
    } else if (strategy === 'backward_fill') {
      let last: unknown = null;
      rows = [...rows].reverse().map((r) => {
        if (!isEmpty(r[column])) { last = r[column]; return r; }
        return { ...r, [column]: last };
      }).reverse();
    } else if (strategy === 'mean' || strategy === 'median') {
      const nums = rows
        .map((r) => r[column])
        .filter((v) => !isEmpty(v))
        .map((v) => Number(v))
        .filter((n) => !isNaN(n));

      let fill: number | null = null;
      if (nums.length > 0) {
        if (strategy === 'mean') {
          fill = nums.reduce((a, b) => a + b, 0) / nums.length;
        } else {
          const sorted = [...nums].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          fill = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        }
      }
      rows = rows.map((r) => ({ ...r, [column]: isEmpty(r[column]) ? fill : r[column] }));
    }

    return { columns: data.columns, rows };
  }

  /**
   * Validate fill_missing config: column must exist, strategy must be valid.
   *
   * @param config - Step config
   * @param availableColumns - Current columns
   * @returns Validation result
   */
  validate(config: StepConfig, availableColumns: string[]): ValidationResult {
    if (config.type !== 'fill_missing') return { valid: false, errors: ['Wrong step type'] };
    const errors: string[] = [];
    if (!config.column) errors.push('Column is required');
    else if (!availableColumns.includes(config.column)) errors.push(`Column "${config.column}" not found`);
    const validStrategies = ['forward_fill', 'backward_fill', 'constant', 'mean', 'median'];
    if (!validStrategies.includes(config.strategy)) errors.push(`Invalid strategy: ${config.strategy}`);
    if (config.strategy === 'constant' && (config.constantValue === undefined || config.constantValue === null))
      errors.push('Constant value is required for constant strategy');
    return { valid: errors.length === 0, errors };
  }

  /** @returns Description for UI display */
  describe(): StepDescription {
    return { type: 'fill_missing', label: 'Fill Missing', summary: 'Fill null/empty values using a fill strategy', icon: 'i-heroicons-inbox-arrow-down' };
  }
}
