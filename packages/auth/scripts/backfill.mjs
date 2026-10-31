import postgres from 'postgres';
import { backfillLegacyAccounts, preflightLegacyAccounts } from '../src/backfill.mjs';

const args = process.argv.slice(2);
if (args.some((argument) => argument !== '--apply') || args.length > 1) {
  console.error('Pemakaian: pnpm --filter @petshop/auth db:backfill [--apply]');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL wajib diberikan secara eksplisit; berkas env tidak dimuat.');
  process.exit(1);
}

let sql;
try {
  sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
  const report = await (args.includes('--apply') ? backfillLegacyAccounts(sql) : preflightLegacyAccounts(sql));
  console.log(JSON.stringify({ mode: args.includes('--apply') ? 'apply' : 'preflight', ...report }));
  if (!report.canApply) process.exitCode = 1;
} catch (error) {
  // Pesan Postgres dapat berisi nilai kredensial atau identifier; keluarkan laporan tersaring saja.
  console.error('Pemeriksaan atau impor akun gagal; periksa koneksi, migrasi, hak akses, dan konflik.');
  if (error.report) console.error(JSON.stringify(error.report));
  process.exitCode = 1;
} finally {
  if (sql) await sql.end();
}
