import Big from 'big.js'
import {
  db, products, unitsOfMeasure, branches, productStocks, productStockBatches, productUomConversions,
  productUomCosts, productPrices, stockAdjustments, stockShortfalls, stockShortfallClearings,
  productCostSyncs, internalReturnItems, internalReturnBatchAdjustments, stockOpnames, stockOpnameItems,
  auditLogs, eq, and, or, inArray, notInArray, sql,
} from '../db'
import type { Tx } from '../stock-adjustment'
import { lockStockPairs } from './stock-lock'
import { fixedUnitWeightGram } from '../product-weight'

/**
 * Ganti satuan dasar produk ke satuan yang LEBIH KECIL dalam satu langkah (mis. SAK → PCS,
 * 1 SAK = 25 PCS). Keputusan owner 2026-11-02:
 * - Semua yang tersimpan "per satuan dasar" ikut dikonversi di sini supaya tidak ada yang
 *   terlewat: stok, batch (qty × rasio, modal ÷ rasio — kedaluwarsa, urutan FIFO, tautan PO
 *   tetap), modal Manajemen Harga, konversi satuan, dan riwayat yang tidak mencatat satuannya
 *   sendiri (penyesuaian stok, utang stok, jejak sinkron modal, revisi harga beli).
 * - Harga JUAL satuan dasar baru sengaja tidak diisi; admin mengisinya di Manajemen Harga.
 * - Hanya ke satuan lebih kecil (rasio bulat ≥ 2).
 *
 * Riwayat yang mencatat satuannya sendiri (nota, PO, transfer, opname, retur) tidak disentuh:
 * semua pembacanya mengonversi lewat product_uom_conversions saat ini, dan satuan lama tetap
 * terdaftar sebagai satuan besar dengan rasio yang sama, jadi angkanya tetap benar.
 * `uom_id` pada batch juga tidak diubah — itu jejak satuan pembelian, bukan satuan qty-nya.
 */

export const BASE_UOM_CHANGE_MAX_RATIO = 100_000

export interface BaseUomChangeInput {
  productId: number
  newBaseUomId: number
  ratio: number
}

export interface BaseUomChangePlan {
  product: { id: number; name: string; sku: string | null }
  oldUom: { id: number; code: string; name: string }
  newUom: { id: number; code: string; name: string } | null
  ratio: number
  /** Alasan migrasi tidak boleh dijalankan. Kosong = boleh. */
  blockers: string[]
  /** Hal yang perlu diketahui admin, tidak menghalangi. */
  warnings: string[]
  stocks: { branchId: number; branchName: string; oldQty: number; newQty: number }[]
  batches: {
    id: number; branchName: string; receivedAt: string; expiryDate: string | null
    oldQtyRemaining: number; newQtyRemaining: number; oldCost: number; newCost: number
  }[]
  conversions: { uomCode: string; oldRatio: number | null; newRatio: number; note: string }[]
  costs: { branchName: string; uomCode: string; oldCost: number | null; newCost: number }[]
  /** Harga jual satuan dasar baru yang perlu diisi admin setelah migrasi. */
  missingPrices: { branchId: number; branchName: string; tiers: string[] }[]
  value: { before: number; after: number; difference: number }
  weight: { oldGram: number | null; newGram: number | null }
  defaultCost: { old: number | null; new: number | null }
  history: { adjustments: number; shortfalls: number; costSyncs: number; internalReturns: number }
  /** Sidik jari kondisi stok saat pratinjau; dicek ulang saat dijalankan. */
  signature: string
}

export class BaseUomChangeError extends Error {
  constructor(message: string, public readonly status = 409) {
    super(message)
  }
}

/** Modal per satuan dasar baru — satu-satunya rumus pembagian supaya semua tabel konsisten. */
export function divideCost(cost: number, ratio: number): number {
  return new Big(cost).div(ratio).round(0, Big.roundHalfUp).toNumber()
}

const TIER_ORDER = ['RETAIL', 'RESELLER', 'GROSIR', 'MEMBER']
const TIER_LABEL: Record<string, string> = { RETAIL: 'Retail', RESELLER: 'Reseller', GROSIR: 'Grosir', MEMBER: 'Member' }
const tierLabel = (t: string) => TIER_LABEL[t] ?? t

type Reader = Tx | typeof db

async function buildPlan(r: Reader, input: BaseUomChangeInput): Promise<BaseUomChangePlan> {
  const { productId, newBaseUomId, ratio } = input
  const [prod] = await r
    .select({
      id: products.id, name: products.name, sku: products.sku, baseUomId: products.baseUomId,
      productKind: products.productKind, weightGram: products.weightGram, defaultCostPrice: products.defaultCostPrice,
    })
    .from(products).where(eq(products.id, productId)).limit(1)
  if (!prod) throw new BaseUomChangeError('Produk tidak ditemukan', 404)

  const uomRows = await r.select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code, name: unitsOfMeasure.name }).from(unitsOfMeasure)
  const uomById = new Map(uomRows.map((u) => [u.id, u]))
  const oldUom = uomById.get(prod.baseUomId) ?? { id: prod.baseUomId, code: '?', name: '?' }
  const newUom = uomById.get(newBaseUomId) ?? null
  const branchRows = await r.select({ id: branches.id, name: branches.name }).from(branches)
  const branchName = new Map(branchRows.map((b) => [b.id, b.name]))
  const nameOf = (id: number) => branchName.get(id) ?? `Cabang ${id}`

  const blockers: string[] = []
  const warnings: string[] = []

  if (prod.productKind !== 'BARANG') blockers.push('Produk ini jasa, tidak punya stok — tidak perlu ganti satuan dasar.')
  if (!newUom) blockers.push('Satuan baru tidak ditemukan.')
  if (newBaseUomId === prod.baseUomId) blockers.push(`Satuan dasar sudah ${oldUom.code}.`)
  const ratioOk = Number.isInteger(ratio) && ratio >= 2 && ratio <= BASE_UOM_CHANGE_MAX_RATIO
  if (!ratioOk) blockers.push(`Isi 1 ${oldUom.code} harus angka bulat, minimal 2.`)
  const k = ratioOk ? ratio : 1

  // --- konversi ---
  const convRows = await r
    .select({ id: productUomConversions.id, uomId: productUomConversions.uomId, ratio: productUomConversions.ratio })
    .from(productUomConversions).where(eq(productUomConversions.productId, productId))
  const conversions: BaseUomChangePlan['conversions'] = []
  for (const c of convRows) {
    const code = uomById.get(c.uomId)?.code ?? '?'
    if (c.uomId === newBaseUomId) {
      if (c.ratio > 1) {
        blockers.push(
          `Data konversi aneh: ${code} tercatat berisi ${c.ratio} ${oldUom.code} (lebih besar dari ${oldUom.code}). ` +
          `Periksa dulu di Master Produk › Satuan.`,
        )
      } else {
        conversions.push({ uomCode: code, oldRatio: c.ratio, newRatio: 1, note: 'jadi satuan dasar (baris konversi lamanya dihapus)' })
      }
      continue
    }
    if (c.uomId === prod.baseUomId) {
      blockers.push(`Data konversi aneh: satuan dasar ${code} punya baris konversi sendiri. Periksa dulu di Master Produk › Satuan.`)
      continue
    }
    conversions.push({ uomCode: code, oldRatio: c.ratio, newRatio: c.ratio * k, note: `1 ${code} = ${c.ratio * k} ${newUom?.code ?? ''}` })
  }
  conversions.push({ uomCode: oldUom.code, oldRatio: null, newRatio: k, note: `1 ${oldUom.code} = ${k} ${newUom?.code ?? ''} (satuan dasar lama jadi satuan besar)` })

  // --- stok ---
  const stockRows = await r
    .select({ id: productStocks.id, branchId: productStocks.branchId, uomId: productStocks.uomId, qty: productStocks.qty })
    .from(productStocks).where(eq(productStocks.productId, productId))
  const stocks: BaseUomChangePlan['stocks'] = []
  for (const s of stockRows) {
    if (s.uomId !== prod.baseUomId) {
      blockers.push(
        `Stok ${nameOf(s.branchId)} tercatat di satuan ${uomById.get(s.uomId)?.code ?? s.uomId}, bukan satuan dasar ${oldUom.code}. ` +
        `Data lama ini perlu dibereskan tim dulu.`,
      )
      continue
    }
    stocks.push({ branchId: s.branchId, branchName: nameOf(s.branchId), oldQty: s.qty, newQty: s.qty * k })
  }
  stocks.sort((a, b) => a.branchName.localeCompare(b.branchName))

  // --- batch ---
  const batchRows = await r
    .select({
      id: productStockBatches.id, branchId: productStockBatches.branchId, qtyRemaining: productStockBatches.qtyRemaining,
      costPrice: productStockBatches.costPrice, receivedAt: productStockBatches.receivedAt, expiryDate: productStockBatches.expiryDate,
    })
    .from(productStockBatches).where(eq(productStockBatches.productId, productId))
    .orderBy(productStockBatches.receivedAt, productStockBatches.id)
  let before = new Big(0)
  let after = new Big(0)
  const batches: BaseUomChangePlan['batches'] = []
  for (const b of batchRows) {
    const newCost = divideCost(b.costPrice, k)
    before = before.plus(new Big(b.qtyRemaining).times(b.costPrice))
    after = after.plus(new Big(b.qtyRemaining * k).times(newCost))
    if (b.qtyRemaining === 0) continue // batch habis tetap dikonversi, tapi tidak perlu dipamerkan
    batches.push({
      id: b.id, branchName: nameOf(b.branchId),
      receivedAt: b.receivedAt.toISOString(), expiryDate: b.expiryDate ? b.expiryDate.toISOString() : null,
      oldQtyRemaining: b.qtyRemaining, newQtyRemaining: b.qtyRemaining * k, oldCost: b.costPrice, newCost,
    })
  }

  // --- modal Manajemen Harga ---
  const costRows = await r
    .select({ branchId: productUomCosts.branchId, uomId: productUomCosts.uomId, costPrice: productUomCosts.costPrice })
    .from(productUomCosts).where(eq(productUomCosts.productId, productId))
  const costs: BaseUomChangePlan['costs'] = []
  for (const c of costRows.filter((c) => c.uomId === prod.baseUomId)) {
    const existingNew = costRows.find((x) => x.branchId === c.branchId && x.uomId === newBaseUomId)
    costs.push({ branchName: nameOf(c.branchId), uomCode: newUom?.code ?? '?', oldCost: existingNew?.costPrice ?? null, newCost: divideCost(c.costPrice, k) })
  }
  costs.sort((a, b) => a.branchName.localeCompare(b.branchName))

  // --- harga jual yang perlu diisi ---
  const priceRows = await r
    .select({ branchId: productPrices.branchId, uomId: productPrices.uomId, tierType: productPrices.tierType })
    .from(productPrices).where(eq(productPrices.productId, productId))
  const missing = new Map<number, Set<string>>()
  for (const p of priceRows.filter((p) => p.uomId === prod.baseUomId)) {
    const hasNew = priceRows.some((x) => x.branchId === p.branchId && x.uomId === newBaseUomId && x.tierType === p.tierType)
    if (hasNew) continue
    if (!missing.has(p.branchId)) missing.set(p.branchId, new Set())
    missing.get(p.branchId)!.add(p.tierType)
  }
  const missingPrices = [...missing.entries()]
    .map(([branchId, set]) => ({
      branchId, branchName: nameOf(branchId),
      tiers: [...set].sort((a, b) => (TIER_ORDER.indexOf(a) + 99) % 99 - (TIER_ORDER.indexOf(b) + 99) % 99).map(tierLabel),
    }))
    .sort((a, b) => a.branchName.localeCompare(b.branchName))

  // --- dokumen yang masih berjalan ---
  const openSo = await r
    .selectDistinct({ soNumber: stockOpnames.soNumber })
    .from(stockOpnameItems)
    .innerJoin(stockOpnames, eq(stockOpnames.id, stockOpnameItems.soId))
    .where(and(
      eq(stockOpnameItems.productId, productId),
      or(notInArray(stockOpnames.status, ['APPROVED', 'REJECTED', 'CANCELLED']), eq(stockOpnameItems.itemStatus, 'PENDING')),
    ))
  if (openSo.length > 0) {
    blockers.push(
      `Barang ini masih ada di Stock Opname yang belum selesai: ${openSo.map((s) => s.soNumber).join(', ')}. ` +
      `Selesaikan (setujui/tolak) dulu, baru ganti satuan.`,
    )
  }
  const [pendingCost] = await r
    .select({ n: sql<number>`count(*)::int` })
    .from(productCostSyncs)
    .where(and(eq(productCostSyncs.productId, productId), eq(productCostSyncs.status, 'PENDING')))
  if ((pendingCost?.n ?? 0) > 0) {
    blockers.push('Barang ini masih punya perubahan modal yang menunggu ditinjau (menu Tinjauan Modal & Margin). Setujui/tolak dulu.')
  }

  // --- riwayat tanpa kolom satuan (ikut dikonversi) ---
  const count = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0
  const n = sql<number>`count(*)::int`
  const history = {
    adjustments: await count(r.select({ n }).from(stockAdjustments).where(eq(stockAdjustments.productId, productId))),
    shortfalls: await count(r.select({ n }).from(stockShortfalls).where(eq(stockShortfalls.productId, productId))),
    costSyncs: await count(r.select({ n }).from(productCostSyncs).where(eq(productCostSyncs.productId, productId))),
    internalReturns: await count(r.select({ n }).from(internalReturnItems).where(eq(internalReturnItems.productId, productId))),
  }

  // --- berat & modal bawaan ---
  const oldWeight = prod.weightGram && prod.weightGram > 0 ? prod.weightGram : null
  let newWeight: number | null = null
  if (newUom && fixedUnitWeightGram(newUom.code) != null) {
    newWeight = null // GRAM/KG beratnya sudah pasti
  } else if (oldWeight != null) {
    newWeight = Math.max(1, Math.round(oldWeight / k))
    if (oldWeight % k !== 0) {
      warnings.push(`Berat 1 ${newUom?.code ?? ''} dibulatkan jadi ${newWeight} gram (${oldWeight} ÷ ${k}). Ubah di Master Produk bila kurang pas.`)
    }
  }
  const oldDefaultCost = prod.defaultCostPrice ?? null
  const newDefaultCost = oldDefaultCost != null ? divideCost(oldDefaultCost, k) : null

  const difference = after.minus(before).toNumber()
  if (difference !== 0) {
    warnings.push(
      `Nilai stok berubah Rp ${difference.toLocaleString('id-ID')} karena modal dibulatkan ke rupiah terdekat per ${newUom?.code ?? ''}.`,
    )
  }
  if (missingPrices.length > 0) {
    warnings.push(`Harga jual per ${newUom?.code ?? ''} belum ada. Setelah migrasi, kasir belum bisa menjual per ${newUom?.code ?? ''} sampai harganya diisi di Manajemen Harga.`)
  }
  warnings.push(`Scan barcode barang ini akan masuk sebagai 1 ${newUom?.code ?? ''}. Kalau menjual per ${oldUom.code}, kasir pilih satuan ${oldUom.code} di keranjang.`)

  const signature = JSON.stringify({
    base: prod.baseUomId,
    s: stockRows.map((s) => [s.id, s.qty]).sort(),
    b: batchRows.map((b) => [b.id, b.qtyRemaining, b.costPrice]).sort(),
  })

  return {
    product: { id: prod.id, name: prod.name, sku: prod.sku },
    oldUom, newUom, ratio: k, blockers, warnings, stocks, batches, conversions, costs, missingPrices,
    value: { before: before.toNumber(), after: after.toNumber(), difference },
    weight: { oldGram: oldWeight, newGram: newWeight },
    defaultCost: { old: oldDefaultCost, new: newDefaultCost },
    history,
    signature,
  }
}

/** Pratinjau: hanya membaca, tidak mengubah apa pun. */
export async function previewBaseUomChange(input: BaseUomChangeInput): Promise<BaseUomChangePlan> {
  return buildPlan(db, input)
}

/**
 * Jalankan migrasi dalam satu transaksi. Semua atau tidak sama sekali.
 * `signature` dari pratinjau wajib sama dengan kondisi sekarang — kalau stok sempat berubah
 * (ada penjualan) setelah pratinjau, admin diminta melihat pratinjau lagi.
 */
export async function executeBaseUomChange(
  input: BaseUomChangeInput & { signature: string },
  actor: { userId: number; branchId: number | null },
): Promise<BaseUomChangePlan> {
  return db.transaction(async (tx) => {
    // Kunci stok produk ini di semua cabang (kunci yang sama dipakai penjualan/penerimaan),
    // lalu kunci baris produknya, sebelum membaca rencana.
    const branchRows = await tx.select({ id: branches.id }).from(branches)
    await lockStockPairs(tx, branchRows.map((b) => ({ branchId: b.id, productId: input.productId })))
    await tx.execute(sql`SELECT id FROM petshop.products WHERE id = ${input.productId} FOR UPDATE`)

    const plan = await buildPlan(tx, input)
    if (plan.blockers.length > 0) throw new BaseUomChangeError(plan.blockers[0])
    if (plan.signature !== input.signature) {
      throw new BaseUomChangeError('Stok barang ini berubah sejak pratinjau dibuat (mungkin ada penjualan). Klik "Lihat Pratinjau" lagi.')
    }
    const k = plan.ratio
    const { productId, newBaseUomId } = input
    const oldBaseUomId = plan.oldUom.id

    // 1. Stok per cabang
    await tx.update(productStocks)
      .set({ uomId: newBaseUomId, qty: sql`${productStocks.qty} * ${k}` })
      .where(and(eq(productStocks.productId, productId), eq(productStocks.uomId, oldBaseUomId)))

    // 2. Batch — uom_id (satuan pembelian) sengaja tidak diubah
    await tx.update(productStockBatches)
      .set({
        qtyReceived: sql`${productStockBatches.qtyReceived} * ${k}`,
        qtyRemaining: sql`${productStockBatches.qtyRemaining} * ${k}`,
        costPrice: sql`ROUND(${productStockBatches.costPrice}::numeric / ${k})::int`,
      })
      .where(eq(productStockBatches.productId, productId))

    // 3. Konversi: satuan besar lain dikali rasio, satuan lama jadi satuan besar
    await tx.delete(productUomConversions)
      .where(and(eq(productUomConversions.productId, productId), eq(productUomConversions.uomId, newBaseUomId)))
    await tx.update(productUomConversions)
      .set({ ratio: sql`${productUomConversions.ratio} * ${k}` })
      .where(eq(productUomConversions.productId, productId))
    await tx.insert(productUomConversions).values({ productId, uomId: oldBaseUomId, ratio: k })

    // 4. Modal Manajemen Harga: baris satuan lama tetap (kini modal per satuan besar), satuan baru = ÷ rasio
    const oldCosts = await tx
      .select({ branchId: productUomCosts.branchId, costPrice: productUomCosts.costPrice })
      .from(productUomCosts)
      .where(and(eq(productUomCosts.productId, productId), eq(productUomCosts.uomId, oldBaseUomId)))
    for (const c of oldCosts) {
      const costPrice = divideCost(c.costPrice, k)
      await tx.insert(productUomCosts)
        .values({ productId, branchId: c.branchId, uomId: newBaseUomId, costPrice })
        .onConflictDoUpdate({
          target: [productUomCosts.productId, productUomCosts.branchId, productUomCosts.uomId],
          set: { costPrice, updatedAt: new Date() },
        })
    }

    // 5. Produk
    await tx.update(products)
      .set({
        baseUomId: newBaseUomId,
        weightGram: plan.weight.newGram ?? (plan.weight.oldGram == null ? undefined : null),
        defaultCostPrice: plan.defaultCost.new ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId))

    // 6. Riwayat yang qty/modalnya "per satuan dasar" tanpa kolom satuan
    const roundDiv = (col: unknown) => sql`ROUND(${col}::numeric / ${k})::int`
    await tx.update(stockAdjustments)
      .set({ previousQty: sql`${stockAdjustments.previousQty} * ${k}`, newQty: sql`${stockAdjustments.newQty} * ${k}` })
      .where(eq(stockAdjustments.productId, productId))
    const shortfallIds = (await tx.select({ id: stockShortfalls.id }).from(stockShortfalls)
      .where(eq(stockShortfalls.productId, productId))).map((s) => s.id)
    if (shortfallIds.length > 0) {
      await tx.update(stockShortfalls)
        .set({
          qtyShort: sql`${stockShortfalls.qtyShort} * ${k}`,
          qtyRemaining: sql`${stockShortfalls.qtyRemaining} * ${k}`,
          costPricePerUnit: roundDiv(stockShortfalls.costPricePerUnit),
        })
        .where(inArray(stockShortfalls.id, shortfallIds))
      await tx.update(stockShortfallClearings)
        .set({
          qtyCleared: sql`${stockShortfallClearings.qtyCleared} * ${k}`,
          costPriceAtClearing: roundDiv(stockShortfallClearings.costPriceAtClearing),
        })
        .where(inArray(stockShortfallClearings.shortfallId, shortfallIds))
    }
    await tx.update(productCostSyncs)
      .set({
        oldCostPerBase: roundDiv(productCostSyncs.oldCostPerBase),
        newCostPerBase: roundDiv(productCostSyncs.newCostPerBase),
      })
      .where(eq(productCostSyncs.productId, productId))
    await tx.update(internalReturnItems)
      .set({ qtyConsumed: sql`${internalReturnItems.qtyConsumed} * ${k}` })
      .where(and(eq(internalReturnItems.productId, productId), sql`${internalReturnItems.qtyConsumed} IS NOT NULL`))
    await tx.update(internalReturnBatchAdjustments)
      .set({
        oldCostPrice: roundDiv(internalReturnBatchAdjustments.oldCostPrice),
        newCostPrice: roundDiv(internalReturnBatchAdjustments.newCostPrice),
        qtyRemaining: sql`${internalReturnBatchAdjustments.qtyRemaining} * ${k}`,
      })
      .where(inArray(
        internalReturnBatchAdjustments.batchId,
        tx.select({ id: productStockBatches.id }).from(productStockBatches).where(eq(productStockBatches.productId, productId)),
      ))

    // 7. Jejak audit (nilai lama cukup untuk membalik bila perlu)
    await tx.insert(auditLogs).values({
      branchId: actor.branchId,
      userId: actor.userId,
      action: 'BASE_UOM_CHANGE',
      tableName: 'products',
      recordId: String(productId),
      oldData: JSON.stringify({
        baseUomId: oldBaseUomId, baseUomCode: plan.oldUom.code,
        weightGram: plan.weight.oldGram, defaultCostPrice: plan.defaultCost.old,
        stocks: plan.stocks.map((s) => ({ branchId: s.branchId, qty: s.oldQty })),
        batches: plan.batches.map((b) => ({ id: b.id, qtyRemaining: b.oldQtyRemaining, costPrice: b.oldCost })),
        conversions: plan.conversions.map((c) => ({ uomCode: c.uomCode, ratio: c.oldRatio })),
      }),
      newData: JSON.stringify({
        baseUomId: newBaseUomId, baseUomCode: plan.newUom?.code, ratio: k,
        weightGram: plan.weight.newGram, defaultCostPrice: plan.defaultCost.new,
        value: plan.value, history: plan.history,
      }),
    })

    return plan
  })
}
