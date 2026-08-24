import { transactionItems, products, productUomConversions, eq, inArray } from '../db';

export interface BulkSaleMatchItem {
  id: number;
  productId: number;
  uomId: number;
}

/**
 * Untuk IBT yang sudah dikonversi jadi Bulk Sale: hitung qty yang benar-benar terjual per
 * baris item transfer, dikonversi ke satuan request semula item itu.
 *
 * Dicocokkan lewat productId + base UOM, BUKAN productId+uomId mentah — kasir bebas menjual
 * dalam satuan berbeda dari yang direquest di IBT (mis. diminta PCS, dijual per DUS di Bulk
 * Sale). Menyamakan lewat uomId mentah membuat item yang sebenarnya terjual salah dianggap
 * "tidak diproses" begitu satuannya beda, walau produknya sama.
 *
 * Asumsi: satu produk hanya muncul di satu baris item per transfer (pola pembuatan/edit IBT
 * saat ini tidak pernah menghasilkan dua baris produk sama dengan uom berbeda dalam satu
 * transfer) — kalau itu terjadi, qty terjualnya akan dihitung ganda ke tiap barisnya.
 */
export async function resolveBulkSaleQtyByItem(
  db: any,
  convertedTransactionId: number,
  items: BulkSaleMatchItem[]
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (items.length === 0) return result;

  const soldItems = await db
    .select({
      productId: transactionItems.productId,
      uomId: transactionItems.uomId,
      qty: transactionItems.qty,
    })
    .from(transactionItems)
    .where(eq(transactionItems.transactionId, convertedTransactionId));

  const productIds = [
    ...new Set([
      ...items.map((i) => i.productId),
      ...soldItems.filter((s: { productId: number | null }) => s.productId != null).map((s: { productId: number }) => s.productId),
    ]),
  ];

  const [productRows, convRows] = await Promise.all([
    db.select({ id: products.id, baseUomId: products.baseUomId }).from(products).where(inArray(products.id, productIds)),
    db
      .select({ productId: productUomConversions.productId, uomId: productUomConversions.uomId, ratio: productUomConversions.ratio })
      .from(productUomConversions)
      .where(inArray(productUomConversions.productId, productIds)),
  ]);

  // ratio: "1 uomId = ratio × base UOM" — base sendiri berasio 1.
  const ratioMap = new Map<string, number>();
  for (const p of productRows as { id: number; baseUomId: number }[]) ratioMap.set(`${p.id}-${p.baseUomId}`, 1);
  for (const c of convRows as { productId: number; uomId: number; ratio: number }[]) ratioMap.set(`${c.productId}-${c.uomId}`, c.ratio);

  const soldBaseByProduct = new Map<number, number>();
  for (const s of soldItems as { productId: number | null; uomId: number; qty: number }[]) {
    if (s.productId == null) continue;
    const ratio = ratioMap.get(`${s.productId}-${s.uomId}`);
    if (ratio === undefined) continue; // satuan jual tak dikenal di konversi — diabaikan, bukan crash
    soldBaseByProduct.set(s.productId, (soldBaseByProduct.get(s.productId) ?? 0) + s.qty * ratio);
  }

  for (const item of items) {
    const totalBase = soldBaseByProduct.get(item.productId) ?? 0;
    if (totalBase <= 0) {
      result.set(item.id, 0);
      continue;
    }
    const itemRatio = ratioMap.get(`${item.productId}-${item.uomId}`);
    // Satuan request item ini tidak dikenal di konversi — tak bisa dikonversi balik, anggap 0
    // daripada menebak (kasus data rusak yang seharusnya tak pernah terjadi di jalur normal).
    result.set(item.id, itemRatio === undefined ? 0 : Math.floor(totalBase / itemRatio));
  }

  return result;
}
