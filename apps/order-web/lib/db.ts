import { createDb } from '@petshop/db';

export * from '@petshop/db';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined. Please check your .env.local or the environment.');
}

// Portal memakai enam koneksi; staging punya jatah sendiri lewat DB_POOL_MAX.
const poolMax = Number(process.env.DB_POOL_MAX) || 6;

export const db = createDb(connectionString, { max: poolMax });
