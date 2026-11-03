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
  /** Kunci sumber asal sisa / pengembalian (L4e-2). */
  originKey?: string;
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
  // Koreksi Periode Lalu (L4e-2) memakai jenis asal: pengembalian telat/denda keluar dari Dana Disiplin, pengembalian
  // alpha/izin/sakit keluar dari Dana Tidak Hadir, lembur/kompensasi yang dipotong balik masuk lagi ke Dana Tidak Hadir.
  const isIn = (kinds: readonly string[]) => (l: SlipLine) => kinds.includes(l.lineKind);
  const disciplineIn = sumTaken(DISCIPLINE_IN);
  const disciplineOut = sumIncome((l) => l.details.fund === 'DISCIPLINE_FUND' || isIn(DISCIPLINE_IN)(l));
  const absenceIn = sumTaken(ABSENCE_IN) + sumTaken(ABSENCE_OUT);
  const absenceOut = sumIncome((l) => isIn(ABSENCE_OUT)(l) || isIn(ABSENCE_IN)(l));
  if (disciplineIn) out.push({ fund: 'DISCIPLINE', amount: disciplineIn, reason: `Slip ${label}: telat dan denda terpotong` });
  if (disciplineOut) out.push({ fund: 'DISCIPLINE', amount: -disciplineOut, reason: `Slip ${label}: bonus bersumber Dana Disiplin` });
  if (absenceIn) out.push({ fund: 'ABSENCE', amount: absenceIn, reason: `Slip ${label}: alpha, izin, dan sakit terpotong` });
  if (absenceOut) out.push({ fund: 'ABSENCE', amount: -absenceOut, reason: `Slip ${label}: lembur dan kompensasi libur dibayar` });
  return out;
}

export type HoldKind = 'OUTSIDE_REVIEW' | 'CLARIFICATION' | 'OVERTIME_CLAIM' | 'NO_SALARY' | 'LAST_SLIP_BONUS';
export type SlipHold = { kind: HoldKind; text: string; resolver: string; link: string; since: IsoDate | null };

export const HOLD_LABELS: Record<HoldKind, { title: string; resolver: string }> = {
  OUTSIDE_REVIEW: { title: 'Absen di luar titik belum diputus', resolver: 'HR, Pemilik, GM' },
  CLARIFICATION: { title: 'Penjelasan menunggu keputusan', resolver: 'HR, Pemilik, GM' },
  OVERTIME_CLAIM: { title: 'Klaim lembur menunggu keputusan', resolver: 'HR, Pemilik, GM' },
  NO_SALARY: { title: 'Belum ada gaji berlaku di periode ini', resolver: 'Pemilik, GM (atau usulan HR)' },
  LAST_SLIP_BONUS: { title: 'Slip terakhir: bonus masih Menunggu atau Ditahan', resolver: 'HR, Pemilik, GM' },
};

export function holdsFrom(
  facts: { outsideReviews: IsoDate[]; clarifications: IsoDate[]; overtimeClaims: IsoDate[] }, hasSalary: boolean, employeeId: number,
  lastSlipBonuses: IsoDate[] = [],
): SlipHold[] {
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
  add('LAST_SLIP_BONUS', lastSlipBonuses, `/gaji/${employeeId}/bonus`);
  return holds;
}

export { GROUP_LABELS };

// ---- L4e-2: koreksi periode lalu, slip terakhir, denda berhenti tanpa pemberitahuan (spec L4e §3.7) ----

/**
 * Jenis kehadiran yang dibandingkan Koreksi Periode Lalu (GAJ-L11). Gaji tetap (BASE) tidak ikut: perubahan gaji
 * periode tertutup ditolak (§3.6), dan BASE bergantung status kerja hari ini (Training → Karyawan) sehingga akan
 * menimbulkan selisih palsu sesudah promosi.
 */
export const CORRECTED_KINDS: readonly LineKey[] = ['LATE', 'PERMIT_SICK', 'SUDDEN', 'ALPHA', 'SICK_LETTER', 'OVERTIME', 'COMPENSATION', 'FINE'];

/** Nilai bertanda satu baris slip: pendapatan +, potongan −. */
const signed = (section: SlipSection, amount: number) => (section === 'INCOME' ? amount : section === 'DEDUCTION' ? -amount : 0);

export type StoredAttLine = { section: SlipSection; lineKind: string; amount: number };

/**
 * Selisih per jenis antara hitungan ulang periode lama dan yang tersimpan di slipnya, dikurangi koreksi yang sudah masuk
 * slip tertutup lain. Plus = pendapatan, minus = potongan kelompok (a). Jenis baris tetap jenis asalnya supaya mutasi dana ikut.
 */
export function correctionInputs(
  oldPeriod: IsoDate, recomputed: readonly PayLine[], stored: readonly StoredAttLine[], corrected: readonly StoredAttLine[], labels: Record<LineKey, string>,
  /** Gaji tetap ikut dibandingkan hanya bila paket periode itu berasal dari Pembetulan gaji periode lalu (spec L4g §3.6). */
  options: { includeBase?: boolean } = {},
): { income: IncomeInput[]; deductions: DeductionInput[] } {
  const income: IncomeInput[] = [];
  const deductions: DeductionInput[] = [];
  const kinds: readonly LineKey[] = options.includeBase ? ['BASE', ...CORRECTED_KINDS] : CORRECTED_KINDS;
  for (const kind of kinds) {
    const now = recomputed.filter((l) => l.key === kind).reduce((s, l) => s + l.sign * l.amount, 0);
    const was = stored.filter((l) => l.lineKind === kind).reduce((s, l) => s + signed(l.section, l.amount), 0);
    const done = corrected.filter((l) => l.lineKind === kind).reduce((s, l) => s + signed(l.section, l.amount), 0);
    const delta = now - was - done;
    if (!delta) continue;
    const label = `Koreksi ${labels[kind].toLowerCase()} periode ${longDate(oldPeriod)}`;
    const details: SlipLineDetails = {
      text: kind === 'BASE' ? 'Gaji tetap periode itu dibetulkan (Pembetulan gaji periode lalu).' : 'Data kehadiran periode itu berubah sesudah slipnya ditutup.',
      link: `/gaji/periode/${oldPeriod}`,
    };
    const sourceKey = `corr:${oldPeriod}:${kind}`;
    if (delta > 0) income.push({ sourceKey, lineKind: kind, label, amount: delta, originPeriod: oldPeriod, details });
    else deductions.push({ group: 'a', sourceKey, lineKind: kind, label, date: oldPeriod, amount: -delta, originPeriod: oldPeriod, details });
  }
  return { income, deductions };
}

/**
 * Berhenti tanpa pemberitahuan (GAJ-58): bersih yang tersisa menjadi baris "Denda berhenti tanpa pemberitahuan",
 * sehingga yang diterima Rp0. Bonus sudah dikeluarkan sebelum susunan dihitung (Hangus).
 */
export function applyResignFine(c: SlipComputation, periodEnd: IsoDate): SlipComputation {
  if (c.net <= 0) return c;
  const line: SlipLine = {
    section: 'DEDUCTION', group: 'a', sourceKey: 'resign_fine', lineKind: 'RESIGN_FINE', label: 'Denda berhenti tanpa pemberitahuan',
    originPeriod: null, amount: c.net, taken: c.net, remaining: 0, details: { date: periodEnd, text: 'Bersih yang tersisa tidak dibayarkan (GAJ-58).' },
  };
  return { lines: [...c.lines, line], income: c.income, taken: c.taken + c.net, net: 0, carried: c.carried };
}

/**
 * Sisa slip terakhir (GAJ-82, 89): kelompok (a) dan (d) Tidak tertagih (tidak masuk dana, tidak dibawa);
 * (b) dan (c) menjadi Piutang Lain, satu per kelompok.
 */
export function lastSlipLeftovers(lines: readonly SlipLine[]): { uncollectible: number; receivables: { group: 'b' | 'c'; amount: number }[] } {
  const left = (groups: readonly DeductionGroup[]) => lines.filter((l) => l.section === 'DEDUCTION' && l.group && groups.includes(l.group)).reduce((s, l) => s + l.remaining, 0);
  const receivables = (['b', 'c'] as const).map((group) => ({ group, amount: left([group]) })).filter((r) => r.amount > 0);
  return { uncollectible: left(['a', 'd']), receivables };
}

/** Sisa saat slip asal dibuka kembali: mutasi dana pembalik = lawan jumlah mutasi slip itu per dana (buku dana hanya tambah). */
export function reversalMovements(entries: readonly { fund: 'DISCIPLINE' | 'ABSENCE'; amount: number }[], number: string): FundMovement[] {
  const out: FundMovement[] = [];
  for (const fund of ['DISCIPLINE', 'ABSENCE'] as const) {
    const total = entries.filter((e) => e.fund === fund).reduce((s, e) => s + e.amount, 0);
    if (total) out.push({ fund, amount: -total, reason: `Slip ${number} dibuka kembali: mutasinya dibalik` });
  }
  return out;
}

/** Alasan buka kembali dan tutup lebih cepat: paling sedikit 15 huruf (GAJ-95). */
export function reasonProblem(reason: string, min = 15): string | null {
  return reason.trim().length < min ? `Alasan paling sedikit ${min} huruf.` : null;
}
