import Big from 'big.js';

/**
 * Penyusutan & pelepasan aset F2-6d-2 (spec docs/work/specs/2026-11-12-f2-6d-aset-penyusutan-design.md §1.6, §2).
 * SALINAN rumus BO `apps/backoffice/lib/services/asset-rules.ts` (garis lurus mulai bulan beli, sisa pembulatan di
 * bulan terakhir, berhenti bulan sebelum dilepas). Bila rumus BO berubah, ubah juga di sini (dijaga tes contoh spec).
 */

export type AssetRow = {
  id: number;
  name: string;
  branchId: number | null;
  branchName: string | null;
  purchasePrice: number;
  usefulLifeMonths: number;
  /** YYYY-MM-DD */
  purchasedOn: string;
  status: 'IN_USE' | 'DAMAGED' | 'LOST' | 'SOLD';
  disposedOn: string | null;
  saleAmount: number | null;
};

const idx = (yyyyMm: string) => {
  const [y, m] = yyyyMm.split('-').map(Number);
  return y * 12 + (m - 1);
};

function portion(price: number, life: number, k: number): number {
  if (k < 1 || k > life) return 0;
  const base = new Big(price).div(life).round(0, Big.roundDown);
  return k === life ? new Big(price).minus(base.times(life - 1)).toNumber() : base.toNumber();
}

function lastIndex(a: AssetRow): number | null {
  const start = idx(a.purchasedOn.slice(0, 7));
  let last = start + a.usefulLifeMonths - 1;
  if (a.status !== 'IN_USE' && a.disposedOn) last = Math.min(last, idx(a.disposedOn.slice(0, 7)) - 1);
  return last >= start ? last : null;
}

/** Penyusutan yang jatuh di bulan YYYY-MM. */
export function depreciationFor(a: AssetRow, month: string): number {
  const start = idx(a.purchasedOn.slice(0, 7));
  const last = lastIndex(a);
  const m = idx(month);
  if (last === null || m < start || m > last) return 0;
  return portion(a.purchasePrice, a.usefulLifeMonths, m - start + 1);
}

/** Sisa nilai di akhir bulan YYYY-MM (sebelum pelepasan). */
export function bookValueAfter(a: AssetRow, month: string): number {
  const start = idx(a.purchasedOn.slice(0, 7));
  const last = lastIndex(a);
  let acc = new Big(0);
  if (last !== null) {
    for (let m = start; m <= Math.min(last, idx(month)); m++) acc = acc.plus(portion(a.purchasePrice, a.usefulLifeMonths, m - start + 1));
  }
  return new Big(a.purchasePrice).minus(acc).toNumber();
}

/** Kerugian (positif) / untung (negatif) pelepasan bila jatuh di bulan YYYY-MM; null bila tidak. */
export function disposalLossIn(a: AssetRow, month: string): number | null {
  if (a.status === 'IN_USE' || !a.disposedOn || a.disposedOn.slice(0, 7) !== month) return null;
  const m = idx(month) - 1;
  const before = `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;
  return new Big(bookValueAfter(a, before)).minus(a.saleAmount ?? 0).toNumber();
}
