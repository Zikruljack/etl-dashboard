import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors.js';
import { logger } from '../logger.js';

/** Configuration for IDOR ownership check */
interface OwnershipConfig<T> {
  /**
   * Function to fetch the resource by ID.
   * Should return null if not found.
   */
  resourceFn: (id: string) => Promise<T | null>;

  /**
   * Field name on the resource that contains the owner's user ID.
   * @example 'createdBy'
   */
  ownerField: keyof T & string;

  /**
   * Request param name containing the resource ID.
   * @default 'id'
   */
  paramName?: string;

  /**
   * If true, allow admin to bypass ownership check.
   * @default true
   */
  allowAdmin?: boolean;
}

/**
 * Middleware factory: verify the requesting user owns the resource.
 * Prevents Insecure Direct Object Reference (IDOR) attacks.
 *
 * Fetches the resource by ID from req.params, compares the owner field
 * against req.user.userId. Admins bypass by default.
 *
 * The fetched resource is attached to `req.resource` for downstream use,
 * avoiding a duplicate DB query in the service layer.
 *
 * @param config - Ownership verification configuration
 * @returns Express middleware
 *
 * @example
 * router.patch('/:id',
 *   authenticate,
 *   checkOwnership({
 *     resourceFn: (id) => datasetRepo.findById(id),
 *     ownerField: 'createdBy',
 *   }),
 *   async (req, res) => {
 *     // req.resource is the verified dataset
 *   }
 * );
 */
export function checkOwnership<T>(config: OwnershipConfig<T>) {
  const { resourceFn, ownerField, paramName = 'id', allowAdmin = true } = config;

  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const resourceId = req.params[paramName] as string | undefined;
      if (!resourceId) {
        throw new AppError(400, `Missing parameter: ${paramName}`);
      }

      // Admin bypass
      if (allowAdmin && req.user?.role === 'admin') {
        const resource = await resourceFn(resourceId);
        if (!resource) {
          throw new AppError(404, 'Resource not found');
        }
        (req as any).resource = resource;
        return next();
      }

      const resource = await resourceFn(resourceId);
      if (!resource) {
        // Return 404 instead of 403 to avoid resource enumeration
        throw new AppError(404, 'Resource not found');
      }

      const ownerId = (resource as any)[ownerField];
      if (ownerId !== req.user?.userId) {
        logger.warn('IDOR attempt blocked', {
          userId: req.user?.userId,
          resourceId,
          ownerField,
          actualOwner: ownerId,
        });
        // Return 404 to avoid leaking existence of resource
        throw new AppError(404, 'Resource not found');
      }

      // Attach resource to request for downstream use
      (req as any).resource = resource;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Extend Express Request type to include attached resource
declare global {
  namespace Express {
    interface Request {
      resource?: any;
    }
  }
}
