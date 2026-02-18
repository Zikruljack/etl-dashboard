import { activityLogRepository, type ActivityLogFilters } from './activity-log.repository.js';

/** Input for logging an activity */
export interface LogActivityInput {
  userId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

/** Pagination options for log queries */
export interface LogQueryOptions {
  page: number;
  pageSize: number;
  filters?: ActivityLogFilters;
}

/**
 * Log a user activity event.
 * Fire-and-forget — errors are swallowed so logging never blocks the main flow.
 *
 * @param input - Activity data to log
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await activityLogRepository.log({
      userId: input.userId || null,
      action: input.action,
      resourceType: input.resourceType || null,
      resourceId: input.resourceId || null,
      details: input.details || null,
    });
  } catch {
    // Logging errors must never propagate — silently swallow
  }
}

/**
 * Query paginated activity logs with optional filters.
 *
 * @param options - Pagination and filter options
 * @returns Paginated logs with user info
 */
export async function queryLogs(options: LogQueryOptions) {
  const { page, pageSize, filters = {} } = options;
  const offset = (page - 1) * pageSize;

  return activityLogRepository.findPaginatedWithUser(
    { limit: pageSize, offset, orderBy: undefined },
    filters,
  );
}

/**
 * Get distinct action types for filter dropdowns.
 *
 * @returns Array of unique action strings
 */
export async function getLogActions(): Promise<string[]> {
  return activityLogRepository.getDistinctActions();
}
