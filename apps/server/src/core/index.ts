/**
 * Core module — framework-level utilities used across all modules.
 * Import from 'core' instead of individual files.
 */

export { AppError, assertFound } from './errors.js';
export { BaseRepository, type PaginatedResult, type PaginateOptions } from './base.repository.js';
export { sendSuccess, sendPaginated, type PaginationMeta } from './response.js';
export { parsePagination, buildPaginationMeta, type PaginationParams } from './pagination.js';
export { logger } from './logger.js';
