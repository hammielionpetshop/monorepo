/** Aturan murni Libur dan Tukar (spec L3e §3). Tanggal = YYYY-MM-DD WIB. Server memeriksa; layar hanya menampilkan. */
import { payPeriodOf, shiftPeriod } from './review';
import { addDays, type IsoDate } from './schedule';

/**
 * Tanda tidak memilih libur baru dicatat mulai periode ini (keputusan owner spec L3e §9 butir 2):
 * jendela periode yang berjalan saat fitur tayang sudah tutup sebelum fiturnya ada.
 */
export const DAY_OFF_MARKS_FROM: IsoDate = '2026-11-26';

export type DayOffRules = {
  quota: number;
  maxPerBranch: number;
  weekendMax: number;
  minGapDays: number;
  windowOpenDay: number;
  windowCloseDay: number;
  lateMinDays: number;
};

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function periodRange(start: IsoDate): { start: IsoDate; end: IsoDate } {
  return { start, end: addDays(shiftPeriod(start, 1), -1) };
}

export function periodDates(start: IsoDate): IsoDate[] {
  const { end } = periodRange(start);
  const dates: IsoDate[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  return dates;
}

export function periodStartOf(date: IsoDate): IsoDate {
  return payPeriodOf(date).start;
}

export function isWeekend(date: IsoDate): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function dayOfMonth(month: IsoDate, day: number): IsoDate {
  return `${month.slice(0, 8)}${String(day).padStart(2, '0')}`;
}

/** Jendela periode yang mulai tanggal 26 bulan M: dibuka tanggal `open` dan ditutup tanggal `close` pukul 23.59 bulan M (KEH-132). */
export function windowOf(periodStart: IsoDate, rules: Pick<DayOffRules, 'windowOpenDay' | 'windowCloseDay'>) {
  return { opens: dayOfMonth(periodStart, rules.windowOpenDay), closes: dayOfMonth(periodStart, rules.windowCloseDay) };
}

export type WindowPhase = 'BEFORE' | 'OPEN' | 'LATE' | 'OVER';

/** BEFORE = belum dibuka; OPEN = jendela biasa; LATE = sesudah tutup, periode belum habis (KEH-135); OVER = periode lewat. */
export function windowPhase(periodStart: IsoDate, today: IsoDate, rules: Pick<DayOffRules, 'windowOpenDay' | 'windowCloseDay'>): WindowPhase {
  const { opens, closes } = windowOf(periodStart, rules);
  if (today < opens) return 'BEFORE';
  if (today <= closes) return 'OPEN';
  return today <= periodRange(periodStart).end ? 'LATE' : 'OVER';
}

/** Jatah sebanding orang yang masuk di tengah periode (GAJ-06): dibulatkan ke hari terdekat. */
export function proratedQuota(quota: number, periodStart: IsoDate, joinedOn: IsoDate | null): number {
  const { end } = periodRange(periodStart);
  if (!joinedOn || joinedOn <= periodStart) return quota;
  if (joinedOn > end) return 0;
  const total = daysBetween(periodStart, end) + 1;
  const worked = daysBetween(joinedOn, end) + 1;
  return Math.round((quota * worked) / total);
}

/** Batas orang libur bersamaan (KEH-34): cabang 2 orang = 1, cabang 1 orang tetap boleh libur. */
export function branchCap(maxPerBranch: number, headcount: number): number {
  return Math.min(maxPerBranch, Math.max(1, headcount - 1));
}

export type DateBlock = 'PAST' | 'TOO_SOON' | 'CLOSED' | 'MINE' | 'FULL' | 'TOO_CLOSE' | 'WEEKEND_USED' | 'OUTSIDE';

export const DATE_BLOCK_LABELS: Record<DateBlock, string> = {
  PAST: 'Sudah lewat',
  TOO_SOON: 'Terlalu dekat dari hari ini',
  CLOSED: 'Hari tutup',
  MINE: 'Sudah libur',
  FULL: 'Penuh',
  TOO_CLOSE: 'Terlalu dekat dengan libur lain',
  WEEKEND_USED: 'Jatah akhir pekan terpakai',
  OUTSIDE: 'Di luar periode',
};

export type PickContext = {
  periodStart: IsoDate;
  today: IsoDate;
  /** Hari paling awal yang boleh dipilih (hari ini, atau hari ini + batas terlambat). */
  earliest: IsoDate;
  /** Libur berlaku orang itu yang bukan pengganti, termasuk di periode tetangga (KEH-134). */
  otherDates: readonly IsoDate[];
  /** Tanggal libur pengganti orang itu (tidak ikut jarak dan akhir pekan, tetapi tanggalnya sudah terpakai). */
  replacementDates?: readonly IsoDate[];
  closedDates: ReadonlySet<IsoDate>;
  /** Orang lain di cabangnya yang libur per tanggal. */
  takenByOthers: ReadonlyMap<IsoDate, number>;
  /** Batas KEH-34 per tanggal (jumlah orang cabang bisa berbeda per tanggal); tanpa isi = 1. */
  caps: ReadonlyMap<IsoDate, number>;
  rules: Pick<DayOffRules, 'weekendMax' | 'minGapDays'>;
};

/** Alasan satu tanggal tidak bisa ditambahkan ke libur biasa orang itu, atau null bila boleh (KEH-34, 35, 134). */
export function dateBlock(date: IsoDate, context: PickContext): DateBlock | null {
  const { start, end } = periodRange(context.periodStart);
  if (date < start || date > end) return 'OUTSIDE';
  if (context.otherDates.includes(date) || context.replacementDates?.includes(date)) return 'MINE';
  if (date < context.today) return 'PAST';
  if (date < context.earliest) return 'TOO_SOON';
  if (context.closedDates.has(date)) return 'CLOSED';
  if ((context.takenByOthers.get(date) ?? 0) >= (context.caps.get(date) ?? 1)) return 'FULL';
  if (context.otherDates.some((other) => Math.abs(daysBetween(other, date)) < context.rules.minGapDays)) return 'TOO_CLOSE';
  if (isWeekend(date)) {
    const weekendCount = context.otherDates.filter((other) => other >= start && other <= end && isWeekend(other)).length;
    if (weekendCount >= context.rules.weekendMax) return 'WEEKEND_USED';
  }
  return null;
}

/**
 * Menambahkan tanggal satu per satu sesuai urutan; tanggal yang tertolak dilewati dan disebut alasannya,
 * tanggal lain tetap diterima (spec L3e §3 "simpan sebagian").
 */
export function acceptDates(candidates: readonly IsoDate[], context: PickContext, room: number) {
  const accepted: IsoDate[] = [];
  const rejected: { date: IsoDate; block: DateBlock | 'QUOTA' }[] = [];
  let others = [...context.otherDates];
  for (const date of [...new Set(candidates)].sort()) {
    if (accepted.length >= room) {
      rejected.push({ date, block: 'QUOTA' });
      continue;
    }
    const block = dateBlock(date, { ...context, otherDates: others });
    if (block) rejected.push({ date, block });
    else {
      accepted.push(date);
      others = [...others, date];
    }
  }
  return { accepted, rejected };
}

/** Batas jawab ajakan tukar: H-n dari tanggal yang lebih dekat, sampai pukul 23.59 (KEH-44, W32). */
export function swapAnswerBy(fromDate: IsoDate, toDate: IsoDate, deadlineDays: number): IsoDate {
  return addDays(fromDate < toDate ? fromDate : toDate, -deadlineDays);
}

/** Batas pilih libur pengganti (KEH-138, W33). */
export function replacementChooseBy(workDate: IsoDate, days: number): IsoDate {
  return addDays(workDate, days);
}

/** Orang baru yang mulai sesudah jendela periodenya tutup: tanpa tanda selama masa awalnya (KEH-140). */
export function newcomerGraceEnds(periodStart: IsoDate, joinedOn: IsoDate | null, graceDays: number, closes: IsoDate): IsoDate | null {
  if (!joinedOn || joinedOn <= closes) return null;
  if (joinedOn > periodRange(periodStart).end) return null;
  return addDays(joinedOn, Math.max(graceDays, 1) - 1);
}

/**
 * Saat jatah dinilai untuk tanda tidak memilih (KEH-135): akhir tanggal tutup jendela,
 * atau akhir masa awal orang baru (KEH-140). Tanda hanya bila hari ini sudah melewatinya.
 */
export function markDueAfter(periodStart: IsoDate, joinedOn: IsoDate | null, graceDays: number, closes: IsoDate): IsoDate {
  return newcomerGraceEnds(periodStart, joinedOn, graceDays, closes) ?? closes;
}

export const SWAP_STATUS_LABELS = {
  PENDING: 'Menunggu', ACCEPTED: 'Diterima', REJECTED: 'Ditolak', EXPIRED: 'Batal otomatis', CANCELLED: 'Dibatalkan',
} as const;

export const WORK_REQUEST_STATUS_LABELS = { REQUESTED: 'Diminta', READY: 'Siap masuk', CANCELLED: 'Dibatalkan' } as const;

export const REPLACEMENT_STATUS_LABELS = { WAITING: 'Menunggu dipilih', CHOSEN: 'Dipilih', EXPIRED: 'Hangus' } as const;

export const ORIGIN_LABELS = {
  PICK: 'Dipilih sendiri', LATE: 'Dipilih terlambat', SWAP: 'Hasil tukar', DIRECT: 'Diubah kantor', REPLACEMENT: 'Libur pengganti',
} as const;
