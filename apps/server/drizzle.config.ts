import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

// drizzle-kit runs from apps/server/, so ../../.env reaches the root
dotenv.config({ path: '../../.env' });

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
