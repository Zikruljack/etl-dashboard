import type { StepType, StepDescription } from '@etl-dashboard/shared';
import type { IPipelineStep } from './steps/step.interface';
import { RenameStep } from './steps/rename.step';
import { ChangeTypeStep } from './steps/change-type.step';
import { TrimStep } from './steps/trim.step';
import { MapValuesStep } from './steps/map-values.step';
import { RemoveDuplicatesStep } from './steps/remove-duplicates.step';
import { FillMissingStep } from './steps/fill-missing.step';
import { FindReplaceStep } from './steps/find-replace.step';
import { FilterRowsStep } from './steps/filter-rows.step';
import { SplitColumnStep } from './steps/split-column.step';
import { MergeColumnsStep } from './steps/merge-columns.step';

/**
 * StepFactory — create pipeline step instances by type string.
 * Maps StepType enum values to concrete IPipelineStep implementations.
 */
export class StepFactory {
  private static readonly registry: Record<StepType, () => IPipelineStep> = {
    rename: () => new RenameStep(),
    change_type: () => new ChangeTypeStep(),
    trim: () => new TrimStep(),
    map_values: () => new MapValuesStep(),
    remove_duplicates: () => new RemoveDuplicatesStep(),
    fill_missing: () => new FillMissingStep(),
    find_replace: () => new FindReplaceStep(),
    filter_rows: () => new FilterRowsStep(),
    split_column: () => new SplitColumnStep(),
    merge_columns: () => new MergeColumnsStep(),
  };

  /**
   * Create a step instance for the given type.
   *
   * @param type - The step type string
   * @returns IPipelineStep instance
   * @throws Error if type is not registered
   */
  static create(type: StepType): IPipelineStep {
    const factory = StepFactory.registry[type];
    if (!factory) throw new Error(`Unknown pipeline step type: ${type}`);
    return factory();
  }

  /**
   * Return descriptions for all registered step types.
   * Used by the frontend to build the "Add Step" menu.
   *
   * @returns Array of step descriptions sorted by label
   */
  static getAllDescriptions(): StepDescription[] {
    return (Object.keys(StepFactory.registry) as StepType[]).map((type) =>
      StepFactory.create(type).describe()
    ).sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Check if a step type is registered.
   *
   * @param type - Step type string to check
   * @returns true if type is valid
   */
  static isValidType(type: string): type is StepType {
    return type in StepFactory.registry;
  }
}
