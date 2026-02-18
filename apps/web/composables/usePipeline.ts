import type {
  Pipeline,
  PipelineStep,
  StepConfig,
  StepType,
  StepDescription,
  PipelinePreviewResponse,
  SavePipelineRequest,
} from '@etl-dashboard/shared';

/**
 * A draft step (not yet saved) with a temporary client-side ID.
 */
export interface DraftStep {
  /** Temporary UUID, replaced with real ID on save. */
  _clientId: string;
  sortOrder: number;
  type: StepType;
  config: Partial<StepConfig>;
}

/**
 * usePipeline — Manage pipeline state and step operations for the pipeline editor.
 *
 * @param datasetId - The dataset this pipeline belongs to
 * @returns Reactive pipeline state and action functions
 */
export function usePipeline(datasetId: Ref<string>) {
  const { $api } = useNuxtApp();

  // ─── State ────────────────────────────────────────────────────────────────
  const pipeline = ref<Pipeline | null>(null);
  const steps = ref<DraftStep[]>([]);
  const availableStepTypes = ref<StepDescription[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const previewing = ref(false);
  const error = ref<string | null>(null);
  const preview = ref<PipelinePreviewResponse | null>(null);
  const isDirty = ref(false);

  // ─── Load ─────────────────────────────────────────────────────────────────

  /**
   * Load the pipeline from the API and hydrate draft steps.
   */
  async function loadPipeline() {
    loading.value = true;
    error.value = null;
    try {
      const res = await $api<{ data: Pipeline | null }>(`/datasets/${datasetId.value}/pipeline`);
      pipeline.value = res.data;
      if (res.data) {
        steps.value = res.data.steps.map((s) => stepToLocal(s));
      } else {
        steps.value = [];
      }
      isDirty.value = false;
    } catch (e: unknown) {
      error.value = extractErr(e);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Load available step type descriptions from the API.
   */
  async function loadStepTypes() {
    try {
      const res = await $api<{ data: StepDescription[] }>(`/datasets/${datasetId.value}/pipeline/step-types`);
      availableStepTypes.value = res.data;
    } catch {
      // Non-critical — UI will show empty list
    }
  }

  // ─── Step CRUD ────────────────────────────────────────────────────────────

  /**
   * Add a new empty step of the given type at the end.
   *
   * @param type - Step type to add
   */
  function addStep(type: StepType) {
    const sortOrder = steps.value.length > 0
      ? Math.max(...steps.value.map((s) => s.sortOrder)) + 1
      : 0;
    steps.value.push({
      _clientId: crypto.randomUUID(),
      sortOrder,
      type,
      config: { type } as Partial<StepConfig>,
    });
    isDirty.value = true;
  }

  /**
   * Remove a step by its client ID.
   *
   * @param clientId - The _clientId of the step to remove
   */
  function removeStep(clientId: string) {
    const idx = steps.value.findIndex((s) => s._clientId === clientId);
    if (idx === -1) return;
    steps.value.splice(idx, 1);
    reorderAfterRemove();
    isDirty.value = true;
  }

  /**
   * Move a step up one position in the list.
   *
   * @param clientId - The _clientId of the step to move
   */
  function moveUp(clientId: string) {
    const idx = steps.value.findIndex((s) => s._clientId === clientId);
    if (idx <= 0) return;
    [steps.value[idx - 1], steps.value[idx]] = [steps.value[idx], steps.value[idx - 1]];
    renumberSteps();
    isDirty.value = true;
  }

  /**
   * Move a step down one position in the list.
   *
   * @param clientId - The _clientId of the step to move
   */
  function moveDown(clientId: string) {
    const idx = steps.value.findIndex((s) => s._clientId === clientId);
    if (idx === -1 || idx >= steps.value.length - 1) return;
    [steps.value[idx], steps.value[idx + 1]] = [steps.value[idx + 1], steps.value[idx]];
    renumberSteps();
    isDirty.value = true;
  }

  /**
   * Update the config of a step.
   *
   * @param clientId - The _clientId of the step to update
   * @param config - New config (partial — merged with existing)
   */
  function updateStepConfig(clientId: string, config: Partial<StepConfig>) {
    const step = steps.value.find((s) => s._clientId === clientId);
    if (!step) return;
    step.config = { ...step.config, ...config };
    isDirty.value = true;
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  /**
   * Save the pipeline to the API (upsert).
   *
   * @param name - Pipeline name
   * @param isActive - Whether to activate the pipeline
   * @throws Error message set in error ref on failure
   */
  async function savePipeline(name: string = 'Default Pipeline', isActive: boolean = true) {
    saving.value = true;
    error.value = null;
    try {
      const body: SavePipelineRequest = {
        name,
        isActive,
        steps: steps.value.map((s) => ({
          type: s.type,
          sortOrder: s.sortOrder,
          config: s.config as StepConfig,
        })),
      };
      const res = await $api<{ data: Pipeline }>(`/datasets/${datasetId.value}/pipeline`, {
        method: 'POST',
        body,
      });
      pipeline.value = res.data;
      steps.value = res.data.steps.map((s) => stepToLocal(s));
      isDirty.value = false;
    } catch (e: unknown) {
      error.value = extractErr(e);
      throw e;
    } finally {
      saving.value = false;
    }
  }

  // ─── Preview ──────────────────────────────────────────────────────────────

  /**
   * Run a pipeline preview on sample rows.
   * Sends the current draft steps to the API for preview.
   *
   * @param sampleRows - Sample data rows (from dataset)
   */
  async function runPreview(sampleRows: Record<string, unknown>[]) {
    previewing.value = true;
    error.value = null;
    try {
      const res = await $api<{ data: PipelinePreviewResponse }>(
        `/datasets/${datasetId.value}/pipeline/preview`,
        {
          method: 'POST',
          body: {
            rows: sampleRows.slice(0, 100),
            steps: steps.value.map((s) => ({
              type: s.type,
              sortOrder: s.sortOrder,
              config: s.config as StepConfig,
            })),
          },
        },
      );
      preview.value = res.data;
    } catch (e: unknown) {
      error.value = extractErr(e);
    } finally {
      previewing.value = false;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function renumberSteps() {
    steps.value.forEach((s, i) => { s.sortOrder = i; });
  }

  function reorderAfterRemove() {
    steps.value.sort((a, b) => a.sortOrder - b.sortOrder);
    renumberSteps();
  }

  function stepToLocal(s: PipelineStep): DraftStep {
    return {
      _clientId: s.id,
      sortOrder: s.sortOrder,
      type: s.type,
      config: s.config as Partial<StepConfig>,
    };
  }

  function extractErr(e: unknown): string {
    if (e && typeof e === 'object') {
      const fe = e as { data?: { message?: string }; message?: string };
      if (fe.data?.message) return fe.data.message;
      if (fe.message) return fe.message;
    }
    return 'An unexpected error occurred';
  }

  return {
    // State
    pipeline: readonly(pipeline),
    steps: readonly(steps),
    availableStepTypes: readonly(availableStepTypes),
    loading: readonly(loading),
    saving: readonly(saving),
    previewing: readonly(previewing),
    error: readonly(error),
    preview: readonly(preview),
    isDirty: readonly(isDirty),
    // Actions
    loadPipeline,
    loadStepTypes,
    addStep,
    removeStep,
    moveUp,
    moveDown,
    updateStepConfig,
    savePipeline,
    runPreview,
  };
}
