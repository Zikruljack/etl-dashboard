import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, validate } from '../../core/middleware/index.js';
import { sendSuccess, sendPaginated } from '../../core/response.js';
import { parsePagination, buildPaginationMeta } from '../../core/pagination.js';
import { AppError } from '../../core/errors.js';
import { checkOwnership } from '../../core/security/idor-guard.js';
import { datasetRepository } from './dataset.repository.js';
import * as datasetService from './dataset.service.js';
import * as dataService from './data.service.js';
import * as syncService from '../sync/sync.service.js';
import { snapshotRepository } from '../source/snapshot.repository.js';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);

/** Validation schema for creating a dataset */
const createDatasetSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  sourceType: z.enum(['google_sheets', 'csv', 'excel']),
  sourceConfig: z.record(z.string(), z.unknown()),
});

/** Validation schema for updating dataset metadata */
const updateDatasetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  sourceConfig: z.record(z.string(), z.unknown()).optional(),
});

/** Validation schema for extraction config */
const extractionConfigSchema = z.object({
  headerRowIndices: z.array(z.number().int().min(0)),
  headerFlattenSeparator: z.string().default('_'),
  dataStartRow: z.number().int().min(0),
  dataEndRow: z.number().int().min(0).nullable(),
  columnStart: z.number().int().min(0).default(0),
  columnEnd: z.number().int().min(0).nullable().default(null),
  skipRows: z.array(z.number().int().min(0)).default([]),
  keyColumns: z.array(z.string()).default([]),
  columnLabels: z.record(z.string(), z.string()).default({}),
});

/** Validation schema for re-extract request */
const reExtractSchema = z.object({
  extractionConfig: extractionConfigSchema,
});

/** Validation schema for flexible data query (widget engine) */
const querySchema = z.object({
  datasetId: z.string().uuid(),
  columns: z.array(z.string()).optional(),
  filters: z.array(z.object({
    column: z.string(),
    operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in']),
    value: z.unknown(),
  })).optional(),
  sort: z.object({
    column: z.string(),
    direction: z.enum(['asc', 'desc']),
  }).optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  aggregation: z.object({
    groupBy: z.array(z.string()),
    measures: z.array(z.object({
      column: z.string(),
      function: z.enum(['count', 'sum', 'avg', 'min', 'max']),
      alias: z.string().optional(),
    })),
  }).optional(),
});

/** IDOR middleware: verify user owns the dataset (or is admin) */
const verifyDatasetOwner = checkOwnership({
  resourceFn: (id) => datasetRepository.findById(id),
  ownerField: 'createdBy',
});

/**
 * GET /api/datasets
 * List datasets. Admin sees all; non-admin sees only their own.
 */
router.get('/', async (req, res, next) => {
  try {
    const datasets = await datasetService.listDatasets(req.user!.userId, req.user!.role);
    sendSuccess(res, datasets);
  } catch (err) { next(err); }
});

/**
 * POST /api/datasets
 * Create a new dataset (editor/admin only).
 */
router.post('/', requireRole('admin', 'editor'), validate(createDatasetSchema), async (req, res, next) => {
  try {
    const dataset = await datasetService.createDataset({
      ...req.body,
      createdBy: req.user!.userId,
    });
    sendSuccess(res, dataset, 201);
  } catch (err) { next(err); }
});

/**
 * GET /api/datasets/:id
 * Get a single dataset by ID (owner or admin only).
 */
router.get('/:id', verifyDatasetOwner, async (req, res, next) => {
  try {
    const dataset = await datasetService.getDataset(req.params.id as string);
    sendSuccess(res, dataset);
  } catch (err) { next(err); }
});

/**
 * PATCH /api/datasets/:id
 * Update dataset metadata (owner or admin only).
 */
router.patch('/:id', requireRole('admin', 'editor'), verifyDatasetOwner, validate(updateDatasetSchema), async (req, res, next) => {
  try {
    const dataset = await datasetService.updateDataset(req.params.id as string, req.body);
    sendSuccess(res, dataset);
  } catch (err) { next(err); }
});

/**
 * DELETE /api/datasets/:id
 * Delete a dataset and all its data (owner or admin only).
 */
router.delete('/:id', requireRole('admin', 'editor'), verifyDatasetOwner, async (req, res, next) => {
  try {
    await datasetService.deleteDataset(req.params.id as string);
    sendSuccess(res, { id: req.params.id as string });
  } catch (err) { next(err); }
});

/**
 * POST /api/datasets/:id/sync
 * Trigger data sync from source (owner or admin only).
 * Uses Phase 3 sync service: fetch → extract → transform → diff → track changes.
 */
router.post('/:id/sync', requireRole('admin', 'editor'), verifyDatasetOwner, async (req, res, next) => {
  try {
    const result = await syncService.runSync(req.params.id as string);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

/**
 * GET /api/datasets/:id/data
 * Get paginated row data for a dataset (owner or admin only).
 */
router.get('/:id/data', verifyDatasetOwner, async (req, res, next) => {
  try {
    const { page, pageSize } = parsePagination(req);
    const result = await datasetService.getDatasetData(req.params.id as string, { page, pageSize });
    sendPaginated(res, result.data, result.pagination);
  } catch (err) { next(err); }
});

/**
 * GET /api/datasets/:id/columns
 * Get column definitions for a dataset (owner or admin only).
 */
router.get('/:id/columns', verifyDatasetOwner, async (req, res, next) => {
  try {
    const dataset = await datasetService.getDataset(req.params.id as string);
    sendSuccess(res, dataset.columns);
  } catch (err) { next(err); }
});

/**
 * POST /api/datasets/:id/re-extract
 * Update extraction config and re-apply to latest snapshot.
 * Replaces existing rows with newly extracted data.
 */
router.post('/:id/re-extract', requireRole('admin', 'editor'), verifyDatasetOwner, validate(reExtractSchema), async (req, res, next) => {
  try {
    const result = await datasetService.reExtractDataset(req.params.id as string, req.body.extractionConfig);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

/**
 * GET /api/datasets/:id/raw
 * Get the latest raw snapshot for a dataset (owner or admin only).
 */
router.get('/:id/raw', verifyDatasetOwner, async (req, res, next) => {
  try {
    const snapshot = await snapshotRepository.findLatestByDataset(req.params.id as string);
    sendSuccess(res, snapshot);
  } catch (err) { next(err); }
});

/**
 * POST /api/data/query
 * Flexible data query for dashboard widgets (owner or admin only).
 * Supports filtering, sorting, aggregation, column selection.
 */
router.post('/query', validate(querySchema), async (req, res, next) => {
  try {
    // Ownership check — user must own the queried dataset or be admin
    const { datasetId } = req.body as { datasetId: string };
    const targetDataset = await datasetRepository.findById(datasetId);
    if (!targetDataset) throw new AppError(404, 'Dataset not found');
    if (req.user?.role !== 'admin' && targetDataset.createdBy !== req.user?.userId) {
      throw new AppError(404, 'Dataset not found');
    }
    const result = await dataService.queryData(req.body);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

export default router;
