import { Router } from 'express';
import { sendSuccess } from '../../core/response.js';
import { AppError } from '../../core/errors.js';
import { dashboardRepository } from '../dashboard/dashboard.repository.js';

const router: ReturnType<typeof Router> = Router();

/**
 * GET /api/public/dashboard/:id
 * Get a published dashboard with all pages and components — no authentication required.
 * Returns 404 if the dashboard doesn't exist or is not published.
 */
router.get('/dashboard/:id', async (req, res, next) => {
  try {
    const dashboard = await dashboardRepository.findFullById(req.params['id'] as string);

    if (!dashboard) {
      throw new AppError(404, 'Dashboard not found');
    }

    if (!dashboard.isPublished) {
      throw new AppError(404, 'Dashboard not found');
    }

    sendSuccess(res, dashboard);
  } catch (err) { next(err); }
});

export default router;
