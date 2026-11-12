import Big from 'big.js';
import { daysBetween } from '@/modules/inter-branch-debts/rules';

/**
 * Aturan murni Dana non-tunai belum cair (spec docs/work/specs/2026-11-12-f2-6c-utang-setoran-bebas-dana-belum-cair-design.md §3).
 */

/**
 * Tanggal mulai Setoran non-tunai (hari rilis F2-2 di produksi, `deposit_settings.startDate`). Ditulis di sini karena
 * `app_settings` juga menyimpan rahasia, jadi `finance_app` tidak diberi akses ke tabel itu.
 */
export const NONCASH_START = '2026-11-08';
/** Batas hari dana belum cair, sama dengan bawaan BO (`deposit_settings.awaitingFundsDays`). */
export const AWAITING_FUNDS_DAYS = 2;

/** AWAITING = Finance sudah menandai "Dana belum cair"; UNVERIFIED = belum disentuh Finance. */
export type PendingStatus = 'AWAITING' | 'UNVERIFIED';

export type PendingRow = {
  key: string;
  branchId: number;
  branchName: string;
  businessDate: string;
  shiftNumber: number | null;
  paymentMethodName: string;
  amount: number;
  status: PendingStatus;
  /** Rekening tujuan: rekening catatan verifikasi (belum cair) atau rekening tautan metode × cabang. null = belum ditautkan. */
  placeId: number | null;
  placeName: string | null;
};

export type PendingItem = PendingRow & { ageDays: number; overdue: boolean };

export type PendingGroup = {
  placeId: number | null;
  placeName: string;
  awaiting: { amount: number; count: number };
  unverified: { amount: number; count: number };
  total: number;
  oldestDate: string;
  oldestDays: number;
  overdue: boolean;
  items: PendingItem[];
};

const sum = (values: number[]) => values.reduce((acc, v) => acc.plus(v), new Big(0)).toNumber();

/** Dikelompokkan per rekening (urut nama; "Rekening belum ditautkan" terakhir), baris tertua dulu. */
export function pendingByPlace(rows: PendingRow[], today: string, limitDays = AWAITING_FUNDS_DAYS): { groups: PendingGroup[]; total: number } {
  const map = new Map<string, PendingItem[]>();
  for (const r of rows) {
    if (r.amount === 0) continue;
    const ageDays = daysBetween(r.businessDate, today);
    const k = r.placeId == null ? 'none' : String(r.placeId);
    map.set(k, [...(map.get(k) ?? []), { ...r, ageDays, overdue: ageDays > limitDays }]);
  }
  const groups = [...map.values()].map((items) => {
    items.sort((a, b) => a.businessDate.localeCompare(b.businessDate) || a.branchName.localeCompare(b.branchName, 'id'));
    const part = (s: PendingStatus) => {
      const list = items.filter((i) => i.status === s);
      return { amount: sum(list.map((i) => i.amount)), count: list.length };
    };
    return {
      placeId: items[0].placeId,
      placeName: items[0].placeName ?? 'Rekening belum ditautkan',
      awaiting: part('AWAITING'),
      unverified: part('UNVERIFIED'),
      total: sum(items.map((i) => i.amount)),
      oldestDate: items[0].businessDate,
      oldestDays: items[0].ageDays,
      overdue: items.some((i) => i.overdue),
      items,
    };
  });
  groups.sort((a, b) => (a.placeId == null ? 1 : b.placeId == null ? -1 : a.placeName.localeCompare(b.placeName, 'id')));
  return { groups, total: sum(groups.map((g) => g.total)) };
}
