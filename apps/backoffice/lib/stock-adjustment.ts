import { lockProductStocks } from './services/stock-lock'
import { resolveStockUom, stockQtyBase, StockConflictError } from './services/stock-validation'
import Big from 'big.js'
import { db, eq, and, desc, asc, sql, isNull, productStocks, productStockBatches, auditLogs, stockAdjustments, products, productUomConversions, stockShortfalls } from './db'
import { fifoDeduct } from '@petshop/shared'
import { InsufficientStockError, resolveBatchCostPerBase, closeOpenShortfallsForRecount } from './services/stock-service'

// Extract the transaction type from db
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface ManualAdjustmentItem {
  productId: number
  branchId: number
  uomId: number         // baseUomId produk
  previousQty: string   // qty saat ini dari productStocks (decimal string)
  newQty: string        // qty baru yang diinput owner (decimal string)
  reason: string        // wajib tidak kosong
  adjustedById: number  // userId dari JWT payload
  costPricePerUnit?: number // HPP per unit (wajib saat penambahan stok)
}

/**
 * Terapkan penyesuaian stok manual — sekaligus merekonsiliasi `product_stock_batches`
 * (dasar laporan Nilai Stok) ke `product_stocks` (dasar POS), sama seperti
 * `applySOStockAdjustment`.
 *
 * Kenapa: dulu fungsi ini cuma menerapkan `delta` yang sama ke agregat dan batch, sehingga
 * drift lama antara keduanya ikut terbawa. Contoh nyata: stok Gudang disesuaikan ke 0, tapi
 * batch masih tersisa 720 — Nilai Stok tetap menampilkan nilainya. Qty baru yang diinput
 * adalah hitungan fisik, jadi batch disamakan ke angka itu, bukan cuma digeser sebesar delta.
 *
 * Invarian yang dijaga: `qty = SUM(batch) - SUM(shortfall terbuka)`. Penambahan menutup
 * shortfall terbuka (keputusan owner, lihat closeOpenShortfallsForRecount), jadi targetnya
 * SUM(batch) = qty baru. Pengurangan tidak menutup shortfall, jadi batch disisakan sebesar
 * qty baru + shortfall terbuka.
 */
export async function applyManualStockAdjustment(tx: Tx, item: ManualAdjustmentItem): Promise<{ stockAdjustmentId: number }> {
  await lockProductStocks(tx, item.branchId, [item.productId])
  const { baseUomId } = await resolveStockUom(tx, item.productId, item.uomId)
  if (baseUomId !== item.uomId) throw new StockConflictError('Penyesuaian manual harus memakai satuan dasar')
  stockQtyBase(item.newQty, 1, true)
  const prev = new Big(item.previousQty)
  const next = new Big(item.newQty)
  const delta = next.minus(prev)

  if (next.lt(0)) {
    throw new Error('Kuantitas baru tidak boleh negatif')
  }

  if (delta.eq(0)) {
    throw new Error('Kuantitas baru sama dengan stok saat ini, tidak ada perubahan')
  }

  // WAJIB: Pessimistic lock sebelum mutasi stok
  const [current] = await tx
    .select({ id: productStocks.id, qty: productStocks.qty })
    .from(productStocks)
    .where(
      and(
        eq(productStocks.productId, item.productId),
        eq(productStocks.branchId, item.branchId),
        eq(productStocks.uomId, item.uomId)
      )
    )
    .for('update')
  if (!new Big(current?.qty ?? 0).eq(prev)) throw new StockConflictError('Stok berubah, silakan ulangi penyesuaian')

  const newQty = Math.round(next.toNumber())

  const [inserted] = await tx.insert(stockAdjustments).values({
    productId: item.productId,
    branchId: item.branchId,
    adjustedById: item.adjustedById,
    previousQty: Math.round(prev.toNumber()),
    newQty,
    reason: item.reason,
  }).returning({ id: stockAdjustments.id })

  // Penambahan manual = physical count baru dianggap kebenaran — tutup shortfall terbuka
  // produk ini. Pengurangan TIDAK menutup shortfall: mengurangi stok bukan "recount naik",
  // tidak ada dasar untuk bilang utang lama sudah terjawab.
  let openShortfallQty = 0
  if (delta.gt(0)) {
    await closeOpenShortfallsForRecount(tx, item.branchId, item.productId, 'MANUAL_ADJUSTMENT', inserted.id)
  } else {
    const [open] = await tx
      .select({ qty: sql<string>`COALESCE(SUM(${stockShortfalls.qtyRemaining}), 0)` })
      .from(stockShortfalls)
      .where(and(
        eq(stockShortfalls.productId, item.productId),
        eq(stockShortfalls.branchId, item.branchId),
        isNull(stockShortfalls.closedAt),
        sql`${stockShortfalls.qtyRemaining} > 0`,
      ))
    openShortfallQty = Number(open?.qty ?? 0)
  }

  const batchRows = await tx
    .select({
      id: productStockBatches.id,
      qtyRemaining: productStockBatches.qtyRemaining,
      costPrice: productStockBatches.costPrice,
      receivedAt: productStockBatches.receivedAt,
    })
    .from(productStockBatches)
    .where(
      and(
        eq(productStockBatches.productId, item.productId),
        eq(productStockBatches.branchId, item.branchId),
        sql`${productStockBatches.qtyRemaining} > 0`
      )
    )
    .orderBy(asc(productStockBatches.receivedAt), asc(productStockBatches.id))
    .for('update')
  const batchBefore = batchRows.reduce((sum, b) => sum + Number(b.qtyRemaining), 0)
  const batchDelta = newQty + openShortfallQty - batchBefore

  if (current) {
    await tx.update(productStocks).set({ qty: newQty }).where(eq(productStocks.id, current.id))
  } else {
    await tx.insert(productStocks).values({
      productId: item.productId,
      branchId: item.branchId,
      uomId: item.uomId,
      qty: newQty,
    })
  }

  if (batchDelta > 0) {
    const costPrice = item.costPricePerUnit
      ? item.costPricePerUnit
      : await resolveBatchCostPerBase(tx, item.branchId, item.productId, baseUomId)

    await tx.insert(productStockBatches).values({
      productId: item.productId,
      branchId: item.branchId,
      uomId: item.uomId,
      qtyReceived: batchDelta,
      qtyRemaining: batchDelta,
      costPrice,
    })
  } else if (batchDelta < 0) {
    // need <= batchBefore selalu (target tidak pernah negatif), jadi FIFO pasti cukup.
    const result = fifoDeduct(
      batchRows.map((b) => ({
        batchId: b.id,
        qtyRemaining: Number(b.qtyRemaining),
        costPrice: Number(b.costPrice),
        receivedAt: b.receivedAt,
      })),
      -batchDelta,
    )
    if (!result.success) {
      throw new InsufficientStockError(result.error ?? 'Stok tidak cukup.', item.productId, result.shortfallQty)
    }
    for (const deduction of result.deductions) {
      const changed = await tx
        .update(productStockBatches)
        .set({ qtyRemaining: sql`${productStockBatches.qtyRemaining} - ${deduction.qtyDeducted}` })
        .where(and(eq(productStockBatches.id, deduction.batchId), sql`${productStockBatches.qtyRemaining} >= ${deduction.qtyDeducted}`))
        .returning({ id: productStockBatches.id })
      if (changed.length !== 1) throw new StockConflictError('Stok berubah, silakan ulangi penyesuaian')
    }
  }

  await tx.insert(auditLogs).values({
    branchId: item.branchId,
    userId: item.adjustedById,
    action: 'MANUAL_STOCK_ADJUSTMENT',
    tableName: 'product_stocks',
    oldData: JSON.stringify({ qty: item.previousQty, batchBefore }),
    newData: JSON.stringify({ qty: item.newQty, reason: item.reason, batchDelta }),
  })

  return { stockAdjustmentId: inserted.id }
}

interface SOItem {
  productId: number;
  branchId: number;
  uomId: number;
  systemQty: number | string;
  physicalQty: number | string;
  currentUserId?: number;
  soId?: number; // dipakai sebagai referenceId saat menutup shortfall terbuka (lihat bawah)
}

/**
 * Terapkan hasil stock opname ke stok nyata — sekaligus merekonsiliasi
 * `product_stock_batches` (dasar laporan Nilai Stok) ke `product_stocks` (dasar
 * POS), bukan cuma menambah selisih hitungan di atasnya.
 *
 * Kenapa: sebelumnya fungsi ini cuma menambah/mengurangi batch sebesar `variance`
 * (physicalQty - systemQty), dengan asumsi total batch sebelum SO sudah akurat.
 * Kalau ada drift lama antara agregat dan batch (mis. stok pernah minus tanpa
 * batch pendukung), drift itu ikut terbawa terus — Nilai Stok jadi tidak pernah
 * sama dengan POS walau SO sudah di-approve. SO adalah momen paling dipercaya
 * untuk tahu qty yang benar, jadi approval-nya sekalian menutup drift itu:
 * target batch dihitung dari `agregat_sebelum + variance`, bukan dari
 * `batch_sebelum + variance`.
 */
export async function applySOStockAdjustment(tx: Tx, item: SOItem): Promise<void> {
  const systemQty = new Big(item.systemQty);
  const physicalQty = new Big(item.physicalQty);
  const variance = physicalQty.minus(systemQty);

  // Selisih 0 TIDAK boleh dilewati. Hitungan fisik yang cocok dengan sistem justru bukti
  // agregat sudah benar — dan batch yang menyimpang harus disamakan ke sana. Dulu item
  // seperti ini di-skip, sehingga SO Besar tidak pernah membersihkan selisih batch vs
  // agregat pada produk yang hitungannya cocok (docs/audit-stok-nilai-vs-pos/).
  const rekonsiliasiSaja = variance.eq(0);

  await lockProductStocks(tx, item.branchId, [item.productId])
  const { baseUomId, ratio } = await resolveStockUom(tx, item.productId, item.uomId)
  if (!rekonsiliasiSaja) stockQtyBase(item.physicalQty, ratio, true)
  const varianceBase = variance.times(ratio).toNumber()
  if (!Number.isSafeInteger(varianceBase)) throw new StockConflictError('Selisih stok dalam satuan dasar harus bilangan bulat')

  // WAJIB: kunci agregat + semua batch produk ini sebelum baca kondisi "sebelum",
  // supaya penjualan/PO yang jalan bersamaan tidak ikut terhitung dobel di rekonsiliasi.
  const [aggRow] = await tx
    .select({ id: productStocks.id, qty: productStocks.qty })
    .from(productStocks)
    .where(and(
      eq(productStocks.productId, item.productId),
      eq(productStocks.branchId, item.branchId),
      eq(productStocks.uomId, baseUomId),
    ))
    .for('update')
    .limit(1)
  const aggBefore = aggRow ? Number(aggRow.qty) : 0

  const batchRows = await tx
    .select({
      id: productStockBatches.id,
      qtyRemaining: productStockBatches.qtyRemaining,
      costPrice: productStockBatches.costPrice,
      receivedAt: productStockBatches.receivedAt,
    })
    .from(productStockBatches)
    .where(and(
      eq(productStockBatches.productId, item.productId),
      eq(productStockBatches.branchId, item.branchId),
      sql`${productStockBatches.qtyRemaining} > 0`,
    ))
    .orderBy(asc(productStockBatches.receivedAt), asc(productStockBatches.id))
    .for('update')
  const batchBefore = batchRows.reduce((sum, b) => sum + Number(b.qtyRemaining), 0)

  const targetAgg = aggBefore + varianceBase
  const batchDelta = targetAgg - batchBefore

  if (aggRow) {
    await tx.update(productStocks).set({ qty: targetAgg }).where(eq(productStocks.id, aggRow.id))
  } else {
    await tx.insert(productStocks).values({ productId: item.productId, branchId: item.branchId, uomId: baseUomId, qty: targetAgg })
  }

  if (batchDelta > 0) {
    // Selisih tambahan (termasuk drift lama yang tertutup) dicatat sebagai satu
    // batch koreksi baru — costPrice fallback, sama seperti selisih hitungan biasa,
    // karena ini bukan pembelian nyata.
    const costPrice = await resolveBatchCostPerBase(tx, item.branchId, item.productId, baseUomId)
    await tx.insert(productStockBatches).values({
      productId: item.productId,
      branchId: item.branchId,
      uomId: baseUomId,
      qtyReceived: batchDelta,
      qtyRemaining: batchDelta,
      costPrice,
    })
  } else if (batchDelta < 0) {
    const need = Math.abs(batchDelta)
    // Jalur rekonsiliasi (selisih 0) tidak boleh melempar: agregat yang sempat minus akan
    // membuat batch tak sanggup turun sampai target, dan kalau itu dilempar, SATU produk
    // bisa membatalkan approval seluruh SO. Item bersellisih tetap ketat seperti semula.
    const result = fifoDeduct(
      batchRows.map((b) => ({
        batchId: b.id,
        qtyRemaining: Number(b.qtyRemaining),
        costPrice: Number(b.costPrice),
        receivedAt: b.receivedAt,
      })),
      need,
      rekonsiliasiSaja,
    )
    if (!result.success) {
      throw new InsufficientStockError(result.error ?? 'Stok tidak cukup.', item.productId, result.shortfallQty)
    }
    for (const deduction of result.deductions) {
      const changed = await tx
        .update(productStockBatches)
        .set({ qtyRemaining: sql`${productStockBatches.qtyRemaining} - ${deduction.qtyDeducted}` })
        .where(and(eq(productStockBatches.id, deduction.batchId), sql`${productStockBatches.qtyRemaining} >= ${deduction.qtyDeducted}`))
        .returning({ id: productStockBatches.id })
      if (changed.length !== 1) throw new StockConflictError('Stok berubah, silakan ulangi penyesuaian')
    }

    // Batch mentok sebelum mencapai target — samakan agregat ke sisa batch supaya keduanya
    // tetap berakhir di angka yang sama, bukan meninggalkan selisih baru.
    const shortfall = result.shortfallQty ?? 0
    if (shortfall > 0) {
      const agreedQty = targetAgg + shortfall
      await tx
        .update(productStocks)
        .set({ qty: agreedQty })
        .where(and(
          eq(productStocks.productId, item.productId),
          eq(productStocks.branchId, item.branchId),
          eq(productStocks.uomId, baseUomId),
        ))
    }
  }

  // SO menetapkan physical count sebagai kebenaran baru — tutup shortfall terbuka produk ini,
  // apa pun tanda variance-nya (keputusan owner, lihat closeOpenShortfallsForRecount). Selisih
  // 0 pun tetap dijalankan: itu justru bukti agregat sudah benar, jadi utang lama tidak relevan lagi.
  // Nilai yang dimaafkan TIDAK perlu ditambahkan manual ke agregat di sini, karena agregat & batch di atas sudah direkonsiliasi dari nol ke `targetAgg`
  // yang sama (batchDelta memaksa SUM(batch) == targetAgg) — begitu shortfall ditutup jadi 0,
  // `SUM(batch) - 0 == targetAgg == agregat` otomatis konsisten tanpa penyesuaian tambahan.
  await closeOpenShortfallsForRecount(tx, item.branchId, item.productId, 'STOCK_OPNAME', item.soId ?? null)

  // Rekonsiliasi yang ternyata tidak mengubah apa pun tidak perlu meninggalkan jejak audit.
  if (item.currentUserId && !(rekonsiliasiSaja && batchDelta === 0)) {
    await tx.insert(auditLogs).values({
      branchId: item.branchId,
      userId: item.currentUserId,
      action: 'STOCK_OPNAME_ADJUSTMENT',
      tableName: 'product_stocks',
      oldData: JSON.stringify({ systemQty, aggBefore, batchBefore }),
      newData: JSON.stringify({ physicalQty, variance, targetAgg, batchDelta }),
    });
  }
}
