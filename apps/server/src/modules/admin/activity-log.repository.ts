import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { activityLogs } from '../../db/schema/index.js';
import { BaseRepository, type PaginateOptions } from '../../core/base.repository.js';
import { db } from '../../config/database.js';

/** Activity log record type */
export type ActivityLogRecord = typeof activityLogs.$inferSelect;

/** Activity log insert type */
export type ActivityLogInsert = typeof activityLogs.$inferInsert;

/** Filters for querying activity logs */
export interface ActivityLogFilters {
  userId?: string;
  action?: string;
  resourceType?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Repository for activity_logs table.
 * Provides paginated queries with filter support.
 */
class ActivityLogRepository extends BaseRepository<typeof activityLogs, ActivityLogRecord, ActivityLogInsert> {
  constructor() {
    super(activityLogs, 'activity_logs');
  }

  /**
   * Insert a new activity log entry.
   *
   * @param data - Log entry data
   * @returns Created log entry
   */
  async log(data: ActivityLogInsert): Promise<ActivityLogRecord> {
    return this.create(data);
  }

  /**
   * Paginated activity log query with optional filters.
   * Joins with users table to include user name and email.
   * Results are ordered newest first.
   *
   * @param options - Pagination options (limit, offset)
   * @param filters - Optional filters (userId, action, resourceType, dateFrom, dateTo)
   * @returns Paginated result with enriched log entries
   */
  async findPaginatedWithUser(
    options: PaginateOptions,
    filters: ActivityLogFilters = {},
  ): Promise<{ data: (ActivityLogRecord & { userName: string | null; userEmail: string | null })[]; total: number }> {
    const conditions = [];

    if (filters.userId) conditions.push(eq(activityLogs.userId, filters.userId));
    if (filters.action) conditions.push(eq(activityLogs.action, filters.action));
    if (filters.resourceType) conditions.push(eq(activityLogs.resourceType, filters.resourceType));
    if (filters.dateFrom) conditions.push(gte(activityLogs.createdAt, filters.dateFrom));
    if (filters.dateTo) conditions.push(lte(activityLogs.createdAt, filters.dateTo));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Count query
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(activityLogs);
    if (where) countQuery.where(where);
    const [{ count }] = await countQuery;

    // Data query with user join
    const users = (await import('../../db/schema/index.js')).users;
    const dataQuery = db
      .select({
        id: activityLogs.id,
        userId: activityLogs.userId,
        action: activityLogs.action,
        resourceType: activityLogs.resourceType,
        resourceId: activityLogs.resourceId,
        details: activityLogs.details,
        createdAt: activityLogs.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(options.limit)
      .offset(options.offset);

    if (where) dataQuery.where(where);

    const data = await dataQuery;

    return {
      data: data as (ActivityLogRecord & { userName: string | null; userEmail: string | null })[],
      total: Number(count),
    };
  }

  /**
   * Get distinct action types (for filter dropdown).
   *
   * @returns Array of unique action strings
   */
  async getDistinctActions(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ action: activityLogs.action })
      .from(activityLogs)
      .orderBy(activityLogs.action);
    return rows.map((r) => r.action);
  }
}

export const activityLogRepository = new ActivityLogRepository();
