/**
 * API Key authentication middleware.
 * Used for /api/v1 routes — external app access via generated API keys.
 * Supports Authorization: Bearer <key> or X-API-Key: <key> header.
 *
 * Rate limiting is enforced per-key using in-memory counters.
 * Resets on server restart (acceptable for internal team tool).
 */

import { createHash } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'api-key-auth' });

/** Attached to req after successful API key auth */
interface ApiUser {
  userId: string;
  keyId: string;
}

// Extend Express Request globally
declare global {
  namespace Express {
    interface Request {
      apiUser?: ApiUser;
    }
  }
}

/** In-memory rate limit tracker per key ID */
interface RateLimitWindow {
  hourCount: number;
  hourReset: number; // timestamp ms
  dayCount: number;
  dayReset: number; // timestamp ms
}

const rateLimitStore = new Map<string, RateLimitWindow>();

/**
 * Get or initialize rate limit window for a key.
 *
 * @param keyId - API key UUID
 * @returns Current window state
 */
function getWindow(keyId: string): RateLimitWindow {
  const now = Date.now();
  let win = rateLimitStore.get(keyId);

  if (!win) {
    win = {
      hourCount: 0,
      hourReset: now + 3_600_000,
      dayCount: 0,
      dayReset: now + 86_400_000,
    };
    rateLimitStore.set(keyId, win);
  }

  // Reset hour window if expired
  if (now >= win.hourReset) {
    win.hourCount = 0;
    win.hourReset = now + 3_600_000;
  }

  // Reset day window if expired
  if (now >= win.dayReset) {
    win.dayCount = 0;
    win.dayReset = now + 86_400_000;
  }

  return win;
}

/**
 * Extract the raw API key from request headers.
 * Checks Authorization: Bearer <key> first, then X-API-Key: <key>.
 *
 * @param req - Express request
 * @returns Plain API key string or null
 */
function extractKey(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // Only treat as API key if it starts with 'etld_'
    if (token.startsWith('etld_')) return token;
  }

  const xApiKey = req.headers['x-api-key'];
  if (typeof xApiKey === 'string' && xApiKey) return xApiKey;

  return null;
}

/**
 * API key authentication middleware factory.
 * Lazily imports repository to avoid circular dependency.
 *
 * @returns Express middleware function
 */
export function apiKeyAuth() {
  return async function apiKeyAuthMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    const plainKey = extractKey(req);
    if (!plainKey) {
      return next(new AppError(401, 'API key required. Use Authorization: Bearer <key> or X-API-Key header'));
    }

    // Hash and lookup
    const keyHash = createHash('sha256').update(plainKey).digest('hex');

    // Dynamic import to avoid circular dependency
    const { apiKeyRepository } = await import('../../modules/api-keys/api-keys.repository.js');
    const record = await apiKeyRepository.findByHash(keyHash);

    if (!record) {
      return next(new AppError(401, 'Invalid API key'));
    }

    if (!record.isActive) {
      return next(new AppError(401, 'API key has been revoked'));
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      return next(new AppError(401, 'API key has expired'));
    }

    // Rate limit check
    if (record.rateLimitPerHour !== null || record.rateLimitPerDay !== null) {
      const win = getWindow(record.id);

      if (record.rateLimitPerHour !== null && win.hourCount >= record.rateLimitPerHour) {
        const retryAfterSec = Math.ceil((win.hourReset - Date.now()) / 1000);
        return next(new AppError(429, `Hourly rate limit exceeded (${record.rateLimitPerHour}/hr). Retry after ${retryAfterSec}s`));
      }

      if (record.rateLimitPerDay !== null && win.dayCount >= record.rateLimitPerDay) {
        const retryAfterSec = Math.ceil((win.dayReset - Date.now()) / 1000);
        return next(new AppError(429, `Daily rate limit exceeded (${record.rateLimitPerDay}/day). Retry after ${retryAfterSec}s`));
      }

      win.hourCount++;
      win.dayCount++;
    }

    // Fire-and-forget: update last used timestamp
    apiKeyRepository.updateLastUsed(record.id).catch((err) => {
      log.warn('Failed to update lastUsedAt', { keyId: record.id, err });
    });

    req.apiUser = { userId: record.userId, keyId: record.id };
    next();
  };
}
