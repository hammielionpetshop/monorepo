import Big from 'big.js';
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

export interface BulkSaleSoldLine {
  productId: number;
  uomId: number;
  qty: number;
  // Nilai bersih baris (sudah dipotong diskon) — sama dengan total_price di nota.
  lineTotal: number;
}

export interface IbtPriceSyncPlan {
  updates: { id: number; costPriceAtTransfer: number }[];
  inserts: { productId: number; uomId: number; costPriceAtTransfer: number }[];
}

/**
 * Harga tagih tiap baris IBT saat dikonversi jadi Bulk Sale, supaya piutang internal
 * (qtyReceived × costPriceAtTransfer) = nilai nota (kanban #43).
 *
 * - Harga dihitung per satuan dasar dari nota (rata-rata tertimbang bila produk dijual
 *   dalam beberapa satuan), lalu dikalikan rasio satuan baris IBT. Dulu harga per satuan
 *   jual disalin mentah hanya bila satuannya sama persis — dipesan PCS, dijual SAK membuat
 *   qty dikonversi ke PCS tapi harganya tetap per SAK (piutang berlipat, IBT-20260903-0005).
 * - Produk yang ada di nota tapi tidak ada di PO Internal ditambahkan sebagai baris baru
 *   (qtyRequested 0) — dulu tidak ikut dikirim/diterima/ditagih (IBT-20260915-0001).
 *   Satuannya = satuan jual bila cuma satu, selain itu satuan dasar supaya qty tak terpotong.
 * - Dijual dalam satuan lebih kecil dari yang dipesan (dipesan 1 DUS, dijual 2 BOX): alokasi
 *   resolveBulkSaleQtyByItem membulatkan ke bawah per satuan baris, sisanya dulu hilang — tidak
 *   terkirim, tidak tertagih (IBT-20260914-0001). Sisa itu kini jadi baris satuan dasar baru.
 */
export function planIbtPriceSync(
  ibtItems: { id: number; productId: number; uomId: number; qtyRequested: number }[],
  soldLines: BulkSaleSoldLine[],
  ratioMap: Map<string, number>,
  baseUomByProduct: Map<number, number>
): IbtPriceSyncPlan {
  const plan: IbtPriceSyncPlan = { updates: [], inserts: [] };

  const byProduct = new Map<number, { net: Big; base: Big; uomIds: Set<number> }>();
  for (const line of soldLines) {
    if (line.qty <= 0) continue;
    const ratio = ratioMap.get(`${line.productId}-${line.uomId}`);
    if (ratio === undefined) continue;
    const agg = byProduct.get(line.productId) ?? { net: new Big(0), base: new Big(0), uomIds: new Set<number>() };
    agg.net = agg.net.plus(line.lineTotal);
    agg.base = agg.base.plus(new Big(line.qty).times(ratio));
    agg.uomIds.add(line.uomId);
    byProduct.set(line.productId, agg);
  }

  const priceFor = (productId: number, uomId: number): number | null => {
    const agg = byProduct.get(productId);
    const ratio = ratioMap.get(`${productId}-${uomId}`);
    if (!agg || agg.base.eq(0) || ratio === undefined) return null;
    return Number(agg.net.div(agg.base).times(ratio).round(0));
  };

  const requestedProducts = new Set<number>();
  for (const item of ibtItems) {
    requestedProducts.add(item.productId);
    const price = priceFor(item.productId, item.uomId);
    if (price !== null && price > 0) plan.updates.push({ id: item.id, costPriceAtTransfer: price });
  }

  // Simulasi alokasi yang sama dengan resolveBulkSaleQtyByItem untuk mendeteksi sisa
  // satuan dasar yang tak tertampung baris mana pun.
  for (const productId of requestedProducts) {
    const agg = byProduct.get(productId);
    const baseUomId = baseUomByProduct.get(productId);
    if (!agg || baseUomId === undefined) continue;
    const rows = ibtItems
      .filter((item) => item.productId === productId)
      .map((item) => ({ item, ratio: ratioMap.get(`${productId}-${item.uomId}`) }))
      .filter((row): row is { item: (typeof ibtItems)[number]; ratio: number } => row.ratio !== undefined);
    if (rows.some((row) => row.ratio === 1)) continue;
    rows.sort((a, b) => b.ratio - a.ratio);
    let remaining = Number(agg.base);
    rows.forEach(({ item, ratio }, idx) => {
      const fit = Math.floor(Math.max(remaining, 0) / ratio);
      const qty = idx === rows.length - 1 ? fit : Math.min(fit, Math.max(item.qtyRequested, 0));
      remaining -= qty * ratio;
    });
    if (remaining > 0) {
      const price = priceFor(productId, baseUomId);
      if (price !== null && price > 0) plan.inserts.push({ productId, uomId: baseUomId, costPriceAtTransfer: price });
    }
  }

  for (const [productId, agg] of byProduct) {
    if (requestedProducts.has(productId)) continue;
    const uomId = agg.uomIds.size === 1 ? [...agg.uomIds][0] : baseUomByProduct.get(productId);
    if (uomId === undefined) continue;
    const price = priceFor(productId, uomId);
    if (price !== null && price > 0) plan.inserts.push({ productId, uomId, costPriceAtTransfer: price });
  }

  return plan;
}

// Peta rasio "productId-uomId" → rasio ke satuan dasar (satuan dasar = 1), plus satuan
// dasar per produk. Dipakai bersama oleh resolveBulkSaleQtyByItem & sinkron harga.
export async function loadUomRatios(db: any, productIds: number[]) {
  const ratioMap = new Map<string, number>();
  const baseUomByProduct = new Map<number, number>();
  if (productIds.length === 0) return { ratioMap, baseUomByProduct };
  const [productRows, convRows] = await Promise.all([
    db.select({ id: products.id, baseUomId: products.baseUomId }).from(products).where(inArray(products.id, productIds)),
    db
      .select({ productId: productUomConversions.productId, uomId: productUomConversions.uomId, ratio: productUomConversions.ratio })
      .from(productUomConversions)
      .where(inArray(productUomConversions.productId, productIds)),
  ]);
  for (const p of productRows as { id: number; baseUomId: number }[]) {
    ratioMap.set(`${p.id}-${p.baseUomId}`, 1);
    baseUomByProduct.set(p.id, p.baseUomId);
  }
  for (const c of convRows as { productId: number; uomId: number; ratio: number }[]) ratioMap.set(`${c.productId}-${c.uomId}`, c.ratio);
  return { ratioMap, baseUomByProduct };
}
