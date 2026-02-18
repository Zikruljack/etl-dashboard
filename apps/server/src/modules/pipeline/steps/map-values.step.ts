import type { StepConfig, StepDescription } from '@etl-dashboard/shared';
import type { IPipelineStep, TabularData, ValidationResult } from './step.interface';

/**
 * MapValuesStep — Replace specific values in a column using a mapping dictionary.
 * Useful for normalizing inconsistent categorical values (L → Laki-laki, etc.).
 */
export class MapValuesStep implements IPipelineStep {
  /**
   * Execute value mapping on the specified column.
   *
   * @param data - Input tabular data
   * @param config - Must be type 'map_values' with column + mapping
   * @returns Data with values replaced per mapping
   */
  execute(data: TabularData, config: StepConfig): TabularData {
    if (config.type !== 'map_values') throw new Error('Invalid config type for MapValuesStep');
    const { column, mapping, keepUnmapped = true } = config;

    const rows = data.rows.map((row) => {
      const val = row[column];
      const str = val === null || val === undefined ? '' : String(val);
      const mapped = mapping[str];
      let newVal: unknown;

      if (mapped !== undefined) {
        newVal = mapped;
      } else if (keepUnmapped) {
        newVal = val;
      } else {
        newVal = null;
      }

      return { ...row, [column]: newVal };
    });

    return { columns: data.columns, rows };
  }

  /**
   * Validate map_values config: column must exist, mapping must have entries.
   *
   * @param config - Step config
   * @param availableColumns - Current columns
   * @returns Validation result
   */
  validate(config: StepConfig, availableColumns: string[]): ValidationResult {
    if (config.type !== 'map_values') return { valid: false, errors: ['Wrong step type'] };
    const errors: string[] = [];
    if (!config.column) errors.push('Column is required');
    else if (!availableColumns.includes(config.column)) errors.push(`Column "${config.column}" not found`);
    if (!config.mapping || Object.keys(config.mapping).length === 0) errors.push('Mapping must have at least one entry');
    return { valid: errors.length === 0, errors };
  }

  /** @returns Description for UI display */
  describe(): StepDescription {
    return { type: 'map_values', label: 'Map Values', summary: 'Replace specific values in a column using a lookup table', icon: 'i-heroicons-table-cells' };
  }
}
