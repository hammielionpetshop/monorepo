// Aturan murni L4e-1: susunan slip, nomor, jendela tutup, dan mutasi dana dari slip (spec L4e §3).
import type { LineKey, PayDetail, PayLine } from './attendance-pay';
import { GROUP_LABELS, objectionDeadline, takeDeductions, type DeductionGroup } from './deductions';
import { ABSENCE_IN, ABSENCE_OUT, DISCIPLINE_IN } from './funds';
import { addPeriods, longDate, type IsoDate } from './salary';

export type SlipStatus = 'ESTIMATE' | 'CLOSED';
export const SLIP_STATUS_LABELS: Record<SlipStatus, string> = { ESTIMATE: 'Perkiraan', CLOSED: 'Ditutup' };

/** Slip pertama di HRIS (spec L4e §9 butir 7). Periode sebelumnya sudah dibayar di HRIS lama. Ganti sebelum produksi. */
export const PAYSLIP_FROM: IsoDate = '2026-10-26';

export type SlipSection = 'INCOME' | 'DEDUCTION' | 'NOTE';

export type SlipLine = {
  section: SlipSection;
  group: DeductionGroup | null;
  sourceKey: string;
  /** Jenis baris asal (BASE, LATE, ALPHA, GROOMING, TYPED, loss, pos, …): dasar mutasi dana dan sisa potongan. */
  lineKind: string;
  label: string;
  originPeriod: IsoDate | null;
  amount: number;
  taken: number;
  remaining: number;
  details: SlipLineDetails;
};

export type SlipLineDetails = {
  /** Rincian per hari dari Hitungan Kehadiran. */
  days?: Pick<PayDetail, 'workDate' | 'text' | 'amount' | 'note'>[];
  /** Kalimat rincian bebas (bonus, kehilangan, minus kas, cicilan, sisa). */
  text?: string;
  /** Tanggal kejadian (potongan) untuk urutan pengambilan. */
  date?: IsoDate;
  /** Bonus bersumber Dana Disiplin (keluar dari dana saat slip ditutup). */
  fund?: 'DISCIPLINE_FUND';
  /** Tautan ke catatan asal. */
  link?: string;
  /** Baris Buku Bonus yang masuk slip (menjadi Masuk slip saat ditutup). */
  bonusIds?: number[];
  /** Sisa potongan yang diambil (id `deduction_carryovers`). */
  carryId?: number;
};

export type IncomeInput = { sourceKey: string; lineKind: string; label: string; amount: number; originPeriod: IsoDate | null; details: SlipLineDetails };
export type DeductionInput = {
  group: DeductionGroup; sourceKey: string; lineKind: string; label: string; date: IsoDate; amount: number; originPeriod: IsoDate | null;
  carried?: boolean; details: SlipLineDetails;
};

export type SlipComputation = { lines: SlipLine[]; income: number; taken: number; net: number; carried: number };

/** Baris kehadiran: tambah → pendapatan; kurang → kelompok (a). */
export function attendanceInputs(lines: readonly PayLine[], periodStart: IsoDate, labels: Record<LineKey, string>): { income: IncomeInput[]; deductions: DeductionInput[] } {
  const days = (l: PayLine) => l.details.map((d) => ({ workDate: d.workDate, text: d.text, amount: d.amount, note: d.note }));
  const income: IncomeInput[] = [];
  const deductions: DeductionInput[] = [];
  for (const line of lines) {
    if (line.amount <= 0) continue;
    if (line.sign === 1) income.push({ sourceKey: `att:${line.key}`, lineKind: line.key, label: labels[line.key], amount: line.amount, originPeriod: null, details: { days: days(line) } });
    else deductions.push({ group: 'a', sourceKey: `att:${line.key}`, lineKind: line.key, label: labels[line.key], date: periodStart, amount: line.amount, originPeriod: null, details: { days: days(line) } });
  }
  return { income, deductions };
}

/**
 * Susunan satu slip (GAJ-54, 75): pendapatan, potongan menurut urutan (a)→(d) dengan sisa dari slip sebelumnya lebih dulu,
 * dan bersih yang tidak pernah minus. Jumlah baris selalu sama dengan bersih.
 */
export function buildSlip(income: readonly IncomeInput[], deductions: readonly DeductionInput[]): SlipComputation {
  const incomeTotal = income.reduce((s, i) => s + i.amount, 0);
  const byKey = new Map(deductions.map((d) => [d.sourceKey, d]));
  const taken = takeDeductions(incomeTotal, deductions.map((d) => ({ group: d.group, key: d.sourceKey, label: d.label, date: d.date, amount: d.amount, carried: d.carried })));
  const lines: SlipLine[] = [
    ...income.map((i) => ({ section: 'INCOME' as const, group: null, sourceKey: i.sourceKey, lineKind: i.lineKind, label: i.label, originPeriod: i.originPeriod, amount: i.amount, taken: 0, remaining: 0, details: i.details })),
    ...taken.items.map((t) => {
      const d = byKey.get(t.key)!;
      return { section: 'DEDUCTION' as const, group: d.group, sourceKey: d.sourceKey, lineKind: d.lineKind, label: d.label, originPeriod: d.originPeriod, amount: t.amount, taken: t.taken, remaining: t.left, details: { ...d.details, date: d.date } };
    }),
  ];
  const takenTotal = taken.items.reduce((s, t) => s + t.taken, 0);
  return { lines, income: incomeTotal, taken: takenTotal, net: incomeTotal - takenTotal, carried: taken.carried };
}

/** Nomor slip bulanan `SB-[tahun][bulan akhir periode]-[urut 4 angka]` (GAJ-97). */
export function slipNumber(periodStart: IsoDate, sequence: number): string {
  const end = addPeriods(periodStart, 1);
  const [y, m] = end.split('-');
  return `SB-${y}${m}-${String(sequence).padStart(4, '0')}`;
}

/** Akhir masa keberatan: 23.59 WIB hari ke-3 sesudah ditutup (GAJ-42). */
export const objectionUntil = objectionDeadline;

/** Saat tombol Tutup aktif: pukul 00.00 WIB tanggal `openDay` di bulan akhir periode (GAJ-92). */
export function closeOpensAt(periodStart: IsoDate, openDay: number): Date {
  const end = addPeriods(periodStart, 1);
  const [y, m] = end.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, openDay, 0, 0, 0) - 7 * 3_600_000);
}

/** Jendela tutup terbuka? Mode uji staging membuka periode berjalan dan periode yang belum sampai tanggalnya (spec L4e §3.4). */
export function closeWindowOpen(periodStart: IsoDate, openDay: number, now: Date, testMode: boolean): boolean {
  if (testMode) return true;
  return now.getTime() >= closeOpensAt(periodStart, openDay).getTime();
}

export type FundMovement = { fund: 'DISCIPLINE' | 'ABSENCE'; amount: number; reason: string };

/**
 * Mutasi dua dana dari baris slip tertutup (GAJ-87, 88), sebesar yang benar-benar terpotong atau dibayar:
 * Dana Disiplin masuk telat + denda, keluar bonus bersumber dana; Dana Tidak Hadir masuk alpha/izin/sakit, keluar lembur + kompensasi.
 */
export function fundMovements(lines: readonly SlipLine[], label: string): FundMovement[] {
  const sumTaken = (kinds: readonly string[]) => lines.filter((l) => l.section === 'DEDUCTION' && kinds.includes(l.lineKind)).reduce((s, l) => s + l.taken, 0);
  const sumIncome = (pred: (l: SlipLine) => boolean) => lines.filter((l) => l.section === 'INCOME' && pred(l)).reduce((s, l) => s + l.amount, 0);
  const out: FundMovement[] = [];
  const disciplineIn = sumTaken(DISCIPLINE_IN);
  const disciplineOut = sumIncome((l) => l.details.fund === 'DISCIPLINE_FUND');
  const absenceIn = sumTaken(ABSENCE_IN);
  const absenceOut = sumIncome((l) => (ABSENCE_OUT as readonly string[]).includes(l.lineKind));
  if (disciplineIn) out.push({ fund: 'DISCIPLINE', amount: disciplineIn, reason: `Slip ${label}: telat dan denda terpotong` });
  if (disciplineOut) out.push({ fund: 'DISCIPLINE', amount: -disciplineOut, reason: `Slip ${label}: bonus bersumber Dana Disiplin` });
  if (absenceIn) out.push({ fund: 'ABSENCE', amount: absenceIn, reason: `Slip ${label}: alpha, izin, dan sakit terpotong` });
  if (absenceOut) out.push({ fund: 'ABSENCE', amount: -absenceOut, reason: `Slip ${label}: lembur dan kompensasi libur dibayar` });
  return out;
}

export type HoldKind = 'OUTSIDE_REVIEW' | 'CLARIFICATION' | 'OVERTIME_CLAIM' | 'NO_SALARY';
export type SlipHold = { kind: HoldKind; text: string; resolver: string; link: string; since: IsoDate | null };

export const HOLD_LABELS: Record<HoldKind, { title: string; resolver: string }> = {
  OUTSIDE_REVIEW: { title: 'Absen di luar titik belum diputus', resolver: 'HR, Pemilik, GM' },
  CLARIFICATION: { title: 'Penjelasan menunggu keputusan', resolver: 'HR, Pemilik, GM' },
  OVERTIME_CLAIM: { title: 'Klaim lembur menunggu keputusan', resolver: 'HR, Pemilik, GM' },
  NO_SALARY: { title: 'Belum ada gaji berlaku di periode ini', resolver: 'Pemilik, GM (atau usulan HR)' },
};

export function holdsFrom(facts: { outsideReviews: IsoDate[]; clarifications: IsoDate[]; overtimeClaims: IsoDate[] }, hasSalary: boolean, employeeId: number): SlipHold[] {
  const oldest = (dates: IsoDate[]) => [...dates].sort()[0] ?? null;
  const holds: SlipHold[] = [];
  const add = (kind: HoldKind, dates: IsoDate[], link: string) => {
    if (!dates.length) return;
    holds.push({ kind, text: `${HOLD_LABELS[kind].title} (${dates.length}, sejak ${longDate(oldest(dates)!)})`, resolver: HOLD_LABELS[kind].resolver, link, since: oldest(dates) });
  };
  add('OUTSIDE_REVIEW', facts.outsideReviews, '/kehadiran/tinjau');
  add('CLARIFICATION', facts.clarifications, '/kehadiran/perlu-dijelaskan');
  add('OVERTIME_CLAIM', facts.overtimeClaims, '/kehadiran/lembur');
  if (!hasSalary) holds.push({ kind: 'NO_SALARY', text: HOLD_LABELS.NO_SALARY.title, resolver: HOLD_LABELS.NO_SALARY.resolver, link: `/gaji/${employeeId}`, since: null });
  return holds;
}

export { GROUP_LABELS };
