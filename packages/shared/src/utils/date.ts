// Semua format tanggal/waktu di-pin ke WIB (Asia/Jakarta) supaya konsisten
// baik dirender di server (UTC) maupun di browser. Timestamp disimpan UTC di DB.
export const WIB_TIMEZONE = 'Asia/Jakarta';

type DateInput = Date | string | number | null | undefined;

const toDate = (date: DateInput): Date | null => {
  if (date === null || date === undefined || date === '') return null;
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Formatter dasar — selalu memaksa timeZone Asia/Jakarta.
 * Gunakan ini menggantikan `x.toLocaleString('id-ID', {...})` dan
 * `new Intl.DateTimeFormat('id-ID', {...}).format(x)`.
 * Mengembalikan '-' bila tanggal kosong/invalid.
 */
export const formatWIB = (
  date: DateInput,
  options: Intl.DateTimeFormatOptions = {},
): string => {
  const d = toDate(date);
  if (!d) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    hour12: false,
    ...options,
    timeZone: WIB_TIMEZONE,
  }).format(d);
};

/** 20/06/2026 */
export const formatDate = (date: DateInput): string =>
  formatWIB(date, { day: '2-digit', month: '2-digit', year: 'numeric' });

/** 20/06/2026 16.01 */
export const formatDateTime = (date: DateInput): string =>
  formatWIB(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** 20/06 16.01 */
export const formatDateTimeShort = (date: DateInput): string =>
  formatWIB(date, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

/** 16.01 */
export const formatTime = (date: DateInput): string =>
  formatWIB(date, { hour: '2-digit', minute: '2-digit' });

/** 20 Juni 2026 */
export const formatDateLong = (date: DateInput): string =>
  formatWIB(date, { day: '2-digit', month: 'long', year: 'numeric' });
