import postgres from 'postgres';
import { inspectRollback, rollbackToLegacy } from '../src/rollback.mjs';

const args = process.argv.slice(2);
if (args.some((argument) => argument !== '--apply') || args.length > 1) {
  console.error('Pemakaian: pnpm --filter @petshop/auth db:rollback [--apply]');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL wajib diberikan secara eksplisit; berkas env tidak dimuat.');
  process.exit(1);
}

// Tanpa --apply hanya melaporkan. Urutan rollback sebenarnya: (1) backup DB, (2) set
// BO_AUTH_MODE=legacy dan deploy, (3) jalankan skrip ini dengan --apply, (4) beri tahu pengguna
// bahwa semua perlu login ulang. Jangan dijalankan ke produksi dari laptop.
let sql;
try {
  sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
  const before = await inspectRollback(sql);
  if (!args.includes('--apply')) {
    console.log(JSON.stringify({ mode: 'preflight', ...before }));
  } else {
    const result = await rollbackToLegacy(sql);
    console.log(JSON.stringify({ mode: 'apply', before, ...result, after: await inspectRollback(sql) }));
  }
} catch {
  // Pesan Postgres dapat memuat nilai data; keluarkan pesan tersaring saja.
  console.error('Rollback gagal; periksa koneksi, hak akses, dan keberadaan schema auth/petshop. Tidak ada perubahan yang disimpan.');
  process.exitCode = 1;
} finally {
  if (sql) await sql.end();
}
