import { createDb } from '@petshop/db';

export * from '@petshop/db';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined. Please check your .env.local or the environment.');
}

// Sejak deploy pindah ke VPS, app ini satu proses yang hidup lama — bukan N lambda
// ephemeral yang masing-masing punya pool sendiri. Angka ini karena itu benar-benar
// batas koneksi seluruh aplikasi, bukan lagi angka per-instance yang terkali sendiri.
// backoffice + order-web berbagi max_connections = 40 di Postgres produksi, jadi
// 10 + 10 masih longgar. DB_POOL_MAX supaya bisa disetel di VPS tanpa build ulang.
const poolMax = Number(process.env.DB_POOL_MAX) || 10;

export const db = createDb(connectionString, { max: poolMax });
