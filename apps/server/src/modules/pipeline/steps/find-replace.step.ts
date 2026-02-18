import type { StepConfig, StepDescription } from '@etl-dashboard/shared';
import type { IPipelineStep, TabularData, ValidationResult } from './step.interface';

/**
 * FindReplaceStep — Find and replace text within a column's values.
 * Supports literal string or regex replacement.
 */
export class FindReplaceStep implements IPipelineStep {
  /**
   * Execute find-replace on the specified column.
   *
   * @param data - Input tabular data
   * @param config - Must be type 'find_replace' with column + find + replace
   * @returns Data with replacements applied
   */
  execute(data: TabularData, config: StepConfig): TabularData {
    if (config.type !== 'find_replace') throw new Error('Invalid config type for FindReplaceStep');
    const { column, find, replace, useRegex = false, replaceAll = true } = config;

    const rows = data.rows.map((row) => {
      const val = row[column];
      if (val === null || val === undefined) return row;
      const str = String(val);
      let result: string;

      if (useRegex) {
        const flags = replaceAll ? 'g' : '';
        try {
          const re = new RegExp(find, flags);
          result = str.replace(re, replace);
        } catch {
          result = str; // invalid regex — leave unchanged
        }
      } else {
        if (replaceAll) {
          result = str.split(find).join(replace);
        } else {
          result = str.replace(find, replace);
        }
      }

      return { ...row, [column]: result };
    });

    return { columns: data.columns, rows };
  }

  /**
   * Validate find_replace config: column must exist, find must not be empty.
   *
   * @param config - Step config
   * @param availableColumns - Current columns
   * @returns Validation result
   */
  validate(config: StepConfig, availableColumns: string[]): ValidationResult {
    if (config.type !== 'find_replace') return { valid: false, errors: ['Wrong step type'] };
    const errors: string[] = [];
    if (!config.column) errors.push('Column is required');
    else if (!availableColumns.includes(config.column)) errors.push(`Column "${config.column}" not found`);
    if (config.find === undefined || config.find === '') errors.push('Find pattern is required');
    if (config.useRegex && config.find) {
      try { new RegExp(config.find); } catch { errors.push('Invalid regex pattern'); }
    }
    return { valid: errors.length === 0, errors };
  }

  /** @returns Description for UI display */
  describe(): StepDescription {
    return { type: 'find_replace', label: 'Find & Replace', summary: 'Find and replace text within column values', icon: 'i-heroicons-magnifying-glass' };
  }
}
