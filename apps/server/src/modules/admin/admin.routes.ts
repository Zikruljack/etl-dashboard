import os from 'os';
import process from 'process';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, validate } from '../../core/middleware/index.js';
import { sendSuccess, sendPaginated } from '../../core/response.js';
import { parsePagination } from '../../core/pagination.js';
import { db } from '../../config/database.js';
import { sql } from 'drizzle-orm';
import * as activityLogService from './activity-log.service.js';
import * as settingsService from './settings.service.js';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate, requireRole('admin'));

/** Validation schema for settings update */
const updateSettingsSchema = z.object({
  settings: z.record(z.string(), z.string()),
});

/**
 * GET /api/admin/logs
 * Get paginated activity logs (admin only).
 * Query params: page, pageSize, userId, action, resourceType, dateFrom, dateTo
 */
router.get('/logs', async (req, res, next) => {
  try {
    const { page, pageSize } = parsePagination(req);

    const filters: activityLogService.LogQueryOptions['filters'] = {};
    if (typeof req.query['userId'] === 'string') filters.userId = req.query['userId'];
    if (typeof req.query['action'] === 'string') filters.action = req.query['action'];
    if (typeof req.query['resourceType'] === 'string') filters.resourceType = req.query['resourceType'];
    if (typeof req.query['dateFrom'] === 'string') filters.dateFrom = new Date(req.query['dateFrom']);
    if (typeof req.query['dateTo'] === 'string') filters.dateTo = new Date(req.query['dateTo']);

    const result = await activityLogService.queryLogs({ page, pageSize, filters });

    const paginationMeta = {
      page,
      pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / pageSize),
    };

    sendPaginated(res, result.data, paginationMeta);
  } catch (err) { next(err); }
});

/**
 * GET /api/admin/logs/actions
 * Get distinct action types for filter dropdown (admin only).
 */
router.get('/logs/actions', async (_req, res, next) => {
  try {
    const actions = await activityLogService.getLogActions();
    sendSuccess(res, actions);
  } catch (err) { next(err); }
});

/**
 * GET /api/admin/system
 * Get system info — DB table counts, server stats, Node version (admin only).
 */
router.get('/system', async (_req, res, next) => {
  try {
    // Table row counts
    const tables = [
      'users', 'datasets', 'dataset_rows', 'raw_snapshots',
      'dataset_syncs', 'dataset_changes', 'dashboards',
      'dashboard_components', 'pipelines', 'activity_logs',
    ] as const;

    const counts: Record<string, number> = {};
    await Promise.all(
      tables.map(async (table) => {
        const [{ count }] = await db.execute<{ count: string }>(
          sql.raw(`SELECT COUNT(*) as count FROM ${table}`),
        );
        counts[table] = Number(count);
      }),
    );

    // Total database size in bytes
    const [dbSizeRow] = await db.execute<{ size_bytes: string }>(
      sql.raw(`SELECT pg_database_size(current_database()) AS size_bytes`),
    );
    const totalSizeBytes = Number(dbSizeRow.size_bytes);

    // Per-table size breakdown (data + indexes)
    const tableSizeRows = await db.execute<{
      table_name: string;
      total_bytes: string;
      table_bytes: string;
      index_bytes: string;
    }>(sql.raw(`
      SELECT
        relname AS table_name,
        pg_total_relation_size(relid) AS total_bytes,
        pg_relation_size(relid) AS table_bytes,
        (pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_bytes
      FROM pg_stat_user_tables
      ORDER BY total_bytes DESC
    `));

    const tableSizes: Record<string, { totalBytes: number; tableBytes: number; indexBytes: number }> = {};
    for (const row of tableSizeRows) {
      tableSizes[row.table_name] = {
        totalBytes: Number(row.total_bytes),
        tableBytes: Number(row.table_bytes),
        indexBytes: Number(row.index_bytes),
      };
    }

    const memUsage = process.memoryUsage();

    sendSuccess(res, {
      server: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptimeSeconds: Math.floor(process.uptime()),
        memory: {
          heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
          rssMb: Math.round(memUsage.rss / 1024 / 1024),
        },
        cpus: os.cpus().length,
        hostname: os.hostname(),
      },
      database: {
        tableCounts: counts,
        totalSizeBytes,
        tableSizes,
      },
      app: {
        version: '0.1.0',
        env: process.env['NODE_ENV'] || 'development',
      },
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/admin/settings
 * Get all app settings, with sensitive values redacted (admin only).
 */
router.get('/settings', async (_req, res, next) => {
  try {
    const settings = await settingsService.getSettings();
    sendSuccess(res, settings);
  } catch (err) { next(err); }
});

/**
 * PATCH /api/admin/settings
 * Update app settings (admin only).
 * Body: { settings: { key: value, ... } }
 */
router.patch('/settings', validate(updateSettingsSchema), async (req, res, next) => {
  try {
    await settingsService.updateSettings(req.body.settings);
    const updated = await settingsService.getSettings();
    sendSuccess(res, updated);
  } catch (err) { next(err); }
});

export default router;
