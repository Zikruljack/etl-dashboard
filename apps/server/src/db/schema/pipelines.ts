import { pgTable, uuid, varchar, boolean, jsonb, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { datasets } from './datasets';
import { users } from './users';

/**
 * Pipelines table.
 * Each dataset can have one active pipeline of ordered transform steps.
 */
export const pipelines = pgTable('pipelines', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  datasetId: uuid('dataset_id').references(() => datasets.id, { onDelete: 'cascade' }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_pipelines_dataset_id').on(table.datasetId),
]);

/**
 * Pipeline steps table.
 * Each row is one ordered step in a pipeline.
 * Config JSONB is typed per step type (rename, trim, etc.).
 */
export const pipelineSteps = pgTable('pipeline_steps', {
  id: uuid('id').defaultRandom().primaryKey(),
  pipelineId: uuid('pipeline_id').references(() => pipelines.id, { onDelete: 'cascade' }).notNull(),
  sortOrder: integer('sort_order').notNull(),
  type: varchar('type', { length: 64 }).notNull(),
  config: jsonb('config').notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_pipeline_steps_pipeline_id').on(table.pipelineId),
]);
