import { createHrisDb } from '@petshop/hris-db';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined. Please check your .env.local or the environment.');
}

// Satu proses yang hidup lama di VPS; jatah koneksi HRIS lihat spec L0 §6.
const poolMax = Number(process.env.DB_POOL_MAX) || 8;

// Sengaja hanya `db`: tabel diimpor modul dari @petshop/hris-db/schema/<modulnya>,
// supaya satu modul tidak bisa meraih tabel modul lain lewat berkas ini.
export const db = createHrisDb(connectionString, { max: poolMax });
