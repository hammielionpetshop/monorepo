import { drizzle } from 'drizzle-orm/postgres-js';
export { eq, and, or, ne, gt, gte, lt, lte, like, ilike, inArray, notInArray, isNull, isNotNull, exists, notExists, between, notBetween, sql, desc, asc, sum, count, max, min, avg } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema/index';

export * from './schema/index';

/**
 * Factory function untuk membuat koneksi DB.
 * Setiap consumer (Next.js backoffice, CLI scripts, dll) memanggil ini dengan
 * DATABASE_URL dari environment mereka masing-masing.
 */
export function createDb(connectionString: string) {
  const client = postgres(connectionString, { max: 10, idle_timeout: 30 });
  return drizzle(client, { schema });
}
