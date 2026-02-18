import type { Request } from 'express';
import type { PaginationMeta } from './response.js';

/** Parsed pagination parameters from query string */
export interface PaginationParams {
  page: number;
  pageSize: number;
  offset: number;
}

/** Default values for pagination */
const DEFAULTS = {
  page: 1,
  pageSize: 50,
  maxPageSize: 200,
} as const;

/**
 * Parse pagination parameters from Express request query string.
 * Clamps values to safe ranges (page >= 1, pageSize 1-200).
 *
 * @param req - Express request object
 * @returns Parsed page, pageSize, and calculated offset
 *
 * @example
 * // GET /api/datasets?page=2&pageSize=25
 * const { page, pageSize, offset } = parsePagination(req);
 * // → { page: 2, pageSize: 25, offset: 25 }
 */
export function parsePagination(req: Request): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string) || DEFAULTS.page);
  const pageSize = Math.min(
    DEFAULTS.maxPageSize,
    Math.max(1, parseInt(req.query.pageSize as string) || DEFAULTS.pageSize),
  );
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
}

/**
 * Build pagination metadata from total count and current params.
 *
 * @param total - Total number of records
 * @param params - Current pagination parameters
 * @returns PaginationMeta object for API response
 */
export function buildPaginationMeta(total: number, params: PaginationParams): PaginationMeta {
  return {
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.ceil(total / params.pageSize),
  };
}
