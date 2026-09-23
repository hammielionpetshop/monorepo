import { purchaseOrders, like, desc } from '@petshop/db';
import type { db } from '@/lib/db';

type Executor = Pick<typeof db, 'select'>;

const WIB_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function poDateStr(now: Date): string {
  return WIB_DATE.format(now).replace(/-/g, '');
}

export function formatPoNumber(dateStr: string, sequence: number): string {
  return `PO-${dateStr}-${sequence.toString().padStart(4, '0')}`;
}

export function nextPoSequence(lastPoNumber: string | null | undefined): number {
  const last = Number.parseInt(lastPoNumber?.split('-')[2] ?? '', 10);
  return Number.isInteger(last) && last > 0 ? last + 1 : 1;
}

/**
 * `po_number` UNIQUE lintas cabang, jadi nomor urut harian harus dihitung dari
 * semua cabang — menghitung per cabang membuat cabang kedua hari itu bentrok
 * dengan `-0001` milik cabang pertama.
 */
export async function generatePoNumber(executor: Executor, now = new Date()): Promise<string> {
  const dateStr = poDateStr(now);
  const [last] = await executor
    .select({ poNumber: purchaseOrders.poNumber })
    .from(purchaseOrders)
    .where(like(purchaseOrders.poNumber, `PO-${dateStr}-%`))
    .orderBy(desc(purchaseOrders.poNumber))
    .limit(1);

  return formatPoNumber(dateStr, nextPoSequence(last?.poNumber));
}

export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && typeof current === 'object' && current !== null; depth++) {
    if ((current as { code?: unknown }).code === '23505') return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
