import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from '../errors.js';

/**
 * Request body validation middleware factory.
 * Uses Zod schema to validate `req.body` and replaces it with parsed data.
 *
 * On failure, throws AppError(400) with field-level error messages.
 *
 * @param schema - Zod schema to validate request body against
 * @returns Express middleware that validates and parses req.body
 * @throws AppError(400) with validation errors if body doesn't match schema
 *
 * @example
 * const createSchema = z.object({ name: z.string().min(1), email: z.string().email() });
 * router.post('/', validate(createSchema), handler);
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join('.');
        if (!errors[path]) errors[path] = [];
        errors[path].push(issue.message);
      }
      throw new AppError(400, 'Validation failed', errors);
    }
    req.body = result.data;
    next();
  };
}
