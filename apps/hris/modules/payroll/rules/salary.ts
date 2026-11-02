// Uang = rupiah bulat (integer). L4a hanya menjumlah bilangan bulat (pasti tepat); gaji harian hanya keterangan.
// Hitungan slip berpecahan (L4b) memakai big.js.

/** Tanggal ISO `YYYY-MM-DD` (WIB). */
export type IsoDate = string;

export type SalaryLine = { componentTypeId: number; amount: number };

/** Satu paket gaji bertanggal (spec L4a §2). */
export type SalaryPackage = {
  id: number;
  effectiveFrom: IsoDate;
  cancelled: boolean;
  lines: SalaryLine[];
};

/** Periode gaji tampil sampai sekian periode depan (spec L4a §9 butir 6). */
export const FUTURE_PERIODS = 3;
/** Usulan hangus hari ke-4 sesudah periode berakhir (perkiraan batas tutup slip, GAJ-41; spec L4a §9 butir 7). */
export const PROPOSAL_GRACE_DAYS = 4;

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function longDate(date: IsoDate): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function rupiah(amount: number): string {
  return `Rp${new Intl.NumberFormat('id-ID').format(amount)}`;
}

/** Gaji tetap sebulan = jumlah semua komponen (GAJ-65). */
export function monthlyTotal(lines: readonly SalaryLine[]): number {
  return lines.reduce((sum, line) => sum + line.amount, 0);
}

/** Gaji harian = gaji tetap ÷ pembagi (GAJ-05), tidak dibulatkan (GAJ-07). */
export function dailyRate(lines: readonly SalaryLine[], divisor: number): number {
  if (divisor <= 0) return 0;
  return monthlyTotal(lines) / divisor;
}

/** Gaji harian sebagai keterangan, dua angka di belakang koma. */
export function dailyRateLabel(lines: readonly SalaryLine[], divisor: number): string {
  return `Rp${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(dailyRate(lines, divisor))}`;
}

/** Awal periode gaji (tanggal 26) yang memuat `date` (GAJ-01). */
export function periodStartOf(date: IsoDate): IsoDate {
  const [y, m, d] = date.split('-').map(Number);
  const start = new Date(Date.UTC(y, d >= 26 ? m - 1 : m - 2, 26));
  return start.toISOString().slice(0, 10);
}

export function addPeriods(start: IsoDate, count: number): IsoDate {
  const [y, m] = start.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + count, 26)).toISOString().slice(0, 10);
}

/** Akhir periode (tanggal 25) dari awal periode. */
export function periodEndOf(start: IsoDate): IsoDate {
  const [y, m] = start.split('-').map(Number);
  return new Date(Date.UTC(y, m, 25)).toISOString().slice(0, 10);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Nama periode menurut bulan akhirnya (GAJ-01): "November 2026". */
export function periodName(start: IsoDate): string {
  const [y, m] = periodEndOf(start).split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function isPeriodStart(date: unknown): date is IsoDate {
  return typeof date === 'string' && /^\d{4}-\d{2}-26$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`));
}

/** Pilihan tanggal berlaku: periode berjalan + 3 periode depan (GAJ-04, spec L4a §3.3). */
export function effectiveChoices(today: IsoDate): IsoDate[] {
  const current = periodStartOf(today);
  return Array.from({ length: FUTURE_PERIODS + 1 }, (_, i) => addPeriods(current, i));
}

/** Paket yang berlaku pada tanggal X: tidak dibatalkan, `effectiveFrom` terbesar ≤ X. */
export function packageOn<T extends Pick<SalaryPackage, 'effectiveFrom' | 'cancelled'>>(packages: readonly T[], date: IsoDate): T | null {
  let found: T | null = null;
  for (const pkg of packages) {
    if (pkg.cancelled || pkg.effectiveFrom > date) continue;
    if (!found || pkg.effectiveFrom > found.effectiveFrom) found = pkg;
  }
  return found;
}

/** Paket terjadwal sesudah tanggal X (belum berlaku), terdekat lebih dulu. */
export function scheduledAfter<T extends Pick<SalaryPackage, 'effectiveFrom' | 'cancelled'>>(packages: readonly T[], date: IsoDate): T[] {
  return packages.filter((p) => !p.cancelled && p.effectiveFrom > date).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
}

function sameLines(a: readonly SalaryLine[], b: readonly SalaryLine[]): boolean {
  if (a.length !== b.length) return false;
  const map = new Map(a.map((l) => [l.componentTypeId, l.amount]));
  return b.every((l) => map.get(l.componentTypeId) === l.amount);
}

export type ChangeKind = 'FIRST' | 'RAISE' | 'CUT' | 'RESHAPE' | 'SAME';

/** Kenaikan, penurunan, atau pengisian pertama (GAJ-63). Sama jumlah beda isi = RESHAPE (diperlakukan seperti kenaikan). */
export function classifyChange(before: readonly SalaryLine[] | null, after: readonly SalaryLine[]): ChangeKind {
  if (!before || before.length === 0) return 'FIRST';
  if (sameLines(before, after)) return 'SAME';
  const diff = monthlyTotal(after) - monthlyTotal(before);
  if (diff > 0) return 'RAISE';
  if (diff < 0) return 'CUT';
  return 'RESHAPE';
}

/** Sebab tanggal berlaku ditolak, atau null bila boleh (spec L4a §3.3). */
export function effectiveDateProblem(effectiveFrom: unknown, today: IsoDate, kind: ChangeKind): string | null {
  if (!isPeriodStart(effectiveFrom)) return 'Perubahan gaji hanya bisa mulai tanggal 26 (awal periode).';
  const choices = effectiveChoices(today);
  if (effectiveFrom < choices[0]) return 'Periode itu sudah lewat. Pilih periode berjalan atau periode depan.';
  if (effectiveFrom > choices[choices.length - 1]) return `Paling jauh ${FUTURE_PERIODS} periode ke depan.`;
  if (kind === 'CUT' && effectiveFrom === choices[0]) return 'Penurunan gaji hanya bisa mulai periode depan.';
  if (kind === 'SAME') return 'Isinya sama dengan gaji yang berlaku di tanggal itu; tidak ada yang berubah.';
  return null;
}

/** Sebab isi paket ditolak, atau null bila boleh. */
export function linesProblem(lines: unknown, activeTypeIds: ReadonlySet<number>): string | null {
  if (!Array.isArray(lines) || lines.length === 0) return 'Isi paling sedikit satu komponen gaji.';
  const seen = new Set<number>();
  for (const line of lines) {
    const id = Number((line as SalaryLine)?.componentTypeId);
    const amount = (line as SalaryLine)?.amount;
    if (!Number.isInteger(id) || !activeTypeIds.has(id)) return 'Ada jenis komponen yang tidak dikenal atau sudah nonaktif.';
    if (seen.has(id)) return 'Satu jenis komponen hanya boleh satu baris.';
    seen.add(id);
    if (typeof amount !== 'number' || !Number.isInteger(amount)) return 'Nominal harus rupiah bulat.';
    if (amount <= 0) return 'Nominal harus lebih dari 0. Komponen yang tidak dipakai dihentikan saja.';
    if (amount > 1_000_000_000) return 'Nominal terlalu besar.';
  }
  return null;
}

export function cleanLines(lines: readonly SalaryLine[]): SalaryLine[] {
  return lines.map((l) => ({ componentTypeId: Number(l.componentTypeId), amount: Number(l.amount) }))
    .sort((a, b) => a.componentTypeId - b.componentTypeId);
}

/** Batas usulan HR: hari ke-4 sesudah periode berakhir (spec L4a §3.4). Hangus bila hari ini sudah lewat batas. */
export function proposalDeadline(effectiveFrom: IsoDate): IsoDate {
  return addDays(periodEndOf(effectiveFrom), PROPOSAL_GRACE_DAYS);
}

/** Promosi Training: komponen di paket Karyawan diganti nominal paket; komponen lain dibawa (GAJ-64). */
export function promotionLines(current: readonly SalaryLine[], standard: readonly SalaryLine[]): SalaryLine[] {
  const merged = new Map(current.map((l) => [l.componentTypeId, l.amount]));
  for (const line of standard) merged.set(line.componentTypeId, line.amount);
  return cleanLines([...merged].map(([componentTypeId, amount]) => ({ componentTypeId, amount })));
}
