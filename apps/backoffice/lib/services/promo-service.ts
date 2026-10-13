import { alias } from 'drizzle-orm/pg-core'
import {
  db, promos, promoBranches, promoConditions, promoRewards, products, productUomConversions,
  productPrices, productUomCosts, unitsOfMeasure, branches, users, appSettings, auditLogs,
  and, eq, gt, inArray, desc, sql,
} from '../db'
import {
  checkNewPromo, promoUnitPrice, promoStatus, PROMO_TIER,
  type PromoRule, type PromoStatus,
} from '../promo/promo-engine'
import { isOngkirKind } from '../ongkir'

// Layanan promo Back Office (P2b): daftar, buat, nonaktifkan, saklar darurat. Hitungan promo
// tetap di mesin (lib/promo/promo-engine.ts); berkas ini hanya membaca dan menyimpan.
// Promo tidak bisa diubah atau dihapus — hanya dinonaktifkan, lalu buat promo baru.

type Executor = Pick<typeof db, 'select'>
type Actor = { userId: number; branchId: number }

/** Peran yang boleh membuat & menonaktifkan promo dan memakai saklar darurat (owner 13 Okt). */
export const PROMO_MANAGER_ROLES = ['OWNER', 'GM']

export const PROMO_SWITCH_SETTING_KEY = 'promo_enabled'

export class PromoServiceError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export interface PromoLoss {
  productName: string
  uomCode: string
  branchName: string
  price: number
  promoPrice: number
  cost: number
}

/** Harga promo di bawah modal dan pembuat belum menyatakan tetap lanjut. */
export class PromoLossError extends PromoServiceError {
  constructor(public losses: PromoLoss[]) {
    super('Harga sesudah promo di bawah modal', 409)
  }
}

export type NewPromoInput = Omit<PromoRule, 'id' | 'isActive'> & { note?: string | null }

// ── Saklar darurat ──────────────────────────────────────────────────────────────────────────

/** FALSE = semua promo dimatikan. Belum pernah diatur = menyala. */
export async function getPromoEnabled(executor: Executor = db): Promise<boolean> {
  const [row] = await executor
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, PROMO_SWITCH_SETTING_KEY))
    .limit(1)
  return row?.value !== 'false'
}

/** Nyalakan / matikan semua promo sekaligus. Berjejak di audit_logs. */
export async function setPromoEnabled(enabled: boolean, actor: Actor): Promise<boolean> {
  return db.transaction(async (tx) => {
    const old = await getPromoEnabled(tx)
    if (old === enabled) return enabled
    const value = String(enabled)
    await tx
      .insert(appSettings)
      .values({ key: PROMO_SWITCH_SETTING_KEY, value, updatedBy: actor.userId, updatedAt: new Date() })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: actor.userId, updatedAt: new Date() } })
    await tx.insert(auditLogs).values({
      branchId: actor.branchId, userId: actor.userId, action: 'PROMO_SWITCH_UPDATE', tableName: 'app_settings',
      recordId: PROMO_SWITCH_SETTING_KEY, oldData: JSON.stringify({ enabled: old }), newData: JSON.stringify({ enabled }),
    })
    return enabled
  })
}

// ── Promo untuk kasir (P2c) ──────────────────────────────────────────────────────────────────

/**
 * Promo aktif di satu cabang yang belum berakhir pada `now` (yang belum mulai ikut, supaya layar
 * kasir yang memuatnya lebih awal tetap tepat saat promonya mulai). Apakah promo benar-benar
 * berlaku pada saat itu tetap diputuskan mesin promo (`isPromoRunning`).
 */
export async function loadPromoRules(branchId: number, now: Date, executor: Executor = db): Promise<PromoRule[]> {
  const heads = await executor
    .select()
    .from(promos)
    .where(and(
      eq(promos.isActive, true),
      gt(promos.endsAt, now),
      sql`EXISTS (SELECT 1 FROM petshop.promo_branches pb WHERE pb.promo_id = ${promos.id} AND pb.branch_id = ${branchId})`,
    ))
    .orderBy(promos.id)
  if (heads.length === 0) return []
  const ids = heads.map((h) => h.id)
  const [branchRows, conditionRows, rewardRows] = await Promise.all([
    executor.select().from(promoBranches).where(inArray(promoBranches.promoId, ids)),
    executor.select().from(promoConditions).where(inArray(promoConditions.promoId, ids)).orderBy(promoConditions.id),
    executor.select().from(promoRewards).where(inArray(promoRewards.promoId, ids)).orderBy(promoRewards.id),
  ])
  return heads.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind as PromoRule['kind'],
    branchIds: branchRows.filter((b) => b.promoId === p.id).map((b) => b.branchId),
    startsAt: p.startsAt,
    endsAt: p.endsAt,
    dailyStartMinute: p.dailyStartMinute,
    dailyEndMinute: p.dailyEndMinute,
    isMultiple: p.isMultiple,
    maxPerNote: p.maxPerNote,
    isActive: p.isActive,
    conditions: conditionRows.filter((c) => c.promoId === p.id).map((c) => ({ productId: c.productId, uomId: c.uomId, minQty: c.minQty })),
    rewards: rewardRows.filter((r) => r.promoId === p.id).map((r) => ({
      productId: r.productId, uomId: r.uomId, type: r.rewardType as PromoRule['rewards'][number]['type'], value: r.value, qty: r.qty,
    })),
  }))
}

// ── Pemeriksaan barang, cabang, dan jual rugi ──────────────────────────────────────────────

async function assertItemsAndBranches(input: NewPromoInput, executor: Executor) {
  const branchIds = [...new Set(input.branchIds)]
  const foundBranches = await executor
    .select({ id: branches.id })
    .from(branches)
    .where(and(inArray(branches.id, branchIds), eq(branches.isActive, true)))
  if (foundBranches.length !== branchIds.length) throw new PromoServiceError('Cabang promo tidak ditemukan atau sudah tidak aktif')

  const items = [...input.conditions, ...input.rewards]
  const productIds = [...new Set(items.map((i) => i.productId))]
  const productRows = await executor
    .select({ id: products.id, isActive: products.isActive, kind: products.productKind, baseUomId: products.baseUomId })
    .from(products)
    .where(inArray(products.id, productIds))
  const conversions = await executor
    .select({ productId: productUomConversions.productId, uomId: productUomConversions.uomId })
    .from(productUomConversions)
    .where(inArray(productUomConversions.productId, productIds))
  const byId = new Map(productRows.map((p) => [p.id, p]))
  for (const item of items) {
    const product = byId.get(item.productId)
    if (!product || !product.isActive) throw new PromoServiceError('Barang promo tidak ditemukan atau sudah tidak aktif')
    if (isOngkirKind(product.kind)) throw new PromoServiceError('Ongkos kirim tidak bisa dipromo')
    const uomOk = item.uomId === product.baseUomId
      || conversions.some((c) => c.productId === item.productId && c.uomId === item.uomId)
    if (!uomOk) throw new PromoServiceError('Satuan barang promo tidak sesuai dengan barangnya')
  }
}

/**
 * Barang yang harganya sesudah promo di bawah modal, per cabang. Barang tanpa harga Retail atau
 * tanpa modal di cabang itu tidak bisa dinilai dan dilewati.
 */
export async function findPromoLosses(input: Pick<NewPromoInput, 'branchIds' | 'rewards'>, executor: Executor = db): Promise<PromoLoss[]> {
  if (input.rewards.length === 0 || input.branchIds.length === 0) return []
  const productIds = [...new Set(input.rewards.map((r) => r.productId))]
  const [prices, costs, names, uoms, branchRows] = await Promise.all([
    executor
      .select({ productId: productPrices.productId, branchId: productPrices.branchId, uomId: productPrices.uomId, price: productPrices.price })
      .from(productPrices)
      .where(and(inArray(productPrices.productId, productIds), inArray(productPrices.branchId, input.branchIds), eq(productPrices.tierType, PROMO_TIER))),
    executor
      .select({ productId: productUomCosts.productId, branchId: productUomCosts.branchId, uomId: productUomCosts.uomId, cost: productUomCosts.costPrice })
      .from(productUomCosts)
      .where(and(inArray(productUomCosts.productId, productIds), inArray(productUomCosts.branchId, input.branchIds))),
    executor.select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, productIds)),
    executor.select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code }).from(unitsOfMeasure).where(inArray(unitsOfMeasure.id, input.rewards.map((r) => r.uomId))),
    executor.select({ id: branches.id, name: branches.name }).from(branches).where(inArray(branches.id, input.branchIds)),
  ])
  const key = (productId: number, branchId: number, uomId: number) => `${productId}:${branchId}:${uomId}`
  const priceOf = new Map(prices.map((p) => [key(p.productId, p.branchId, p.uomId), p.price]))
  const costOf = new Map(costs.map((c) => [key(c.productId, c.branchId, c.uomId), c.cost]))
  const losses: PromoLoss[] = []
  for (const reward of input.rewards) {
    for (const branch of branchRows) {
      const price = priceOf.get(key(reward.productId, branch.id, reward.uomId))
      const cost = costOf.get(key(reward.productId, branch.id, reward.uomId))
      if (price == null || cost == null) continue
      const promoPrice = promoUnitPrice(reward, price)
      if (promoPrice >= cost) continue
      losses.push({
        productName: names.find((n) => n.id === reward.productId)?.name ?? `#${reward.productId}`,
        uomCode: uoms.find((u) => u.id === reward.uomId)?.code ?? '',
        branchName: branch.name,
        price,
        promoPrice,
        cost,
      })
    }
  }
  return losses
}

// ── Buat & nonaktifkan ─────────────────────────────────────────────────────────────────────

/**
 * Simpan promo baru. Harga promo di bawah modal → PromoLossError, kecuali `acceptLoss`
 * (pembuat sudah memilih "tetap buat" di peringatan jual rugi).
 */
export async function createPromo(input: NewPromoInput, actor: Actor, opts: { acceptLoss?: boolean } = {}): Promise<{ id: number }> {
  const rule = { ...input, name: input.name.trim(), branchIds: [...new Set(input.branchIds)], isActive: true }
  const problem = checkNewPromo(rule)
  if (problem) throw new PromoServiceError(problem)
  await assertItemsAndBranches(rule, db)
  const losses = await findPromoLosses(rule)
  if (losses.length > 0 && !opts.acceptLoss) throw new PromoLossError(losses)

  return db.transaction(async (tx) => {
    const [promo] = await tx.insert(promos).values({
      name: rule.name,
      kind: rule.kind,
      note: input.note?.trim() || null,
      startsAt: new Date(rule.startsAt),
      endsAt: new Date(rule.endsAt),
      dailyStartMinute: rule.dailyStartMinute,
      dailyEndMinute: rule.dailyEndMinute,
      isMultiple: rule.isMultiple,
      maxPerNote: rule.maxPerNote,
      createdById: actor.userId,
    }).returning({ id: promos.id })
    await tx.insert(promoBranches).values(rule.branchIds.map((branchId) => ({ promoId: promo.id, branchId })))
    await tx.insert(promoConditions).values(rule.conditions.map((c) => ({ promoId: promo.id, productId: c.productId, uomId: c.uomId, minQty: c.minQty })))
    await tx.insert(promoRewards).values(rule.rewards.map((r) => ({
      promoId: promo.id, productId: r.productId, uomId: r.uomId, rewardType: r.type, value: r.value, qty: r.qty,
    })))
    await tx.insert(auditLogs).values({
      branchId: actor.branchId, userId: actor.userId, action: 'PROMO_CREATE', tableName: 'promos',
      recordId: String(promo.id), newData: JSON.stringify({ ...rule, acceptedLoss: losses.length > 0 ? losses : undefined }),
    })
    return promo
  })
}

/** Nonaktifkan promo (tidak bisa dinyalakan lagi — buat promo baru bila perlu). */
export async function deactivatePromo(promoId: number, actor: Actor): Promise<void> {
  await db.transaction(async (tx) => {
    const [promo] = await tx.select({ id: promos.id, isActive: promos.isActive }).from(promos).where(eq(promos.id, promoId)).for('update')
    if (!promo) throw new PromoServiceError('Promo tidak ditemukan', 404)
    if (!promo.isActive) throw new PromoServiceError('Promo ini sudah dinonaktifkan', 409)
    await tx.update(promos).set({ isActive: false, deactivatedById: actor.userId, deactivatedAt: new Date() }).where(eq(promos.id, promoId))
    await tx.insert(auditLogs).values({
      branchId: actor.branchId, userId: actor.userId, action: 'PROMO_DEACTIVATE', tableName: 'promos',
      recordId: String(promoId), oldData: JSON.stringify({ isActive: true }), newData: JSON.stringify({ isActive: false }),
    })
  })
}

// ── Daftar ────────────────────────────────────────────────────────────────────────────────

export interface PromoItemView {
  productId: number
  productName: string
  uomId: number
  uomCode: string
}

export interface PromoListItem extends PromoRule {
  note: string | null
  status: PromoStatus
  branchNames: string[]
  conditions: (PromoRule['conditions'][number] & PromoItemView)[]
  rewards: (PromoRule['rewards'][number] & PromoItemView)[]
  createdByName: string | null
  createdAt: Date
  deactivatedByName: string | null
  deactivatedAt: Date | null
}

/** Semua promo, terbaru dulu. `branchId` = hanya promo yang berlaku di cabang itu. */
export async function listPromos(opts: { branchId?: number; now?: Date } = {}, executor: Executor = db): Promise<PromoListItem[]> {
  const now = opts.now ?? new Date()
  const creator = alias(users, 'promo_creator')
  const deactivator = alias(users, 'promo_deactivator')
  const scoped = opts.branchId == null
    ? undefined
    : sql`EXISTS (SELECT 1 FROM petshop.promo_branches pb WHERE pb.promo_id = ${promos.id} AND pb.branch_id = ${opts.branchId})`
  const heads = await executor
    .select({
      promo: promos,
      createdByName: creator.name,
      deactivatedByName: deactivator.name,
    })
    .from(promos)
    .leftJoin(creator, eq(promos.createdById, creator.id))
    .leftJoin(deactivator, eq(promos.deactivatedById, deactivator.id))
    .where(scoped)
    .orderBy(desc(promos.id))
  if (heads.length === 0) return []
  const ids = heads.map((h) => h.promo.id)

  const [branchRows, conditionRows, rewardRows] = await Promise.all([
    executor
      .select({ promoId: promoBranches.promoId, branchId: branches.id, name: branches.name })
      .from(promoBranches)
      .innerJoin(branches, eq(promoBranches.branchId, branches.id))
      .where(inArray(promoBranches.promoId, ids))
      .orderBy(branches.name),
    executor
      .select({ row: promoConditions, productName: products.name, uomCode: unitsOfMeasure.code })
      .from(promoConditions)
      .innerJoin(products, eq(promoConditions.productId, products.id))
      .innerJoin(unitsOfMeasure, eq(promoConditions.uomId, unitsOfMeasure.id))
      .where(inArray(promoConditions.promoId, ids))
      .orderBy(promoConditions.id),
    executor
      .select({ row: promoRewards, productName: products.name, uomCode: unitsOfMeasure.code })
      .from(promoRewards)
      .innerJoin(products, eq(promoRewards.productId, products.id))
      .innerJoin(unitsOfMeasure, eq(promoRewards.uomId, unitsOfMeasure.id))
      .where(inArray(promoRewards.promoId, ids))
      .orderBy(promoRewards.id),
  ])

  return heads.map(({ promo, createdByName, deactivatedByName }) => {
    const ownBranches = branchRows.filter((b) => b.promoId === promo.id)
    const rule: PromoListItem = {
      id: promo.id,
      name: promo.name,
      kind: promo.kind as PromoRule['kind'],
      note: promo.note,
      branchIds: ownBranches.map((b) => b.branchId),
      branchNames: ownBranches.map((b) => b.name),
      startsAt: promo.startsAt,
      endsAt: promo.endsAt,
      dailyStartMinute: promo.dailyStartMinute,
      dailyEndMinute: promo.dailyEndMinute,
      isMultiple: promo.isMultiple,
      maxPerNote: promo.maxPerNote,
      isActive: promo.isActive,
      status: 'NONAKTIF',
      conditions: conditionRows.filter((c) => c.row.promoId === promo.id).map((c) => ({
        productId: c.row.productId, uomId: c.row.uomId, minQty: c.row.minQty, productName: c.productName, uomCode: c.uomCode,
      })),
      rewards: rewardRows.filter((r) => r.row.promoId === promo.id).map((r) => ({
        productId: r.row.productId, uomId: r.row.uomId, type: r.row.rewardType as PromoRule['rewards'][number]['type'],
        value: r.row.value, qty: r.row.qty, productName: r.productName, uomCode: r.uomCode,
      })),
      createdByName,
      createdAt: promo.createdAt,
      deactivatedByName,
      deactivatedAt: promo.deactivatedAt,
    }
    rule.status = promoStatus(rule, now)
    return rule
  })
}

// ── Pilihan barang untuk form promo ────────────────────────────────────────────────────────

export interface PromoItemOption {
  productId: number
  name: string
  sku: string | null
  /** Satuan yang bisa dipromo: satuan dasar + satuan konversinya. `price` = harga Retail di cabang itu. */
  uoms: { uomId: number; code: string; price: number | null }[]
}

/** Barang aktif yang bisa dipromo (bukan ongkos kirim), dengan satuannya dan harga Retail di `branchId`. */
export async function listPromoItemOptions(branchId: number, executor: Executor = db): Promise<PromoItemOption[]> {
  const baseUom = alias(unitsOfMeasure, 'promo_base_uom')
  const [productRows, conversionRows, priceRows] = await Promise.all([
    executor
      .select({ id: products.id, name: products.name, sku: products.sku, kind: products.productKind, baseUomId: products.baseUomId, baseCode: baseUom.code })
      .from(products)
      .innerJoin(baseUom, eq(products.baseUomId, baseUom.id))
      .where(eq(products.isActive, true))
      .orderBy(products.name),
    executor
      .select({ productId: productUomConversions.productId, uomId: productUomConversions.uomId, code: unitsOfMeasure.code })
      .from(productUomConversions)
      .innerJoin(unitsOfMeasure, eq(productUomConversions.uomId, unitsOfMeasure.id))
      .orderBy(productUomConversions.ratio),
    executor
      .select({ productId: productPrices.productId, uomId: productPrices.uomId, price: productPrices.price })
      .from(productPrices)
      .where(and(eq(productPrices.branchId, branchId), eq(productPrices.tierType, PROMO_TIER))),
  ])
  const priceOf = new Map(priceRows.map((p) => [`${p.productId}:${p.uomId}`, p.price]))
  const conversionsOf = new Map<number, { uomId: number; code: string }[]>()
  for (const c of conversionRows) conversionsOf.set(c.productId, [...(conversionsOf.get(c.productId) ?? []), c])
  return productRows
    .filter((p) => !isOngkirKind(p.kind))
    .map((p) => {
      const uoms = [{ uomId: p.baseUomId, code: p.baseCode }, ...(conversionsOf.get(p.id) ?? []).filter((c) => c.uomId !== p.baseUomId)]
      return {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        uoms: uoms.map((u) => ({ uomId: u.uomId, code: u.code, price: priceOf.get(`${p.id}:${u.uomId}`) ?? null })),
      }
    })
}
