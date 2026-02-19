/**
 * API Keys table schema.
 * Stores API keys for external application access to dataset data.
 * Plain keys are NEVER stored — only SHA-256 hashes.
 */

import { pgTable, uuid, varchar, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const apiKeys = pgTable('api_keys', {
  /** UUID primary key */
  id: uuid('id').defaultRandom().primaryKey(),

  /** Owner user */
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  /** User-given label for this key */
  name: varchar('name', { length: 255 }).notNull(),

  /** SHA-256 hash of the plain key (never store plain text) */
  keyHash: varchar('key_hash', { length: 64 }).notNull().unique(),

  /** First 12 chars of the plain key for display (e.g. "etld_a1b2c3d4") */
  keyPrefix: varchar('key_prefix', { length: 12 }).notNull(),

  /** Max requests per hour (null = unlimited) */
  rateLimitPerHour: integer('rate_limit_per_hour'),

  /** Max requests per day (null = unlimited) */
  rateLimitPerDay: integer('rate_limit_per_day'),

  /** Whether this key is active */
  isActive: boolean('is_active').default(true).notNull(),

  /** Last time this key was used */
  lastUsedAt: timestamp('last_used_at'),

  /** Optional expiry (null = never expires) */
  expiresAt: timestamp('expires_at'),

  /** Creation timestamp */
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
