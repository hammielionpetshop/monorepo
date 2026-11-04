// Aturan murni uji banding L9b (spec L9 §4): baca berkas hasil slip lama, susun SQL muat/hapus, dan baris Lembar Banding.
import { periodEndOf, type IsoDate } from './salary';
import type { SlipComputation } from './payslip';

export type ComparisonSlipKind = 'MONTHLY' | 'WEEKLY' | 'WEEKLY_EXTRA';
export type ComparisonComponent = { label: string; side: 'INCOME' | 'DEDUCTION'; amount: number };
export type ComparisonCause = 'INTENDED' | 'FIX';

export const COMPARISON_KIND_LABELS: Record<ComparisonSlipKind, string> = {
  MONTHLY: 'Bulanan', WEEKLY: 'Mingguan', WEEKLY_EXTRA: 'Mingguan tambahan',
};
export const COMPARISON_CAUSE_LABELS: Record<ComparisonCause, string> = { INTENDED: 'Beda disengaja', FIX: 'Perlu diperbaiki' };
/** Hitungan HRIS paling banyak dua kali: hitungan pertama + satu hitung ulang sesudah perbaikan (SIS-16). */
export const MAX_COMPUTE = 2;

/** Kolom berkas "Hasil slip lama" (satu baris per komponen; tiap slip punya tepat satu baris Bagian = Total). */
export const OLD_SLIP_COLUMNS = ['Kode', 'Nama', 'Jenis slip', 'Mulai', 'Bagian', 'Komponen', 'Jumlah'] as const;

export type OldSlipRow = Partial<Record<(typeof OLD_SLIP_COLUMNS)[number], unknown>>;

export type OldSlip = {
  legacyCode: string;
  name: string;
  slipKind: ComparisonSlipKind;
  slipStart: IsoDate;
  oldTotal: number;
  components: ComparisonComponent[];
};

const KIND_WORDS: Record<string, ComparisonSlipKind> = {
  bulanan: 'MONTHLY', mingguan: 'WEEKLY', 'mingguan tambahan': 'WEEKLY_EXTRA',
};
const SIDE_WORDS: Record<string, ComparisonComponent['side'] | 'TOTAL'> = {
  pendapatan: 'INCOME', potongan: 'DEDUCTION', total: 'TOTAL',
};

const text = (v: unknown) => (v == null ? '' : String(v).trim().replace(/\s+/g, ' '));

/** Rupiah bulat ≥ 0 dari angka Excel atau teks ("1.250.000", "Rp 50.000"). Null bila bukan rupiah bulat. */
export function parseRupiah(v: unknown): number | null {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 ? v : null;
  const s = text(v).replace(/^rp\.?\s*/i, '');
  if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(s)) return null;
  return Number(s.replace(/\./g, ''));
}

const iso = (y: number, m: number, d: number): IsoDate | null => {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date.toISOString().slice(0, 10) : null;
};

/** Tanggal dari nomor seri Excel, "YYYY-MM-DD", atau "DD-MM-YYYY" / "DD/MM/YYYY". */
export function parseDate(v: unknown): IsoDate | null {
  if (typeof v === 'number' && Number.isInteger(v) && v > 20000 && v < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  }
  const s = text(v);
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(s);
  if (m) return iso(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

/**
 * Periksa seluruh berkas dulu (spec L9 §4 butir 2): satu baris salah = seluruh berkas ditolak, dengan nomor baris dan
 * sebabnya. Nama boleh dibetulkan lewat `renames` (kode lama → nama di HRIS), seperti muat data karyawan L2g.
 */
export function parseOldSlips(
  rows: readonly OldSlipRow[],
  options: { periodStart: IsoDate; renames?: Record<string, string> },
): { slips: OldSlip[]; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const end = periodEndOf(options.periodStart);
  const names = new Map<string, string>();
  const slips = new Map<string, OldSlip & { totals: number }>();
  rows.forEach((row, index) => {
    const where = `Baris ${index + 2}`;
    const code = text(row.Kode).toUpperCase();
    const rawName = text(row.Nama);
    const kind = KIND_WORDS[text(row['Jenis slip']).toLowerCase()];
    const side = SIDE_WORDS[text(row.Bagian).toLowerCase()];
    const label = text(row.Komponen);
    const amount = parseRupiah(row.Jumlah);
    const problems: string[] = [];
    if (!code) problems.push('Kode kosong');
    if (!rawName) problems.push('Nama kosong');
    if (!kind) problems.push(`Jenis slip "${text(row['Jenis slip'])}" bukan Bulanan / Mingguan / Mingguan tambahan`);
    if (!side) problems.push(`Bagian "${text(row.Bagian)}" bukan Pendapatan / Potongan / Total`);
    if (side && side !== 'TOTAL' && !label) problems.push('Komponen kosong');
    if (amount == null) problems.push(`Jumlah "${text(row.Jumlah)}" bukan rupiah bulat`);
    let start: IsoDate | null = options.periodStart;
    if (kind && kind !== 'MONTHLY') {
      start = parseDate(row.Mulai);
      if (!start) problems.push('Mulai (tanggal minggu upah) kosong atau bukan tanggal');
      else if (start < options.periodStart || start > end) problems.push(`Mulai ${start} di luar periode ${options.periodStart} s.d. ${end}`);
    } else if (kind === 'MONTHLY' && text(row.Mulai) && parseDate(row.Mulai) !== options.periodStart) {
      problems.push(`Mulai slip bulanan harus kosong atau ${options.periodStart}`);
    }
    if (code && rawName) {
      const known = names.get(code);
      if (known && known.toLowerCase() !== rawName.toLowerCase()) problems.push(`Kode ${code} sudah dipakai nama "${known}"`);
      else names.set(code, rawName);
    }
    if (problems.length) {
      errors.push(`${where} (${code || 'tanpa kode'}): ${problems.join('; ')}.`);
      return;
    }
    const key = `${code}|${kind}|${start}`;
    const slip = slips.get(key) ?? {
      legacyCode: code, name: options.renames?.[code] ?? rawName, slipKind: kind!, slipStart: start!, oldTotal: 0, components: [], totals: 0,
    };
    if (side === 'TOTAL') {
      slip.totals += 1;
      slip.oldTotal = amount!;
    } else {
      slip.components.push({ label, side: side as ComparisonComponent['side'], amount: amount! });
    }
    slips.set(key, slip);
  });
  for (const slip of slips.values()) {
    const what = `${slip.legacyCode} ${COMPARISON_KIND_LABELS[slip.slipKind]} ${slip.slipStart}`;
    if (slip.totals !== 1) errors.push(`${what}: baris Total harus tepat satu (ada ${slip.totals}).`);
    const sum = componentNet(slip.components);
    if (slip.totals === 1 && slip.components.length && sum !== slip.oldTotal) {
      warnings.push(`${what}: pendapatan − potongan = ${sum}, tetapi Total ${slip.oldTotal} (dipakai angka Total).`);
    }
  }
  if (!rows.length) errors.push('Berkas kosong.');
  return { slips: errors.length ? [] : [...slips.values()].map((s) => ({
    legacyCode: s.legacyCode, name: s.name, slipKind: s.slipKind, slipStart: s.slipStart, oldTotal: s.oldTotal, components: s.components,
  })), errors, warnings };
}

export function componentNet(components: readonly ComparisonComponent[]): number {
  return components.reduce((sum, c) => sum + (c.side === 'INCOME' ? c.amount : -c.amount), 0);
}

/** Komponen hitungan HRIS: pendapatan apa adanya, potongan sebesar yang benar-benar diambil slip (sisa dibawa tidak dihitung). */
export function computationComponents(computation: SlipComputation): ComparisonComponent[] {
  const out: ComparisonComponent[] = [];
  for (const line of computation.lines) {
    if (line.section === 'INCOME' && line.amount) out.push({ label: line.label, side: 'INCOME', amount: line.amount });
    if (line.section === 'DEDUCTION' && line.taken) out.push({ label: line.label, side: 'DEDUCTION', amount: line.taken });
  }
  return out;
}

/** Angka HRIS yang dipakai di Lembar Banding: hitungan ulang bila ada, kalau tidak hitungan pertama. */
export function latestHris(row: { firstTotal: number | null; secondTotal: number | null }, computedCount: number): number | null {
  if (computedCount >= 2) return row.secondTotal;
  if (computedCount >= 1) return row.firstTotal;
  return null;
}

export function causeProblem(cause: ComparisonCause | null, ruleRef: string | null, note: string | null): string | null {
  if (cause === 'INTENDED' && !text(ruleRef)) return 'Beda disengaja wajib menyebut nomor aturan (mis. GAJ-54).';
  if (text(ruleRef).length > 40) return 'Nomor aturan paling panjang 40 huruf.';
  if (text(note).length > 500) return 'Catatan paling panjang 500 huruf.';
  return null;
}

// ---- SQL muat / hapus (dijalankan dengan psql di staging; skrip tidak menyentuh database) ----

const literal = (value: string | number | null) => (value == null ? 'NULL' : typeof value === 'number' ? String(value) : `'${value.replace(/'/g, "''")}'`);

/**
 * Satu transaksi semua-atau-tidak-sama-sekali: ditolak bila periode itu sudah dimuat dan belum dihapus, atau nama tidak
 * ditemukan tepat satu kali di HRIS. Orang dicocokkan dengan nama (huruf besar/kecil dan spasi diabaikan).
 */
export function comparisonLoadSql(slips: readonly OldSlip[], meta: { periodStart: IsoDate; label: string; files: string[] }): string {
  const body = slips.map((slip) => `
  SELECT count(*), min(id) INTO n, emp FROM hris.employees WHERE lower(btrim(regexp_replace(name, '\\s+', ' ', 'g'))) = lower(${literal(text(slip.name))});
  IF n <> 1 THEN RAISE EXCEPTION 'Nama % (kode lama %) ditemukan % kali di HRIS; betulkan dengan --rename.', ${literal(slip.name)}, ${literal(slip.legacyCode)}, n; END IF;
  INSERT INTO hris.comparison_slips (run_id, employee_id, legacy_code, slip_kind, slip_start, old_total, old_components)
  VALUES (run, emp, ${literal(slip.legacyCode)}, ${literal(slip.slipKind)}, ${literal(slip.slipStart)}, ${slip.oldTotal}, ${literal(JSON.stringify(slip.components))}::jsonb);`).join('');
  return `\\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE run integer; emp integer; n integer;
BEGIN
  IF EXISTS (SELECT 1 FROM hris.comparison_runs WHERE period_start = ${literal(meta.periodStart)} AND status = 'LOADED') THEN
    RAISE EXCEPTION 'Uji banding periode ini sudah dimuat. Hapus dulu dengan --purge.';
  END IF;
  INSERT INTO hris.comparison_runs (period_start, label, source_files)
  VALUES (${literal(meta.periodStart)}, ${literal(meta.label)}, ${literal(JSON.stringify(meta.files))}::jsonb) RETURNING id INTO run;${body}
  RAISE NOTICE 'Dimuat % slip lama ke uji banding #%.', ${slips.length}, run;
END $$;
COMMIT;
`;
}

/**
 * Hapus data salinan (spec L9 §4 butir 7): baris operasional bertanda COMPARISON (urut terbalik), slip lama, dan tanda
 * itu sendiri. Baris uji banding tetap ada berstatus PURGED sebagai jejak.
 */
export function comparisonPurgeSql(periodStart: IsoDate): string {
  return `\\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE r record; run integer;
BEGIN
  SELECT id INTO run FROM hris.comparison_runs WHERE period_start = ${literal(periodStart)} AND status = 'LOADED';
  IF run IS NULL THEN RAISE EXCEPTION 'Tidak ada uji banding periode ini yang masih dimuat.'; END IF;
  FOR r IN SELECT table_name, row_id FROM hris.comparison_rows WHERE run_id = run ORDER BY id DESC LOOP
    EXECUTE format('DELETE FROM %I.%I WHERE id = $1', split_part(r.table_name, '.', 1), split_part(r.table_name, '.', 2)) USING r.row_id;
  END LOOP;
  DELETE FROM hris.comparison_rows WHERE run_id = run;
  DELETE FROM hris.comparison_slips WHERE run_id = run;
  UPDATE hris.comparison_runs SET status = 'PURGED', purged_at = now() WHERE id = run;
  RAISE NOTICE 'Data salinan uji banding #% dihapus.', run;
END $$;
COMMIT;
`;
}

// ---- CSV Lembar Banding ----

const csvCell = (value: string) => (/[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export type ComparisonCsvRow = {
  code: string; legacyCode: string; name: string; slipKind: ComparisonSlipKind; slipStart: IsoDate; oldTotal: number;
  firstTotal: number | null; secondTotal: number | null; hris: number | null; cause: ComparisonCause | null; ruleRef: string | null; note: string | null;
};

export function comparisonCsv(rows: readonly ComparisonCsvRow[], meta: { label: string; madeBy: string; madeAt: string }): string {
  const n = (v: number | null) => (v == null ? '' : String(v));
  const lines = [
    'sep=;',
    [`Lembar Banding ${meta.label}`, `dibuat ${meta.madeBy}`, meta.madeAt].map(csvCell).join(';'),
    ['Kode HRIS', 'Kode lama', 'Nama', 'Jenis slip', 'Mulai', 'Angka lama', 'HRIS hitungan 1', 'HRIS hitung ulang', 'Selisih (HRIS − lama)', 'Sebab', 'Nomor aturan', 'Catatan'].join(';'),
    ...rows.map((r) => [
      csvCell(r.code), csvCell(r.legacyCode), csvCell(r.name), COMPARISON_KIND_LABELS[r.slipKind], r.slipStart, String(r.oldTotal),
      n(r.firstTotal), n(r.secondTotal), r.hris == null ? '' : String(r.hris - r.oldTotal),
      r.cause ? COMPARISON_CAUSE_LABELS[r.cause] : '', csvCell(r.ruleRef ?? ''), csvCell(r.note ?? ''),
    ].join(';')),
  ];
  return `${lines.join('\r\n')}\r\n`;
}

