import { addPeriods, type IsoDate } from './salary';

// Keberatan slip (spec L4g §3.5–3.6; GAJ-110, 111). Aturan murni: masa keberatan, jalan pembetulan, dan label.

export type ObjectionKind = 'WRONG' | 'NOT_RECEIVED';
export const OBJECTION_KIND_LABELS: Record<ObjectionKind, string> = { WRONG: 'Ada yang salah di slip', NOT_RECEIVED: 'Uang belum saya terima' };

export type FixPath = 'SOURCE' | 'REOPEN' | 'PAST_CORRECTION' | 'SALARY_CORRECTION' | 'CANCEL_PAYMENT';
export const FIX_PATH_LABELS: Record<FixPath, { label: string; hint: string }> = {
  SOURCE: { label: 'Betulkan di sumbernya', hint: 'Slip masih Perkiraan: koreksi absen, potongan, bonus, atau gaji periode berjalan; slip ikut berubah.' },
  REOPEN: { label: 'Buka kembali, betulkan, tutup ulang', hint: 'Slip ditutup tetapi belum Dibayar: buka kembali slip, betulkan sumbernya, lalu tutup ulang.' },
  PAST_CORRECTION: {
    label: 'Betulkan di sumber, masuk Koreksi Periode Lalu',
    hint: 'Slip sudah Dibayar atau slip berikutnya sudah ditutup: selisihnya masuk slip berikutnya. Tanpa slip berikutnya: plus dibayar di luar slip, minus menjadi Piutang Lain.',
  },
  SALARY_CORRECTION: { label: 'Pembetulan gaji periode lalu', hint: 'Gaji tetap periode itu salah: Pemilik atau GM membetulkan paketnya; selisihnya masuk Koreksi Periode Lalu.' },
  CANCEL_PAYMENT: { label: 'Batal bayar lalu bayar ulang', hint: 'Pembayaran dibatalkan dengan alasan, lalu dibayar ulang; pembayaran baru tertaut otomatis.' },
};

export const FIX_STATUS_LABELS = { NONE: '—', WAITING_FIX: 'Menunggu pembetulan', FIXED: 'Sudah dibetulkan' } as const;
export type FixStatus = keyof typeof FIX_STATUS_LABELS;

/** Jenis catatan pembetul yang bisa ditautkan (spec L4g §3.6). */
export type FixKind = 'SLIP_VERSION' | 'SLIP_LINE' | 'SALARY_CHANGE' | 'ATTENDANCE' | 'BONUS' | 'DEDUCTION' | 'WAIVER' | 'PAYMENT' | 'OFF_SLIP' | 'RECEIVABLE';
export const FIX_KIND_LABELS: Record<FixKind, string> = {
  SLIP_VERSION: 'Slip ditutup ulang',
  SLIP_LINE: 'Baris Koreksi Periode Lalu',
  SALARY_CHANGE: 'Perubahan gaji',
  ATTENDANCE: 'Koreksi absen',
  BONUS: 'Bonus',
  DEDUCTION: 'Potongan Lain',
  WAIVER: 'Peniadaan potongan',
  PAYMENT: 'Pembayaran baru',
  OFF_SLIP: 'Bayar di luar slip',
  RECEIVABLE: 'Piutang Lain',
};

export const OBJECTION_REASON_MIN = 20;
export const OBJECTION_REJECT_MIN = 15;
/** "Menunggu pembetulan" lebih dari ini masuk perlu perhatian Pemilik dan GM (GAJ-111). */
export const FIX_ATTENTION_DAYS = 2;

const WIB = 7 * 3_600_000;

/** 23.59.59 WIB hari ke-`days` sesudah `at` (hari `at` = hari ke-0). */
export function dayEndWib(at: Date, days: number): Date {
  const wib = new Date(at.getTime() + WIB);
  return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() + days, 23, 59, 59) - WIB);
}

/** Periode berakhir: tanggal 26 berikutnya pukul 00.00 WIB. */
export function periodEndedAt(periodStart: IsoDate): Date {
  const [y, m, d] = addPeriods(periodStart, 1).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - WIB);
}

export type Window = { open: true; until: Date | null } | { open: false; reason: string; until: Date | null };

/**
 * "Ada yang salah" (spec L4g §3.5): sejak periode berakhir selama slip Perkiraan, sampai 23.59 hari ke-3 sesudah slip ditutup
 * (ditutup ulang: dari penutupan terakhir, yaitu `objectionUntil` slip).
 */
export function wrongWindow(slip: { periodStart: IsoDate; status: 'ESTIMATE' | 'CLOSED'; objectionUntil: Date | null }, now: Date): Window {
  if (now < periodEndedAt(slip.periodStart)) {
    return { open: false, until: null, reason: 'Periode ini belum berakhir. Kalau ada yang salah di absen, jelaskan lewat Perlu Dijelaskan atau minta koreksi ke kepala toko. Potongan bisa dikeberati di tab Potongan.' };
  }
  if (slip.status === 'ESTIMATE') return { open: true, until: null };
  const until = slip.objectionUntil;
  if (!until || now > until) return { open: false, until, reason: 'Batas keberatan slip ini (pukul 23.59 hari ke-3 sesudah ditutup) sudah lewat.' };
  return { open: true, until };
}

/** "Uang belum saya terima": sejak ditandai Dibayar sampai 23.59 hari ke-7. Slip tanpa uang tidak bisa. */
export function notReceivedWindow(payment: { kind: 'MONEY' | 'NO_MONEY'; createdAt: Date } | null, now: Date): Window {
  if (!payment) return { open: false, until: null, reason: 'Slip ini belum ditandai Dibayar.' };
  if (payment.kind !== 'MONEY') return { open: false, until: null, reason: 'Slip ini tanpa uang (bersih Rp0), jadi tidak ada uang yang dikirim.' };
  const until = dayEndWib(payment.createdAt, 7);
  if (now > until) return { open: false, until, reason: 'Batas keberatan uang belum diterima (pukul 23.59 hari ke-7 sesudah ditandai Dibayar) sudah lewat.' };
  return { open: true, until };
}

/**
 * Jalan pembetulan yang tersedia menurut keadaan slip saat diputuskan (spec L4g §3.6). Server menyaring pilihan penyetuju.
 * `reopenable` = slip ditutup, belum Dibayar, dan syarat buka kembali terpenuhi.
 */
export function fixPathsFor(input: { kind: ObjectionKind; status: 'ESTIMATE' | 'CLOSED'; reopenable: boolean }): FixPath[] {
  if (input.kind === 'NOT_RECEIVED') return ['CANCEL_PAYMENT'];
  if (input.status === 'ESTIMATE') return ['SOURCE'];
  if (input.reopenable) return ['REOPEN'];
  return ['PAST_CORRECTION', 'SALARY_CORRECTION'];
}

/** Hari menunggu pembetulan, dihitung dari saat disetujui (hari penuh). */
export function waitingFixDays(approvedAt: Date, now: Date): number {
  return Math.floor((now.getTime() - approvedAt.getTime()) / 86_400_000);
}
