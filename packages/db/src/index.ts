import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';
import * as schema from './schema/index.js';

export * from './schema/index.js';

// Load .env dari root monorepo (2 level ke atas dari packages/db/src)
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined. Please check your .env file at the monorepo root.');
}

const client = postgres(connectionString);

export const db = drizzle(client, { schema });
