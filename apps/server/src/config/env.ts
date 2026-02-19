import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
  GOOGLE_PRIVATE_KEY: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
};

// Startup validation — ensure critical secrets are configured before serving requests
if (!env.JWT_SECRET) {
  if (env.NODE_ENV === 'production') {
    throw new Error(
      '[SECURITY] FATAL: JWT_SECRET environment variable must be set in production. Server refused to start.',
    );
  }
  // Development-only fallback — never allow this in production
  (env as { JWT_SECRET: string }).JWT_SECRET = 'dev-secret-do-not-use-in-production';
  console.warn(
    '[SECURITY] ⚠ WARNING: JWT_SECRET is not set. ' +
    'Using insecure default. DO NOT run this configuration in production!',
  );
}
