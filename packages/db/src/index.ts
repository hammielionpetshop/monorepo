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
   * Batas koneksi **per proses** — bukan batas untuk seluruh aplikasi. Berapa
   * koneksi yang benar-benar dipakai tergantung berapa proses yang hidup.
   *
   * Produksi hanya punya max_connections = 40 dan backoffice + order-web berbagi
   * jatah itu, jadi bawaannya sengaja kecil dan cocok untuk pemanggil yang jumlah
   * prosesnya tidak diketahui. Kedua app Next kini jalan sebagai satu proses tetap
   * di VPS, jadi keduanya menaikkan angka ini sendiri (lihat `lib/db.ts` tiap app);
   * skrip CLI yang jalan sebagai proses tunggal juga boleh.
   */
  max?: number;
  idleTimeout?: number;
  connectTimeout?: number;
  /**
   * Umur maksimum satu koneksi dalam detik, setelah itu didaur ulang.
   *
   * Ini pengaman terhadap soket yang mati tanpa memberi tahu klien: koneksi yang menganggur
   * lama bisa sudah ditutup di sisi server tanpa klien tahu (restart Postgres,
   * `server_lifetime` PgBouncer, timeout NAT — dan setelah pindah ke VPS, koneksinya
   * melintasi jaringan sehingga makin rawan diputus di tengah). postgres.js tidak
   * punya batas waktu untuk ANTREAN pool — kalau semua slot dipegang soket zombi seperti itu,
   * query berikutnya menunggu tanpa batas sampai platformnya yang membunuh request (terpantau
   * sebagai 504 setelah 300 detik di Vercel, bukan sebagai error koneksi).
   *
   * `connect_timeout` tidak menolong di sini: koneksinya sudah terlanjur jadi, yang mati
   * belakangan. Yang memutus hanyalah membuang koneksi karena umur.
   */
  maxLifetime?: number;
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
    max_lifetime: options.maxLifetime ?? 60 * 10,
    prepare: options.prepare ?? false,
  });
  return drizzle(client, { schema });
}
