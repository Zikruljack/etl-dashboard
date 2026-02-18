import { pgTable, uuid, varchar, text, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { datasets } from './datasets';
import { datasetSyncs } from './dataset-syncs';

export const changeTypeEnum = pgEnum('change_type', ['new', 'changed', 'deleted']);

/**
 * Cell-level change records produced by the DiffEngine during sync.
 * One record per modified column for 'changed' rows.
 * One record (column_name=null) for 'new' and 'deleted' rows.
 */
export const datasetChanges = pgTable('dataset_changes', {
  id: uuid('id').defaultRandom().primaryKey(),
  datasetId: uuid('dataset_id').references(() => datasets.id, { onDelete: 'cascade' }).notNull(),
  syncId: uuid('sync_id').references(() => datasetSyncs.id, { onDelete: 'cascade' }).notNull(),
  /** Stringified key column values identifying the row, e.g. "Banda Aceh". */
  rowKey: varchar('row_key', { length: 512 }).notNull(),
  changeType: changeTypeEnum('change_type').notNull(),
  /** Column name that changed. Null for row-level new/deleted events. */
  columnName: varchar('column_name', { length: 255 }),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  changedAt: timestamp('changed_at').defaultNow().notNull(),
}, (table) => [
  index('idx_dataset_changes_dataset_id').on(table.datasetId),
  index('idx_dataset_changes_sync_id').on(table.syncId),
  index('idx_dataset_changes_row_key').on(table.datasetId, table.rowKey),
]);
