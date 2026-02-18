/**
 * Pipeline types — Transform step definitions and pipeline state.
 * Used by both backend (pipeline executor) and frontend (pipeline editor UI).
 */

/** All supported pipeline step types. */
export type StepType =
  | 'rename'
  | 'change_type'
  | 'trim'
  | 'map_values'
  | 'remove_duplicates'
  | 'fill_missing'
  | 'find_replace'
  | 'filter_rows'
  | 'split_column'
  | 'merge_columns';

/** Target data types for change_type step. */
export type TargetColumnType = 'text' | 'number' | 'date' | 'boolean';

/** Fill strategy for fill_missing step. */
export type FillStrategy = 'forward_fill' | 'backward_fill' | 'constant' | 'mean' | 'median';

/** Filter row operators. */
export type FilterOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty';

// ─── Step Config Types ────────────────────────────────────────────────────────

/** Config for rename step: rename a single column. */
export interface RenameConfig {
  column: string;
  newName: string;
}

/** Config for change_type step: change column data type. */
export interface ChangeTypeConfig {
  column: string;
  targetType: TargetColumnType;
  /** Format string for date parsing, e.g. "DD/MM/YYYY". Optional. */
  dateFormat?: string;
}

/** Config for trim step: strip leading/trailing whitespace from columns. */
export interface TrimConfig {
  /** Columns to trim. Empty array = trim all columns. */
  columns: string[];
}

/** Config for map_values step: replace specific values in a column. */
export interface MapValuesConfig {
  column: string;
  /** Mapping from old value to new value. */
  mapping: Record<string, string>;
  /** If true, values not in mapping are left unchanged. If false, they become empty. Default: true. */
  keepUnmapped?: boolean;
}

/** Config for remove_duplicates step: remove duplicate rows by key columns. */
export interface RemoveDuplicatesConfig {
  /** Columns to check for duplicates. Empty = all columns. */
  columns: string[];
  /** Which duplicate to keep: first (default) or last. */
  keep?: 'first' | 'last';
}

/** Config for fill_missing step: fill null/empty values in a column. */
export interface FillMissingConfig {
  column: string;
  strategy: FillStrategy;
  /** Used when strategy = 'constant'. */
  constantValue?: string;
}

/** Config for find_replace step: find and replace text in a column. */
export interface FindReplaceConfig {
  column: string;
  find: string;
  replace: string;
  /** If true, treat `find` as a regex pattern. */
  useRegex?: boolean;
  /** If true, replace all occurrences. Default: true. */
  replaceAll?: boolean;
}

/** Filter condition for a single column. */
export interface FilterCondition {
  column: string;
  operator: FilterOperator;
  value: string;
}

/** Config for filter_rows step: keep only rows matching condition. */
export interface FilterRowsConfig {
  condition: FilterCondition;
}

/** Config for split_column step: split one column into multiple by separator. */
export interface SplitColumnConfig {
  column: string;
  separator: string;
  /** Names for the new columns produced by splitting. */
  newColumns: string[];
  /** If true, remove the original column after splitting. Default: true. */
  dropOriginal?: boolean;
}

/** Config for merge_columns step: join multiple columns into one. */
export interface MergeColumnsConfig {
  /** Source columns to merge (in order). */
  columns: string[];
  separator: string;
  /** Name for the new merged column. */
  newColumn: string;
  /** If true, remove the source columns after merging. Default: true. */
  dropOriginals?: boolean;
}

// ─── Step Config Union ────────────────────────────────────────────────────────

/** Discriminated union of all step configs. */
export type StepConfig =
  | ({ type: 'rename' } & RenameConfig)
  | ({ type: 'change_type' } & ChangeTypeConfig)
  | ({ type: 'trim' } & TrimConfig)
  | ({ type: 'map_values' } & MapValuesConfig)
  | ({ type: 'remove_duplicates' } & RemoveDuplicatesConfig)
  | ({ type: 'fill_missing' } & FillMissingConfig)
  | ({ type: 'find_replace' } & FindReplaceConfig)
  | ({ type: 'filter_rows' } & FilterRowsConfig)
  | ({ type: 'split_column' } & SplitColumnConfig)
  | ({ type: 'merge_columns' } & MergeColumnsConfig);

// ─── Pipeline Entities ────────────────────────────────────────────────────────

/**
 * A single pipeline step stored in the DB.
 * Config is typed per step.
 */
export interface PipelineStep {
  id: string;
  pipelineId: string;
  sortOrder: number;
  type: StepType;
  config: StepConfig;
  createdAt: string;
  updatedAt: string;
}

/**
 * A pipeline attached to a dataset.
 * Contains ordered list of transform steps.
 */
export interface Pipeline {
  id: string;
  name: string;
  datasetId: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  steps: PipelineStep[];
}

// ─── API Request/Response Types ───────────────────────────────────────────────

/** Request body for saving/updating a pipeline. */
export interface SavePipelineRequest {
  name?: string;
  isActive?: boolean;
  steps: Array<{
    type: StepType;
    config: StepConfig;
    sortOrder: number;
  }>;
}

/** Request body for previewing pipeline execution. */
export interface PipelinePreviewRequest {
  /** Raw rows to run pipeline on (sample). */
  rows: Record<string, unknown>[];
  steps: Array<{
    type: StepType;
    config: StepConfig;
    sortOrder: number;
  }>;
}

/** A single step result for pipeline preview. */
export interface StepPreviewResult {
  stepIndex: number;
  stepType: StepType;
  rowsIn: number;
  rowsOut: number;
  /** Sample of output rows (first 50). */
  sample: Record<string, unknown>[];
  /** Column names after this step. */
  columns: string[];
  /** Any warnings from this step. */
  warnings: string[];
}

/** Response for pipeline preview endpoint. */
export interface PipelinePreviewResponse {
  /** Input rows (before pipeline). */
  input: Record<string, unknown>[];
  /** Final output rows (after all steps). */
  output: Record<string, unknown>[];
  /** Per-step results for the preview. */
  steps: StepPreviewResult[];
  /** Total rows in, out. */
  stats: {
    rowsIn: number;
    rowsOut: number;
    stepsExecuted: number;
  };
}

/** Human-readable description of a step for display in UI. */
export interface StepDescription {
  type: StepType;
  label: string;
  summary: string;
  icon: string;
}
