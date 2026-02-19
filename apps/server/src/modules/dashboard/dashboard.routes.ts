import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, validate } from '../../core/middleware/index.js';
import { sendSuccess } from '../../core/response.js';
import { AppError } from '../../core/errors.js';
import { checkOwnership } from '../../core/security/idor-guard.js';
import { dashboardRepository } from './dashboard.repository.js';
import * as dashboardervice from './dashboard.service.js';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);

/** Validation schema for creating a dashboard */
const createdashboardchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

/** Validation schema for creating a page */
const createPageSchema = z.object({
  title: z.string().min(1).max(255),
});

/** Validation schema for updating a dashboard — whitelist allowed fields */
const updateDashboardSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  isPublished: z.boolean().optional(),
});

/** Validation schema for updating a page — whitelist allowed fields */
const updatePageSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/** Validation schema for bulk saving components */
const saveComponentsSchema = z.object({
  components: z.array(z.object({
    id: z.string().optional(),
    type: z.enum(['table', 'chart', 'map', 'timeline', 'kpi']),
    title: z.string().max(255).optional(),
    layout: z.object({
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    }),
    config: z.record(z.string(), z.unknown()),
    datasetId: z.string().uuid().optional(),
  })),
});

/** IDOR middleware: verify user owns the dashboard (or is admin) */
const verifyDashboardOwner = checkOwnership({
  resourceFn: (id) => dashboardRepository.findById(id),
  ownerField: 'createdBy',
});

/**
 * GET /api/dashboard
 * List dashboards. Admin sees all; others see only their own.
 */
router.get('/', async (req, res, next) => {
  try {
    const list = await dashboardervice.listdashboard(req.user!.userId, req.user!.role);
    sendSuccess(res, list);
  } catch (err) { next(err); }
});

/**
 * POST /api/dashboard
 * Create a new dashboard (editor/admin only).
 */
router.post('/', requireRole('admin', 'editor'), validate(createdashboardchema), async (req, res, next) => {
  try {
    const dashboard = await dashboardervice.createDashboard(
      req.body.title,
      req.user!.userId,
      req.body.description,
    );
    sendSuccess(res, dashboard, 201);
  } catch (err) { next(err); }
});

/**
 * GET /api/dashboard/:id
 * Get a dashboard with all pages and components.
 * Non-owners can only view published dashboards.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const dash = await dashboardervice.getDashboard(req.params.id as string);
    // Non-admin users who don't own this dashboard may only see published ones
    if (req.user?.role !== 'admin' && dash.createdBy !== req.user?.userId) {
      if (!dash.isPublished) {
        throw new AppError(404, 'Dashboard not found');
      }
    }
    sendSuccess(res, dash);
  } catch (err) { next(err); }
});

/**
 * PATCH /api/dashboard/:id
 * Update dashboard metadata (owner or admin only).
 * Validates only whitelisted fields to prevent mass assignment.
 */
router.patch('/:id', requireRole('admin', 'editor'), verifyDashboardOwner, validate(updateDashboardSchema), async (req, res, next) => {
  try {
    const dashboard = await dashboardervice.updateDashboard(req.params.id as string, req.body);
    sendSuccess(res, dashboard);
  } catch (err) { next(err); }
});

/**
 * DELETE /api/dashboard/:id
 * Delete a dashboard (owner or admin only).
 */
router.delete('/:id', requireRole('admin', 'editor'), verifyDashboardOwner, async (req, res, next) => {
  try {
    await dashboardervice.deleteDashboard(req.params.id as string);
    sendSuccess(res, { id: req.params.id as string });
  } catch (err) { next(err); }
});

// --- Pages ---

/**
 * POST /api/dashboard/:id/pages
 * Add a new page to a dashboard.
 */
router.post('/:id/pages', requireRole('admin', 'editor'), verifyDashboardOwner, validate(createPageSchema), async (req, res, next) => {
  try {
    const page = await dashboardervice.addPage(req.params.id as string, req.body.title);
    sendSuccess(res, page, 201);
  } catch (err) { next(err); }
});

/**
 * PATCH /api/dashboard/:id/pages/:pid
 * Update a page's title or sort order.
 * Validates only whitelisted fields to prevent mass assignment.
 */
router.patch('/:id/pages/:pid', requireRole('admin', 'editor'), verifyDashboardOwner, validate(updatePageSchema), async (req, res, next) => {
  try {
    const page = await dashboardervice.updatePage(req.params.pid as string, req.body);
    sendSuccess(res, page);
  } catch (err) { next(err); }
});

/**
 * DELETE /api/dashboard/:id/pages/:pid
 * Delete a page from a dashboard.
 */
router.delete('/:id/pages/:pid', requireRole('admin', 'editor'), verifyDashboardOwner, async (req, res, next) => {
  try {
    await dashboardervice.deletePage(req.params.pid as string);
    sendSuccess(res, { id: req.params.pid as string });
  } catch (err) { next(err); }
});

// --- Components ---

/**
 * PUT /api/dashboard/:id/pages/:pid/components
 * Bulk save all components for a page (replaces existing).
 */
router.put('/:id/pages/:pid/components', requireRole('admin', 'editor'), verifyDashboardOwner, validate(saveComponentsSchema), async (req, res, next) => {
  try {
    const components = await dashboardervice.saveComponents(req.params.pid as string, req.body.components);
    sendSuccess(res, components);
  } catch (err) { next(err); }
});

export default router;
