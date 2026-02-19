/**
 * Source module routes.
 * Handles connecting to data sources, fetching raw snapshots,
 * extraction preview, and creating datasets from extraction.
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, validate, uploadFile } from '../../core/middleware/index.js';
import { sendSuccess } from '../../core/response.js';
import * as sourceService from './source.service.js';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);

/** Validation: test connection to source */
const connectSchema = z.object({
  sourceType: z.enum(['google_sheets', 'csv', 'excel', 'rest_api']),
  sourceConfig: z.record(z.string(), z.unknown()),
});

/** Validation: fetch raw data from source */
const fetchRawSchema = z.object({
  sourceType: z.enum(['google_sheets', 'csv', 'excel', 'rest_api']),
  sourceConfig: z.record(z.string(), z.unknown()),
  datasetId: z.string().uuid().optional(),
});

/** Validation: extraction config for preview */
const extractionConfigSchema = z.object({
  headerRowIndices: z.array(z.number().int().min(0)),
  headerFlattenSeparator: z.string().default('_'),
  dataStartRow: z.number().int().min(0),
  dataEndRow: z.number().int().min(0).nullable(),
  columnStart: z.number().int().min(0).default(0),
  columnEnd: z.number().int().min(0).nullable().default(null),
  skipRows: z.array(z.number().int().min(0)).default([]),
  excludeColumns: z.array(z.number().int().min(0)).nullable().default(null),
  keyColumns: z.array(z.string()).default([]),
  columnLabels: z.record(z.string(), z.string()).default({}),
});

/** Validation: extract preview request */
const extractPreviewSchema = z.object({
  snapshotId: z.string().uuid(),
  config: extractionConfigSchema,
});

/** Validation: create dataset from extraction */
const createFromExtractionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  sourceType: z.enum(['google_sheets', 'csv', 'excel', 'rest_api']),
  sourceConfig: z.record(z.string(), z.unknown()),
  snapshotId: z.string().uuid(),
  extractionConfig: extractionConfigSchema,
});

/** Validation: merge sheets preview */
const mergeSheetsPreviewSchema = z.object({
  snapshotIds: z.array(z.string().uuid()).min(1),
  config: extractionConfigSchema,
});

/**
 * POST /api/sources/connect
 * Test connection to a data source.
 * Returns source metadata (title, sheet names, etc.)
 */
router.post('/connect', requireRole('admin', 'editor'), validate(connectSchema), async (req, res, next) => {
  try {
    const result = await sourceService.connectSource(req.body.sourceType, req.body.sourceConfig);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

/**
 * POST /api/sources/fetch-raw
 * Fetch ALL cells from source, save as raw snapshot.
 * Returns snapshot ID and the raw cell grid.
 */
router.post('/fetch-raw', requireRole('admin', 'editor'), validate(fetchRawSchema), async (req, res, next) => {
  try {
    const result = await sourceService.fetchRaw(
      req.body.sourceType,
      req.body.sourceConfig,
      req.body.datasetId,
    );
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

/**
 * POST /api/sources/extract-preview
 * Apply extraction config to a snapshot, return preview (no save).
 */
router.post('/extract-preview', requireRole('admin', 'editor'), validate(extractPreviewSchema), async (req, res, next) => {
  try {
    const result = await sourceService.extractPreview(
      req.body.snapshotId,
      req.body.config,
    );
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

/**
 * POST /api/sources/create-dataset
 * Create dataset from extraction: apply config to snapshot, save clean rows.
 */
router.post('/create-dataset', requireRole('admin', 'editor'), validate(createFromExtractionSchema), async (req, res, next) => {
  try {
    const result = await sourceService.createDatasetFromExtraction({
      ...req.body,
      createdBy: req.user!.userId,
    });
    sendSuccess(res, result, 201);
  } catch (err) { next(err); }
});

/**
 * POST /api/sources/upload
 * Upload a CSV or Excel file, parse into CellGrid, save as raw snapshot.
 * Accepts multipart/form-data with field 'file'.
 * Optional query param 'sheetName' for Excel files.
 * Returns same shape as fetch-raw: { snapshotId, data, totalRows, totalCols }.
 */
router.post('/upload', requireRole('admin', 'editor'), ...uploadFile('file'), async (req, res, next) => {
  try {
    const result = await sourceService.uploadFileSource(
      req.file!.buffer,
      req.file!.originalname,
      {
        sheetName: req.body.sheetName as string | undefined,
        datasetId: req.body.datasetId as string | undefined,
      },
    );
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

/**
 * GET /api/sources/snapshot/:id
 * Get a specific raw snapshot by ID.
 */
router.get('/snapshot/:id', async (req, res, next) => {
  try {
    const snapshot = await sourceService.getSnapshot(req.params.id as string);
    sendSuccess(res, snapshot);
  } catch (err) { next(err); }
});

/**
 * POST /api/sources/upload-multi-sheet
 * Upload an Excel file and parse multiple sheets as separate snapshots.
 * Accepts multipart/form-data with field 'file' and optional 'sheetNames' (JSON array string).
 * Returns all sheet names + snapshot per requested sheet.
 */
router.post('/upload-multi-sheet', requireRole('admin', 'editor'), ...uploadFile('file'), async (req, res, next) => {
  try {
    let sheetNames: string[] = [];
    if (req.body.sheetNames) {
      try {
        sheetNames = JSON.parse(req.body.sheetNames as string) as string[];
      } catch {
        sheetNames = [];
      }
    }
    const result = await sourceService.uploadMultipleSheets(
      req.file!.buffer,
      req.file!.originalname,
      sheetNames,
    );
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

/**
 * POST /api/sources/merge-preview
 * Merge multiple snapshots into one and return extraction preview.
 */
router.post('/merge-preview', requireRole('admin', 'editor'), validate(mergeSheetsPreviewSchema), async (req, res, next) => {
  try {
    const result = await sourceService.mergeSheetsPreview(
      req.body.snapshotIds as string[],
      req.body.config,
    );
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

/** Validation: merge snapshot request */
const mergeSnapshotSchema = z.object({
  snapshotIds: z.array(z.string().uuid()).min(1),
});

/**
 * POST /api/sources/merge-snapshot
 * Merge multiple sheet snapshots row-wise, save as a new raw snapshot.
 * Returns same shape as fetch-raw: { snapshotId, data, totalRows, totalCols }.
 * Used by the wizard merge-mode flow to create a single merged snapshot for extraction.
 */
router.post('/merge-snapshot', requireRole('admin', 'editor'), validate(mergeSnapshotSchema), async (req, res, next) => {
  try {
    const result = await sourceService.mergeAndSaveSnapshot(req.body.snapshotIds as string[]);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

export default router;
