import type { BulkSaleRow } from "./types";

export type BulkSaleStockInfo = {
  stock: number;
  baseUomCode: string;
};

export type BulkSaleStockShortage = {
  productId: number;
  neededBase: number;
  stock: number;
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
    if (!info || neededBase <= info.stock) continue;
    shortages.set(productId, { productId, neededBase, stock: info.stock, baseUomCode: info.baseUomCode });
  }
  return shortages;
}

export function describeStockShortage(shortage: BulkSaleStockShortage) {
  const stock = shortage.stock.toLocaleString("id-ID");
  const needed = shortage.neededBase.toLocaleString("id-ID");
  const unit = shortage.baseUomCode ? ` ${shortage.baseUomCode}` : "";
  return shortage.stock <= 0
    ? `Stok kosong (${stock}${unit}), diminta ${needed}${unit}`
    : `Stok kurang: sisa ${stock}${unit}, diminta ${needed}${unit}`;
}
