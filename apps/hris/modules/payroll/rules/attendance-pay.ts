import Big from 'big.js';
import type { IsoDate } from './salary';

/**
 * Hitungan Kehadiran (spec L4b §3.2): satu-satunya rumus rupiah dari kehadiran. Dipakai layar Hitungan, contoh
 * Aturan Potongan, dan kelak slip (4E-5a). Kehadiran memberi fakta; fungsi ini memberi rupiah.
 * Pembulatan ikut HRIS lama: rupiah tiap hari dibulatkan (,5 ke atas), lalu dijumlah per baris.
 */

export type Escalation = { start: number; step: number; max: number };
export type SickLetter = { day1: number; day2to3: number; day4plus: number };
export type ForgotKind = 'IN' | 'OUT' | 'RETURN';

export type PayRules = {
  divisor: number;
  lateRate: number;
  overtimeRate: number;
  permitSick: Escalation;
  sudden: Escalation;
  alpha: Escalation;
  sickLetter: SickLetter;
  training: number;
  compensation: number;
  fines: Record<ForgotKind, number> & { surcharge: number; dayOffMissing: number };
};

/** Mulai kejadian ke-5 kena tambahan (KEH-64; sama dengan konstanta Kehadiran). */
export const SURCHARGE_FROM = 5;

export type PayDay = {
  workDate: IsoDate;
  status: 'PRESENT' | 'CLOSED' | 'DAY_OFF' | 'PERMIT' | 'SICK' | 'LEAVE' | 'ALPHA' | 'UNDETERMINED';
  lateMinutes: number | null;
  /** Jenis hitungan pengajuan tidak masuk yang disetujui (PERMIT, PERMIT_SUDDEN, SICK, SICK_LETTER, ANNUAL_LEAVE, BEREAVEMENT). */
  absence: string | null;
  tags: string[];
};

export type PayInput = {
  monthly: number;
  period: { start: IsoDate; end: IsoDate };
  /** Hari pertama dan terakhir bekerja di periode ini (sudah dipotong ke batas periode). */
  workedFrom: IsoDate;
  workedUntil: IsoDate;
  /** Jabatan Pemilik: hanya gaji tetap (GAJ-09). */
  ownerPosition: boolean;
  training: boolean;
  compensationApplies: boolean;
  tracked: boolean;
  days: PayDay[];
  lateTolerance: (date: IsoDate) => number;
  lateExplained: ReadonlySet<IsoDate>;
  overtime: { workDate: IsoDate; hours: number }[];
  forgot: { eventId: number; kind: ForgotKind; workDate: IsoDate; nth: number }[];
  dayOffMissing: boolean;
  workRequests: { workDate: IsoDate; present: boolean }[];
  /** Kunci peniadaan berlaku: `LATE|tanggal` atau `FINE|jenis|tanggal`. */
  waived: ReadonlyMap<string, string>;
  rules: PayRules;
};

export type LineKey = 'BASE' | 'LATE' | 'PERMIT_SICK' | 'SUDDEN' | 'ALPHA' | 'SICK_LETTER' | 'OVERTIME' | 'COMPENSATION' | 'FINE';
export type FineKind = ForgotKind | 'DAY_OFF_MISSING';

export type PayDetail = {
  workDate: IsoDate;
  text: string;
  amount: number;
  /** Rupiah sebelum ditiadakan/dijelaskan/toleransi (untuk daftar Tiadakan Potongan). */
  full: number;
  /** Tanda di rincian: ditiadakan, dalam toleransi, menunggu keputusan, dan lainnya. */
  note: string | null;
  /** Untuk tombol Tiadakan: jenis + kunci kejadian. */
  waive: { kind: 'LATE' | 'FINE'; fineKind: FineKind | null } | null;
  waived: boolean;
};

export type PayLine = { key: LineKey; sign: 1 | -1; amount: number; details: PayDetail[] };

export type PayResult = {
  monthly: number;
  daily: number;
  lines: PayLine[];
  paidFull: { dayOff: number; leave: number; closed: number };
  pending: { workDate: IsoDate; text: string }[];
  additions: number;
  deductions: number;
  /** Gaji tetap (diprorata) + tambahan − potongan kehadiran. Belum termasuk potongan lain dan bonus. */
  estimate: number;
};

export const LINE_LABELS: Record<LineKey, string> = {
  BASE: 'Gaji tetap',
  LATE: 'Potongan telat',
  PERMIT_SICK: 'Izin dan sakit tanpa surat',
  SUDDEN: 'Izin mendadak',
  ALPHA: 'Alpha',
  SICK_LETTER: 'Sakit dengan surat dokter',
  OVERTIME: 'Lembur',
  COMPENSATION: 'Kompensasi libur',
  FINE: 'Denda kehadiran',
};

export const FINE_LABELS: Record<FineKind, string> = {
  IN: 'Lupa absen masuk', OUT: 'Lupa absen pulang', RETURN: 'Lupa Masuk Kembali', DAY_OFF_MISSING: 'Tidak memilih libur',
};

export const waiverKey = (kind: 'LATE' | 'FINE', workDate: IsoDate, fineKind: FineKind | null = null) =>
  kind === 'LATE' ? `LATE|${workDate}` : `FINE|${fineKind}|${workDate}`;

/** Pengali hari ke-n dari tangga: min(start + (n−1) × step, max). */
export function escalationAt(ladder: Escalation, n: number): number {
  const value = new Big(ladder.start).plus(new Big(ladder.step).times(n - 1));
  return Number((value.gt(ladder.max) ? new Big(ladder.max) : value).toFixed(2));
}

/** Deret pengali sampai mentok (tampilan, seperti `buildMultipliers` HRIS lama). */
export function escalationSeries(ladder: Escalation): number[] {
  if (!(ladder.step > 0) || ladder.start >= ladder.max) return [ladder.start];
  const out: number[] = [];
  for (let n = 1; n <= 50; n += 1) {
    const value = escalationAt(ladder, n);
    out.push(value);
    if (value >= ladder.max) break;
  }
  return out;
}

export function sickLetterAt(rule: SickLetter, n: number): number {
  return n <= 1 ? rule.day1 : n <= 3 ? rule.day2to3 : rule.day4plus;
}

/** Rupiah satu hari = gaji sebulan × pengali ÷ pembagi, dibulatkan ,5 ke atas. */
export function dayAmount(monthly: number, multiplier: number, divisor: number): number {
  if (divisor <= 0) return 0;
  return Number(new Big(monthly).times(multiplier).div(divisor).round(0, Big.roundHalfUp).toFixed(0));
}

const daysBetween = (from: IsoDate, to: IsoDate) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

/** Gaji tetap diprorata bila masuk/berhenti di tengah periode (GAJ-06), dibulatkan sekali. */
export function proratedBase(monthly: number, period: { start: IsoDate; end: IsoDate }, from: IsoDate, until: IsoDate): number {
  const total = daysBetween(period.start, period.end);
  const worked = Math.max(0, daysBetween(from, until));
  if (worked >= total) return monthly;
  return Number(new Big(monthly).times(worked).div(total).round(0, Big.roundHalfUp).toFixed(0));
}

export const multiplierLabel = (value: number) => `${String(value).replace('.', ',')}×`;
const rp = (amount: number) => `Rp${new Intl.NumberFormat('id-ID').format(amount)}`;

const ABSENCE_LINE: Record<string, LineKey | null> = {
  PERMIT: 'PERMIT_SICK', BEREAVEMENT: 'PERMIT_SICK', SICK: 'PERMIT_SICK', PERMIT_SUDDEN: 'SUDDEN', SICK_LETTER: 'SICK_LETTER', ANNUAL_LEAVE: null,
};

export function attendancePay(input: PayInput): PayResult {
  const { rules } = input;
  const monthly = input.monthly;
  const lines: PayLine[] = [];
  const base = proratedBase(monthly, input.period, input.workedFrom, input.workedUntil);
  lines.push({
    key: 'BASE', sign: 1, amount: base,
    details: base === monthly ? [] : [{
      workDate: input.workedFrom, amount: base, full: base, waive: null, waived: false, note: null,
      text: `Bekerja ${daysBetween(input.workedFrom, input.workedUntil)} dari ${daysBetween(input.period.start, input.period.end)} hari periode: ${rp(monthly)} × ${daysBetween(input.workedFrom, input.workedUntil)}/${daysBetween(input.period.start, input.period.end)}`,
    }],
  });
  const paidFull = { dayOff: 0, leave: 0, closed: 0 };
  const pending: { workDate: IsoDate; text: string }[] = [];
  const daily = rules.divisor > 0 ? monthly / rules.divisor : 0;
  const finish = (): PayResult => {
    const kept = lines.filter((line) => line.key === 'BASE' || line.details.length > 0);
    const additions = kept.filter((l) => l.sign === 1 && l.key !== 'BASE').reduce((s, l) => s + l.amount, 0);
    const deductions = kept.filter((l) => l.sign === -1).reduce((s, l) => s + l.amount, 0);
    return { monthly, daily, lines: kept, paidFull, pending, additions, deductions, estimate: base + additions - deductions };
  };
  if (input.ownerPosition || !input.tracked) return finish();

  const days = [...input.days].sort((a, b) => (a.workDate < b.workDate ? -1 : 1));
  const inRange = (date: IsoDate) => date >= input.workedFrom && date <= input.workedUntil;

  // R3 Telat (GAJ-10, 11).
  const late: PayLine = { key: 'LATE', sign: -1, amount: 0, details: [] };
  for (const day of days) {
    if (day.status !== 'PRESENT' || !day.lateMinutes || day.lateMinutes <= 0 || !inRange(day.workDate)) continue;
    const minutes = day.lateMinutes;
    const tolerance = input.lateTolerance(day.workDate);
    const full = minutes * rules.lateRate;
    const waivedReason = input.waived.get(waiverKey('LATE', day.workDate));
    let amount = full;
    let note: string | null = null;
    if (minutes <= tolerance) { amount = 0; note = 'Dalam toleransi'; }
    else if (input.lateExplained.has(day.workDate)) { amount = 0; note = 'Ditiadakan lewat penjelasan'; }
    else if (waivedReason) { amount = 0; note = `Ditiadakan: ${waivedReason}`; }
    late.details.push({
      workDate: day.workDate, amount, full, note, waived: Boolean(waivedReason),
      text: `Telat ${minutes} menit × ${rp(rules.lateRate)}`,
      waive: minutes > tolerance && !input.lateExplained.has(day.workDate) ? { kind: 'LATE', fineKind: null } : null,
    });
    late.amount += amount;
  }
  lines.push(late);

  // R4 Tidak hadir: tiga tangga terpisah + sakit dengan surat per periode (K1); Training rata (K2).
  const ladders: Record<'PERMIT_SICK' | 'SUDDEN' | 'ALPHA' | 'SICK_LETTER', PayLine> = {
    PERMIT_SICK: { key: 'PERMIT_SICK', sign: -1, amount: 0, details: [] },
    SUDDEN: { key: 'SUDDEN', sign: -1, amount: 0, details: [] },
    ALPHA: { key: 'ALPHA', sign: -1, amount: 0, details: [] },
    SICK_LETTER: { key: 'SICK_LETTER', sign: -1, amount: 0, details: [] },
  };
  const counters = { PERMIT_SICK: 0, SUDDEN: 0, ALPHA: 0, SICK_LETTER: 0 };
  for (const day of days) {
    if (!inRange(day.workDate)) continue;
    if (day.status === 'DAY_OFF') { paidFull.dayOff += 1; continue; }
    if (day.status === 'CLOSED') { paidFull.closed += 1; continue; }
    if (day.status === 'UNDETERMINED') {
      pending.push({ workDate: day.workDate, text: day.tags.includes('Pengajuan tidak masuk menunggu keputusan') ? 'Pengajuan tidak masuk menunggu keputusan' : 'Belum ditentukan' });
      continue;
    }
    let key: keyof typeof ladders | null = null;
    if (day.status === 'ALPHA') {
      if (day.tags.includes('Penjelasan menunggu keputusan')) { pending.push({ workDate: day.workDate, text: 'Alpha: penjelasan menunggu keputusan' }); continue; }
      key = 'ALPHA';
    } else if ((day.status === 'PERMIT' || day.status === 'SICK' || day.status === 'LEAVE') && day.absence) {
      const mapped = ABSENCE_LINE[day.absence];
      if (mapped === null) { paidFull.leave += 1; continue; }
      key = (mapped ?? 'PERMIT_SICK') as keyof typeof ladders;
    }
    if (!key) continue;
    counters[key] += 1;
    const n = counters[key];
    const multiplier = key === 'SICK_LETTER' ? sickLetterAt(rules.sickLetter, n)
      : input.training ? rules.training
      : escalationAt(key === 'PERMIT_SICK' ? rules.permitSick : key === 'SUDDEN' ? rules.sudden : rules.alpha, n);
    const amount = dayAmount(monthly, multiplier, rules.divisor);
    const what = day.absence === 'BEREAVEMENT' ? 'izin duka' : day.absence === 'SICK' ? 'sakit tanpa surat' : day.absence === 'PERMIT' ? 'izin' : '';
    ladders[key].details.push({
      workDate: day.workDate, amount, full: amount, waived: false, waive: null,
      note: input.training && key !== 'SICK_LETTER' ? 'Training: tidak naik' : null,
      text: `Hari ke-${n}${what ? ` (${what})` : ''}, pengali ${multiplierLabel(multiplier)}`,
    });
    ladders[key].amount += amount;
  }
  lines.push(ladders.PERMIT_SICK, ladders.SUDDEN, ladders.ALPHA, ladders.SICK_LETTER);

  // R6 Lembur (jam disahkan × tarif, GAJ-12).
  const overtime: PayLine = { key: 'OVERTIME', sign: 1, amount: 0, details: [] };
  for (const row of input.overtime) {
    if (!inRange(row.workDate) || row.hours <= 0) continue;
    const amount = row.hours * rules.overtimeRate;
    overtime.details.push({ workDate: row.workDate, amount, full: amount, waived: false, waive: null, note: null, text: `${row.hours} jam disahkan × ${rp(rules.overtimeRate)}` });
    overtime.amount += amount;
  }
  lines.push(overtime);

  // R7 Kompensasi libur (GAJ-15): diminta masuk dan benar-benar masuk.
  const compensation: PayLine = { key: 'COMPENSATION', sign: 1, amount: 0, details: [] };
  if (input.compensationApplies) {
    for (const row of input.workRequests) {
      if (!row.present || !inRange(row.workDate)) continue;
      const amount = dayAmount(monthly, rules.compensation, rules.divisor);
      compensation.details.push({ workDate: row.workDate, amount, full: amount, waived: false, waive: null, note: null, text: `Diminta masuk di hari libur, ${multiplierLabel(rules.compensation)} gaji harian` });
      compensation.amount += amount;
    }
  }
  lines.push(compensation);

  // R8 Denda kehadiran (GAJ-16, KEH-64, 135).
  const fine: PayLine = { key: 'FINE', sign: -1, amount: 0, details: [] };
  for (const row of [...input.forgot].sort((a, b) => (a.workDate === b.workDate ? a.eventId - b.eventId : a.workDate < b.workDate ? -1 : 1))) {
    if (!inRange(row.workDate)) continue;
    const surcharge = row.nth >= SURCHARGE_FROM ? rules.fines.surcharge : 0;
    const full = rules.fines[row.kind] + surcharge;
    const reason = input.waived.get(waiverKey('FINE', row.workDate, row.kind));
    fine.details.push({
      workDate: row.workDate, amount: reason ? 0 : full, full, waived: Boolean(reason), note: reason ? `Ditiadakan: ${reason}` : null,
      text: `${FINE_LABELS[row.kind]} (kejadian ke-${row.nth}${surcharge ? ', kena tambahan' : ''})`,
      waive: { kind: 'FINE', fineKind: row.kind },
    });
    fine.amount += reason ? 0 : full;
  }
  if (input.dayOffMissing) {
    const reason = input.waived.get(waiverKey('FINE', input.period.start, 'DAY_OFF_MISSING'));
    const amount = reason ? 0 : rules.fines.dayOffMissing;
    fine.details.push({
      workDate: input.period.start, amount, full: rules.fines.dayOffMissing, waived: Boolean(reason), note: reason ? `Ditiadakan: ${reason}` : null,
      text: FINE_LABELS.DAY_OFF_MISSING, waive: { kind: 'FINE', fineKind: 'DAY_OFF_MISSING' },
    });
    fine.amount += amount;
  }
  lines.push(fine);
  return finish();
}
