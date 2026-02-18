import type { Response } from 'express';

/**
 * Send a successful JSON response with standard wrapper.
 *
 * @param res - Express response object
 * @param data - Response payload
 * @param statusCode - HTTP status code (default: 200)
 *
 * @example
 * sendSuccess(res, { id: '123', name: 'Test' });
 * sendSuccess(res, dataset, 201);
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({ success: true, data });
}

/** Pagination metadata included in paginated responses */
export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Send a paginated JSON response with standard wrapper.
 *
 * @param res - Express response object
 * @param data - Array of items for current page
 * @param pagination - Pagination metadata
 *
 * @example
 * sendPaginated(res, rows, { total: 100, page: 1, pageSize: 50, totalPages: 2 });
 */
export function sendPaginated<T>(res: Response, data: T[], pagination: PaginationMeta): void {
  res.json({ success: true, data, pagination });
}
