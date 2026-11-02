/** Aturan murni Perlu Dijelaskan dan alpha (spec L3g §3). Tanggal = YYYY-MM-DD WIB. Tanpa DB. */
import { wibDate, wibInstant } from './attendance';
import { addDays, type IsoDate } from './schedule';

export const EVENT_KINDS = ['ALPHA', 'FORGOT_OUT', 'FORGOT_RETURN', 'LATE', 'EARLY_LEAVE'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export type EventState = 'OPEN' | 'EXPLAINED' | 'EXPIRED' | 'VOID';

export const CAUSES = ['SICK', 'SICK_LETTER', 'FORGOT', 'SUDDEN_PERMIT', 'REASON'] as const;
export type Cause = (typeof CAUSES)[number];

/**
 * Mulai menandai sejak tanggal ini, tanpa menandai mundur (spec L3g §9 butir 2). Ditulis di kode, bukan pengaturan,
 * karena layar Pengaturan baru mendukung angka (seperti DAY_OFF_MARKS_FROM di L3e).
 */
export const CLARIFY_MARKS_FROM: IsoDate = '2026-11-02';

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  ALPHA: 'Alpha', FORGOT_OUT: 'Lupa absen pulang', FORGOT_RETURN: 'Lupa Masuk Kembali', LATE: 'Telat', EARLY_LEAVE: 'Pulang cepat',
};

export const CAUSE_LABELS: Record<Cause, string> = {
  SICK: 'Sakit tanpa surat', SICK_LETTER: 'Sakit dengan surat dokter', FORGOT: 'Lupa absen (saya sebenarnya hadir)',
  SUDDEN_PERMIT: 'Izin mendadak', REASON: 'Alasan',
};

export const EVENT_STATE_LABELS: Record<EventState, string> = {
  OPEN: 'Perlu dijelaskan', EXPLAINED: 'Disetujui', EXPIRED: 'Lewat batas', VOID: 'Sudah dibereskan',
};

export function isEventKind(value: unknown): value is EventKind {
  return typeof value === 'string' && (EVENT_KINDS as readonly string[]).includes(value);
}

export function isCause(value: unknown): value is Cause {
  return typeof value === 'string' && (CAUSES as readonly string[]).includes(value);
}

/** "Telat 42 menit", "Alpha". */
export function eventTitle(kind: EventKind, minutes: number | null): string {
  if ((kind === 'LATE' || kind === 'EARLY_LEAVE') && minutes != null) return `${EVENT_KIND_LABELS[kind]} ${minutes} menit`;
  return EVENT_KIND_LABELS[kind];
}

/** Akibat bila dibiarkan, satu kalimat tanpa nominal (PRI-07, KEH-L35). */
export function consequenceText(kind: EventKind): string {
  switch (kind) {
    case 'ALPHA': return 'Kalau tidak dijelaskan, hari ini tetap dihitung alpha.';
    case 'FORGOT_OUT': return 'Kalau tidak dijelaskan, jam pulang hari ini kosong. Lupa absen dikenai denda lupa absen.';
    case 'FORGOT_RETURN': return 'Kalau tidak dijelaskan, istirahat Anda tercatat tanpa Masuk Kembali. Lupa absen dikenai denda lupa absen.';
    case 'LATE': return 'Kalau tidak dijelaskan, potongan telat tetap berlaku.';
    case 'EARLY_LEAVE': return 'Kalau tidak dijelaskan, HR melihatnya sebagai pulang cepat yang belum dijelaskan.';
  }
}

// ---- Batas (KEH-58, 62, 151) ----

/** Batas = tanggal + n hari pukul 23.59 WIB. Disimpan sebagai awal hari berikutnya (eksklusif). */
export function deadlineAfter(date: IsoDate, days: number): Date {
  return wibInstant(addDays(date, days + 1), '00:00');
}

/** Tanggal terakhir boleh menjelaskan (untuk tampilan "sampai Kam 5 Nov 23.59"). */
export function lastDayOf(deadlineAt: Date): IsoDate {
  return wibDate(new Date(deadlineAt.getTime() - 1));
}

export function isOpenAt(deadlineAt: Date, now: Date): boolean {
  return now < deadlineAt;
}

/** Sisa hari kalender: 0 = hari terakhir; null = lewat batas. */
export function daysLeft(deadlineAt: Date, now: Date): number | null {
  if (!isOpenAt(deadlineAt, now)) return null;
  const [a, b] = [wibDate(now), lastDayOf(deadlineAt)].map((d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

export type Urgency = 'normal' | 'warn' | 'danger' | 'over';

/** Kuning bila tinggal 1 hari, merah di hari terakhir (KEH-L35). */
export function urgencyOf(deadlineAt: Date, now: Date): Urgency {
  const left = daysLeft(deadlineAt, now);
  if (left === null) return 'over';
  if (left === 0) return 'danger';
  return left === 1 ? 'warn' : 'normal';
}

export function leftText(deadlineAt: Date, now: Date): string {
  const left = daysLeft(deadlineAt, now);
  if (left === null) return 'Lewat batas';
  return left === 0 ? 'Hari terakhir' : `Tinggal ${left} hari`;
}

// ---- Lahirnya kejadian (KEH-150, 151) ----

export type DayFacts = {
  /** Orang punya shift di hari itu (jadwal). Hari tanpa shift tidak dinilai alpha (spec L3g §9 butir 7). */
  scheduled: boolean;
  closed: boolean;
  dayOff: boolean;
  /** Ada izin/sakit/cuti berlaku (Menunggu atau Disetujui; KEH-147). */
  absent: boolean;
  /** Jam masuk berlaku (sesudah koreksi). */
  present: boolean;
  /** Jam pulang berlaku (Laporan Pulang terkirim atau koreksi; KEH-89). */
  outCounted: boolean;
  hasBreak: boolean;
  hasReturn: boolean;
  lateMinutes: number | null;
  earlyLeaveMinutes: number | null;
};

export type Thresholds = { late: number; early: number };

export type BornEvent = { kind: EventKind; minutes: number | null };

/** Kejadian yang lahir dari satu hari kerja yang sudah lewat. Satu fungsi untuk mesin dan pemeriksa ulang (WAJ-04). */
export function detectEvents(facts: DayFacts, thresholds: Thresholds): BornEvent[] {
  if (!facts.present) {
    return facts.scheduled && !facts.closed && !facts.dayOff && !facts.absent ? [{ kind: 'ALPHA', minutes: null }] : [];
  }
  const events: BornEvent[] = [];
  if (!facts.outCounted) events.push({ kind: 'FORGOT_OUT', minutes: null });
  if (facts.hasBreak && !facts.hasReturn) events.push({ kind: 'FORGOT_RETURN', minutes: null });
  if (facts.lateMinutes != null && facts.lateMinutes > thresholds.late) events.push({ kind: 'LATE', minutes: facts.lateMinutes });
  if (facts.outCounted && facts.earlyLeaveMinutes != null && facts.earlyLeaveMinutes > thresholds.early) {
    events.push({ kind: 'EARLY_LEAVE', minutes: facts.earlyLeaveMinutes });
  }
  return events;
}

// ---- Sebab dan isian (KEH-L36, KEH-153) ----

/** Sebab yang boleh dipilih untuk satu jenis kejadian. */
export function causesFor(kind: EventKind): Cause[] {
  if (kind === 'ALPHA') return ['SICK', 'SICK_LETTER', 'FORGOT', 'SUDDEN_PERMIT'];
  if (kind === 'FORGOT_OUT' || kind === 'FORGOT_RETURN') return ['FORGOT'];
  return ['REASON'];
}

export type ForgotKind = 'IN' | 'OUT' | 'RETURN';

export const FORGOT_KIND_LABELS: Record<ForgotKind, string> = { IN: 'lupa absen masuk', OUT: 'lupa absen pulang', RETURN: 'lupa Masuk Kembali' };

/** Jenis lupa absen untuk denda (KEH-154): tiga jenis terpisah. Selain itu null. */
export function forgotKindOf(kind: EventKind, cause: Cause): ForgotKind | null {
  if (kind === 'ALPHA') return cause === 'FORGOT' ? 'IN' : null;
  if (kind === 'FORGOT_OUT') return 'OUT';
  if (kind === 'FORGOT_RETURN') return 'RETURN';
  return null;
}

/** Ajukan terlambat hanya untuk lupa absen (KEH-60, 155); alpha hanya dengan sebab Lupa absen. */
export function lateSubmitAllowed(kind: EventKind, cause: Cause): boolean {
  return forgotKindOf(kind, cause) !== null;
}

/** Rangkaian berturut-turut hanya untuk sakit dan izin mendadak; lupa absen per hari karena jamnya berbeda. */
export function seriesAllowed(cause: Cause): boolean {
  return cause === 'SICK' || cause === 'SICK_LETTER' || cause === 'SUDDEN_PERMIT';
}

/**
 * Hari alpha terpilih bersambung (KEH-152): di antara dua tanggal berurutan tidak ada hari Hadir dan tidak ada alpha lain
 * yang tidak ikut dipilih. Libur terjadwal dan hari tutup tidak memutus.
 */
export function isContiguous(selected: readonly IsoDate[], otherAlpha: ReadonlySet<IsoDate>, presentDates: ReadonlySet<IsoDate>): boolean {
  const dates = [...selected].sort();
  for (let i = 1; i < dates.length; i += 1) {
    for (let d = addDays(dates[i - 1], 1); d < dates[i]; d = addDays(d, 1)) {
      if (otherAlpha.has(d) || presentDates.has(d)) return false;
    }
  }
  return true;
}

// ---- Kejadian ke-n lupa absen (KEH-64, 154) ----

export type ForgotItem = { id: number; kind: ForgotKind; workDate: IsoDate };

/** Urutan per jenis menurut tanggal kejadian (lalu id) di satu periode; dihitung ulang tiap dibaca. */
export function forgotSequence(items: readonly ForgotItem[]): Map<number, number> {
  const result = new Map<number, number>();
  for (const kind of ['IN', 'OUT', 'RETURN'] as const) {
    const own = items.filter((item) => item.kind === kind).sort((a, b) => (a.workDate === b.workDate ? a.id - b.id : a.workDate < b.workDate ? -1 : 1));
    own.forEach((item, index) => result.set(item.id, index + 1));
  }
  return result;
}

/** Mulai kejadian ke-5 kena tambahan (KEH-64). */
export const FORGOT_SURCHARGE_FROM = 5;

// ---- Tanda tidak masuk berturut-turut (KEH-55, 157) ----

/** COUNT = sakit tanpa surat / izin / alpha; BREAK = hadir, cuti, sakit dengan surat, duka; SKIP = libur, tutup, tanpa shift. */
export type StreakDay = { date: IsoDate; mark: 'COUNT' | 'BREAK' | 'SKIP'; cause: string | null };

export type StreakHit = { startDate: IsoDate; flaggedDate: IsoDate; causes: string[] };

/** Rangkaian yang mencapai `threshold` hari kerja. Satu tanda per rangkaian, di hari ke-n (tidak berulang). */
export function streakHits(days: readonly StreakDay[], threshold: number): StreakHit[] {
  const hits: StreakHit[] = [];
  let run: StreakDay[] = [];
  for (const day of [...days].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    if (day.mark === 'SKIP') continue;
    if (day.mark === 'BREAK') {
      run = [];
      continue;
    }
    run.push(day);
    if (run.length === threshold) hits.push({ startDate: run[0].date, flaggedDate: day.date, causes: run.map((d) => d.cause ?? '-') });
  }
  return hits;
}

// ---- Jam yang masuk akal (KEH-18, 111) ----

/** Jam masuk paling awal sekian menit sebelum jam masuk shift (sama dengan pembukaan tombol Masuk). */
export function earliestInProblem(workDate: IsoDate, startTime: string | null, inAt: Date, earliestMinutes: number): string | null {
  if (!startTime) return null;
  const opens = new Date(wibInstant(workDate, startTime).getTime() - earliestMinutes * 60_000);
  if (inAt < opens) {
    const hours = Math.floor(earliestMinutes / 60);
    const rest = earliestMinutes % 60;
    return `Jam masuk paling awal ${hours ? `${hours} jam` : ''}${rest ? ` ${rest} menit` : ''} sebelum jam masuk shift.`.replace('  ', ' ');
  }
  return null;
}

/** Masuk Kembali sesudah Istirahat dan sebelum Pulang. */
export function returnProblem(breakAt: Date, returnAt: Date, outAt: Date | null): string | null {
  if (returnAt <= breakAt) return 'Jam Masuk Kembali harus sesudah jam Istirahat.';
  if (outAt && returnAt >= outAt) return 'Jam Masuk Kembali harus sebelum jam Pulang.';
  return null;
}
