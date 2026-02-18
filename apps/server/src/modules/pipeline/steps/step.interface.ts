import type { StepConfig, StepDescription, StepType } from '@etl-dashboard/shared';

/**
 * Tabular data structure passed between pipeline steps.
 * Each row is a flat object of column → value.
 */
export interface TabularData {
  /** Column names in order. */
  columns: string[];
  /** Data rows. Values are string | null from extraction. */
  rows: Record<string, unknown>[];
}

/**
 * Validation result returned by step.validate().
 */
export interface ValidationResult {
  valid: boolean;
  /** Human-readable error messages if invalid. */
  errors: string[];
}

/**
 * IPipelineStep — interface every pipeline step must implement.
 *
 * Steps are stateless — they receive data + config, return transformed data.
 */
export interface IPipelineStep {
  /**
   * Execute this step on the input data.
   *
   * @param data - Input tabular data from previous step
   * @param config - Step-specific configuration
   * @returns Transformed tabular data
   * @throws Error if step cannot execute (invalid data shape, etc.)
   */
  execute(data: TabularData, config: StepConfig): TabularData;

  /**
   * Validate the step config before execution.
   * Called before execute() to give early feedback.
   *
   * @param config - Step config to validate
   * @param availableColumns - Columns available in the current data (for column-ref checks)
   * @returns Validation result with errors list
   */
  validate(config: StepConfig, availableColumns: string[]): ValidationResult;

  /**
   * Return human-readable description of this step type.
   * Used by the frontend to render step cards and labels.
   */
  describe(): StepDescription;
}

/** Extract config type for a specific StepType. */
export type ConfigForType<T extends StepType> = Extract<StepConfig, { type: T }>;
