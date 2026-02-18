import { pgTable, uuid, varchar, text, timestamp, integer, pgEnum, index } from 'drizzle-orm/pg-core';
import { datasets } from './datasets';

export const syncRunStatusEnum = pgEnum('sync_run_status', ['running', 'success', 'failed']);

/**
 * Records every sync run for a dataset.
 * Tracks row-level stats (added, changed, deleted) and duration.
 */
export const datasetSyncs = pgTable('dataset_syncs', {
  id: uuid('id').defaultRandom().primaryKey(),
  datasetId: uuid('dataset_id').references(() => datasets.id, { onDelete: 'cascade' }).notNull(),
  syncedAt: timestamp('synced_at').defaultNow().notNull(),
  status: syncRunStatusEnum('status').default('running').notNull(),
  rowsTotal: integer('rows_total').default(0).notNull(),
  rowsNew: integer('rows_new').default(0).notNull(),
  rowsChanged: integer('rows_changed').default(0).notNull(),
  rowsDeleted: integer('rows_deleted').default(0).notNull(),
  rowsUnchanged: integer('rows_unchanged').default(0).notNull(),
  /** SHA256 of raw snapshot data — detect if source actually changed. */
  sourceSnapshotHash: varchar('source_snapshot_hash', { length: 64 }),
  /** Error message if status is 'failed'. */
  errorLog: text('error_log'),
  /** Total sync duration in milliseconds. */
  durationMs: integer('duration_ms'),
}, (table) => [
  index('idx_dataset_syncs_dataset_id').on(table.datasetId),
  index('idx_dataset_syncs_synced_at').on(table.syncedAt),
]);
