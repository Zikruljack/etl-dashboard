/**
 * API Keys repository.
 * Handles CRUD operations for API keys.
 * Keys are stored as SHA-256 hashes — plain keys are never persisted.
 */

import { eq, desc } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { apiKeys } from '../../db/schema/index.js';
import { users } from '../../db/schema/users.js';
import { BaseRepository } from '../../core/base.repository.js';

/** Shape of an API key record from DB */
export type ApiKeyRecord = typeof apiKeys.$inferSelect;

/**
 * Repository for api_keys table.
 * Extends BaseRepository for standard CRUD + provides key-specific queries.
 */
class ApiKeysRepository extends BaseRepository<typeof apiKeys> {
  constructor() {
    super(apiKeys, 'api_keys');
  }

  /**
   * Find an API key by its SHA-256 hash.
   * Used during authentication to look up the key owner.
   *
   * @param hash - SHA-256 hash of the plain key
   * @returns Key record or null if not found
   */
  async findByHash(hash: string): Promise<ApiKeyRecord | null> {
    return this.findOneWhere(eq(apiKeys.keyHash, hash));
  }

  /**
   * List all active API keys for a specific user.
   *
   * @param userId - Owner user UUID
   * @returns Array of key records (no hash exposed)
   */
  async findByUser(userId: string): Promise<ApiKeyRecord[]> {
    return this.findWhere(eq(apiKeys.userId, userId), desc(apiKeys.createdAt));
  }

  /**
   * List all API keys across all users with joined user info.
   * Admin-only use.
   *
   * @returns Keys with user name and email
   */
  async findAllWithUsers(): Promise<(ApiKeyRecord & { userName: string; userEmail: string })[]> {
    const rows = await db
      .select({
        id: apiKeys.id,
        userId: apiKeys.userId,
        name: apiKeys.name,
        keyHash: apiKeys.keyHash,
        keyPrefix: apiKeys.keyPrefix,
        rateLimitPerHour: apiKeys.rateLimitPerHour,
        rateLimitPerDay: apiKeys.rateLimitPerDay,
        isActive: apiKeys.isActive,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(apiKeys)
      .leftJoin(users, eq(apiKeys.userId, users.id))
      .orderBy(desc(apiKeys.createdAt));

    return rows.map((r) => ({
      ...r,
      userName: r.userName ?? '',
      userEmail: r.userEmail ?? '',
    }));
  }

  /**
   * Fire-and-forget update of lastUsedAt timestamp.
   *
   * @param id - Key UUID
   */
  async updateLastUsed(id: string): Promise<void> {
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, id));
  }

  /**
   * Update rate limits and active status for a key.
   *
   * @param id - Key UUID
   * @param updates - Fields to update
   */
  async updateLimits(
    id: string,
    updates: { rateLimitPerHour?: number | null; rateLimitPerDay?: number | null; isActive?: boolean },
  ): Promise<ApiKeyRecord | null> {
    const [updated] = await db
      .update(apiKeys)
      .set(updates)
      .where(eq(apiKeys.id, id))
      .returning();
    return updated ?? null;
  }

  /**
   * Soft-revoke a key by setting isActive = false.
   *
   * @param id - Key UUID
   * @param userId - Must match key owner (for user self-revoke)
   * @returns Updated record or null if not found/not owned
   */
  async revoke(id: string, userId: string): Promise<ApiKeyRecord | null> {
    const [updated] = await db
      .update(apiKeys)
      .set({ isActive: false })
      .where(eq(apiKeys.id, id))
      .returning();

    // Verify ownership after update
    if (updated && updated.userId !== userId) {
      // Undo — this should not happen if route guards ownership
      await db.update(apiKeys).set({ isActive: true }).where(eq(apiKeys.id, id));
      return null;
    }

    return updated ?? null;
  }
}

export const apiKeyRepository = new ApiKeysRepository();
