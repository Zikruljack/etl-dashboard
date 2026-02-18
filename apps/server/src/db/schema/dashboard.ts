import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, boolean, pgEnum, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { datasets } from './datasets';

export const componentTypeEnum = pgEnum('component_type', ['table', 'chart', 'map', 'timeline', 'kpi']);

export const dashboard = pgTable('dashboards', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  isPublished: boolean('is_published').default(false).notNull(),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const dashboardPages = pgTable('dashboard_pages', {
  id: uuid('id').defaultRandom().primaryKey(),
  dashboardId: uuid('dashboard_id').references(() => dashboard.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_dashboard_pages_dashboard_id').on(table.dashboardId),
]);

export const dashboardComponents = pgTable('dashboard_components', {
  id: uuid('id').defaultRandom().primaryKey(),
  pageId: uuid('page_id').references(() => dashboardPages.id, { onDelete: 'cascade' }).notNull(),
  type: componentTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }),
  layout: jsonb('layout').notNull().$type<{ x: number; y: number; w: number; h: number }>(),
  config: jsonb('config').notNull().$type<Record<string, unknown>>(),
  datasetId: uuid('dataset_id').references(() => datasets.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_dashboard_components_page_id').on(table.pageId),
]);
