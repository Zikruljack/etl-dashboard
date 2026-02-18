import type { StepConfig, StepType, PipelinePreviewResponse, StepPreviewResult } from '@etl-dashboard/shared';
import type { TabularData } from './steps/step.interface';
import { StepFactory } from './step.factory';
import { logger } from '../../core/logger';

/** A step definition ready for execution. */
export interface ExecutableStep {
  sortOrder: number;
  type: StepType;
  config: StepConfig;
}

/** Result of a full pipeline execution. */
export interface PipelineResult {
  /** Final transformed data. */
  data: TabularData;
  /** Rows removed by filtering steps. */
  rowsFiltered: number;
  /** Total steps executed. */
  stepsExecuted: number;
  /** Any non-fatal warnings collected. */
  warnings: string[];
}

/**
 * PipelineExecutor — Run pipeline steps sequentially.
 * Each step receives the output of the previous step.
 * Steps are executed in sortOrder order.
 */
export class PipelineExecutor {
  private readonly log = logger.child({ module: 'PipelineExecutor' });

  /**
   * Execute a full pipeline on the input data.
   * Steps are sorted by sortOrder before execution.
   *
   * @param input - Initial tabular data (extraction output)
   * @param steps - Ordered list of executable steps
   * @returns Execution result with final data + stats
   */
  execute(input: TabularData, steps: ExecutableStep[]): PipelineResult {
    const sorted = [...steps].sort((a, b) => a.sortOrder - b.sortOrder);
    const warnings: string[] = [];
    const initialRowCount = input.rows.length;
    let current = input;

    for (const step of sorted) {
      try {
        const handler = StepFactory.create(step.type);
        const validation = handler.validate(step.config, current.columns);
        if (!validation.valid) {
          warnings.push(`Step ${step.sortOrder} (${step.type}): ${validation.errors.join(', ')}`);
          this.log.warn(`Step validation failed — skipping step ${step.type}`, { errors: validation.errors });
          continue;
        }
        current = handler.execute(current, step.config);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`Step ${step.sortOrder} (${step.type}) error: ${msg}`);
        this.log.error(`Step execution error — skipping step ${step.type}`, { err: msg });
      }
    }

    return {
      data: current,
      rowsFiltered: initialRowCount - current.rows.length,
      stepsExecuted: sorted.length,
      warnings,
    };
  }

  /**
   * Execute pipeline and return per-step preview data.
   * Used by the preview endpoint to show before/after for each step.
   *
   * @param input - Initial tabular data
   * @param steps - Ordered list of executable steps
   * @returns Full preview response with per-step samples
   */
  preview(input: TabularData, steps: ExecutableStep[]): PipelinePreviewResponse {
    const sorted = [...steps].sort((a, b) => a.sortOrder - b.sortOrder);
    const stepResults: StepPreviewResult[] = [];
    let current = input;

    for (let i = 0; i < sorted.length; i++) {
      const step = sorted[i];
      const rowsIn = current.rows.length;
      const stepWarnings: string[] = [];

      try {
        const handler = StepFactory.create(step.type);
        const validation = handler.validate(step.config, current.columns);
        if (!validation.valid) {
          stepWarnings.push(...validation.errors);
        } else {
          current = handler.execute(current, step.config);
        }
      } catch (err) {
        stepWarnings.push(err instanceof Error ? err.message : String(err));
      }

      stepResults.push({
        stepIndex: i,
        stepType: step.type,
        rowsIn,
        rowsOut: current.rows.length,
        sample: current.rows.slice(0, 50),
        columns: [...current.columns],
        warnings: stepWarnings,
      });
    }

    return {
      input: input.rows.slice(0, 50),
      output: current.rows.slice(0, 50),
      steps: stepResults,
      stats: {
        rowsIn: input.rows.length,
        rowsOut: current.rows.length,
        stepsExecuted: sorted.length,
      },
    };
  }
}
