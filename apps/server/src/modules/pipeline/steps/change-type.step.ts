import type { StepConfig, StepDescription } from '@etl-dashboard/shared';
import type { IPipelineStep, TabularData, ValidationResult } from './step.interface';

/**
 * ChangeTypeStep — Convert column values to a target data type.
 * Converts string values to number, boolean, or date.
 * Invalid conversions result in null.
 */
export class ChangeTypeStep implements IPipelineStep {
  /**
   * Execute type conversion on the specified column.
   *
   * @param data - Input tabular data
   * @param config - Must be type 'change_type' with column + targetType
   * @returns Data with column values converted
   */
  execute(data: TabularData, config: StepConfig): TabularData {
    if (config.type !== 'change_type') throw new Error('Invalid config type for ChangeTypeStep');
    const { column, targetType, dateFormat } = config;

    const rows = data.rows.map((row) => {
      const raw = row[column];
      const str = raw === null || raw === undefined ? '' : String(raw).trim();
      let converted: unknown = raw;

      if (str === '') {
        converted = null;
      } else if (targetType === 'number') {
        const n = Number(str.replace(/,/g, ''));
        converted = isNaN(n) ? null : n;
      } else if (targetType === 'boolean') {
        const lower = str.toLowerCase();
        if (['true', 'ya', 'yes', '1', 'benar'].includes(lower)) converted = true;
        else if (['false', 'tidak', 'no', '0', 'salah'].includes(lower)) converted = false;
        else converted = null;
      } else if (targetType === 'date') {
        // Try parsing with dateFormat hint or ISO fallback
        const d = dateFormat ? this._parseWithFormat(str, dateFormat) : new Date(str);
        converted = isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
      }
      // 'text' — keep as string
      else {
        converted = str;
      }

      return { ...row, [column]: converted };
    });

    return { columns: data.columns, rows };
  }

  /**
   * Parse a date string using a simple format string (DD/MM/YYYY, etc.).
   *
   * @param str - Date string to parse
   * @param format - Format string (DD, MM, YYYY tokens)
   * @returns Parsed Date object
   */
  private _parseWithFormat(str: string, format: string): Date {
    const sep = format.replace(/[DMY]/g, '').charAt(0) || '/';
    const parts = str.split(sep);
    const fParts = format.split(sep);
    let day = 1, month = 0, year = 2000;
    fParts.forEach((f, i) => {
      const v = parseInt(parts[i] ?? '0', 10);
      if (f.startsWith('D')) day = v;
      else if (f.startsWith('M')) month = v - 1;
      else if (f.startsWith('Y')) year = v;
    });
    return new Date(year, month, day);
  }

  /**
   * Validate change_type config: column must exist, targetType must be valid.
   *
   * @param config - Step config
   * @param availableColumns - Current columns
   * @returns Validation result
   */
  validate(config: StepConfig, availableColumns: string[]): ValidationResult {
    if (config.type !== 'change_type') return { valid: false, errors: ['Wrong step type'] };
    const errors: string[] = [];
    if (!config.column) errors.push('Column is required');
    else if (!availableColumns.includes(config.column)) errors.push(`Column "${config.column}" not found`);
    const valid = ['text', 'number', 'date', 'boolean'];
    if (!valid.includes(config.targetType)) errors.push(`Invalid target type: ${config.targetType}`);
    return { valid: errors.length === 0, errors };
  }

  /** @returns Description for UI display */
  describe(): StepDescription {
    return { type: 'change_type', label: 'Change Type', summary: 'Convert column values to a target data type', icon: 'i-heroicons-arrow-path' };
  }
}
