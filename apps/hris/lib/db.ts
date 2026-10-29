import { createHrisDb } from '@petshop/hris-db';

export * from '@petshop/hris-db';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined. Please check your .env.local or the environment.');
}

// Satu proses yang hidup lama di VPS; jatah koneksi HRIS lihat spec L0 §6.
const poolMax = Number(process.env.DB_POOL_MAX) || 8;

export const db = createHrisDb(connectionString, { max: poolMax });
