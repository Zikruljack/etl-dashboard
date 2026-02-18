import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, validate } from '../../core/middleware/index.js';
import { sendSuccess } from '../../core/response.js';
import { checkOwnership } from '../../core/security/idor-guard.js';
import { datasetRepository } from '../dataset/dataset.repository.js';
import * as pipelineService from './pipeline.service.js';

const router: ReturnType<typeof Router> = Router({ mergeParams: true });

router.use(authenticate);

// ─── Validation Schemas ────────────────────────────────────────────────────

/** Step type enum — all valid step types */
const stepTypeEnum = z.enum([
  'rename', 'change_type', 'trim', 'map_values', 'remove_duplicates',
  'fill_missing', 'find_replace', 'filter_rows', 'split_column', 'merge_columns',
]);

/** Generic step config — we trust the executor to validate specifics */
const stepSchema = z.object({
  type: stepTypeEnum,
  sortOrder: z.number().int().min(0),
  config: z.record(z.string(), z.unknown()),
});

/** Validation schema for saving a pipeline */
const savePipelineSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
  steps: z.array(stepSchema),
});

/** Validation schema for pipeline preview */
const previewSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).max(500),
  steps: z.array(stepSchema),
});

// ─── Routes ───────────────────────────────────────────────────────────────

/**
 * GET /api/datasets/:id/pipeline
 * Get the pipeline for a dataset.
 * Returns null (with 200) if no pipeline exists yet.
 */
router.get('/',
  requireRole('admin', 'editor', 'viewer'),
  checkOwnership({
    resourceFn: (id) => datasetRepository.findById(id),
    ownerField: 'createdBy',
    paramName: 'id',
  }),
  async (req, res, next) => {
    try {
      const pipeline = await pipelineService.getPipeline(req.params['id'] as string);
      sendSuccess(res, pipeline);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/datasets/:id/pipeline
 * Save (upsert) the pipeline for a dataset.
 * Replaces all existing steps atomically.
 */
router.post('/',
  requireRole('admin', 'editor'),
  checkOwnership({
    resourceFn: (id) => datasetRepository.findById(id),
    ownerField: 'createdBy',
    paramName: 'id',
  }),
  validate(savePipelineSchema),
  async (req, res, next) => {
    try {
      const pipeline = await pipelineService.savePipeline(
        req.params['id'] as string,
        req.user!.userId,
        req.body,
      );
      sendSuccess(res, pipeline, 201);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/datasets/:id/pipeline
 * Delete the pipeline for a dataset.
 */
router.delete('/',
  requireRole('admin', 'editor'),
  checkOwnership({
    resourceFn: (id) => datasetRepository.findById(id),
    ownerField: 'createdBy',
    paramName: 'id',
  }),
  async (req, res, next) => {
    try {
      await pipelineService.deletePipeline(req.params['id'] as string);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/datasets/:id/pipeline/preview
 * Run pipeline steps on sample rows and return per-step preview.
 * Does not save anything.
 */
router.post('/preview',
  requireRole('admin', 'editor'),
  validate(previewSchema),
  async (req, res, next) => {
    try {
      const result = await pipelineService.previewPipeline(req.body);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/datasets/:id/pipeline/step-types
 * Return all available step types with descriptions and icons.
 * Used by the frontend "Add Step" menu.
 */
router.get('/step-types',
  requireRole('admin', 'editor', 'viewer'),
  (_req, res, next) => {
    try {
      const descriptions = pipelineService.getStepDescriptions();
      sendSuccess(res, descriptions);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
