import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Tracks all significant user actions in the system.
 * Used by the admin activity log page and audit trails.
 */
export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  /** UUID of the user who performed the action. Null for system actions. */
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  /** Action identifier, e.g. 'login', 'create_dataset', 'sync_dataset', 'delete_dashboard'. */
  action: varchar('action', { length: 100 }).notNull(),
  /** Type of resource affected, e.g. 'dataset', 'dashboard', 'user', 'pipeline'. */
  resourceType: varchar('resource_type', { length: 50 }),
  /** UUID of the affected resource (if applicable). */
  resourceId: uuid('resource_id'),
  /** Extra metadata — request body snapshot, error info, etc. */
  details: jsonb('details').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_activity_logs_user_id').on(table.userId),
  index('idx_activity_logs_action').on(table.action),
  index('idx_activity_logs_resource_type').on(table.resourceType),
  index('idx_activity_logs_created_at').on(table.createdAt),
]);
