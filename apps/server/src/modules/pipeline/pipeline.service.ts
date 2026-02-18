import type { SavePipelineRequest, PipelinePreviewRequest, PipelinePreviewResponse, Pipeline, StepType } from '@etl-dashboard/shared';
import { AppError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';
import { pipelineRepository } from './pipeline.repository.js';
import { PipelineExecutor } from './pipeline.executor.js';
import { StepFactory } from './step.factory.js';
import type { TabularData } from './steps/step.interface.js';

const log = logger.child({ module: 'pipeline.service' });

/**
 * Get the pipeline for a dataset, or null if none exists.
 *
 * @param datasetId - Dataset UUID
 * @returns Pipeline with steps, or null
 */
export async function getPipeline(datasetId: string): Promise<Pipeline | null> {
  const pipeline = await pipelineRepository.findByDataset(datasetId);
  if (!pipeline) return null;

  return {
    id: pipeline.id,
    name: pipeline.name,
    datasetId: pipeline.datasetId,
    isActive: pipeline.isActive,
    createdBy: pipeline.createdBy,
    createdAt: pipeline.createdAt.toISOString(),
    updatedAt: pipeline.updatedAt.toISOString(),
    steps: pipeline.steps.map((s) => ({
      id: s.id,
      pipelineId: s.pipelineId,
      sortOrder: s.sortOrder,
      type: s.type as StepType,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: s.config as any,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
  };
}

/**
 * Save (upsert) a pipeline for a dataset.
 * Replaces all existing steps with the new step list.
 *
 * @param datasetId - Dataset UUID
 * @param userId - User ID performing the save
 * @param body - Pipeline definition (name, isActive, steps)
 * @returns Saved pipeline
 * @throws AppError(400) if any step type is invalid
 */
export async function savePipeline(
  datasetId: string,
  userId: string,
  body: SavePipelineRequest,
): Promise<Pipeline> {
  // Validate all step types
  const invalidTypes = body.steps
    .map((s) => s.type)
    .filter((t) => !StepFactory.isValidType(t));
  if (invalidTypes.length > 0) {
    throw new AppError(400, `Invalid step type(s): ${invalidTypes.join(', ')}`);
  }

  const name = body.name ?? 'Default Pipeline';
  const isActive = body.isActive ?? true;

  log.info('Saving pipeline', { datasetId, stepCount: body.steps.length });

  const saved = await pipelineRepository.upsert(
    datasetId,
    userId,
    name,
    isActive,
    body.steps.map((s) => ({
      sortOrder: s.sortOrder,
      type: s.type as StepType,
      config: s.config,
    })),
  );

  return {
    id: saved.id,
    name: saved.name,
    datasetId: saved.datasetId,
    isActive: saved.isActive,
    createdBy: saved.createdBy,
    createdAt: saved.createdAt.toISOString(),
    updatedAt: saved.updatedAt.toISOString(),
    steps: saved.steps.map((s) => ({
      id: s.id,
      pipelineId: s.pipelineId,
      sortOrder: s.sortOrder,
      type: s.type as StepType,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      config: s.config as any,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
  };
}

/**
 * Run a pipeline preview on sample rows.
 * Does NOT save anything — used by the frontend step-by-step preview.
 *
 * @param body - Preview request with rows + step definitions
 * @returns Per-step preview results
 * @throws AppError(400) if any step type is invalid
 */
export async function previewPipeline(body: PipelinePreviewRequest): Promise<PipelinePreviewResponse> {
  const invalidTypes = body.steps
    .map((s) => s.type)
    .filter((t) => !StepFactory.isValidType(t));
  if (invalidTypes.length > 0) {
    throw new AppError(400, `Invalid step type(s): ${invalidTypes.join(', ')}`);
  }

  // Infer columns from first row
  const columns = body.rows.length > 0 ? Object.keys(body.rows[0]) : [];
  const input: TabularData = { columns, rows: body.rows };

  const executor = new PipelineExecutor();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return executor.preview(input, body.steps as any);
}

/**
 * Delete the pipeline for a dataset.
 *
 * @param datasetId - Dataset UUID
 * @throws AppError(404) if pipeline not found
 */
export async function deletePipeline(datasetId: string): Promise<void> {
  const deleted = await pipelineRepository.deleteByDataset(datasetId);
  if (!deleted) throw new AppError(404, 'Pipeline not found');
}

/**
 * Get all available step type descriptions (for the "Add Step" menu in UI).
 *
 * @returns Array of step descriptions
 */
export function getStepDescriptions() {
  return StepFactory.getAllDescriptions();
}
