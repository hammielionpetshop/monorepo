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
export interface CreateDbOptions {
  /**
   * Batas koneksi **per proses**. Di serverless (Vercel) tiap instance lambda
   * punya pool sendiri, jadi angka ini otomatis dikali jumlah instance yang
   * hidup — bukan batas untuk seluruh aplikasi. Produksi hanya punya
   * max_connections = 40, dan backoffice + order-web berbagi jatah itu, jadi
   * bawaannya sengaja kecil. Skrip CLI yang jalan sebagai satu proses tunggal
   * boleh menaikkannya.
   */
  max?: number;
  idleTimeout?: number;
  connectTimeout?: number;
  /**
   * Prepared statement WAJIB mati bila koneksi lewat PgBouncer dengan
   * `pool_mode = transaction`: pooler memindahkan klien antar koneksi server,
   * sehingga statement yang sudah disiapkan hilang dan query gagal dengan
   * `prepared statement "..." does not exist`. Terbukti pada uji beban
   * (25 klien di atas pool 15) — bukan teori. Default sengaja `false` supaya
   * mengarahkan DATABASE_URL ke pooler tidak pernah jadi jebakan.
   */
  prepare?: boolean;
}

export function createDb(connectionString: string, options: CreateDbOptions = {}) {
  let url = connectionString;
  if (!url.includes('timezone=')) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}options=-c%20timezone=UTC`;
  }
  // idle_timeout tidak bisa diandalkan di serverless: instance yang dibekukan
  // antar-invocation tidak menjalankan timer, sehingga koneksinya tetap nangkring
  // (terpantau idle 5+ menit padahal timeout-nya 30 detik). Karena itu `max` yang
  // jadi pengaman utama, bukan timeout.
  const client = postgres(url, {
    max: options.max ?? 3,
    idle_timeout: options.idleTimeout ?? 20,
    connect_timeout: options.connectTimeout ?? 10,
    prepare: options.prepare ?? false,
  });
  return drizzle(client, { schema });
}
