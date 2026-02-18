import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors.js';

/** Supported user roles */
type UserRole = 'admin' | 'editor' | 'viewer';

/**
 * Role-based access control middleware factory.
 * Checks if authenticated user has one of the required roles.
 *
 * Must be used AFTER `authenticate` middleware.
 *
 * @param roles - One or more roles allowed to access the route
 * @returns Express middleware that checks user role
 * @throws AppError(401) if user is not authenticated
 * @throws AppError(403) if user role is not in allowed list
 *
 * @example
 * // Only admin and editor can create datasets
 * router.post('/', authenticate, requireRole('admin', 'editor'), handler);
 *
 * // Only admin can manage users
 * router.use(authenticate, requireRole('admin'));
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError(401, 'Authentication required');
    }
    if (!roles.includes(req.user.role as UserRole)) {
      throw new AppError(403, 'Insufficient permissions');
    }
    next();
  };
}
