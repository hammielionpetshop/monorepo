/**
 * Tanggal kalender (YYYY-MM-DD) tanpa jam. Semua "hari ini" memakai jam server di WIB (PRI-01).
 */
export type IsoDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function todayWib(now: Date = new Date()): IsoDate {
  return new Date(now.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

function parts(date: IsoDate): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
}

function format(y: number, m: number, d: number): IsoDate {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Tambah bulan; bulan tanpa tanggal itu memakai tanggal terakhirnya (31 Jan + 3 bulan = 30 Apr). */
export function addMonthsClamped(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = parts(date);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return format(year, month, Math.min(d, daysInMonth(year, month)));
}

/** Riwayat pengaturan "Masa training sebelum dinilai" (urut tanggal berlaku). */
export type TrainingMonthsVersion = { from: IsoDate; months: number };

/**
 * KAR-20: Training dinilai saat genap masa training sejak tanggal bergabung. Masa training dibaca dari
 * pengaturan bertanggal (spec L2e §3.3): tanggal genapnya = hari pertama D yang memenuhi
 * D ≥ bergabung + (masa yang berlaku pada D). Mengubah masa mulai tanggal X tidak menggeser orang yang
 * sudah genap sebelum X. Versi pertama dianggap berlaku sejak dulu (isi awal).
 */
export function trainingDueOn(joinedOn: IsoDate, versions: readonly TrainingMonthsVersion[] = [{ from: '0000-01-01', months: 3 }]): IsoDate {
  const sorted = [...versions].sort((a, b) => (a.from < b.from ? -1 : 1));
  for (let i = 0; i < sorted.length; i += 1) {
    const from = i === 0 ? '0000-01-01' : sorted[i].from;
    const until = sorted[i + 1]?.from ?? null;
    const reached = addMonthsClamped(joinedOn, sorted[i].months);
    const due = reached > from ? reached : from;
    if (until === null || due < until) return due;
  }
  return addMonthsClamped(joinedOn, 3);
}

/** GAJ-04: periode gaji 26–25; promosi berlaku awal periode berikutnya. */
export function nextPayrollPeriodStart(decidedOn: IsoDate): IsoDate {
  const [y, m, d] = parts(decidedOn);
  return d < 26 ? format(y, m, 26) : addMonthsClamped(format(y, m, 26), 1);
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** "1 November 2026". */
export function formatLongDate(date: IsoDate): string {
  const [y, m, d] = parts(date);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
