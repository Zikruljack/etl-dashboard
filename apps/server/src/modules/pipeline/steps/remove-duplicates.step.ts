import type { StepConfig, StepDescription } from '@etl-dashboard/shared';
import type { IPipelineStep, TabularData, ValidationResult } from './step.interface';

/**
 * RemoveDuplicatesStep — Remove duplicate rows by key columns.
 * Keeps the first or last occurrence of each duplicate group.
 */
export class RemoveDuplicatesStep implements IPipelineStep {
  /**
   * Execute duplicate removal based on specified key columns.
   *
   * @param data - Input tabular data
   * @param config - Must be type 'remove_duplicates' with columns + keep strategy
   * @returns Data with duplicates removed
   */
  execute(data: TabularData, config: StepConfig): TabularData {
    if (config.type !== 'remove_duplicates') throw new Error('Invalid config type for RemoveDuplicatesStep');
    const { columns, keep = 'first' } = config;
    const keyColumns = columns.length > 0 ? columns : data.columns;

    const seen = new Map<string, number>();
    const rows = keep === 'first' ? data.rows : [...data.rows].reverse();

    const deduped: Record<string, unknown>[] = [];
    for (const row of rows) {
      const key = keyColumns.map((c) => String(row[c] ?? '')).join('\x00');
      if (!seen.has(key)) {
        seen.set(key, 1);
        deduped.push(row);
      }
    }

    return { columns: data.columns, rows: keep === 'first' ? deduped : deduped.reverse() };
  }

  /**
   * Validate remove_duplicates config: all specified columns must exist.
   *
   * @param config - Step config
   * @param availableColumns - Current columns
   * @returns Validation result
   */
  validate(config: StepConfig, availableColumns: string[]): ValidationResult {
    if (config.type !== 'remove_duplicates') return { valid: false, errors: ['Wrong step type'] };
    const errors: string[] = [];
    for (const col of config.columns) {
      if (!availableColumns.includes(col)) errors.push(`Column "${col}" not found`);
    }
    return { valid: errors.length === 0, errors };
  }

  /** @returns Description for UI display */
  describe(): StepDescription {
    return { type: 'remove_duplicates', label: 'Remove Duplicates', summary: 'Remove duplicate rows based on key columns', icon: 'i-heroicons-document-duplicate' };
  }
}
