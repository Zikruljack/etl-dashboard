import type { StepConfig, StepDescription } from '@etl-dashboard/shared';
import type { IPipelineStep, TabularData, ValidationResult } from './step.interface';

/**
 * FilterRowsStep — Keep only rows that match a condition.
 * Rows NOT matching the condition are removed.
 */
export class FilterRowsStep implements IPipelineStep {
  /**
   * Execute row filter: keep rows matching condition.
   *
   * @param data - Input tabular data
   * @param config - Must be type 'filter_rows' with condition
   * @returns Data with non-matching rows removed
   */
  execute(data: TabularData, config: StepConfig): TabularData {
    if (config.type !== 'filter_rows') throw new Error('Invalid config type for FilterRowsStep');
    const { condition } = config;
    const { column, operator, value } = condition;

    const rows = data.rows.filter((row) => {
      const cellRaw = row[column];
      const cell = cellRaw === null || cellRaw === undefined ? '' : String(cellRaw);
      const cmp = value ?? '';

      switch (operator) {
        case '=': return cell === cmp;
        case '!=': return cell !== cmp;
        case '>': return Number(cell) > Number(cmp);
        case '>=': return Number(cell) >= Number(cmp);
        case '<': return Number(cell) < Number(cmp);
        case '<=': return Number(cell) <= Number(cmp);
        case 'contains': return cell.includes(cmp);
        case 'not_contains': return !cell.includes(cmp);
        case 'is_empty': return cell.trim() === '';
        case 'is_not_empty': return cell.trim() !== '';
        default: return true;
      }
    });

    return { columns: data.columns, rows };
  }

  /**
   * Validate filter_rows config: column must exist, operator must be valid.
   *
   * @param config - Step config
   * @param availableColumns - Current columns
   * @returns Validation result
   */
  validate(config: StepConfig, availableColumns: string[]): ValidationResult {
    if (config.type !== 'filter_rows') return { valid: false, errors: ['Wrong step type'] };
    const errors: string[] = [];
    const { column, operator } = config.condition;
    if (!column) errors.push('Condition column is required');
    else if (!availableColumns.includes(column)) errors.push(`Column "${column}" not found`);
    const validOps = ['=', '!=', '>', '>=', '<', '<=', 'contains', 'not_contains', 'is_empty', 'is_not_empty'];
    if (!validOps.includes(operator)) errors.push(`Invalid operator: ${operator}`);
    return { valid: errors.length === 0, errors };
  }

  /** @returns Description for UI display */
  describe(): StepDescription {
    return { type: 'filter_rows', label: 'Filter Rows', summary: 'Keep only rows that match a condition', icon: 'i-heroicons-funnel' };
  }
}
