import type { BulkSaleRow } from "./types";

export type BulkSaleStockInfo = {
  stock: number;
  /** Ditahan Daftar Tunggu — dianggap sudah terpakai saat menilai cukup/tidaknya stok. */
  reserved?: number;
  baseUomCode: string;
};

export type BulkSaleStockShortage = {
  productId: number;
  neededBase: number;
  stock: number;
  reserved: number;
  baseUomCode: string;
};

// Stok cabang tersimpan dalam satuan dasar, sedangkan baris bisa DUS/LUSIN/PCS sekaligus
// untuk produk yang sama — jadi kebutuhannya dijumlah per produk setelah dikali rasio,
// bukan dibandingkan per baris. Produk tanpa data stok (belum termuat) tidak dinilai.
export function findStockShortages(
  rows: Pick<BulkSaleRow, "productId" | "uomId" | "qty" | "availableUoms">[],
  stockByProduct: Map<number, BulkSaleStockInfo>,
): Map<number, BulkSaleStockShortage> {
  const neededByProduct = new Map<number, number>();
  for (const row of rows) {
    const ratio = row.availableUoms.find((uom) => uom.uomId === row.uomId)?.conversionRate ?? 1;
    neededByProduct.set(row.productId, (neededByProduct.get(row.productId) ?? 0) + row.qty * ratio);
  }

  const shortages = new Map<number, BulkSaleStockShortage>();
  for (const [productId, neededBase] of neededByProduct) {
    const info = stockByProduct.get(productId);
    const reserved = info?.reserved ?? 0;
    if (!info || neededBase <= info.stock - reserved) continue;
    shortages.set(productId, { productId, neededBase, stock: info.stock, reserved, baseUomCode: info.baseUomCode });
  }
  return shortages;
}

export function describeStockShortage(shortage: BulkSaleStockShortage) {
  const stock = shortage.stock.toLocaleString("id-ID");
  const needed = shortage.neededBase.toLocaleString("id-ID");
  const unit = shortage.baseUomCode ? ` ${shortage.baseUomCode}` : "";
  if (shortage.stock <= 0) return `Stok kosong (${stock}${unit}), diminta ${needed}${unit}`;
  if (shortage.reserved > 0) {
    const reserved = shortage.reserved.toLocaleString("id-ID");
    return `Stok kurang: sisa ${stock}${unit}, ${reserved}${unit} ditahan Daftar Tunggu, diminta ${needed}${unit}`;
  }
  return `Stok kurang: sisa ${stock}${unit}, diminta ${needed}${unit}`;
}
