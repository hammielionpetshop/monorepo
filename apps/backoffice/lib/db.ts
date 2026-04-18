import { createDb } from '@petshop/db';

export * from '@petshop/db';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined. Please check your .env.local or the environment.');
}

export const db = createDb(connectionString);
