import { Router } from 'express';
import { authenticate } from '../../core/middleware/index.js';
import { sendSuccess, sendPaginated } from '../../core/response.js';
import { parsePagination } from '../../core/pagination.js';
import * as syncService from './sync.service.js';

/**
 * Sync & change history routes.
 * Mounted at /api/datasets/:id (mergeParams: true) so :id is available.
 */
const router: ReturnType<typeof Router> = Router({ mergeParams: true });

router.use(authenticate);

/** Valid change type filter values */
const changeTypeValues = ['new', 'changed', 'deleted'] as const;

/**
 * GET /api/datasets/:id/syncs
 * Get sync run history for a dataset (newest first).
 */
router.get('/syncs', async (req, res, next) => {
  try {
    const params = req.params as Record<string, string>;
    const syncs = await syncService.getSyncHistory(params['id']);
    sendSuccess(res, syncs);
  } catch (err) { next(err); }
});

/**
 * GET /api/datasets/:id/changes
 * Get paginated change timeline for a dataset.
 * Query params: page, pageSize, syncId, changeType (new|changed|deleted)
 */
router.get('/changes', async (req, res, next) => {
  try {
    const params = req.params as Record<string, string>;
    const { page, pageSize } = parsePagination(req);
    const syncId = typeof req.query['syncId'] === 'string' ? req.query['syncId'] : undefined;
    const changeTypeRaw = req.query['changeType'];
    const changeType = typeof changeTypeRaw === 'string' && (changeTypeValues as readonly string[]).includes(changeTypeRaw)
      ? changeTypeRaw as 'new' | 'changed' | 'deleted'
      : undefined;

    const result = await syncService.getChangeHistory(params['id'], {
      page,
      pageSize,
      syncId,
      changeType,
    });

    sendPaginated(res, result.data, result.pagination);
  } catch (err) { next(err); }
});

/**
 * GET /api/datasets/:id/changes/:rowKey
 * Get full change history for a specific row (all syncs).
 * rowKey is URL-encoded: encodeURIComponent(rowKey)
 */
router.get('/changes/:rowKey', async (req, res, next) => {
  try {
    const params = req.params as Record<string, string>;
    const rowKey = decodeURIComponent(params['rowKey']);
    const history = await syncService.getRowHistory(params['id'], rowKey);
    sendSuccess(res, history);
  } catch (err) { next(err); }
});

export default router;
