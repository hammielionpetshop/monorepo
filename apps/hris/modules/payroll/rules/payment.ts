import { periodEndOf, type IsoDate } from './salary';

// Aturan murni Bayar Slip (spec L4f §3): tanggal uang, jatuh bayar, kelompok Jadwal Bayar, Daftar Transfer.

export type PayMethod = 'CASH' | 'TRANSFER';
export const PAY_METHOD_LABELS: Record<PayMethod, string> = { CASH: 'tunai', TRANSFER: 'transfer' };

/** Batas mundur tanggal uang tanpa alasan (GAJ-99). */
export const MONEY_DATE_FREE_DAYS = 7;

const toUtc = (d: IsoDate) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

export function shiftDate(date: IsoDate, days: number): IsoDate {
  return new Date(toUtc(date) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Tanggal uang (GAJ-99, spec L4f §3.1 langkah 2): tidak masa depan, tidak sebelum slip ditutup,
 * mundur lebih dari 7 hari wajib alasan. Null = boleh.
 */
export function moneyDateProblem(input: { moneyDate: string; today: IsoDate; closedOn: IsoDate; reason: string | null }): string | null {
  const { moneyDate, today, closedOn } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(moneyDate) || Number.isNaN(toUtc(moneyDate))) return 'Tanggal uang tidak sah.';
  if (moneyDate > today) return 'Tanggal uang tidak boleh sesudah hari ini.';
  if (moneyDate < closedOn) return 'Tanggal uang tidak boleh sebelum slip ditutup.';
  if (daysBetween(moneyDate, today) > MONEY_DATE_FREE_DAYS && (input.reason ?? '').trim().length < 15) {
    return `Tanggal uang mundur lebih dari ${MONEY_DATE_FREE_DAYS} hari: tulis alasannya (paling sedikit 15 huruf).`;
  }
  return null;
}

/** Tanggal bayar periode (GAJ-41): tanggal `payDay` pertama sesudah periode berakhir. */
export function payDateOf(periodStart: IsoDate, payDay: number): IsoDate {
  const end = periodEndOf(periodStart);
  const day = String(Math.min(Math.max(payDay, 1), 28)).padStart(2, '0');
  const sameMonth = `${end.slice(0, 7)}-${day}`;
  if (sameMonth > end) return sameMonth;
  const year = Number(end.slice(0, 4));
  const month = Number(end.slice(5, 7));
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
  return `${next}-${day}`;
}

/**
 * Jatuh bayar (GAJ-104): tanggal bayar periode, atau tanggal slip ditutup bila lebih lambat.
 * Mode uji staging (spec L4f §9 butir 6): jatuh bayar = tanggal slip ditutup.
 */
export function dueDateOf(payDate: IsoDate, closedOn: IsoDate, testMode: boolean): IsoDate {
  if (testMode) return closedOn;
  return closedOn > payDate ? closedOn : payDate;
}

export type DueBucket = 'LATE' | 'TODAY' | 'WEEK' | 'LATER';
export const DUE_BUCKET_LABELS: Record<DueBucket, string> = { LATE: 'Lewat', TODAY: 'Hari ini', WEEK: '7 hari ke depan', LATER: 'Belum jatuh' };

export function dueBucket(due: IsoDate, today: IsoDate): { bucket: DueBucket; daysLate: number } {
  const diff = daysBetween(due, today);
  if (diff > 0) return { bucket: 'LATE', daysLate: diff };
  if (diff === 0) return { bucket: 'TODAY', daysLate: 0 };
  return { bucket: diff >= -7 ? 'WEEK' : 'LATER', daysLate: 0 };
}

/** Pengingat belum Dibayar mulai 07.00 hari sesudah jatuh bayar (GAJ-104). */
export function reminderDue(due: IsoDate, today: IsoDate): boolean {
  return daysBetween(due, today) >= 1;
}

export type TransferRow = { name: string; bank: string | null; accountNumber: string | null; accountHolder: string | null; net: number };

/** Daftar Transfer diurutkan per bank supaya mudah ditransfer (GAJ-L36); tanpa rekening di akhir. */
export function sortTransfer<T extends TransferRow>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    const ab = (a.accountNumber ? a.bank ?? '' : '￿').toLowerCase();
    const bb = (b.accountNumber ? b.bank ?? '' : '￿').toLowerCase();
    return ab.localeCompare(bb) || a.name.localeCompare(b.name);
  });
}

const csvCell = (value: string) => (/[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/**
 * Berkas CSV Daftar Transfer (spec L4f §9 butir 7). Pemisah titik koma (Excel berbahasa Indonesia);
 * nomor rekening ditulis sebagai teks supaya angka nol di depan tidak hilang.
 */
export function transferCsv(rows: readonly TransferRow[], meta: { period: string; madeBy: string; madeAt: string }): string {
  const lines = [
    'sep=;',
    [`Daftar Transfer periode ${meta.period}`, `dibuat ${meta.madeBy}`, meta.madeAt].map(csvCell).join(';'),
    ['Nama', 'Bank', 'Nomor rekening', 'Nama pemilik rekening', 'Bersih'].join(';'),
    ...sortTransfer(rows).map((r) => [
      csvCell(r.name), csvCell(r.bank ?? ''), r.accountNumber ? `="${r.accountNumber.replace(/"/g, '')}"` : 'Belum ada rekening',
      csvCell(r.accountHolder ?? ''), String(r.net),
    ].join(';')),
    ['Jumlah', '', '', '', String(rows.reduce((s, r) => s + r.net, 0))].join(';'),
  ];
  return `${lines.join('\r\n')}\r\n`;
}

/** Empat angka terakhir nomor rekening untuk Jadwal Bayar. */
export function accountTail(accountNumber: string | null): string | null {
  const digits = (accountNumber ?? '').replace(/\D/g, '');
  return digits ? `•••${digits.slice(-4)}` : null;
}
