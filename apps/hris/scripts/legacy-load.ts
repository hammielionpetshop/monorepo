import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { legacyLoadSql, mapLegacyRows, type LegacyRow } from '../modules/employees/rules/legacy-load';

/*
 * Muat data awal karyawan (spec L2g): Excel → berkas SQL satu transaksi. Tidak menyentuh database dan tidak menulis
 * isi data ke layar. Data pribadi tidak masuk repo: berkas Excel, SQL, koreksi nama, dan kode yang dikecualikan
 * semuanya diberikan lewat argumen.
 *
 *   tsx apps/hris/scripts/legacy-load.ts <excel> <keluaran.sql> [--exclude KODE] [--rename KODE=Nama]
 */
const args = process.argv.slice(2);
const [input, output] = args.filter((arg, i) => !arg.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!input || !output) {
  console.error('Pemakaian: legacy-load <excel> <keluaran.sql> [--exclude KODE] [--rename KODE=Nama]');
  process.exit(1);
}
const excludeCodes: string[] = [];
const renames: Record<string, string> = {};
args.forEach((arg, i) => {
  if (arg === '--exclude') excludeCodes.push(args[i + 1]);
  if (arg === '--rename') {
    const [code, ...name] = args[i + 1].split('=');
    renames[code] = name.join('=');
  }
});

const XLSX = createRequire(new URL('../../backoffice/package.json', import.meta.url))('xlsx');
const workbook = XLSX.readFile(input);
const rows: LegacyRow[] = XLSX.utils.sheet_to_json(workbook.Sheets.Karyawan, { defval: null, raw: true });
const result = mapLegacyRows(rows, { excludeCodes, renames });

if (result.errors.length) {
  console.error(`DITOLAK: ${result.errors.length} masalah, tidak ada berkas yang ditulis.`);
  for (const error of result.errors) console.error(`  ${error}`);
  process.exit(1);
}
writeFileSync(output, legacyLoadSql(result.employees));
const count = (key: 'branchName' | 'positionName' | 'workStatus') => {
  const tally: Record<string, number> = {};
  for (const employee of result.employees) tally[employee[key]] = (tally[employee[key]] ?? 0) + 1;
  return tally;
};
console.log(JSON.stringify({
  dimuat: result.employees.length, nonaktifDilewati: result.skippedInactive, dikecualikan: result.skippedExcluded,
  cabang: count('branchName'), jabatan: count('positionName'), status: count('workStatus'),
}, null, 2));
