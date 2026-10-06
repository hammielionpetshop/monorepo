import Big from 'big.js'
import { alias } from 'drizzle-orm/pg-core'
import {
  db,
  productCostSyncs,
  productUomCosts,
  productUomConversions,
  productPrices,
  products,
  branches,
  unitsOfMeasure,
  users,
  auditLogs,
  eq,
  and,
  or,
  gt,
  inArray,
  ilike,
  sql,
  asc,
  desc,
} from '@/lib/db'
import { buildPriceAuditEntry, type PriceMutationActor } from './price-service'

// Lompatan modal per satuan dasar sebesar ini (naik atau turun) wajib ditinjau OWNER/GM.
export const COST_REVIEW_THRESHOLD = new Big('0.3')
// Margin harga jual terhadap modal di bawah/sama dengan persen ini muncul di Tinjauan Margin.
export const MARGIN_ALERT_PERCENT = 1

export type CostSyncSourceType = 'PO_RECEIVING' | 'PO_INVOICE' | 'IBT_RECEIVE' | 'STOCK_ADJUSTMENT' | 'PO_REVERSAL'
export type CostSyncStatus = 'APPLIED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED'
export type CostSyncOutcome = 'APPLIED' | 'PENDING' | 'UNCHANGED' | 'SKIPPED'

type Tx = any

export interface UomRatio {
  uomId: number
  ratio: number
}

// -------------------- Fungsi murni --------------------

/** Modal per satuan dasar yang berlaku: baris satuan dasar, kalau kosong satuan terbesar ÷ rasionya. */
export function currentCostPerBase(
  uoms: UomRatio[],
  costByUom: Map<number, number>,
  baseUomId: number,
): number | null {
  const base = costByUom.get(baseUomId)
  if (base && base > 0) return base
  const candidates = uoms
    .filter(u => u.uomId !== baseUomId && u.ratio > 0 && (costByUom.get(u.uomId) ?? 0) > 0)
    .sort((a, b) => b.ratio - a.ratio)
  if (candidates.length === 0) return null
  const top = candidates[0]
  return new Big(costByUom.get(top.uomId)!).div(top.ratio).round(0, Big.roundHalfUp).toNumber()
}

/**
 * Modal tiap satuan dari modal satu satuan masuk. Satuan dengan rasio yang sama dengan satuan
 * masuk memakai angka mentahnya (182.500/SAK tetap 182.500, bukan 6.083 × 30 = 182.490).
 */
export function buildTargetCosts(
  sourceUnitCost: number,
  sourceRatio: number,
  uoms: UomRatio[],
): { uomId: number; costPrice: number }[] {
  if (sourceUnitCost <= 0 || sourceRatio <= 0) return []
  const perBase = new Big(sourceUnitCost).div(sourceRatio)
  return uoms
    .filter(u => u.ratio > 0)
    .map(u => ({
      uomId: u.uomId,
      costPrice: u.ratio === sourceRatio
        ? sourceUnitCost
        : perBase.times(u.ratio).round(0, Big.roundHalfUp).toNumber(),
    }))
    .filter(t => t.costPrice > 0)
}

/** APPLY bila modal lama kosong atau selisihnya < 30%; REVIEW bila >= 30%. */
export function decideCostSync(currentPerBase: number | null, newPerBase: number): 'APPLY' | 'REVIEW' {
  if (currentPerBase === null || currentPerBase <= 0) return 'APPLY'
  const change = new Big(newPerBase).minus(currentPerBase).abs().div(currentPerBase)
  return change.gte(COST_REVIEW_THRESHOLD) ? 'REVIEW' : 'APPLY'
}

export function marginPercent(price: number, cost: number): number {
  if (price <= 0) return 0
  return new Big(price).minus(cost).div(price).times(100).round(2, Big.roundHalfUp).toNumber()
}

// -------------------- Akses DB --------------------

async function loadProductUoms(tx: Tx, productId: number): Promise<{ baseUomId: number; uoms: UomRatio[] } | null> {
  const [prod] = await tx
    .select({ baseUomId: products.baseUomId })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)
  if (!prod?.baseUomId) return null

  const convs: { uomId: number; ratio: number | null }[] = await tx
    .select({ uomId: productUomConversions.uomId, ratio: productUomConversions.ratio })
    .from(productUomConversions)
    .where(eq(productUomConversions.productId, productId))

  const uoms: UomRatio[] = [{ uomId: prod.baseUomId, ratio: 1 }]
  for (const c of convs) {
    if (c.uomId !== prod.baseUomId && Number(c.ratio) > 0) uoms.push({ uomId: c.uomId, ratio: Number(c.ratio) })
  }
  return { baseUomId: prod.baseUomId, uoms }
}

async function loadCurrentCosts(tx: Tx, branchId: number, productId: number): Promise<Map<number, number>> {
  const rows: { uomId: number; costPrice: number }[] = await tx
    .select({ uomId: productUomCosts.uomId, costPrice: productUomCosts.costPrice })
    .from(productUomCosts)
    .where(and(eq(productUomCosts.branchId, branchId), eq(productUomCosts.productId, productId)))
  return new Map(rows.map(r => [r.uomId, Number(r.costPrice)]))
}

async function supersedePending(tx: Tx, branchId: number, productId: number, note: string): Promise<void> {
  await tx
    .update(productCostSyncs)
    .set({ status: 'SUPERSEDED', resolvedAt: new Date(), resolutionNote: note })
    .where(and(
      eq(productCostSyncs.branchId, branchId),
      eq(productCostSyncs.productId, productId),
      eq(productCostSyncs.status, 'PENDING'),
    ))
}

/** Tulis modal semua satuan + satu baris riwayat harga (hanya satuan yang benar-benar berubah). */
async function applyTargetCosts(
  tx: Tx,
  input: {
    branchId: number
    productId: number
    targets: { uomId: number; costPrice: number }[]
    current: Map<number, number>
    actor: PriceMutationActor
  },
): Promise<void> {
  const { branchId, productId, targets, current, actor } = input
  const changed = targets.filter(t => current.get(t.uomId) !== t.costPrice)
  if (changed.length === 0) return

  await tx
    .insert(productUomCosts)
    .values(changed.map(t => ({ productId, branchId, uomId: t.uomId, costPrice: t.costPrice })))
    .onConflictDoUpdate({
      target: [productUomCosts.productId, productUomCosts.branchId, productUomCosts.uomId],
      set: { costPrice: sql`excluded.cost_price`, updatedAt: new Date() },
    })

  const costByKey = new Map<string, number>()
  for (const [uomId, cost] of current) costByKey.set(`${productId}:${uomId}`, cost)

  await tx.insert(auditLogs).values(buildPriceAuditEntry({
    branchId,
    changes: [],
    costChanges: changed.map(t => ({ productId, uomId: t.uomId, costPrice: t.costPrice })),
    actor,
    before: { priceByKey: new Map(), costByKey },
  }))
}

export interface InboundCostInput {
  branchId: number
  productId: number
  /** Satuan barang masuk & modal per satuan itu (bukan per satuan dasar). */
  uomId: number
  unitCost: number
  sourceType: Exclude<CostSyncSourceType, 'PO_REVERSAL'>
  sourceId: number | null
  sourceRef: string
  actorUserId: number
  /** Waktu barang masuk. Bawaan sekarang; koreksi faktur PO memakai waktu penerimaannya. */
  effectiveAt?: Date
}

/** Jenis sumber yang berbagi `sourceId` untuk satu dokumen: penerimaan & faktur PO = PO yang sama. */
export function sameInboundSourceTypes(sourceType: InboundCostInput['sourceType']): CostSyncSourceType[] {
  return sourceType === 'PO_RECEIVING' || sourceType === 'PO_INVOICE' ? ['PO_RECEIVING', 'PO_INVOICE'] : [sourceType]
}

/**
 * Salin modal barang masuk ke Manajemen Harga (semua satuan, dari rasio). Lompatan >= 30%
 * ditahan sebagai PENDING. Wajib dipanggil di dalam transaksi yang sama dengan penambahan stok.
 */
export async function syncCostFromInbound(tx: Tx, input: InboundCostInput): Promise<CostSyncOutcome> {
  const { branchId, productId, uomId, unitCost, sourceType, sourceId, sourceRef, actorUserId } = input
  const effectiveAt = input.effectiveAt ?? new Date()
  if (!(unitCost > 0)) return 'SKIPPED'

  const product = await loadProductUoms(tx, productId)
  if (!product) return 'SKIPPED'
  const sourceRatio = product.uoms.find(u => u.uomId === uomId)?.ratio
  if (!sourceRatio) return 'SKIPPED'

  // Faktur PO lama yang dikoreksi belakangan tidak boleh menimpa modal dari penerimaan yang lebih baru.
  // Catatan dari dokumen yang sama dikecualikan: penerimaan PO itu sendiri tercatat beberapa milidetik
  // setelah batch-nya, sehingga dulu selalu terbaca "lebih baru" dan koreksi faktur tak pernah sampai.
  const sameSource = sourceId === null
    ? undefined
    : sql`NOT (${productCostSyncs.sourceId} = ${sourceId} AND ${inArray(productCostSyncs.sourceType, sameInboundSourceTypes(sourceType))})`
  const [newer] = await tx
    .select({ id: productCostSyncs.id })
    .from(productCostSyncs)
    .where(and(
      eq(productCostSyncs.branchId, branchId),
      eq(productCostSyncs.productId, productId),
      gt(productCostSyncs.effectiveAt, effectiveAt),
      inArray(productCostSyncs.status, ['APPLIED', 'APPROVED', 'PENDING']),
      sameSource,
    ))
    .limit(1)
  if (newer) return 'SKIPPED'

  const current = await loadCurrentCosts(tx, branchId, productId)
  const targets = buildTargetCosts(unitCost, sourceRatio, product.uoms)
  if (targets.length === 0) return 'SKIPPED'

  const supersedeNote = `Digantikan barang masuk yang lebih baru (${sourceRef})`
  if (targets.every(t => current.get(t.uomId) === t.costPrice)) {
    await supersedePending(tx, branchId, productId, supersedeNote)
    return 'UNCHANGED'
  }

  const oldPerBase = currentCostPerBase(product.uoms, current, product.baseUomId)
  const newPerBase = new Big(unitCost).div(sourceRatio).round(0, Big.roundHalfUp).toNumber()
  const decision = decideCostSync(oldPerBase, newPerBase)

  await supersedePending(tx, branchId, productId, supersedeNote)

  if (decision === 'APPLY') {
    await applyTargetCosts(tx, {
      branchId,
      productId,
      targets,
      current,
      actor: { userId: actorUserId, source: 'AUTO_SYNC', reference: sourceRef },
    })
  }

  await tx.insert(productCostSyncs).values({
    branchId,
    productId,
    sourceType,
    sourceId,
    sourceRef,
    sourceUomId: uomId,
    sourceUnitCost: unitCost,
    oldCostPerBase: oldPerBase,
    newCostPerBase: newPerBase,
    status: decision === 'APPLY' ? 'APPLIED' : 'PENDING',
    effectiveAt,
    createdById: actorUserId,
  })

  return decision === 'APPLY' ? 'APPLIED' : 'PENDING'
}

/**
 * Penerimaan PO dibatalkan: usulkan modal kembali ke sebelum PO itu, sebagai PENDING yang harus
 * disetujui. Dilewati bila modal sudah diperbarui barang masuk lain sesudahnya, atau dulu kosong.
 */
export async function proposeCostReversalForPO(
  tx: Tx,
  input: { poId: number; poNumber: string; branchId: number; actorUserId: number },
): Promise<number> {
  const { poId, poNumber, branchId, actorUserId } = input
  const poSources = and(
    inArray(productCostSyncs.sourceType, ['PO_RECEIVING', 'PO_INVOICE']),
    eq(productCostSyncs.sourceId, poId),
    eq(productCostSyncs.branchId, branchId),
  )

  await tx
    .update(productCostSyncs)
    .set({ status: 'SUPERSEDED', resolvedAt: new Date(), resolutionNote: `Penerimaan ${poNumber} dibatalkan` })
    .where(and(poSources, eq(productCostSyncs.status, 'PENDING')))

  const applied: { id: number; productId: number; oldCostPerBase: number | null }[] = await tx
    .select({ id: productCostSyncs.id, productId: productCostSyncs.productId, oldCostPerBase: productCostSyncs.oldCostPerBase })
    .from(productCostSyncs)
    .where(and(poSources, inArray(productCostSyncs.status, ['APPLIED', 'APPROVED'])))
    .orderBy(desc(productCostSyncs.id))

  const latestByProduct = new Map<number, { id: number; oldCostPerBase: number | null }>()
  for (const r of applied) if (!latestByProduct.has(r.productId)) latestByProduct.set(r.productId, r)

  let proposed = 0
  for (const [productId, row] of latestByProduct) {
    if (row.oldCostPerBase === null || row.oldCostPerBase <= 0) continue

    const [later] = await tx
      .select({ id: productCostSyncs.id })
      .from(productCostSyncs)
      .where(and(
        eq(productCostSyncs.branchId, branchId),
        eq(productCostSyncs.productId, productId),
        gt(productCostSyncs.id, row.id),
        inArray(productCostSyncs.status, ['APPLIED', 'APPROVED']),
      ))
      .limit(1)
    if (later) continue

    const product = await loadProductUoms(tx, productId)
    if (!product) continue
    const current = await loadCurrentCosts(tx, branchId, productId)

    await supersedePending(tx, branchId, productId, `Digantikan usulan pengembalian (${poNumber} dibatalkan)`)
    await tx.insert(productCostSyncs).values({
      branchId,
      productId,
      sourceType: 'PO_REVERSAL',
      sourceId: poId,
      sourceRef: `Batal terima ${poNumber}`,
      sourceUomId: product.baseUomId,
      sourceUnitCost: row.oldCostPerBase,
      oldCostPerBase: currentCostPerBase(product.uoms, current, product.baseUomId),
      newCostPerBase: row.oldCostPerBase,
      status: 'PENDING',
      effectiveAt: new Date(),
      createdById: actorUserId,
    })
    proposed++
  }
  return proposed
}

/** Setujui satu usulan PENDING: terapkan modal ke semua satuan dari angka mentah satuan masuknya. */
export async function approveCostReview(tx: Tx, input: { id: number; userId: number; note?: string | null }): Promise<void> {
  const [row] = await tx
    .select()
    .from(productCostSyncs)
    .where(eq(productCostSyncs.id, input.id))
    .for('update')
    .limit(1)
  if (!row) throw new Error('NOT_FOUND')
  if (row.status !== 'PENDING') throw new Error('NOT_PENDING')

  const product = await loadProductUoms(tx, row.productId)
  const sourceRatio = product?.uoms.find(u => u.uomId === row.sourceUomId)?.ratio
  if (!product || !sourceRatio) throw new Error('NO_CONVERSION')

  const current = await loadCurrentCosts(tx, row.branchId, row.productId)
  await applyTargetCosts(tx, {
    branchId: row.branchId,
    productId: row.productId,
    targets: buildTargetCosts(row.sourceUnitCost, sourceRatio, product.uoms),
    current,
    actor: { userId: input.userId, source: 'REVIEW', reference: row.sourceRef },
  })

  await tx
    .update(productCostSyncs)
    .set({ status: 'APPROVED', resolvedById: input.userId, resolvedAt: new Date(), resolutionNote: input.note ?? null })
    .where(eq(productCostSyncs.id, row.id))
}

export async function rejectCostReview(tx: Tx, input: { id: number; userId: number; reason: string }): Promise<void> {
  const [updated] = await tx
    .update(productCostSyncs)
    .set({ status: 'REJECTED', resolvedById: input.userId, resolvedAt: new Date(), resolutionNote: input.reason })
    .where(and(eq(productCostSyncs.id, input.id), eq(productCostSyncs.status, 'PENDING')))
    .returning({ id: productCostSyncs.id })
  if (updated) return

  const [exists] = await tx.select({ id: productCostSyncs.id }).from(productCostSyncs).where(eq(productCostSyncs.id, input.id)).limit(1)
  throw new Error(exists ? 'NOT_PENDING' : 'NOT_FOUND')
}

// -------------------- Daftar untuk halaman --------------------

export type CostReviewTab = 'PENDING' | 'APPROVED' | 'APPLIED' | 'REJECTED'

const TAB_STATUSES: Record<CostReviewTab, CostSyncStatus[]> = {
  PENDING: ['PENDING'],
  APPROVED: ['APPROVED'],
  APPLIED: ['APPLIED'],
  REJECTED: ['REJECTED', 'SUPERSEDED'],
}

export const COST_REVIEW_HISTORY_LIMIT = 200

export interface CostReviewEntry {
  id: number
  branchId: number
  branchName: string
  productId: number
  productName: string
  sku: string | null
  baseUomCode: string | null
  sourceType: CostSyncSourceType
  sourceRef: string | null
  sourceUomCode: string | null
  sourceUnitCost: number
  oldCostPerBase: number | null
  newCostPerBase: number
  changePercent: number | null
  status: CostSyncStatus
  effectiveAt: string
  createdAt: string
  createdByName: string | null
  resolvedByName: string | null
  resolvedAt: string | null
  resolutionNote: string | null
}

export async function getCostReviews(tab: CostReviewTab): Promise<CostReviewEntry[]> {
  const createdBy = alias(users, 'cost_sync_created_by')
  const resolvedBy = alias(users, 'cost_sync_resolved_by')
  const sourceUom = alias(unitsOfMeasure, 'cost_sync_source_uom')
  const baseUom = alias(unitsOfMeasure, 'cost_sync_base_uom')

  const rows = await db
    .select({
      id: productCostSyncs.id,
      branchId: productCostSyncs.branchId,
      branchName: branches.name,
      productId: productCostSyncs.productId,
      productName: products.name,
      sku: products.sku,
      baseUomCode: baseUom.code,
      sourceType: productCostSyncs.sourceType,
      sourceRef: productCostSyncs.sourceRef,
      sourceUomCode: sourceUom.code,
      sourceUnitCost: productCostSyncs.sourceUnitCost,
      oldCostPerBase: productCostSyncs.oldCostPerBase,
      newCostPerBase: productCostSyncs.newCostPerBase,
      status: productCostSyncs.status,
      effectiveAt: productCostSyncs.effectiveAt,
      createdAt: productCostSyncs.createdAt,
      createdByName: createdBy.name,
      resolvedByName: resolvedBy.name,
      resolvedAt: productCostSyncs.resolvedAt,
      resolutionNote: productCostSyncs.resolutionNote,
    })
    .from(productCostSyncs)
    .innerJoin(branches, eq(productCostSyncs.branchId, branches.id))
    .innerJoin(products, eq(productCostSyncs.productId, products.id))
    .leftJoin(baseUom, eq(products.baseUomId, baseUom.id))
    .leftJoin(sourceUom, eq(productCostSyncs.sourceUomId, sourceUom.id))
    .leftJoin(createdBy, eq(productCostSyncs.createdById, createdBy.id))
    .leftJoin(resolvedBy, eq(productCostSyncs.resolvedById, resolvedBy.id))
    .where(inArray(productCostSyncs.status, TAB_STATUSES[tab]))
    .orderBy(tab === 'PENDING' ? asc(productCostSyncs.createdAt) : desc(productCostSyncs.id))
    .limit(COST_REVIEW_HISTORY_LIMIT)

  return rows.map(r => ({
    ...r,
    sourceType: r.sourceType as CostSyncSourceType,
    status: r.status as CostSyncStatus,
    changePercent: r.oldCostPerBase && r.oldCostPerBase > 0
      ? new Big(r.newCostPerBase).minus(r.oldCostPerBase).div(r.oldCostPerBase).times(100).round(1, Big.roundHalfUp).toNumber()
      : null,
    effectiveAt: r.effectiveAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
  }))
}

export const MARGIN_ALERT_LIMIT = 500

export interface MarginAlertEntry {
  branchId: number
  branchName: string
  productId: number
  productName: string
  sku: string | null
  uomId: number
  uomCode: string
  tierType: string
  price: number
  costPrice: number
  margin: number
  marginPercent: number
}

// Margin <= 1% (termasuk rugi) di pasangan harga jual & modal pada cabang + satuan yang sama.
// Dihitung langsung dari Manajemen Harga, jadi baris hilang sendiri begitu harga jualnya dinaikkan.
function marginAlertCondition() {
  return and(
    gt(productPrices.price, 0),
    gt(productUomCosts.costPrice, 0),
    sql`(${productPrices.price} - ${productUomCosts.costPrice}) * 100 <= ${productPrices.price} * ${MARGIN_ALERT_PERCENT}`,
    eq(products.isActive, true),
    eq(branches.isActive, true),
  )
}

function marginAlertBase() {
  return {
    costJoin: and(
      eq(productUomCosts.productId, productPrices.productId),
      eq(productUomCosts.branchId, productPrices.branchId),
      eq(productUomCosts.uomId, productPrices.uomId),
    ),
  }
}

export async function getMarginAlerts(filter: { branchId?: number | null; q?: string | null }): Promise<{
  items: MarginAlertEntry[]
  total: number
}> {
  const { costJoin } = marginAlertBase()
  const q = filter.q?.trim()
  const where = and(
    marginAlertCondition(),
    filter.branchId ? eq(productPrices.branchId, filter.branchId) : undefined,
    q ? or(ilike(products.name, `%${q}%`), ilike(products.sku, `%${q}%`)) : undefined,
  )

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        branchId: productPrices.branchId,
        branchName: branches.name,
        productId: productPrices.productId,
        productName: products.name,
        sku: products.sku,
        uomId: productPrices.uomId,
        uomCode: unitsOfMeasure.code,
        tierType: productPrices.tierType,
        price: productPrices.price,
        costPrice: productUomCosts.costPrice,
      })
      .from(productPrices)
      .innerJoin(productUomCosts, costJoin)
      .innerJoin(products, eq(productPrices.productId, products.id))
      .innerJoin(branches, eq(productPrices.branchId, branches.id))
      .innerJoin(unitsOfMeasure, eq(productPrices.uomId, unitsOfMeasure.id))
      .where(where)
      .orderBy(
        asc(sql`(${productPrices.price} - ${productUomCosts.costPrice})::numeric / ${productPrices.price}`),
        asc(products.name),
      )
      .limit(MARGIN_ALERT_LIMIT),
    db
      .select({ total: sql<number>`CAST(COUNT(*) AS INTEGER)` })
      .from(productPrices)
      .innerJoin(productUomCosts, costJoin)
      .innerJoin(products, eq(productPrices.productId, products.id))
      .innerJoin(branches, eq(productPrices.branchId, branches.id))
      .where(where),
  ])

  return {
    total: Number(countRow?.total ?? 0),
    items: rows.map(r => ({
      ...r,
      price: Number(r.price),
      costPrice: Number(r.costPrice),
      margin: Number(r.price) - Number(r.costPrice),
      marginPercent: marginPercent(Number(r.price), Number(r.costPrice)),
    })),
  }
}

/** Untuk badge sidebar: usulan modal menunggu + pasangan harga bermargin <= 1%. */
export function costReviewBadgeExpr() {
  const { costJoin } = marginAlertBase()
  return sql<number>`(
    (SELECT CAST(COUNT(*) AS INTEGER) FROM ${productCostSyncs} WHERE ${eq(productCostSyncs.status, 'PENDING')})
    + (SELECT CAST(COUNT(*) AS INTEGER) FROM ${productPrices}
        INNER JOIN ${productUomCosts} ON ${costJoin}
        INNER JOIN ${products} ON ${eq(productPrices.productId, products.id)}
        INNER JOIN ${branches} ON ${eq(productPrices.branchId, branches.id)}
        WHERE ${marginAlertCondition()})
  )`
}

