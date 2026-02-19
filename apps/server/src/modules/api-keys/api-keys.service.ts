/**
 * API Keys service.
 * Business logic for generating, listing, and revoking API keys.
 * Plain keys are generated here and returned ONCE — never persisted.
 */

import { createHash, randomBytes } from 'crypto';
import { AppError, assertFound } from '../../core/errors.js';
import { logger } from '../../core/logger.js';
import { apiKeyRepository, type ApiKeyRecord } from './api-keys.repository.js';

const log = logger.child({ module: 'api-keys' });

/** Key prefix for easy identification */
const KEY_PREFIX = 'etld_';

/** Public-safe view of an API key (no hash) */
export interface SafeApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  rateLimitPerHour: number | null;
  rateLimitPerDay: number | null;
  isActive: boolean;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

/** Result of key generation — includes plain key shown ONCE */
export interface GeneratedKeyResult extends SafeApiKey {
  /** Full plain key — show to user immediately, never store */
  fullKey: string;
}

/**
 * Strip sensitive fields from a DB record for safe display.
 *
 * @param record - Raw DB record
 * @returns Public-safe key object (no keyHash)
 */
function toSafeKey(record: ApiKeyRecord): SafeApiKey {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    keyPrefix: record.keyPrefix,
    rateLimitPerHour: record.rateLimitPerHour,
    rateLimitPerDay: record.rateLimitPerDay,
    isActive: record.isActive,
    lastUsedAt: record.lastUsedAt,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
  };
}

/**
 * Generate a new API key for a user.
 * Returns the full key ONCE — caller must show it to user immediately.
 *
 * @param userId - Owner user UUID
 * @param name - User-given label for the key
 * @param options - Optional rate limits and expiry
 * @returns Generated key (with fullKey field) + saved record
 */
export async function generateKey(
  userId: string,
  name: string,
  options?: {
    rateLimitPerHour?: number | null;
    rateLimitPerDay?: number | null;
    expiresAt?: Date | null;
  },
): Promise<GeneratedKeyResult> {
  // Generate 32 random bytes → 64 hex chars → full key
  const randomPart = randomBytes(32).toString('hex');
  const fullKey = `${KEY_PREFIX}${randomPart}`;

  // SHA-256 hash for storage
  const keyHash = createHash('sha256').update(fullKey).digest('hex');

  // Prefix for display (first 12 chars: "etld_" + 7 chars)
  const keyPrefix = fullKey.slice(0, 12);

  const record = await apiKeyRepository.create({
    userId,
    name,
    keyHash,
    keyPrefix,
    rateLimitPerHour: options?.rateLimitPerHour ?? null,
    rateLimitPerDay: options?.rateLimitPerDay ?? null,
    isActive: true,
    expiresAt: options?.expiresAt ?? null,
  });

  log.info('API key generated', { userId, keyId: record.id, name });

  return {
    ...toSafeKey(record),
    fullKey,
  };
}

/**
 * List all API keys for a user (safe view, no hashes).
 *
 * @param userId - Owner user UUID
 * @returns Array of safe key objects
 */
export async function listKeysForUser(userId: string): Promise<SafeApiKey[]> {
  const records = await apiKeyRepository.findByUser(userId);
  return records.map(toSafeKey);
}

/**
 * Revoke (deactivate) an API key.
 * User can only revoke their own keys.
 *
 * @param id - Key UUID
 * @param userId - Must match key owner
 * @throws AppError(404) if key not found
 * @throws AppError(403) if key belongs to another user
 */
export async function revokeKey(id: string, userId: string): Promise<void> {
  const key = await apiKeyRepository.findById(id);
  assertFound(key, 'API key not found');

  if (key.userId !== userId) {
    throw new AppError(403, 'You do not own this API key');
  }

  await apiKeyRepository.update(id, { isActive: false });
  log.info('API key revoked', { keyId: id, userId });
}

/**
 * Update rate limits for a key (admin-only operation).
 *
 * @param id - Key UUID
 * @param updates - Fields to update
 * @throws AppError(404) if key not found
 */
export async function updateKeyLimits(
  id: string,
  updates: { rateLimitPerHour?: number | null; rateLimitPerDay?: number | null; isActive?: boolean },
): Promise<SafeApiKey> {
  const updated = await apiKeyRepository.updateLimits(id, updates);
  assertFound(updated, 'API key not found');
  return toSafeKey(updated);
}

/**
 * List all API keys across all users (admin view).
 *
 * @returns Keys with user name and email
 */
export async function adminListAllKeys() {
  const records = await apiKeyRepository.findAllWithUsers();
  return records.map((r) => ({
    ...toSafeKey(r),
    userName: r.userName,
    userEmail: r.userEmail,
  }));
}

/**
 * Admin hard-delete a key.
 *
 * @param id - Key UUID
 * @throws AppError(404) if key not found
 */
export async function adminDeleteKey(id: string): Promise<void> {
  const key = await apiKeyRepository.findById(id);
  assertFound(key, 'API key not found');
  await apiKeyRepository.delete(id);
  log.info('API key deleted by admin', { keyId: id });
}
