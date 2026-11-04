import { createRequire } from 'node:module';
import { basename } from 'node:path';
import { writeFileSync } from 'node:fs';
import { comparisonLoadSql, comparisonPurgeSql, parseOldSlips, type OldSlipRow } from '../modules/payroll/rules/comparison';
import { periodEndOf } from '../modules/payroll/rules/salary';

/*
 * Uji banding L9b (spec L9 §4): berkas "Hasil slip lama" → berkas SQL satu transaksi bertanda COMPARISON, atau SQL
 * penghapus data salinan. Tidak menyentuh database dan tidak menulis isi data ke layar; SQL dijalankan dengan psql
 * di DB staging (petshop_staging), bukan produksi. Berkas berisi data gaji: hapus sesudah dipakai.
 *
 *   tsx apps/hris/scripts/comparison-load.ts <excel> <keluaran.sql> --period 2026-10-26 [--rename KODE=Nama]
 *   tsx apps/hris/scripts/comparison-load.ts --purge <keluaran.sql> --period 2026-10-26
 *
 * Lembar "Slip" berkolom: Kode, Nama, Jenis slip (Bulanan / Mingguan / Mingguan tambahan), Mulai (tanggal minggu upah;
 * kosong untuk Bulanan), Bagian (Pendapatan / Potongan / Total), Komponen, Jumlah. Satu baris per komponen; tiap slip
 * punya tepat satu baris Total.
 */
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((arg, i) => !arg.startsWith('--') && !(args[i - 1]?.startsWith('--') && args[i - 1] !== '--purge'));
const purge = args.includes('--purge');
const period = flag('--period');
const usage = 'Pemakaian: comparison-load <excel> <keluaran.sql> --period YYYY-MM-26 [--rename KODE=Nama] | --purge <keluaran.sql> --period YYYY-MM-26';
if (!period || !/^\d{4}-\d{2}-26$/.test(period)) {
  console.error(`${usage}\nPeriode harus tanggal 26 (awal periode gaji).`);
  process.exit(1);
}

if (purge) {
  const output = positional[0];
  if (!output) {
    console.error(usage);
    process.exit(1);
  }
  writeFileSync(output, comparisonPurgeSql(period));
  console.log(`SQL penghapus data salinan periode ${period} ditulis.`);
  process.exit(0);
}

const [input, output] = positional;
if (!input || !output) {
  console.error(usage);
  process.exit(1);
}
const renames: Record<string, string> = {};
args.forEach((arg, i) => {
  if (arg === '--rename') {
    const [code, ...name] = args[i + 1].split('=');
    renames[code.trim().toUpperCase()] = name.join('=').trim();
  }
});

const XLSX = createRequire(new URL('../../backoffice/package.json', import.meta.url))('xlsx');
const workbook = XLSX.readFile(input);
const sheet = workbook.Sheets.Slip ?? workbook.Sheets[workbook.SheetNames[0]];
const rows: OldSlipRow[] = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
const result = parseOldSlips(rows, { periodStart: period, renames });

if (result.errors.length) {
  console.error(`DITOLAK: ${result.errors.length} masalah, tidak ada berkas yang ditulis.`);
  for (const error of result.errors) console.error(`  ${error}`);
  process.exit(1);
}
for (const warning of result.warnings) console.warn(`PERHATIAN: ${warning}`);
writeFileSync(output, comparisonLoadSql(result.slips, { periodStart: period, label: `${period} s.d. ${periodEndOf(period)}`, files: [basename(input)] }));
const tally: Record<string, number> = {};
for (const slip of result.slips) tally[slip.slipKind] = (tally[slip.slipKind] ?? 0) + 1;
console.log(JSON.stringify({ slip: result.slips.length, orang: new Set(result.slips.map((s) => s.legacyCode)).size, jenis: tally, perhatian: result.warnings.length }, null, 2));
