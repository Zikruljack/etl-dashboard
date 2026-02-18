import type { Request, Response, NextFunction } from 'express';

/**
 * Map of HTTP method + route pattern → action name for activity logging.
 * Routes are matched by prefix, so order matters (more specific first).
 */
const ACTION_MAP: Array<{
  method: string;
  pathPattern: RegExp;
  action: string;
  resourceType: string;
}> = [
  // Auth
  { method: 'POST', pathPattern: /^\/api\/auth\/login/, action: 'login', resourceType: 'auth' },
  { method: 'POST', pathPattern: /^\/api\/auth\/register/, action: 'register', resourceType: 'auth' },
  // Datasets
  { method: 'POST', pathPattern: /^\/api\/datasets$/, action: 'create_dataset', resourceType: 'dataset' },
  { method: 'PATCH', pathPattern: /^\/api\/datasets\/[^/]+$/, action: 'update_dataset', resourceType: 'dataset' },
  { method: 'DELETE', pathPattern: /^\/api\/datasets\/[^/]+$/, action: 'delete_dataset', resourceType: 'dataset' },
  { method: 'POST', pathPattern: /^\/api\/datasets\/[^/]+\/sync/, action: 'sync_dataset', resourceType: 'dataset' },
  { method: 'POST', pathPattern: /^\/api\/sources\/create-dataset/, action: 'create_dataset', resourceType: 'dataset' },
  // Pipelines
  { method: 'POST', pathPattern: /^\/api\/datasets\/[^/]+\/pipeline/, action: 'save_pipeline', resourceType: 'pipeline' },
  // Dashboards
  { method: 'POST', pathPattern: /^\/api\/dashboard$/, action: 'create_dashboard', resourceType: 'dashboard' },
  { method: 'PATCH', pathPattern: /^\/api\/dashboard\/[^/]+$/, action: 'update_dashboard', resourceType: 'dashboard' },
  { method: 'DELETE', pathPattern: /^\/api\/dashboard\/[^/]+$/, action: 'delete_dashboard', resourceType: 'dashboard' },
  // Users (admin)
  { method: 'PATCH', pathPattern: /^\/api\/users\/[^/]+$/, action: 'update_user', resourceType: 'user' },
  { method: 'DELETE', pathPattern: /^\/api\/users\/[^/]+$/, action: 'delete_user', resourceType: 'user' },
];

/**
 * Extract UUID from path (last segment if it looks like a UUID).
 *
 * @param path - URL path string
 * @returns UUID string or undefined
 */
function extractResourceId(path: string): string | undefined {
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = path.match(uuidRegex);
  return match?.[0];
}

/**
 * Activity logger middleware.
 * Attaches a `res.on('finish')` listener that logs significant mutations
 * (POST/PATCH/DELETE on success — 2xx responses only).
 *
 * Only logs actions defined in ACTION_MAP; GET requests are never logged.
 * Errors during logging are silently swallowed to never affect the main flow.
 */
export function activityLogger(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (!['POST', 'PATCH', 'DELETE'].includes(method)) {
    next();
    return;
  }

  const match = ACTION_MAP.find(
    (rule) => rule.method === method && rule.pathPattern.test(req.path),
  );

  if (!match) {
    next();
    return;
  }

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;

    const userId = (req as any).user?.userId ?? null;
    const resourceId = extractResourceId(req.path);

    // Fire-and-forget async log
    import('../../modules/admin/activity-log.service.js')
      .then(({ logActivity }) =>
        logActivity({
          userId,
          action: match.action,
          resourceType: match.resourceType,
          resourceId,
          details: { method, path: req.path, statusCode: res.statusCode },
        }),
      )
      .catch(() => { /* swallow */ });
  });

  next();
}
