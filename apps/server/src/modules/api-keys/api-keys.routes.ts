/**
 * API Keys routes.
 * User endpoints: list own keys, generate, revoke.
 * Admin endpoints: list all, update limits, delete.
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, validate } from '../../core/middleware/index.js';
import { sendSuccess } from '../../core/response.js';
import * as apiKeyService from './api-keys.service.js';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);

/** Validation: generate key */
const generateKeySchema = z.object({
  name: z.string().min(1).max(255),
  rateLimitPerHour: z.number().int().positive().nullable().optional(),
  rateLimitPerDay: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

/** Validation: update limits */
const updateLimitsSchema = z.object({
  rateLimitPerHour: z.number().int().positive().nullable().optional(),
  rateLimitPerDay: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/api-keys
 * List all API keys for the authenticated user.
 */
router.get('/', async (req, res, next) => {
  try {
    const keys = await apiKeyService.listKeysForUser(req.user!.userId);
    sendSuccess(res, keys);
  } catch (err) { next(err); }
});

/**
 * POST /api/api-keys
 * Generate a new API key for the authenticated user.
 * Returns the full key ONCE — it cannot be retrieved again.
 */
router.post('/', validate(generateKeySchema), async (req, res, next) => {
  try {
    const result = await apiKeyService.generateKey(
      req.user!.userId,
      req.body.name as string,
      {
        rateLimitPerHour: req.body.rateLimitPerHour ?? null,
        rateLimitPerDay: req.body.rateLimitPerDay ?? null,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt as string) : null,
      },
    );
    sendSuccess(res, result, 201);
  } catch (err) { next(err); }
});

/**
 * DELETE /api/api-keys/:id
 * Revoke (deactivate) one of the authenticated user's own keys.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await apiKeyService.revokeKey(req.params['id'] as string, req.user!.userId);
    sendSuccess(res, { revoked: true });
  } catch (err) { next(err); }
});

/**
 * GET /api/api-keys/admin
 * Admin: list all API keys across all users.
 */
router.get('/admin', requireRole('admin'), async (req, res, next) => {
  try {
    const keys = await apiKeyService.adminListAllKeys();
    sendSuccess(res, keys);
  } catch (err) { next(err); }
});

/**
 * PATCH /api/api-keys/admin/:id
 * Admin: update rate limits and active status for any key.
 */
router.patch('/admin/:id', requireRole('admin'), validate(updateLimitsSchema), async (req, res, next) => {
  try {
    const key = await apiKeyService.updateKeyLimits(req.params['id'] as string, req.body);
    sendSuccess(res, key);
  } catch (err) { next(err); }
});

/**
 * DELETE /api/api-keys/admin/:id
 * Admin: hard-delete any API key.
 */
router.delete('/admin/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await apiKeyService.adminDeleteKey(req.params['id'] as string);
    sendSuccess(res, { deleted: true });
  } catch (err) { next(err); }
});

export default router;
