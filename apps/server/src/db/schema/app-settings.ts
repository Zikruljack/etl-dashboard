import { pgTable, varchar, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Application settings as a key-value store.
 * Keys are pre-defined; values are free-form text (JSON stringified for complex types).
 *
 * Default keys:
 * - googleServiceAccountEmail — service account for Google Sheets
 * - googlePrivateKey — private key JSON string
 * - appName — display name of the application
 * - allowRegistration — 'true' | 'false'
 */
export const appSettings = pgTable('app_settings', {
  /** Setting key — acts as primary key. */
  key: varchar('key', { length: 100 }).primaryKey(),
  /** Setting value, stored as text. JSON values are stringified by the service layer. */
  value: text('value').notNull(),
  /** Human-readable description of the setting. */
  description: varchar('description', { length: 500 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
