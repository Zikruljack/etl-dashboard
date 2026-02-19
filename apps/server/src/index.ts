/**
 * ETL Dashboard — Express server entry point.
 *
 * Architecture: core/ (framework) + modules/ (domain)
 * Each module is self-contained with its own routes, service, and repository.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { logger } from './core/logger.js';
import { errorHandler } from './core/middleware/error-handler.js';
import { activityLogger } from './core/middleware/activity-logger.js';

// Module routes
import { authRoutes } from './modules/auth/index.js';
import { userRoutes } from './modules/user/index.js';
import { datasetRoutes } from './modules/dataset/index.js';
import { dashboardRoutes } from './modules/dashboard/index.js';
import { sourceRoutes } from './modules/source/index.js';
import pipelineRoutes from './modules/pipeline/pipeline.routes.js';
import syncRoutes from './modules/sync/sync.routes.js';
import { adminRoutes, settingsRepository } from './modules/admin/index.js';
import { publicRoutes } from './modules/public/index.js';
import apiKeyRoutes from './modules/api-keys/api-keys.routes.js';
import v1Routes from './modules/public-api/v1.routes.js';

const app = express();

// --- Global middleware ---
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

/** Rate limiter: 500 requests per 15 minutes per IP */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
});
app.use('/api/', limiter);

// --- Activity logger (logs mutations after response) ---
app.use(activityLogger);

// --- Module routes ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/datasets', datasetRoutes);
app.use('/api/data', datasetRoutes);     // /api/data/query shares dataset module
app.use('/api/sources', sourceRoutes);
app.use('/api/datasets/:id/pipeline', pipelineRoutes);
app.use('/api/datasets/:id', syncRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);   // No auth — published dashboards only
app.use('/api/api-keys', apiKeyRoutes); // API key management (JWT auth)
app.use('/api/v1', v1Routes);           // External API (API key auth)

// --- Health check ---
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Global error handler (must be last) ---
app.use(errorHandler);

// --- Start server ---
app.listen(env.PORT, async () => {
  logger.info(`Server running on http://localhost:${env.PORT}`, {
    env: env.NODE_ENV,
    port: env.PORT,
  });
  // Seed default settings (idempotent)
  await settingsRepository.seedDefaults().catch((err) => {
    logger.warn('Failed to seed default settings', { err });
  });
});
