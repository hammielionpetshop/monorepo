import Big from 'big.js'
import type { PriceTier } from '@petshop/shared'
import {
  db,
  priceReviews,
  productCostSyncs,
  productPrices,
  products,
  branches,
  unitsOfMeasure,
  auditLogs,
  eq,
  and,
  asc,
} from '@/lib/db'
import { costChangePercent, suggestSellPrice } from '@/lib/price-review'
import {
  approveCostReview,
  buildTargetCosts,
  currentCostPerBase,
  loadCurrentCosts,
  loadProductUoms,
  marginPercent,
  rejectCostReview,
} from './cost-sync-service'
import { buildPriceAuditEntry, MAX_PRICE, type PriceChange } from './price-service'
import { resolvePriceReviewInTx } from './price-review-record'
import type { PriceReviewSource } from '@petshop/db'

type Tx = any

export class PriceReviewError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
    this.name = 'PriceReviewError'
  }
}

export interface PriceReviewLine {
  uomId: number
  uomCode: string | null
  tierType: string
  price: number
  /** Modal satuan ini sesudah naik (modal yang ditahan bila belum disetujui). */
  unitCost: number | null
  marginPercent: number | null
  suggested: number
}

export interface PriceReviewEntry {
  id: number
  branchId: number
  branchName: string
  productId: number
  productName: string
  sku: string | null
  baseUomCode: string | null
  sources: PriceReviewSource[]
  oldCostPerBase: number | null
  newCostPerBase: number
  changePercent: number | null
  /** Modal barunya masih ditahan (naik ≥ 30%) — disetujui bersama harga jual. */
  costPending: boolean
  costSyncId: number | null
  createdAt: string
  updatedAt: string
  lines: PriceReviewLine[]
}

interface ReviewCostContext {
  newCostPerBase: number | null
  costPending: boolean
  unitCostOf: (uomId: number) => number | null
}

/** Modal baru per satuan: dari usulan yang ditahan bila masih PENDING, selain itu modal yang berlaku. */
async function loadReviewCosts(
  tx: Tx,
  review: { branchId: number; productId: number; costSyncId: number | null },
): Promise<ReviewCostContext> {
  const product = await loadProductUoms(tx, review.productId)
  if (!product) return { newCostPerBase: null, costPending: false, unitCostOf: () => null }
  const ratioOf = (uomId: number) => product.uoms.find(u => u.uomId === uomId)?.ratio ?? null

  if (review.costSyncId) {
    const [sync] = await tx
      .select()
      .from(productCostSyncs)
      .where(eq(productCostSyncs.id, review.costSyncId))
      .limit(1)
    const sourceRatio = sync ? ratioOf(sync.sourceUomId) : null
    if (sync?.status === 'PENDING' && sourceRatio) {
      const targets = new Map(buildTargetCosts(sync.sourceUnitCost, sourceRatio, product.uoms).map(t => [t.uomId, t.costPrice]))
      return { newCostPerBase: sync.newCostPerBase, costPending: true, unitCostOf: uomId => targets.get(uomId) ?? null }
    }
  }

  const current = await loadCurrentCosts(tx, review.branchId, review.productId)
  const perBase = currentCostPerBase(product.uoms, current, product.baseUomId)
  return {
    newCostPerBase: perBase,
    costPending: false,
    unitCostOf: uomId => {
      const direct = current.get(uomId)
      if (direct && direct > 0) return direct
      const ratio = ratioOf(uomId)
      return perBase !== null && ratio ? new Big(perBase).times(ratio).round(0, Big.roundHalfUp).toNumber() : null
    },
  }
}

async function loadPriceRows(tx: Tx, branchId: number, productId: number) {
  return (await tx
    .select({ uomId: productPrices.uomId, uomCode: unitsOfMeasure.code, tierType: productPrices.tierType, price: productPrices.price })
    .from(productPrices)
    .leftJoin(unitsOfMeasure, eq(productPrices.uomId, unitsOfMeasure.id))
    .where(and(eq(productPrices.branchId, branchId), eq(productPrices.productId, productId)))
    .orderBy(asc(productPrices.uomId), asc(productPrices.tierType))) as {
    uomId: number
    uomCode: string | null
    tierType: string
    price: number
  }[]
}

function buildLines(
  rows: Awaited<ReturnType<typeof loadPriceRows>>,
  costs: ReviewCostContext,
  oldCostPerBase: number | null,
): PriceReviewLine[] {
  return rows.map(r => {
    const unitCost = costs.unitCostOf(r.uomId)
    const price = Number(r.price)
    return {
      uomId: r.uomId,
      uomCode: r.uomCode,
      tierType: r.tierType,
      price,
      unitCost,
      marginPercent: unitCost !== null ? marginPercent(price, unitCost) : null,
      suggested:
        unitCost !== null && costs.newCostPerBase !== null
          ? suggestSellPrice({ price, oldCostPerBase, newCostPerBase: costs.newCostPerBase, unitCost })
          : price,
    }
  })
}

/** Daftar Pemeriksaan Harga Jual terbuka, terlama dulu. */
export async function getOpenPriceReviews(filter: { branchId?: number | null } = {}): Promise<PriceReviewEntry[]> {
  const baseUom = unitsOfMeasure
  const rows = await db
    .select({
      id: priceReviews.id,
      branchId: priceReviews.branchId,
      branchName: branches.name,
      productId: priceReviews.productId,
      productName: products.name,
      sku: products.sku,
      baseUomCode: baseUom.code,
      sources: priceReviews.sources,
      oldCostPerBase: priceReviews.oldCostPerBase,
      newCostPerBase: priceReviews.newCostPerBase,
      costSyncId: priceReviews.costSyncId,
      createdAt: priceReviews.createdAt,
      updatedAt: priceReviews.updatedAt,
    })
    .from(priceReviews)
    .innerJoin(products, eq(priceReviews.productId, products.id))
    .innerJoin(branches, eq(priceReviews.branchId, branches.id))
    .leftJoin(baseUom, eq(products.baseUomId, baseUom.id))
    .where(and(
      eq(priceReviews.status, 'OPEN'),
      filter.branchId ? eq(priceReviews.branchId, filter.branchId) : undefined,
    ))
    .orderBy(asc(priceReviews.createdAt), asc(priceReviews.id))

  const entries: PriceReviewEntry[] = []
  for (const r of rows) {
    const costs = await loadReviewCosts(db, r)
    const newCostPerBase = costs.newCostPerBase ?? r.newCostPerBase
    entries.push({
      id: r.id,
      branchId: r.branchId,
      branchName: r.branchName,
      productId: r.productId,
      productName: r.productName,
      sku: r.sku,
      baseUomCode: r.baseUomCode,
      sources: r.sources ?? [],
      oldCostPerBase: r.oldCostPerBase,
      newCostPerBase,
      changePercent: costChangePercent(r.oldCostPerBase, newCostPerBase),
      costPending: costs.costPending,
      costSyncId: r.costSyncId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      lines: buildLines(await loadPriceRows(db, r.branchId, r.productId), costs, r.oldCostPerBase),
    })
  }
  return entries
}

async function lockReview(tx: Tx, id: number) {
  const [row] = await tx.select().from(priceReviews).where(eq(priceReviews.id, id)).for('update').limit(1)
  if (!row) throw new PriceReviewError('Pemeriksaan harga jual tidak ditemukan', 404)
  if (row.status !== 'OPEN') throw new PriceReviewError('Pemeriksaan ini sudah diputuskan sebelumnya — muat ulang halaman', 409)
  return row as typeof priceReviews.$inferSelect
}

const reference = (sources: PriceReviewSource[] | null) =>
  `Periksa harga jual${sources && sources.length > 0 ? ` (${sources.map(s => s.ref).filter(Boolean).join(', ')})` : ''}`

async function approvePendingCost(tx: Tx, review: typeof priceReviews.$inferSelect, userId: number) {
  if (!review.costSyncId) return
  const [sync] = await tx.select({ status: productCostSyncs.status }).from(productCostSyncs).where(eq(productCostSyncs.id, review.costSyncId)).limit(1)
  if (sync?.status === 'PENDING') {
    await approveCostReview(tx, { id: review.costSyncId, userId, note: 'Disetujui bersama harga jual' })
  }
}

/** Harga kiriman harus mencakup tepat semua baris harga cabang, bulat, dan tidak di bawah modal satuannya. */
function checkPrices(lines: PriceReviewLine[], prices: { uomId: number; tierType: string; price: number }[], productName: string) {
  const key = (uomId: number, tierType: string) => `${uomId}:${tierType}`
  const sent = new Map(prices.map(p => [key(p.uomId, p.tierType), p.price]))
  if (sent.size !== prices.length || sent.size !== lines.length || lines.some(l => !sent.has(key(l.uomId, l.tierType)))) {
    throw new PriceReviewError(`Daftar harga ${productName} sudah berubah — muat ulang halaman`, 409)
  }
  for (const l of lines) {
    const price = sent.get(key(l.uomId, l.tierType))!
    if (!Number.isInteger(price) || price <= 0 || new Big(price).gt(MAX_PRICE)) {
      throw new PriceReviewError(`Harga ${productName} (${l.uomCode ?? ''} ${l.tierType}) tidak valid`)
    }
    if (l.unitCost !== null && price < l.unitCost) {
      throw new PriceReviewError(
        `Harga ${productName} (${l.uomCode ?? ''} ${l.tierType}) Rp ${price.toLocaleString('id-ID')} di bawah modal Rp ${l.unitCost.toLocaleString('id-ID')}`,
      )
    }
  }
  return sent
}

/**
 * Setujui: modal yang masih ditahan ikut disetujui, lalu harga jual cabang ditulis ke Manajemen
 * Harga (riwayat harga sumber Tinjauan, referensi dokumen asal). `prices` null = pakai usulan.
 */
export async function approvePriceReview(
  tx: Tx,
  input: { id: number; userId: number; prices: { uomId: number; tierType: string; price: number }[] | null },
): Promise<void> {
  const review = await lockReview(tx, input.id)
  const [product] = await tx.select({ name: products.name }).from(products).where(eq(products.id, review.productId)).limit(1)
  const productName = product?.name ?? `Produk ${review.productId}`

  // Usulan dihitung dari modal sebelum persetujuan (modal yang ditahan = modal sesudah disetujui).
  const costs = await loadReviewCosts(tx, review)
  const rows = await loadPriceRows(tx, review.branchId, review.productId)
  const lines = buildLines(rows, costs, review.oldCostPerBase)
  const prices = input.prices ?? lines.map(l => ({ uomId: l.uomId, tierType: l.tierType, price: l.suggested }))
  const sent = checkPrices(lines, prices, productName)

  await approvePendingCost(tx, review, input.userId)

  const changes: PriceChange[] = lines
    .filter(l => sent.get(`${l.uomId}:${l.tierType}`) !== l.price)
    .map(l => ({ productId: review.productId, uomId: l.uomId, tierType: l.tierType as PriceTier, price: sent.get(`${l.uomId}:${l.tierType}`)! }))

  if (changes.length > 0) {
    for (const c of changes) {
      await tx
        .update(productPrices)
        .set({ price: c.price })
        .where(and(
          eq(productPrices.branchId, review.branchId),
          eq(productPrices.productId, c.productId),
          eq(productPrices.uomId, c.uomId),
          eq(productPrices.tierType, c.tierType),
        ))
    }
    await tx.insert(auditLogs).values(buildPriceAuditEntry({
      branchId: review.branchId,
      changes,
      costChanges: [],
      actor: { userId: input.userId, source: 'REVIEW', reference: reference(review.sources) },
      before: {
        priceByKey: new Map(lines.map(l => [`${review.productId}:${l.uomId}:${l.tierType}`, l.price])),
        costByKey: new Map(),
      },
    }))
  }

  await resolvePriceReviewInTx(tx, {
    id: review.id,
    status: 'APPROVED',
    userId: input.userId,
    note: changes.length > 0 ? null : 'Harga jual sudah sesuai',
  })
}

/** Tetap harga lama: alasan wajib; ditolak bila ada harga di bawah modal baru. Modal yang ditahan ikut disetujui. */
export async function keepPriceReview(tx: Tx, input: { id: number; userId: number; reason: string }): Promise<void> {
  const reason = input.reason.trim()
  if (!reason) throw new PriceReviewError('Alasan wajib diisi')
  const review = await lockReview(tx, input.id)
  const [product] = await tx.select({ name: products.name }).from(products).where(eq(products.id, review.productId)).limit(1)
  const costs = await loadReviewCosts(tx, review)
  const lines = buildLines(await loadPriceRows(tx, review.branchId, review.productId), costs, review.oldCostPerBase)
  const below = lines.find(l => l.unitCost !== null && l.price < l.unitCost)
  if (below) {
    throw new PriceReviewError(
      `Harga lama ${product?.name ?? ''} (${below.uomCode ?? ''} ${below.tierType}) di bawah modal baru — ubah harganya, tidak bisa dipertahankan`,
    )
  }
  await approvePendingCost(tx, review, input.userId)
  await resolvePriceReviewInTx(tx, { id: review.id, status: 'KEPT', userId: input.userId, note: reason })
}

/** Tolak modal yang masih ditahan: modal tidak berubah, Pemeriksaan tertutup bila modal tidak lagi naik. */
export async function rejectPriceReviewCost(tx: Tx, input: { id: number; userId: number; reason: string }): Promise<void> {
  const reason = input.reason.trim()
  if (!reason) throw new PriceReviewError('Alasan wajib diisi')
  const review = await lockReview(tx, input.id)
  if (!review.costSyncId) throw new PriceReviewError('Modal ini sudah berlaku, tidak ada yang bisa ditolak', 409)
  const [sync] = await tx.select({ status: productCostSyncs.status }).from(productCostSyncs).where(eq(productCostSyncs.id, review.costSyncId)).limit(1)
  if (sync?.status !== 'PENDING') throw new PriceReviewError('Modal ini sudah berlaku, tidak ada yang bisa ditolak', 409)
  // rejectCostReview menutup Pemeriksaan sendiri bila modal yang berlaku tidak lagi naik.
  await rejectCostReview(tx, { id: review.costSyncId, userId: input.userId, reason })
}
