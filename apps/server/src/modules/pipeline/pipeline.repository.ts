import { eq, asc } from 'drizzle-orm';
import { BaseRepository } from '../../core/base.repository.js';
import { pipelines, pipelineSteps } from '../../db/schema/index.js';
import { db } from '../../config/database.js';
import type { StepType, StepConfig } from '@etl-dashboard/shared';

type Pipeline = typeof pipelines.$inferSelect;
type PipelineInsert = typeof pipelines.$inferInsert;
type PipelineStep = typeof pipelineSteps.$inferSelect;
type PipelineStepInsert = typeof pipelineSteps.$inferInsert;

/**
 * PipelineRepository — CRUD for pipelines and pipeline_steps.
 * Handles composite fetch (pipeline + steps together).
 */
export class PipelineRepository extends BaseRepository<typeof pipelines> {
  constructor() {
    super(pipelines, 'pipelines');
  }

  /**
   * Find the active pipeline for a dataset, including its steps sorted by sortOrder.
   *
   * @param datasetId - Dataset UUID
   * @returns Pipeline with steps, or null if none found
   */
  async findByDataset(datasetId: string): Promise<(Pipeline & { steps: PipelineStep[] }) | null> {
    const [pipeline] = await db
      .select()
      .from(pipelines)
      .where(eq(pipelines.datasetId, datasetId))
      .limit(1);

    if (!pipeline) return null;

    const steps = await db
      .select()
      .from(pipelineSteps)
      .where(eq(pipelineSteps.pipelineId, pipeline.id))
      .orderBy(asc(pipelineSteps.sortOrder));

    return { ...pipeline, steps };
  }

  /**
   * Find a pipeline by ID including its steps.
   *
   * @param id - Pipeline UUID
   * @returns Pipeline with steps, or null
   */
  async findByIdWithSteps(id: string): Promise<(Pipeline & { steps: PipelineStep[] }) | null> {
    const pipeline = await this.findById(id);
    if (!pipeline) return null;

    const steps = await db
      .select()
      .from(pipelineSteps)
      .where(eq(pipelineSteps.pipelineId, id))
      .orderBy(asc(pipelineSteps.sortOrder));

    return { ...pipeline, steps };
  }

  /**
   * Upsert a pipeline for a dataset: create if none exists, update if already there.
   * Replaces all steps atomically.
   *
   * @param datasetId - Dataset UUID
   * @param userId - User creating/updating the pipeline
   * @param name - Pipeline name
   * @param isActive - Whether pipeline is active
   * @param steps - Ordered step definitions
   * @returns Saved pipeline with steps
   */
  async upsert(
    datasetId: string,
    userId: string,
    name: string,
    isActive: boolean,
    steps: Array<{ sortOrder: number; type: StepType; config: StepConfig }>,
  ): Promise<Pipeline & { steps: PipelineStep[] }> {
    const existing = await this.findByDataset(datasetId);

    let pipeline: Pipeline;
    if (existing) {
      const [updated] = await db
        .update(pipelines)
        .set({ name, isActive, updatedAt: new Date() })
        .where(eq(pipelines.id, existing.id))
        .returning();
      pipeline = updated;
    } else {
      const [created] = await db
        .insert(pipelines)
        .values({ datasetId, name, isActive, createdBy: userId } satisfies PipelineInsert)
        .returning();
      pipeline = created;
    }

    // Replace all steps
    await db.delete(pipelineSteps).where(eq(pipelineSteps.pipelineId, pipeline.id));

    let savedSteps: PipelineStep[] = [];
    if (steps.length > 0) {
      savedSteps = await db
        .insert(pipelineSteps)
        .values(steps.map((s) => ({
          pipelineId: pipeline.id,
          sortOrder: s.sortOrder,
          type: s.type,
          config: s.config as unknown as Record<string, unknown>,
        }) satisfies PipelineStepInsert))
        .returning();
    }

    return { ...pipeline, steps: savedSteps.sort((a, b) => a.sortOrder - b.sortOrder) };
  }

  /**
   * Delete a pipeline and all its steps (cascade handled by FK).
   *
   * @param datasetId - Dataset UUID whose pipeline to delete
   * @returns Deleted pipeline or null
   */
  async deleteByDataset(datasetId: string): Promise<Pipeline | null> {
    const existing = await this.findByDataset(datasetId);
    if (!existing) return null;
    return this.delete(existing.id);
  }
}

/** Singleton instance for DI. */
export const pipelineRepository = new PipelineRepository();
