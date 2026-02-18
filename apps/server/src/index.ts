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

// Module routes
import { authRoutes } from './modules/auth/index.js';
import { userRoutes } from './modules/user/index.js';
import { datasetRoutes } from './modules/dataset/index.js';
import { dashboardRoutes } from './modules/dashboard/index.js';
import { sourceRoutes } from './modules/source/index.js';
import pipelineRoutes from './modules/pipeline/pipeline.routes.js';
import syncRoutes from './modules/sync/sync.routes.js';

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

// --- Module routes ---
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/datasets', datasetRoutes);
app.use('/api/data', datasetRoutes);     // /api/data/query shares dataset module
app.use('/api/sources', sourceRoutes);
app.use('/api/datasets/:id/pipeline', pipelineRoutes);
app.use('/api/datasets/:id', syncRoutes);
app.use('/api/dashboard', dashboardRoutes);

// --- Health check ---
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Global error handler (must be last) ---
app.use(errorHandler);

// --- Start server ---
app.listen(env.PORT, () => {
  logger.info(`Server running on http://localhost:${env.PORT}`, {
    env: env.NODE_ENV,
    port: env.PORT,
  });
});
