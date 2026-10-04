import { calculateRowSubtotal } from "./bulk-sale-calculations";
import type { BulkSaleRow } from "./types";

// Produk + satuan + tier yang sama dianggap satu baris, sama seperti keranjang web POS.
// Satuan berbeda (SAK vs PCS) sengaja tetap baris terpisah.
export function isSameLine(row: Pick<BulkSaleRow, "productId" | "uomId" | "priceTier">, other: Pick<BulkSaleRow, "productId" | "uomId" | "priceTier">) {
  return row.productId === other.productId && row.uomId === other.uomId && row.priceTier === other.priceTier;
}

export function incrementRowQty(row: BulkSaleRow, by = 1): BulkSaleRow {
  const qty = row.qty + by;
  return { ...row, qty, subtotal: calculateRowSubtotal({ qty, unitPrice: row.unitPrice, discountAmount: row.discountAmount }) };
}

// Item terbaru selalu di atas: produk yang sudah ada dan ditambah lagi ikut naik ke atas.
export function incrementRowToTop(rows: BulkSaleRow[], id: string): BulkSaleRow[] {
  const target = rows.find((row) => row.id === id);
  if (!target) return rows;
  return [incrementRowQty(target), ...rows.filter((row) => row.id !== id)];
}

// Baris kembar dari sumber (IBT/Order Portal dengan produk dobel, draf lama) digabung ke
// kemunculan pertamanya: qty dan diskon item dijumlah, urutan baris lain tidak berubah.
export function mergeDuplicateRows(rows: BulkSaleRow[]): BulkSaleRow[] {
  const merged: BulkSaleRow[] = [];
  for (const row of rows) {
    const index = merged.findIndex((existing) => isSameLine(existing, row));
    if (index === -1) {
      merged.push(row);
      continue;
    }
    const target = merged[index];
    const qty = target.qty + row.qty;
    const discountAmount = target.discountAmount + row.discountAmount;
    merged[index] = {
      ...target,
      qty,
      discountAmount,
      subtotal: calculateRowSubtotal({ qty, unitPrice: target.unitPrice, discountAmount }),
    };
  }
  return merged;
}
