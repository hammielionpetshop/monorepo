// Barang kembali, rincian retur, dan tertunda (spec LT1 §14.1, LT2a). Aturan murni, tanpa DB.
import Big from 'big.js';
import { REASON_MIN } from './trip';

export type ReturnItemInput = { name?: string | null; quantity?: number | string | null; unit?: string | null };
export type ReturnItem = { name: string; quantity: string; unit: string };
export const RETURN_ITEMS_MAX = 20;

const squash = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();

/**
 * Rincian barang retur (§14.1 butir 2): 1–20 baris; nama 2–120 huruf, jumlah > 0 (paling banyak 2 angka di belakang
 * koma, maks 100.000), satuan 1–20 huruf. Jumlah dikembalikan sebagai teks desimal untuk kolom numeric.
 */
export function cleanReturnItems(items: ReturnItemInput[] | null | undefined):
  { ok: true; items: ReturnItem[] } | { ok: false; error: string } {
  const rows = (items ?? []).filter((i) => squash(i.name) || squash(String(i.quantity ?? '')) || squash(i.unit));
  if (!rows.length) return { ok: false, error: 'Isi barang retur: nama, jumlah, dan satuannya.' };
  if (rows.length > RETURN_ITEMS_MAX) return { ok: false, error: `Paling banyak ${RETURN_ITEMS_MAX} barang per laporan.` };
  const clean: ReturnItem[] = [];
  for (const [index, row] of rows.entries()) {
    const at = `Barang ke-${index + 1}`;
    const name = squash(row.name);
    if (name.length < 2 || name.length > 120) return { ok: false, error: `${at}: nama barang 2–120 huruf.` };
    const raw = squash(String(row.quantity ?? '')).replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) return { ok: false, error: `${at}: jumlah harus angka (boleh 2 angka di belakang koma).` };
    const quantity = new Big(raw);
    if (quantity.lte(0) || quantity.gt(100000)) return { ok: false, error: `${at}: jumlah harus lebih dari 0.` };
    const unit = squash(row.unit);
    if (unit.length < 1 || unit.length > 20) return { ok: false, error: `${at}: isi satuannya (mis. pcs, sak, dus).` };
    clean.push({ name, quantity: quantity.toFixed(quantity.round(0).eq(quantity) ? 0 : 2), unit });
  }
  return { ok: true, items: clean };
}

/** Tampilan jumlah: "2", "1,5". */
export function quantityText(value: string | number): string {
  const n = new Big(value);
  return (n.round(0).eq(n) ? n.toFixed(0) : n.toFixed(2).replace(/0$/, '')).replace('.', ',');
}

export type ReceiptStep = 'WAREHOUSE' | 'OWNER';
export type ReceiptResult = 'MATCH' | 'MISMATCH';
export const RESULT_LABELS: Record<ReceiptResult, string> = { MATCH: 'Sesuai', MISMATCH: 'Tidak sesuai' };

/**
 * Langkah penerimaan yang dibutuhkan (§14.1 butir 1): semua turun di Gudang; milik cabang lain diterima lagi di cabang
 * pemiliknya. Pemilik tak diketahui (laporan lama) dianggap Gudang.
 */
export function stepsNeeded(ownerBranchId: number | null, homeBranchId: number | null): ReceiptStep[] {
  return ownerBranchId != null && homeBranchId != null && ownerBranchId !== homeBranchId ? ['WAREHOUSE', 'OWNER'] : ['WAREHOUSE'];
}

/** Langkah berikutnya yang belum diterima, atau null bila sudah selesai. */
export function nextStep(needed: ReceiptStep[], done: ReceiptStep[]): ReceiptStep | null {
  return needed.find((s) => !done.includes(s)) ?? null;
}

/** Penerimaan: Sesuai, atau Tidak sesuai dengan catatan wajib (≥ 5 huruf, ≤ 300). */
export function cleanReceipt(result: string | null | undefined, note: string | null | undefined):
  { ok: true; result: ReceiptResult; note: string | null } | { ok: false; error: string } {
  if (result !== 'MATCH' && result !== 'MISMATCH') return { ok: false, error: 'Pilih Sesuai atau Tidak sesuai.' };
  const text = squash(note);
  if (text.length > 300) return { ok: false, error: 'Catatan paling panjang 300 huruf.' };
  if (result === 'MISMATCH' && text.length < REASON_MIN) return { ok: false, error: `Tulis apa yang tidak sesuai, paling sedikit ${REASON_MIN} huruf.` };
  return { ok: true, result, note: text || null };
}

/** Tertunda merah (LOG-57): lebih dari `redDays` hari sejak pertama tertunda. */
export function pendingRed(ageDays: number, redDays: number): boolean {
  return ageDays > redDays;
}
