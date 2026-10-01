import { transactionItems, products, productUomConversions, eq, inArray } from '../db';

export interface BulkSaleMatchItem {
  id: number;
  productId: number;
  uomId: number;
  qtyRequested: number;
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
 * Satu produk bisa muncul di lebih dari satu baris item (IBT lama, atau satuan berbeda). Qty
 * terjualnya DIBAGI ke baris-baris itu, bukan disalin ke tiap baris — menyalin membuat qty kirim,
 * stok masuk cabang tujuan, dan hutang internal dobel (kasus IBT-20261001-0001).
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

  const itemsByProduct = new Map<number, BulkSaleMatchItem[]>();
  for (const item of items) {
    const group = itemsByProduct.get(item.productId) ?? [];
    group.push(item);
    itemsByProduct.set(item.productId, group);
  }

  for (const [productId, group] of itemsByProduct) {
    let remainingBase = soldBaseByProduct.get(productId) ?? 0;

    // Satuan request tidak dikenal di konversi — tak bisa dikonversi balik, anggap 0 daripada
    // menebak (kasus data rusak yang seharusnya tak pernah terjadi di jalur normal).
    const convertible: { item: BulkSaleMatchItem; ratio: number }[] = [];
    for (const item of group) {
      const ratio = ratioMap.get(`${item.productId}-${item.uomId}`);
      if (ratio === undefined) result.set(item.id, 0);
      else convertible.push({ item, ratio });
    }

    // Satuan terbesar diisi lebih dulu sampai qty requestnya; sisa jatuh ke baris terakhir
    // (satuan terkecil) supaya pecahan base tidak hilang karena pembulatan ke bawah.
    convertible.sort((a, b) => b.ratio - a.ratio);
    convertible.forEach(({ item, ratio }, idx) => {
      const isLast = idx === convertible.length - 1;
      const fit = Math.floor(Math.max(remainingBase, 0) / ratio);
      const qty = isLast ? fit : Math.min(fit, Math.max(item.qtyRequested, 0));
      result.set(item.id, qty);
      remainingBase -= qty * ratio;
    });
  }

  return result;
}
