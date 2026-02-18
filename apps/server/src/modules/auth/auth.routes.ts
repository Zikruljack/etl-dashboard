import { Router } from 'express';
import { z } from 'zod';
import { authenticate, validate } from '../../core/middleware/index.js';
import { sendSuccess } from '../../core/response.js';
import * as authService from './auth.service.js';

const router: ReturnType<typeof Router> = Router();

/** Validation schema for user registration */
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(255),
});

/** Validation schema for user login */
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /api/auth/register
 * Register a new user account.
 */
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const result = await authService.register(req.body.email, req.body.password, req.body.name);
    sendSuccess(res, result, 201);
  } catch (err) { next(err); }
});

/**
 * POST /api/auth/login
 * Authenticate with email and password.
 */
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.login(req.body.email, req.body.password);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

/**
 * GET /api/auth/me
 * Get current authenticated user profile.
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user!.userId);
    sendSuccess(res, user);
  } catch (err) { next(err); }
});

export default router;
