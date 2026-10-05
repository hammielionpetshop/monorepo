import Big from 'big.js';
import { db, productStocks, productStockBatches, products, productUomConversions, productUomCosts, unitsOfMeasure, stockShortfalls, stockShortfallClearings, transactionItems, eq, and, isNull, sql, asc } from '../db';
import { fifoDeduct } from '@petshop/shared';

import { lockProductStocks } from './stock-lock'
import { resolveStockUom, stockQtyBase, StockConflictError } from './stock-validation'

/**
 * Stok tidak cukup untuk dikurangi. Membawa `shortfallQty` (base UOM) agar pemanggil
 * bisa membedakan kekurangan stok dari error tak terduga tanpa mencocokkan string pesan.
 * `message` sengaja dipertahankan sama dengan versi lama demi kompatibilitas pemanggil.
 */
export class InsufficientStockError extends Error {
  constructor(
    message: string,
    readonly productId: number,
    readonly shortfallQty: number
  ) {
    super(message);
    this.name = 'InsufficientStockError';
  }
}

export interface ProductUomOption {
  uomId: number
  name: string
  ratio: number  // berapa base UOM per 1 unit UOM ini (base UOM = 1)
}

export interface ProductWithStock {
  productId: number
  productName: string
  sku: string | null
  baseUomId: number
  baseUomName: string | null  // nama satuan dasar produk (mis. "Pcs", "Kg")
  currentQty: string  // decimal string, '0' jika tidak ada stok (selalu dalam base UOM)
  uoms: ProductUomOption[]  // satuan yang tersedia: base UOM + konversi
}

interface AddStockOptions {
  useDefaultUomCost?: boolean
  // true HANYA untuk barang yang benar-benar datang dari luar perusahaan (penerimaan PO dari
  // supplier). Saat true, qty masuk melunasi shortfall terbuka produk ini dulu (FIFO, tertua
  // dulu) sebelum sisanya dianggap stok baru — lihat settleOpenShortfalls. Transfer internal,
  // retur, void, dan koreksi nota BUKAN "barang baru dari luar" — jangan set true di situ.
  settleShortfalls?: boolean
  // Dipakai untuk mengisi stock_shortfall_clearings.referenceId (mis. purchaseOrderId).
  settleShortfallsReferenceId?: number | null
  // PO yang menerbitkan batch ini (penerimaan PO dari supplier). Ditinggal kosong untuk
  // jalur lain (retur, void, koreksi nota, transfer internal) — batch tetap dapat batchCode,
  // cuma tidak tertaut PO.
  purchaseOrderId?: number
}

export async function resolveInboundCostPrice(
  tx: any,
  branchId: number,
  productId: number,
  uomId: number,
  providedCostPrice: string,
  useDefaultUomCost: boolean,
): Promise<string> {
  if (!useDefaultUomCost || !new Big(providedCostPrice).eq(0)) {
    return providedCostPrice
  }

  const [defaultCost] = await tx
    .select({ costPrice: productUomCosts.costPrice })
    .from(productUomCosts)
    .where(and(
      eq(productUomCosts.productId, productId),
      eq(productUomCosts.branchId, branchId),
      eq(productUomCosts.uomId, uomId),
    ))
    .limit(1)

  return defaultCost ? String(defaultCost.costPrice) : providedCostPrice
}

export interface FallbackUomCost {
  uomId: number
  costPrice: unknown
  ratio: number | null
}

// Modal per base UOM untuk fallback HPP (dipakai saat batch FIFO kosong/tanpa modal):
// prioritas cost matrix UOM dasar → cost matrix UOM besar ÷ ratio (ambil ratio terbesar
// = satuan pembelian grosir) → defaultCostPrice produk. Mengembalikan null jika tak ada sumber.
export async function resolveFallbackCostPerBase(
  tx: any,
  branchId: number,
  productId: number,
  baseUomId: number,
  defaultCostPrice: unknown,
  prefetchedUomCosts?: FallbackUomCost[],
): Promise<Big | null> {
  const rows: FallbackUomCost[] = prefetchedUomCosts ?? await tx
    .select({
      uomId: productUomCosts.uomId,
      costPrice: productUomCosts.costPrice,
      ratio: productUomConversions.ratio,
    })
    .from(productUomCosts)
    .leftJoin(productUomConversions, and(
      eq(productUomConversions.productId, productUomCosts.productId),
      eq(productUomConversions.uomId, productUomCosts.uomId),
    ))
    .where(and(
      eq(productUomCosts.productId, productId),
      eq(productUomCosts.branchId, branchId),
    ))

  const validRows = rows.filter((r) => Number(r.costPrice) > 0)

  const baseRow = validRows.find((r) => r.uomId === baseUomId)
  if (baseRow) return new Big(String(baseRow.costPrice))

  const bigUomRows = validRows.filter((r) => r.uomId !== baseUomId && Number(r.ratio) > 0)
  if (bigUomRows.length > 0) {
    const best = bigUomRows.reduce((a, b) => (Number(b.ratio) > Number(a.ratio) ? b : a))
    return new Big(String(best.costPrice)).div(Number(best.ratio))
  }

  return Number(defaultCostPrice) > 0 ? new Big(String(defaultCostPrice)) : null
}

/**
 * Modal per satuan dasar (integer) untuk batch yang lahir dari hitungan ulang (SO / penyesuaian
 * manual) tanpa modal eksplisit. Rantainya sama dengan HPP fallback penjualan, supaya batch
 * tidak lahir bermodal 0 hanya karena modal di Manajemen Harga diisi di satuan besar. 0 bila
 * produk benar-benar belum punya modal di mana pun di cabang itu.
 */
export async function resolveBatchCostPerBase(
  tx: any,
  branchId: number,
  productId: number,
  baseUomId: number,
): Promise<number> {
  const [prod] = await tx
    .select({ defaultCostPrice: products.defaultCostPrice })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)
  const cost = await resolveFallbackCostPerBase(tx, branchId, productId, baseUomId, prod?.defaultCostPrice)
  return cost ? Math.round(cost.toNumber()) : 0
}

export type ShortfallClearingReferenceType = 'PO_RECEIVING' | 'STOCK_OPNAME' | 'MANUAL_ADJUSTMENT'

/**
 * Melunasi shortfall terbuka (FIFO, tertua dulu) untuk (productId, branchId) memakai qtyBase
 * yang tersedia untuk pelunasan. TIDAK mengubah batch/agregat — pemanggil yang menentukan
 * bagaimana qty ini dipakai (barang baru datang lewat `addStock`, atau hasil hitung ulang
 * SO/adjustment yang menetapkan agregat baru langsung). Mengembalikan qty yang berhasil
 * dilunasi (<= qtyBase), supaya pemanggil tahu sisanya untuk diperlakukan sebagai stok baru.
 */
export async function settleOpenShortfalls(
  tx: any,
  branchId: number,
  productId: number,
  qtyBase: number,
  costPriceAtClearing: number,
  referenceType: ShortfallClearingReferenceType,
  referenceId?: number | null,
): Promise<number> {
  if (qtyBase <= 0) return 0
  await lockProductStocks(tx, branchId, [productId])

  const openShortfalls = await tx
    .select()
    .from(stockShortfalls)
    .where(and(
      eq(stockShortfalls.branchId, branchId),
      eq(stockShortfalls.productId, productId),
      isNull(stockShortfalls.closedAt),
      isNull(stockShortfalls.writtenOffAt),
    ))
    .orderBy(asc(stockShortfalls.createdAt), asc(stockShortfalls.id))
    .for('update')

  let remaining = qtyBase
  let totalCleared = 0

  for (const shortfall of openShortfalls) {
    if (remaining <= 0) break
    const qtyCleared = Math.min(shortfall.qtyRemaining, remaining)
    if (qtyCleared <= 0) continue

    const newRemaining = shortfall.qtyRemaining - qtyCleared
    await tx
      .update(stockShortfalls)
      .set({
        qtyRemaining: newRemaining,
        closedAt: newRemaining === 0 ? new Date() : null,
      })
      .where(eq(stockShortfalls.id, shortfall.id))

    await tx.insert(stockShortfallClearings).values({
      shortfallId: shortfall.id,
      qtyCleared,
      costPriceAtClearing,
      referenceType,
      referenceId: referenceId ?? null,
    })

    // Penyesuaian HPP (true-up): kalau harga pelunas beda dari estimasi saat oversell dan
    // shortfall ini tertaut ke baris nota asli, sesuaikan cogs baris itu — snapshot originalCogs
    // sekali (pola sama seperti transaction-edit-service.ts), jangan sentuh qty/harga nota tercetak.
    if (costPriceAtClearing !== shortfall.costPricePerUnit && shortfall.sourceTransactionItemId) {
      const [item] = await tx
        .select({ cogs: transactionItems.cogs, originalCogs: transactionItems.originalCogs })
        .from(transactionItems)
        .where(eq(transactionItems.id, shortfall.sourceTransactionItemId))
        .limit(1)
      if (item) {
        const cogsDelta = (costPriceAtClearing - shortfall.costPricePerUnit) * qtyCleared
        await tx
          .update(transactionItems)
          .set({
            originalCogs: item.originalCogs ?? item.cogs ?? 0,
            cogs: sql`${transactionItems.cogs} + ${cogsDelta}`,
          })
          .where(eq(transactionItems.id, shortfall.sourceTransactionItemId))
      }
    }

    totalCleared += qtyCleared
    remaining -= qtyCleared
  }

  return totalCleared
}

/**
 * Tutup SEMUA shortfall terbuka untuk (productId, branchId) tanpa syarat qty — dipakai saat
 * SO Besar / adjustment manual menetapkan physical count sebagai kebenaran baru (keputusan
 * owner: hasil hitung fisik dianggap melunasi utang lama, apa pun jumlahnya, supaya PO
 * berikutnya tidak salah "melunasi" utang yang sebenarnya sudah terjawab oleh hitungan ulang).
 * TIDAK ada true-up HPP di sini (bukan pembelian baru dengan harga baru, cuma konfirmasi ulang
 * fisik) dan TIDAK mengubah batch — pemanggil yang menentukan itu.
 *
 * Mengembalikan total qty yang dimaafkan (`SUM(qtyRemaining)` sebelum ditutup). PENTING:
 * menutup shortfall mengurangi porsi yang dikurangkan dari agregat (lihat invarian di
 * deductStock), jadi kalau pemanggil TIDAK sudah merekonsiliasi batch≡agregat baru dari nol
 * (seperti applySOStockAdjustment & applyManualStockAdjustment lewat batchDelta), agregatnya
 * WAJIB ditambah nilai return ini secara eksplisit — kalau tidak, invarian
 * `qty = SUM(batch) - SUM(shortfall terbuka)` meleset sebesar nilai yang dimaafkan.
 */
export async function closeOpenShortfallsForRecount(
  tx: any,
  branchId: number,
  productId: number,
  referenceType: 'STOCK_OPNAME' | 'MANUAL_ADJUSTMENT',
  referenceId?: number | null,
): Promise<number> {
  await lockProductStocks(tx, branchId, [productId])
  const openShortfalls = await tx
    .select()
    .from(stockShortfalls)
    .where(and(
      eq(stockShortfalls.branchId, branchId),
      eq(stockShortfalls.productId, productId),
      isNull(stockShortfalls.closedAt),
      sql`${stockShortfalls.qtyRemaining} > 0`,
    ))
    .orderBy(asc(stockShortfalls.createdAt), asc(stockShortfalls.id))
    .for('update')

  let totalForgiven = 0
  for (const shortfall of openShortfalls) {
    await tx
      .update(stockShortfalls)
      .set({ qtyRemaining: 0, closedAt: new Date() })
      .where(eq(stockShortfalls.id, shortfall.id))

    await tx.insert(stockShortfallClearings).values({
      shortfallId: shortfall.id,
      qtyCleared: shortfall.qtyRemaining,
      costPriceAtClearing: shortfall.costPricePerUnit,
      referenceType,
      referenceId: referenceId ?? null,
    })

    totalForgiven += shortfall.qtyRemaining
  }

  return totalForgiven
}

export async function getProductsWithStock(branchId: number): Promise<ProductWithStock[]> {
  // Subquery: jumlahkan semua UOM row per produk di cabang ini, konversi ke base UOM.
  // Satuan dasar dipaksa ratio 1, tidak sekadar COALESCE: baris konversi untuk satuan dasar
  // dengan ratio selain 1 adalah data rusak, dan mengalikannya di sini akan menggelembungkan
  // stok sebesar ratio itu.
  const stockAgg = db
    .select({
      productId: productStocks.productId,
      totalBaseQty: sql<number>`SUM(${productStocks.qty} * CASE
        WHEN ${productStocks.uomId} = ${products.baseUomId} THEN 1
        ELSE COALESCE(${productUomConversions.ratio}, 1)
      END)`.as('total_base_qty'),
    })
    .from(productStocks)
    .innerJoin(products, eq(products.id, productStocks.productId))
    .leftJoin(
      productUomConversions,
      and(
        eq(productUomConversions.productId, productStocks.productId),
        eq(productUomConversions.uomId, productStocks.uomId)
      )
    )
    .where(eq(productStocks.branchId, branchId))
    .groupBy(productStocks.productId)
    .as('stock_agg')

  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      sku: products.sku,
      baseUomId: products.baseUomId,
      baseUomName: unitsOfMeasure.name,
      currentQty: sql<string>`COALESCE(${stockAgg.totalBaseQty}::text, '0')`,
    })
    .from(products)
    .leftJoin(stockAgg, eq(stockAgg.productId, products.id))
    .leftJoin(unitsOfMeasure, eq(unitsOfMeasure.id, products.baseUomId))
    .where(eq(products.isActive, true))
    .orderBy(asc(products.name))

  // Ambil semua konversi UOM untuk produk aktif, lalu kelompokkan per produk
  const conversions = await db
    .select({
      productId: productUomConversions.productId,
      uomId: productUomConversions.uomId,
      name: unitsOfMeasure.name,
      ratio: productUomConversions.ratio,
    })
    .from(productUomConversions)
    .innerJoin(unitsOfMeasure, eq(unitsOfMeasure.id, productUomConversions.uomId))

  const conversionsByProduct = new Map<number, ProductUomOption[]>()
  for (const c of conversions) {
    const list = conversionsByProduct.get(c.productId) ?? []
    list.push({ uomId: c.uomId, name: c.name, ratio: c.ratio })
    conversionsByProduct.set(c.productId, list)
  }

  return rows.map((r) => ({
    ...r,
    uoms: [
      { uomId: r.baseUomId, name: r.baseUomName ?? 'Satuan dasar', ratio: 1 },
      ...(conversionsByProduct.get(r.productId) ?? []),
    ],
  }))
}

export class StockService {
  /**
   * Deduct stock from a branch using FIFO.
   * qtyToDeduct boleh dalam UOM apapun — fungsi ini mengonversi ke base UOM secara internal.
   */
  static async deductStock(
    tx: any,
    branchId: number,
    productId: number,
    uomId: number,
    qtyToDeduct: number,
    allowNegative = false,
    prefetched?: {
      product?: any;
      ratio?: number;
      // Baris productUomCosts (cabang ini) untuk fallback HPP — array kosong = sudah
      // dicek dan memang tidak ada; undefined = belum di-prefetch (query saat dibutuhkan).
      uomCosts?: FallbackUomCost[];
    }
  ) {
    await lockProductStocks(tx, branchId, [productId])

    const { product: prod, baseUomId, ratio } = await resolveStockUom(tx, productId, uomId, prefetched)
    const qtyBase = stockQtyBase(qtyToDeduct, ratio)
    const [existingAgg] = await tx.select({ id: productStocks.id }).from(productStocks)
      .where(and(eq(productStocks.branchId, branchId), eq(productStocks.productId, productId), eq(productStocks.uomId, baseUomId)))
      .for('update').limit(1)

    // 1. Get batches sorted by received_at (tanpa filter uomId — semua batch dalam base UOM)
    const batches = await tx
      .select()
      .from(productStockBatches)
      .where(and(
        eq(productStockBatches.branchId, branchId),
        eq(productStockBatches.productId, productId),
        sql`${productStockBatches.qtyRemaining} > 0`
      ))
      .orderBy(asc(productStockBatches.receivedAt), asc(productStockBatches.id))
      .for('update')

    // 2. FIFO deduction dalam base UOM
    const result = fifoDeduct(
      batches.map((b: any) => ({
        batchId: b.id,
        qtyRemaining: parseFloat(b.qtyRemaining),
        costPrice: parseFloat(b.costPrice),
        receivedAt: b.receivedAt,
      })),
      qtyBase,
      allowNegative
    )

    if (!result.success) {
      throw new InsufficientStockError(
        result.error ?? 'Stok tidak cukup.',
        productId,
        result.shortfallQty
      )
    }

    // Porsi qty yang melebihi stok (oversell) — tidak tertutup batch
    const shortfallQty = result.shortfallQty ?? 0
    const coveredQty = qtyBase - shortfallQty

    // HPP fallback untuk porsi tanpa batch: (a) batch tertutup tapi tanpa harga modal,
    // (b) porsi oversell/shortfall. Sumber: cost matrix (productUomCosts) → defaultCostPrice.
    let totalCogs = result.totalCogs
    const needsCostFallback = (totalCogs === 0 && coveredQty > 0) || shortfallQty > 0
    let fallbackCost: Big | null = null
    if (needsCostFallback) {
      fallbackCost = await resolveFallbackCostPerBase(
        tx,
        branchId,
        productId,
        baseUomId,
        prod?.defaultCostPrice,
        prefetched?.uomCosts,
      )
      if (fallbackCost) {
        if (totalCogs === 0 && coveredQty > 0) {
          totalCogs = fallbackCost.times(coveredQty).toNumber()
        }
        if (shortfallQty > 0) {
          totalCogs = new Big(totalCogs).plus(fallbackCost.times(shortfallQty)).toNumber()
        }
      }
    }

    // 3. Update batches
    for (const deduction of result.deductions) {
      const changed = await tx
        .update(productStockBatches)
        .set({ qtyRemaining: sql`${productStockBatches.qtyRemaining} - ${deduction.qtyDeducted}` })
        .where(and(eq(productStockBatches.id, deduction.batchId), sql`${productStockBatches.qtyRemaining} >= ${deduction.qtyDeducted}`))
        .returning({ id: productStockBatches.id })
      if (changed.length !== 1) throw new StockConflictError('Stok berubah, silakan ulangi transaksi')
    }

    // 4. Update aggregate — selalu row base UOM.
    //    SENGAJA memotong `qtyBase` PENUH (coveredQty + shortfallQty), bukan cuma `coveredQty`.
    //    Ini membalikkan sebagian aritmatika "Fix A" (docs/audit-stok-nilai-vs-pos/
    //    DESAIN-PERBAIKAN-DEDUCTSTOCK.md) yang dulu sengaja memotong `coveredQty` saja supaya
    //    agregat tidak pernah menyimpang dari SUM(batch.qty_remaining) — itu perlu karena porsi
    //    oversell dulu TIDAK punya jejak apa pun, jadi kalau agregat ikut turun penuh, angkanya
    //    minus diam-diam tanpa penjelasan (bug asli yang menyebabkan selisih Nilai Stok vs POS).
    //    Sekarang porsi oversell PUNYA jejak (baris stock_shortfalls di bawah), jadi agregat boleh
    //    minus lagi — bedanya cuma sekarang berjejak, bukan diam-diam. Invarian yang berlaku:
    //      product_stocks.qty = SUM(batch.qty_remaining) − SUM(stock_shortfalls.qty_remaining terbuka)
    //    Batch sendiri TIDAK diubah caranya (tetap cuma turun `coveredQty` di atas) — batch
    //    merepresentasikan lot fisik nyata, tidak pernah minus.
    if (existingAgg) {
      await tx
        .update(productStocks)
        .set({ qty: sql`${productStocks.qty} - ${qtyBase}` })
        .where(eq(productStocks.id, existingAgg.id))
    } else {
      await tx.insert(productStocks).values({ productId, branchId, uomId: baseUomId, qty: -qtyBase })
    }

    // Dipakai pemanggil untuk mengisi stock_shortfalls.costPricePerUnit — deductStock sendiri
    // TIDAK menulis baris shortfall: itu perlu sourceTransactionId/sourceTransactionItemId
    // yang cuma diketahui pemanggil.
    const shortfallCostPricePerUnit = shortfallQty > 0 ? Math.round((fallbackCost?.toNumber()) ?? 0) : null

    return { ...result, totalCogs, shortfallQty, shortfallCostPricePerUnit, firstExpiryDate: batches.find((batch: any) => batch.id === result.deductions[0]?.batchId)?.expiryDate ?? null }
  }

  /**
   * Tambah stok ke cabang — konversi ke base UOM, insert batch, update aggregate.
   * qty dan costPrice dikirim dalam uomId caller; fungsi ini mengonversi ke base UOM secara internal.
   */
  static async addStock(
    tx: any,
    branchId: number,
    productId: number,
    uomId: number,
    qty: string,
    costPrice: string,
    receivedAt?: Date,
    expiryDate?: Date | null,
    options: AddStockOptions = {},
  ): Promise<void> {
    await lockProductStocks(tx, branchId, [productId])

    const { baseUomId, ratio } = await resolveStockUom(tx, productId, uomId)
    const qtyBase = stockQtyBase(qty, ratio)
    const [existing] = await tx.select({ id: productStocks.id }).from(productStocks)
      .where(and(eq(productStocks.productId, productId), eq(productStocks.branchId, branchId), eq(productStocks.uomId, baseUomId)))
      .for('update').limit(1)
    const effectiveCostPrice = await resolveInboundCostPrice(
      tx,
      branchId,
      productId,
      uomId,
      costPrice,
      options.useDefaultUomCost === true,
    )
    // costPrice per unit base UOM: cost_per_uomId / ratio
    const costPriceBase = Math.round(new Big(effectiveCostPrice).div(ratio).toNumber())

    // Kode tampilan batch, BTC-YYYYMMDD-NNNN per cabang per hari — sekadar penanda untuk
    // dilihat manusia (bukan kunci unik), sama seperti generator poNumber di
    // app/api/bo/purchase-orders/route.ts. Race antar produk berbeda di cabang/hari yang sama
    // secara teori bisa menghasilkan nomor kembar; diterima sama seperti pola PO yang sudah ada.
    const effectiveReceivedAt = receivedAt ?? new Date()
    const [batchCountRow] = await tx
      .select({ count: sql<number>`COUNT(*)` })
      .from(productStockBatches)
      .where(and(
        eq(productStockBatches.branchId, branchId),
        sql`DATE(${productStockBatches.receivedAt}) = CURRENT_DATE`,
      ))
      .limit(1)
    const batchIncrement = ((Number(batchCountRow?.count) || 0) + 1).toString().padStart(4, '0')
    const batchDateStr = effectiveReceivedAt.toISOString().slice(0, 10).replace(/-/g, '')
    const batchCode = `BTC-${batchDateStr}-${batchIncrement}`

    // Insert batch — uomId asli disimpan sebagai audit trail, qty dalam base UOM.
    // qtyReceived TETAP qtyBase penuh (laporan pembelian tidak boleh diam-diam dikurangi),
    // tapi qtyRemaining bisa dikurangi porsi pelunasan shortfall di bawah — qtyRemaining
    // artinya "sisa yang benar-benar tersedia untuk dijual", bukan "yang diterima".
    const [insertedBatch] = await tx.insert(productStockBatches).values({
      productId,
      branchId,
      uomId,
      qtyReceived: qtyBase,
      qtyRemaining: qtyBase,
      costPrice: costPriceBase,
      receivedAt: effectiveReceivedAt,
      expiryDate: expiryDate ?? null,
      batchCode,
      purchaseOrderId: options.purchaseOrderId ?? null,
    }).returning({ id: productStockBatches.id })

    // Lunasi shortfall terbuka dulu (kalau ini barang genuinely baru dari luar). Porsi yang
    // melunasi ditarik LANGSUNG dari batch yang baru saja dicatat (qtyRemaining turun sebesar
    // clearedQty) — bukan dari agregat. Ini membuat pelunasan jadi perpindahan netral: batch
    // turun X, shortfall turun X, jadi (batch − shortfall) TIDAK berubah akibat pelunasan itu
    // sendiri. Efeknya, agregat SELALU cukup ditambah qtyBase penuh di bawah, apa pun clearedQty-nya
    // — lihat komentar invarian di deductStock. (Sebelumnya agregat sempat dikurangi clearedQty lagi
    // di sini, di atas batch yang tidak ikut dikurangi — pengurangan ganda yang membuat invarian
    // meleset sebesar 2×clearedQty; sudah diperbaiki.)
    const clearedQty = options.settleShortfalls
      ? await settleOpenShortfalls(
          tx,
          branchId,
          productId,
          qtyBase,
          costPriceBase,
          'PO_RECEIVING',
          options.settleShortfallsReferenceId,
        )
      : 0

    if (clearedQty > 0) {
      await tx
        .update(productStockBatches)
        .set({ qtyRemaining: sql`${productStockBatches.qtyRemaining} - ${clearedQty}` })
        .where(eq(productStockBatches.id, insertedBatch.id))
    }

    // Upsert agregat ke row satuan dasar
    if (existing) {
      await tx
        .update(productStocks)
        .set({ qty: sql`${productStocks.qty} + ${qtyBase}` })
        .where(eq(productStocks.id, existing.id))
    } else {
      await tx.insert(productStocks).values({ productId, branchId, uomId: baseUomId, qty: qtyBase })
    }
  }
}
