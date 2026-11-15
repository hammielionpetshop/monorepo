import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Muat .env dari root monorepo
dotenv.config({ path: '../../.env' });

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ['petshop'],
});
