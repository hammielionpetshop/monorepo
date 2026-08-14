import { createDb } from '@petshop/db';

export * from '@petshop/db';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined. Please check your .env.local or the environment.');
}

// Lihat catatan yang sama di apps/backoffice/lib/db.ts: di VPS ini satu proses yang
// hidup lama, jadi 10 di sini benar-benar 10 koneksi, bukan 10 dikali jumlah instance.
const poolMax = Number(process.env.DB_POOL_MAX) || 10;

export const db = createDb(connectionString, { max: poolMax });
