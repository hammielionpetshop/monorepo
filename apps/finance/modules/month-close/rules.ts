import Big from 'big.js';
import { countCheck, latestCount, type CashCount, type MoneyLine, type Place } from '@/modules/money';
import { addMonths, cell, FIRST_MONTH, type Flag, type ProfitLoss } from '@/modules/profit-loss';

/**
 * Tutup Bulan F2-6f-2 (spec docs/work/specs/2026-11-12-f2-6f-tutup-bulan-design.md §2): urutan bulan, daftar belum
 * beres, pemeriksaan isian, dan selisih salinan vs angka hidup. Rumus murni; pembaca & penulis di sources.ts.
 */

/** Hal yang belum beres saat menutup (tanda Laba Rugi, Hitung Kas akhir bulan, catatan tanpa Tempat Uang). */
export type OpenItem = { key: string; label: string; count: number; amount: number | null };

export type SnapshotBalance = { placeId: number; name: string; branchName: string; balance: number };

/** Isi `month_closings.snapshot` (versi 1). */
export type MonthSnapshot = {
  version: 1;
  profitLoss: ProfitLoss;
  flags: Flag[];
  balances: SnapshotBalance[];
  balanceTotal: number;
};

export type Closing = {
  /** YYYY-MM */
  month: string;
  closedAt: string;
  closedByName: string;
  withNotes: boolean;
  note: string | null;
  openItems: OpenItem[];
  snapshot: MonthSnapshot;
};

export type MonthState = 'CLOSED' | 'NEXT' | 'WAITING' | 'CURRENT';

/** Status tiap bulan dari November 2026 s.d. bulan berjalan, terbaru dulu. NEXT = satu-satunya yang boleh ditutup. */
export function monthStates(closed: string[], thisMonth: string): { month: string; state: MonthState }[] {
  const done = new Set(closed);
  const next = closableMonth(closed, thisMonth);
  const out: { month: string; state: MonthState }[] = [];
  for (let m = FIRST_MONTH; m <= thisMonth; m = addMonths(m, 1)) {
    out.push({ month: m, state: done.has(m) ? 'CLOSED' : m === thisMonth ? 'CURRENT' : m === next ? 'NEXT' : 'WAITING' });
  }
  return out.reverse();
}

/** Bulan tertua yang belum ditutup dan sudah lewat (berurutan, KEU-221); null bila tidak ada. */
export function closableMonth(closed: string[], thisMonth: string): string | null {
  const done = new Set(closed);
  for (let m = FIRST_MONTH; m < thisMonth; m = addMonths(m, 1)) {
    if (!done.has(m)) return m;
  }
  return null;
}

/** Hari batas pengingat: bulan lalu yang belum ditutup sampai tanggal 10 bulan berikutnya (KEU-112). */
export const REMINDER_DAY = 10;

/** Bulan yang sudah lewat tetapi belum ditutup dan sudah melewati batas pengingat. */
export function overdueMonths(closed: string[], today: string): string[] {
  const thisMonth = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  const done = new Set(closed);
  const out: string[] = [];
  for (let m = FIRST_MONTH; m < thisMonth; m = addMonths(m, 1)) {
    const late = addMonths(m, 1) < thisMonth || day > REMINDER_DAY;
    if (!done.has(m) && late) out.push(m);
  }
  return out;
}

/** Nama bulan yang harus diketik untuk memastikan, mis. "November 2026". */
export function confirmLabel(month: string): string {
  const names = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${names[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

export const NOTE_MIN = 5;

/** Pemeriksaan isian tutup bulan; null = boleh. */
export function checkClose(input: {
  month: string;
  closable: string | null;
  confirmText: string;
  openItems: OpenItem[];
  note: string;
}): string | null {
  if (!input.closable) return 'Belum ada bulan yang bisa ditutup.';
  if (input.month !== input.closable) return `Tutup bulan harus berurutan; yang bisa ditutup sekarang ${confirmLabel(input.closable)}.`;
  const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  if (norm(input.confirmText) !== norm(confirmLabel(input.month))) {
    return `Ketik "${confirmLabel(input.month)}" untuk memastikan. Bulan yang ditutup tidak bisa dibuka kembali.`;
  }
  if (input.openItems.length && input.note.trim().length < NOTE_MIN) {
    return 'Masih ada yang belum beres: isi alasan menutup dengan catatan.';
  }
  return null;
}

export type Change = { lineKey: string; label: string; columnKey: string; columnName: string; closed: number; live: number; delta: number };

/**
 * Selisih angka hidup terhadap salinan saat ditutup, per baris & kolom yang berubah. Baris/kolom yang hanya ada di
 * salah satu sisi dihitung 0 di sisi lain.
 */
export function profitLossChanges(closed: ProfitLoss, live: ProfitLoss): Change[] {
  const columns = new Map<string, string>();
  for (const c of [...closed.columns, ...live.columns]) if (!columns.has(c.key)) columns.set(c.key, c.name);
  const lines = new Map<string, { label: string; closed?: ProfitLoss['lines'][number]; live?: ProfitLoss['lines'][number] }>();
  for (const l of closed.lines) lines.set(l.key, { label: l.label, closed: l });
  for (const l of live.lines) lines.set(l.key, { ...(lines.get(l.key) ?? { label: l.label }), live: l });
  const out: Change[] = [];
  for (const [lineKey, l] of lines) {
    for (const [columnKey, columnName] of columns) {
      const before = l.closed ? cell(l.closed, columnKey) : 0;
      const after = l.live ? cell(l.live, columnKey) : 0;
      const delta = new Big(after).minus(before).toNumber();
      if (delta !== 0) out.push({ lineKey, label: l.label, columnKey, columnName, closed: before, live: after, delta });
    }
  }
  return out;
}

/** Selisih laba bersih Gabungan (ringkas untuk peringatan di bulan berjalan). */
export function netChange(changes: Change[]): number {
  return changes.find((c) => c.lineKey === 'net' && c.columnKey === 'total')?.delta ?? 0;
}

/**
 * Hitung Kas akhir bulan (spec F2-6f §2): Tunai/Rekening aktif yang tidak dihitung pada hari terakhir bulan, dan yang
 * dihitung tetapi masih berselisih dengan saldo catatan (belum dijelaskan atau disesuaikan).
 */
export function countOpenItems(places: Place[], lines: MoneyLine[], counts: CashCount[], monthEnd: string): OpenItem[] {
  const active = places.filter((p) => p.isActive);
  const notCounted: string[] = [];
  let mismatch = 0;
  let mismatchAmount = new Big(0);
  for (const p of active) {
    const last = latestCount(counts, p.id, monthEnd);
    if (!last || last.countedOn !== monthEnd) {
      notCounted.push(p.name);
      continue;
    }
    const variance = countCheck(p, lines, last).variance;
    if (variance !== 0) {
      mismatch += 1;
      mismatchAmount = mismatchAmount.plus(Math.abs(variance));
    }
  }
  const out: OpenItem[] = [];
  if (notCounted.length) {
    out.push({ key: 'count-missing', label: `Tunai/Rekening tidak dihitung pada hari terakhir bulan (${notCounted.join(', ')})`, count: notCounted.length, amount: null });
  }
  if (mismatch) out.push({ key: 'count-variance', label: 'Hitung Kas akhir bulan masih berselisih dengan saldo catatan', count: mismatch, amount: mismatchAmount.toNumber() });
  return out;
}

/**
 * Koreksi bulan lalu (spec F2-6f §5, PSAK 25 / IAS 8): catatan Arus Kas beralasan dengan "Untuk bulan" = bulan tertutup.
 * Bulan asal disajikan kembali; Laba Rugi bulan berjalan tidak berubah (ia membaca "Untuk bulan").
 */
export type Correction = {
  id: number;
  /** Tanggal uang (bulan terbuka), YYYY-MM-DD. */
  occurredOn: string;
  branchName: string;
  category: string;
  type: 'INCOME' | 'EXPENSE';
  reportKind: string | null;
  amount: number;
  reason: string;
  createdByName: string;
};

/** Pengaruh satu koreksi pada laba bersih Gabungan: biaya mengurangi, pendapatan lain menambah, jenis lain tidak masuk laba. */
export function correctionEffect(c: Pick<Correction, 'type' | 'reportKind' | 'amount'>): number {
  if (c.reportKind === 'COST' && c.type === 'EXPENSE') return -c.amount;
  if (c.reportKind === 'INCOME' && c.type === 'INCOME') return c.amount;
  return 0;
}

export type Restatement = { closed: number; corrections: number; other: number; restated: number };

/**
 * Laba bersih Gabungan bulan tertutup: saat ditutup → koreksi bulan lalu → perubahan lain → disajikan kembali.
 * "Disajikan kembali" = angka hidup sekarang; "perubahan lain" = sisa selisih yang bukan koreksi Arus Kas
 * (nota dibatalkan, slip HRIS ditutup terlambat, dsb.).
 */
export function restatement(closed: ProfitLoss, live: ProfitLoss, corrections: Correction[]): Restatement {
  const net = (pl: ProfitLoss) => {
    const line = pl.lines.find((l) => l.key === 'net');
    return line ? cell(line, 'total') : 0;
  };
  const before = net(closed);
  const after = net(live);
  const fix = corrections.reduce((s, c) => s.plus(correctionEffect(c)), new Big(0));
  return {
    closed: before,
    corrections: fix.toNumber(),
    other: new Big(after).minus(before).minus(fix).toNumber(),
    restated: after,
  };
}
