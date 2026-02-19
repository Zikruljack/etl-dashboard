/**
 * Public V1 API routes.
 * External application access via API keys.
 * All routes require valid API key (not JWT).
 * Users can read their own datasets only.
 */

import { Router } from 'express';
import { apiKeyAuth } from '../../core/middleware/api-key-auth.js';
import { sendSuccess, sendPaginated } from '../../core/response.js';
import { AppError, assertFound } from '../../core/errors.js';
import { parsePagination, buildPaginationMeta } from '../../core/pagination.js';
import { datasetRepository, datasetRowRepository } from '../dataset/dataset.repository.js';

const router: ReturnType<typeof Router> = Router();

// All V1 routes require valid API key
router.use(apiKeyAuth());

/**
 * GET /api/v1/datasets
 * List all datasets owned by the API key's user.
 */
router.get('/datasets', async (req, res, next) => {
  try {
    const { eq } = await import('drizzle-orm');
    const { datasets } = await import('../../db/schema/index.js');
    const { db } = await import('../../config/database.js');

    const rows = await db
      .select()
      .from(datasets)
      .where(eq(datasets.createdBy, req.apiUser!.userId))
      .orderBy(datasets.createdAt);

    sendSuccess(res, rows);
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/datasets/:id
 * Get dataset metadata by ID.
 * Only accessible if the dataset belongs to the API key's user.
 */
router.get('/datasets/:id', async (req, res, next) => {
  try {
    const dataset = await datasetRepository.findById(req.params['id'] as string);
    assertFound(dataset, 'Dataset not found');

    if (dataset.createdBy !== req.apiUser!.userId) {
      throw new AppError(403, 'Access denied');
    }

    sendSuccess(res, dataset);
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/datasets/:id/columns
 * Get column definitions for a dataset.
 */
router.get('/datasets/:id/columns', async (req, res, next) => {
  try {
    const dataset = await datasetRepository.findById(req.params['id'] as string);
    assertFound(dataset, 'Dataset not found');

    if (dataset.createdBy !== req.apiUser!.userId) {
      throw new AppError(403, 'Access denied');
    }

    sendSuccess(res, dataset.columns ?? []);
  } catch (err) { next(err); }
});

/**
 * GET /api/v1/datasets/:id/data
 * Get paginated clean data rows for a dataset.
 * Supports: ?page=1&pageSize=50
 */
router.get('/datasets/:id/data', async (req, res, next) => {
  try {
    const dataset = await datasetRepository.findById(req.params['id'] as string);
    assertFound(dataset, 'Dataset not found');

    if (dataset.createdBy !== req.apiUser!.userId) {
      throw new AppError(403, 'Access denied');
    }

    const pagination = parsePagination(req);
    const { data, total } = await datasetRowRepository.findByDataset(
      dataset.id,
      pagination.pageSize,
      pagination.offset,
    );

    sendPaginated(res, data, buildPaginationMeta(total, pagination));
  } catch (err) { next(err); }
});

export default router;
