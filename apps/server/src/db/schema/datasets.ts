import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, pgEnum, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const sourceTypeEnum = pgEnum('source_type', ['google_sheets', 'csv', 'excel']);
export const syncStatusEnum = pgEnum('sync_status', ['idle', 'syncing', 'error', 'success']);

export const datasets = pgTable('datasets', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  sourceType: sourceTypeEnum('source_type').notNull(),
  sourceConfig: jsonb('source_config').notNull().$type<Record<string, unknown>>(),
  extractionConfig: jsonb('extraction_config').$type<Record<string, unknown>>(),
  columns: jsonb('columns').default([]).$type<Array<{ name: string; originalName: string; type: string }>>(),
  syncStatus: syncStatusEnum('sync_status').default('idle').notNull(),
  lastSyncedAt: timestamp('last_synced_at'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const datasetRows = pgTable('dataset_rows', {
  id: uuid('id').defaultRandom().primaryKey(),
  datasetId: uuid('dataset_id').references(() => datasets.id, { onDelete: 'cascade' }).notNull(),
  data: jsonb('data').notNull().$type<Record<string, unknown>>(),
  rowNumber: integer('row_number').notNull(),
  /** SHA256 hash of serialized row data — used for change detection. */
  rowHash: varchar('row_hash', { length: 64 }),
  /** Stringified key column values — e.g. "Banda Aceh" — used as identity for diffing. */
  rowKey: varchar('row_key', { length: 512 }),
  /** Timestamp when this row first appeared (from first sync or initial load). */
  firstSeenAt: timestamp('first_seen_at').defaultNow().notNull(),
  /** Timestamp of most recent data change on this row. */
  lastChangedAt: timestamp('last_changed_at').defaultNow().notNull(),
  /** Which sync introduced or last modified this row. */
  syncId: uuid('sync_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_dataset_rows_dataset_id').on(table.datasetId),
  index('idx_dataset_rows_row_key').on(table.datasetId, table.rowKey),
]);
