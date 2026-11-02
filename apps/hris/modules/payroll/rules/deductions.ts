// Aturan murni L4c-2: jadwal cicilan Potongan Lain (GAJ-80) dan urutan pengambilan potongan (GAJ-75).
import { addPeriods, type IsoDate } from './salary';

/** Nominal dibagi rata, dibulatkan ke bawah ke rupiah; sisanya masuk cicilan terakhir. */
export function scheduleInstallments(amount: number, count: number, firstPeriod: IsoDate): { sequence: number; periodStart: IsoDate; amount: number }[] {
  const each = Math.floor(amount / count);
  return Array.from({ length: count }, (_, index) => ({
    sequence: index + 1,
    periodStart: addPeriods(firstPeriod, index),
    amount: index === count - 1 ? amount - each * (count - 1) : each,
  }));
}

export type DeductionGroup = 'a' | 'b' | 'c' | 'd';

export const GROUP_LABELS: Record<DeductionGroup, string> = {
  a: 'Telat, tidak hadir, dan denda',
  b: 'Kehilangan barang dan minus kas',
  c: 'Potongan Lain',
  d: 'Kasbon',
};

export type DeductionItem = { group: DeductionGroup; key: string; label: string; date: IsoDate; amount: number; carried?: boolean };
export type TakenItem = DeductionItem & { taken: number; left: number };

/**
 * GAJ-75: potongan diambil per kelompok (a) → (d) sampai pendapatan habis. Di tiap kelompok sisa dari slip sebelumnya
 * lebih dulu, lalu menurut tanggal kejadian (paling lama dulu). Yang tertampung sebagian dipotong sebagian;
 * sisanya dibawa ke slip berikutnya. Gaji bersih tidak pernah di bawah Rp0.
 */
export function takeDeductions(income: number, items: readonly DeductionItem[]): { items: TakenItem[]; net: number; carried: number } {
  const order: DeductionGroup[] = ['a', 'b', 'c', 'd'];
  const sorted = [...items].filter((i) => i.amount > 0).sort((x, y) => (
    order.indexOf(x.group) - order.indexOf(y.group)
    || Number(Boolean(y.carried)) - Number(Boolean(x.carried))
    || (x.date < y.date ? -1 : x.date > y.date ? 1 : 0)
  ));
  let room = Math.max(0, income);
  const result = sorted.map((item) => {
    const taken = Math.min(room, item.amount);
    room -= taken;
    return { ...item, taken, left: item.amount - taken };
  });
  return { items: result, net: room, carried: result.reduce((sum, i) => sum + i.left, 0) };
}

/** Batas keberatan: pukul 23.59 WIB hari ke-3 sejak diberi tahu (GAJ-81). */
export function objectionDeadline(notifiedAt: Date): Date {
  const wib = new Date(notifiedAt.getTime() + 7 * 3_600_000);
  const day = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() + 3, 23, 59, 59);
  return new Date(day - 7 * 3_600_000);
}
