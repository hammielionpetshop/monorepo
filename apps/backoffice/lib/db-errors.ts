/**
 * Membedakan "database menolak koneksi" dari kegagalan query biasa.
 *
 * Produksi hanya punya max_connections = 40 dan dipakai bersama oleh backoffice
 * serta order-web yang jalan di serverless, jadi kehabisan slot adalah mode
 * gagal yang nyata — bukan bug kode. Dulu semuanya keluar sebagai 500 dengan
 * pesan generik, sehingga insidennya tak bisa dibedakan dari error lain.
 */
export function isDbUnavailable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string') {
    // 53300 too_many_connections, 53400 configuration_limit_exceeded,
    // 08001/08004 gagal membangun koneksi, 57P03 server belum siap menerima.
    if (['53300', '53400', '08001', '08004', '57P03'].includes(code)) return true;
    if (['CONNECT_TIMEOUT', 'CONNECTION_ENDED', 'CONNECTION_CLOSED', 'CONNECTION_REFUSED'].includes(code)) {
      return true;
    }
  }

  const message = (error as { message?: unknown }).message;
  if (typeof message !== 'string') return false;
  return /too many clients|remaining connection slots|connection terminated|Connection ended/i.test(message);
}

export const DB_UNAVAILABLE_MESSAGE =
  'Database sedang penuh koneksi. Muat ulang halaman beberapa saat lagi.';
