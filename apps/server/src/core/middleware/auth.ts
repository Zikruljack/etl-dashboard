import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '../../utils/jwt.js';
import { AppError } from '../errors.js';

// Extend Express Request to carry authenticated user data
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Authentication middleware.
 * Verifies JWT Bearer token from Authorization header and attaches
 * decoded user payload to `req.user`.
 *
 * @throws AppError(401) if token is missing, malformed, or expired
 *
 * @example
 * router.get('/profile', authenticate, (req, res) => {
 *   // req.user.userId and req.user.role are available
 * });
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError(401, 'Authentication required');
  }

  try {
    const token = header.slice(7);
    req.user = verifyToken(token);
    next();
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }
}
