import { pgSchema } from 'drizzle-orm/pg-core';

// Tabel akun & sesi terpusat diisi di L1.
export const authSchema = pgSchema('auth');
