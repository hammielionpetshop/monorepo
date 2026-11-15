// Aturan murni Izin, Sakit, dan Cuti (spec L3f §3). Tanpa DB; server memanggilnya, layar hanya menampilkan hasilnya.
import { daysBetween } from './days-off';
import { addDays, type IsoDate } from './schedule';

export const ABSENCE_KINDS = ['PERMIT', 'SICK', 'SICK_LETTER', 'ANNUAL_LEAVE', 'BEREAVEMENT'] as const;
export type AbsenceKind = (typeof ABSENCE_KINDS)[number];

export type AbsenceCount = 'PERMIT' | 'PERMIT_SUDDEN' | 'SICK' | 'SICK_LETTER' | 'ANNUAL_LEAVE' | 'BEREAVEMENT';

export const ABSENCE_KIND_LABELS: Record<AbsenceKind, string> = {
  PERMIT: 'Izin keperluan',
  SICK: 'Sakit tanpa surat',
  SICK_LETTER: 'Sakit dengan surat dokter',
  ANNUAL_LEAVE: 'Cuti tahunan',
  BEREAVEMENT: 'Izin duka',
};

export const ABSENCE_COUNT_LABELS: Record<AbsenceCount, string> = {
  PERMIT: 'Izin',
  PERMIT_SUDDEN: 'Izin mendadak',
  SICK: 'Sakit tanpa surat',
  SICK_LETTER: 'Sakit dengan surat',
  ANNUAL_LEAVE: 'Cuti',
  BEREAVEMENT: 'Izin duka',
};

// Hubungan yang berhak izin duka (KEH-49); keluarga lain memakai izin keperluan.
export const BEREAVEMENT_RELATIONS = ['AYAH', 'IBU', 'SUAMI', 'ISTRI', 'ANAK'] as const;
export type BereavementRelation = (typeof BEREAVEMENT_RELATIONS)[number];
export const RELATION_LABELS: Record<BereavementRelation, string> = {
  AYAH: 'Ayah', IBU: 'Ibu', SUAMI: 'Suami', ISTRI: 'Istri', ANAK: 'Anak',
};

/** Rentang terpanjang satu pengajuan (hari kalender), supaya salah ketik tanggal tidak memesan sebulan penuh. */
export const MAX_RANGE_DAYS = 31;

export type AbsenceRules = {
  annualQuota: number;
  annualNoticeDays: number;
  permitNoticeDays: number;
  lateSubmitDays: number;
  sickNoLetterMaxDays: number;
  bereavementDays: number;
  letterGraceDays: number;
};

export function isAbsenceKind(value: unknown): value is AbsenceKind {
  return typeof value === 'string' && (ABSENCE_KINDS as readonly string[]).includes(value);
}

export function isRelation(value: unknown): value is BereavementRelation {
  return typeof value === 'string' && (BEREAVEMENT_RELATIONS as readonly string[]).includes(value);
}

export function datesBetween(start: IsoDate, end: IsoDate): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  return dates;
}

/** Hari kerja orang itu dalam rentang: tanggal dikurangi libur berlaku dan Hari tutup (KEH-41). */
export function workdaysIn(start: IsoDate, end: IsoDate, isOff: (date: IsoDate) => boolean): IsoDate[] {
  return datesBetween(start, end).filter((date) => !isOff(date));
}

/** Satu kalimat batas waktu di bawah tombol jenis (KEH-141). */
export function deadlineLabel(kind: AbsenceKind, rules: AbsenceRules): string {
  switch (kind) {
    case 'PERMIT':
      return `Paling lambat H-${rules.permitNoticeDays}. Kurang dari itu dicatat izin mendadak (sampai ${rules.lateSubmitDays} hari sesudah hari pertama).`;
    case 'ANNUAL_LEAVE':
      return `Paling lambat H-${rules.annualNoticeDays}. Sisa cuti langsung terpesan.`;
    case 'SICK':
      return `Paling lama ${rules.sickNoLetterMaxDays} hari kerja. Diajukan paling lambat ${rules.lateSubmitDays} hari sesudah hari pertama.`;
    case 'SICK_LETTER':
      return `Surat boleh menyusul, paling lambat ${rules.letterGraceDays} hari sesudah masuk kembali. Diajukan paling lambat ${rules.lateSubmitDays} hari sesudah hari pertama.`;
    case 'BEREAVEMENT':
      return `Ayah, ibu, suami, istri, atau anak: ${rules.bereavementDays} hari kerja dibayar. Diajukan paling lambat ${rules.lateSubmitDays} hari sesudah hari pertama.`;
  }
}

export type DeadlineResult = { ok: true; sudden: boolean } | { ok: false; error: string };

/**
 * Batas waktu mengajukan, dihitung dari hari ini WIB saat dikirim (KEH-141, 142). Izin keperluan yang kurang dari
 * H-2 dilabeli izin mendadak oleh server; karyawan tidak memilih label itu.
 */
export function checkDeadline(kind: AbsenceKind, start: IsoDate, today: IsoDate, rules: AbsenceRules): DeadlineResult {
  const ahead = daysBetween(today, start);
  const lateLimitPassed = daysBetween(start, today) > rules.lateSubmitDays;
  const late = { ok: false as const, error: 'Batas mengajukan sudah lewat. Hari tanpa absen ditandai alpha dan dijelaskan lewat menu Perlu Dijelaskan.' };
  if (kind === 'ANNUAL_LEAVE') {
    return ahead >= rules.annualNoticeDays
      ? { ok: true, sudden: false }
      : { ok: false, error: `Cuti tahunan diajukan paling lambat H-${rules.annualNoticeDays}. Pilih tanggal mulai ${addDays(today, rules.annualNoticeDays)} atau sesudahnya, atau ajukan izin keperluan.` };
  }
  if (kind === 'PERMIT') {
    if (ahead >= rules.permitNoticeDays) return { ok: true, sudden: false };
    return lateLimitPassed ? late : { ok: true, sudden: true };
  }
  return lateLimitPassed ? late : { ok: true, sudden: false };
}

/** Hitungan per hari (Gaji membaca ini). Surat menyusul dihitung sakit tanpa surat sampai suratnya masuk (KEH-143). */
export function countKindOf(kind: AbsenceKind, sudden: boolean, letterPending: boolean): AbsenceCount {
  switch (kind) {
    case 'PERMIT': return sudden ? 'PERMIT_SUDDEN' : 'PERMIT';
    case 'SICK': return 'SICK';
    case 'SICK_LETTER': return letterPending ? 'SICK' : 'SICK_LETTER';
    case 'ANNUAL_LEAVE': return 'ANNUAL_LEAVE';
    case 'BEREAVEMENT': return 'BEREAVEMENT';
  }
}

/**
 * Deret sakit tanpa surat terpanjang yang memuat hari baru, dihitung pada urutan hari kerja orang itu (KEH-143):
 * sakit tanpa surat yang sudah berlaku tepat sebelum atau sesudahnya ikut dihitung; libur di tengah tidak memutus.
 */
export function sickRunLength(workdays: readonly IsoDate[], newDays: ReadonlySet<IsoDate>, existingSick: ReadonlySet<IsoDate>): number {
  let best = 0;
  let run = 0;
  let touchesNew = false;
  for (const date of workdays) {
    if (newDays.has(date) || existingSick.has(date)) {
      run += 1;
      touchesNew ||= newDays.has(date);
      if (touchesNew) best = Math.max(best, run);
    } else {
      run = 0;
      touchesNew = false;
    }
  }
  return best;
}

/** Izin duka: hari kerja ke-3 dan seterusnya dipotong (KEH-146). */
export function cutBereavement(workdays: readonly IsoDate[], maxDays: number): { days: IsoDate[]; cut: boolean } {
  return { days: workdays.slice(0, maxDays), cut: workdays.length > maxDays };
}

/** Tanggal + n tahun; 29 Februari jatuh ke 28 Februari di tahun bukan kabisat. */
export function addYears(date: IsoDate, years: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y + years, m - 1, d));
  if (target.getUTCMonth() !== m - 1) target.setUTCDate(0);
  return target.toISOString().slice(0, 10);
}

export type LeaveYear = { index: number; start: IsoDate; end: IsoDate };

/**
 * Tahun cuti yang memuat tanggal itu (KEH-48, 145): tahun ke-k mulai tepat k tahun sesudah tanggal bergabung dan
 * berakhir sehari sebelum tahun berikutnya. Sebelum masa kerja 1 tahun penuh belum ada tahun cuti (null).
 */
export function leaveYearOf(joinedOn: IsoDate, date: IsoDate): LeaveYear | null {
  if (date < addYears(joinedOn, 1)) return null;
  let index = Math.max(1, Number(date.slice(0, 4)) - Number(joinedOn.slice(0, 4)));
  while (addYears(joinedOn, index) > date) index -= 1;
  while (addYears(joinedOn, index + 1) <= date) index += 1;
  return { index, start: addYears(joinedOn, index), end: addDays(addYears(joinedOn, index + 1), -1) };
}

export function firstLeaveDate(joinedOn: IsoDate): IsoDate {
  return addYears(joinedOn, 1);
}

export type LeaveMovementKind = 'RESERVE' | 'USE' | 'RETURN' | 'EXPIRE' | 'ADJUST';

/** Sisa = jatah − pesan + kembali − hangus + sesuaikan; USE hanya penanda (jatahnya sudah dipesan). */
export function leaveBalance(quota: number, movements: readonly { kind: LeaveMovementKind; days: number }[]): number {
  return movements.reduce((sum, m) => {
    switch (m.kind) {
      case 'RESERVE': return sum - m.days;
      case 'RETURN': return sum + m.days;
      case 'EXPIRE': return sum - m.days;
      case 'ADJUST': return sum + m.days;
      case 'USE': return sum;
    }
  }, quota);
}

/** Batas menyusulkan surat dokter: sekian hari sesudah absen Masuk pertama sesudah sakit (KEH-51, 143). */
export function letterDeadline(returnedOn: IsoDate, graceDays: number): IsoDate {
  return addDays(returnedOn, graceDays);
}

/** "Tinggal 2 hari lagi" atau null bila batas sudah lewat. Sebelum masuk kembali batasnya belum berjalan. */
export function letterDaysLeft(returnedOn: IsoDate | null, today: IsoDate, graceDays: number): number | null {
  if (!returnedOn) return graceDays;
  const left = daysBetween(today, letterDeadline(returnedOn, graceDays));
  return left >= 0 ? left : null;
}

export type AbsenceStatusKey = 'PERMIT' | 'SICK' | 'LEAVE';

/** Status hari kerja dari hitungannya (KEH-81): izin (termasuk mendadak dan duka), sakit, cuti. */
export function statusOfCount(count: AbsenceCount): AbsenceStatusKey {
  if (count === 'ANNUAL_LEAVE') return 'LEAVE';
  if (count === 'SICK' || count === 'SICK_LETTER') return 'SICK';
  return 'PERMIT';
}
