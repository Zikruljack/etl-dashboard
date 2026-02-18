import { pgTable, uuid, jsonb, integer, timestamp, varchar, index } from 'drizzle-orm/pg-core';
import { datasets } from './datasets';

/**
 * Raw snapshots table.
 * Stores complete cell grid fetched from source per fetch.
 * Used for extraction configuration and re-sync comparison.
 */
export const rawSnapshots = pgTable('raw_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  datasetId: uuid('dataset_id').references(() => datasets.id, { onDelete: 'cascade' }),
  snapshotData: jsonb('snapshot_data').notNull().$type<(string | null)[][]>(),
  totalRows: integer('total_rows').notNull(),
  totalCols: integer('total_cols').notNull(),
  sourceHash: varchar('source_hash', { length: 64 }),
  fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
}, (table) => [
  index('idx_raw_snapshots_dataset_id').on(table.datasetId),
]);
