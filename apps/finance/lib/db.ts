import postgres from 'postgres';

/**
 * Koneksi Finance (spec F2-6 §3.1): role `finance_app` hanya punya SELECT, jadi tulisan apa pun ditolak database.
 * Sengaja SQL mentah: Finance tidak memakai ORM app lain supaya pintu bacanya terlihat di satu tempat (modules/).
 */
let client: postgres.Sql | undefined;

export function getSql(): postgres.Sql {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL belum diisi untuk web Finance.');
  client = postgres(url, {
    max: Number(process.env.DB_POOL_MAX) || 3,
    // Tanggal dibiarkan teks YYYY-MM-DD agar tidak bergeser zona waktu.
    types: { date: { to: 1082, from: [1082], serialize: (v: string) => v, parse: (v: string) => v } },
    // Lapis kedua di atas hak role: setiap transaksi baca saja.
    connection: { default_transaction_read_only: true },
  });
  return client;
}
