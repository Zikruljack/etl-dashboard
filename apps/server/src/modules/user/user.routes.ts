import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, validate } from '../../core/middleware/index.js';
import { sendSuccess } from '../../core/response.js';
import * as userService from './user.service.js';

const router: ReturnType<typeof Router> = Router();

// All user management routes require admin
router.use(authenticate, requireRole('admin'));

/** Validation schema for role update */
const updateRoleSchema = z.object({
  role: z.enum(['admin', 'editor', 'viewer']),
});

/**
 * GET /api/users
 * List all users (admin only).
 */
router.get('/', async (_req, res, next) => {
  try {
    const users = await userService.listUsers();
    sendSuccess(res, users);
  } catch (err) { next(err); }
});

/**
 * PATCH /api/users/:id/role
 * Update a user's role (admin only).
 */
router.patch('/:id/role', validate(updateRoleSchema), async (req, res, next) => {
  try {
    const user = await userService.updateUserRole(req.params.id as string, req.body.role);
    sendSuccess(res, user);
  } catch (err) { next(err); }
});

/**
 * DELETE /api/users/:id
 * Delete a user (admin only, cannot delete self).
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await userService.deleteUser(req.params.id as string, req.user!.userId);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

export default router;
