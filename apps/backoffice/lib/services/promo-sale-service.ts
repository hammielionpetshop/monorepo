import { db, customers, products, productPrices, productStocks, promoBranchUsage, transactionItemDiscounts, and, eq, inArray, sql } from '../db'
import { isOngkirKind } from '../ongkir'
import { DISCOUNT_KIND_PROMO } from '../manual-discount'
import { judgePromos, type PromoClaim, type PromoJudgeCode } from '../promo/promo-judge'
import { PROMO_TIER, type PromoLineResult, type PromoRule } from '../promo/promo-engine'
import { getPromoEnabled, loadPromoRules } from './promo-service'

// Promo di nota kasir (P2c) — pintu baca & tulisnya. Hitungannya di mesin promo
// (`lib/promo/promo-engine.ts`) dan pemeriksaannya di `lib/promo/promo-judge.ts`; berkas ini
// hanya mengumpulkan bahan dari database (promo, saklar darurat, golongan pelanggan, jenis
// barang), memakai jam server, dan mencatat potongan `PROMO` sesudah baris nota tersimpan.
//
// Kuota per cabang & syarat stok (P3c): sisa jatah dan stok barang hadiah disuplai ke mesin
// sebagai data masukan (mesin tetap murni). Saat nota disimpan, baris `promo_branch_usage`
// dikunci FOR UPDATE supaya dua kasir tidak berebut jatah yang sama.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
/** `db` atau `tx`; cukup untuk membaca dan (saat mengunci jatah) menyisipkan baris pemakaian. */
type Executor = Pick<typeof db, 'select' | 'insert'>

export class PromoSaleError extends Error {
  constructor(message: string, readonly code: PromoJudgeCode, readonly status = code === 'PROMO_CHANGED' ? 409 : 400) {
    super(message)
    this.name = 'PromoSaleError'
  }
}

interface SaleItemLike {
  productId: number | string
  uomId: number | string
  qty: number | string
  unitPrice: number | string
  priceTier: string
  discountAmount: number | string
  subtotal: number | string
  promo?: PromoClaim | null
  manualDiscount?: unknown
}

export interface SalePromoPayload {
  branchId: number
  customerId?: number | null
  saleType?: string
  sourceIbtId?: number | null
  sourceOrderId?: number | null
  createdOffline?: boolean
  items: SaleItemLike[]
  totals: { subtotal: number | string; discountTotal: number | string; grandTotal: number | string }
}

export interface PromoAward extends PromoLineResult {
  /** Salinan aturan promo saat nota terbit. */
  rule: PromoRule
}

/** Penjualan Grosir, PO Internal, pesanan portal, dan nota sinkron offline tidak ikut promo. */
export function isOutsidePromo(payload: Pick<SalePromoPayload, 'saleType' | 'sourceIbtId' | 'sourceOrderId' | 'createdOffline'>): boolean {
  return payload.saleType === 'BULK' || payload.sourceIbtId != null || payload.sourceOrderId != null || payload.createdOffline === true
}

/**
 * Sisa jatah kuota per promo + stok barang hadiah untuk satu cabang, disuplai ke mesin promo
 * sebagai data masukan. `lock` (dipakai saat simpan nota) menyisipkan dan mengunci baris
 * `promo_branch_usage` FOR UPDATE supaya dua kasir yang berebut jatah promo yang sama jadi
 * berurutan — jatah tidak jebol minus. Tanpa `lock` (layar kasir) hanya membaca.
 */
export async function loadPromoUsageContext(
  executor: Executor,
  branchId: number,
  rules: PromoRule[],
  opts: { lock?: boolean } = {},
): Promise<{ remainingQuota: Map<number, number>; stock: Map<string, number>; rewardPrices: Map<string, number> }> {
  const remainingQuota = new Map<number, number>()
  const stock = new Map<string, number>()
  const rewardPrices = new Map<string, number>()

  const quotaRules = rules.filter((r) => r.quotaKind != null && r.quotaPerBranch != null)
  if (quotaRules.length > 0) {
    const ids = quotaRules.map((r) => r.id)
    if (opts.lock) {
      // Pastikan barisnya ada lebih dulu — baris yang belum ada tidak bisa dikunci; dua nota
      // untuk promo×cabang yang sama lalu berurutan di SELECT … FOR UPDATE di bawah.
      await executor.insert(promoBranchUsage).values(quotaRules.map((r) => ({ promoId: r.id, branchId }))).onConflictDoNothing()
      await executor
        .select({ promoId: promoBranchUsage.promoId })
        .from(promoBranchUsage)
        .where(and(inArray(promoBranchUsage.promoId, ids), eq(promoBranchUsage.branchId, branchId)))
        .for('update')
    }
    const usageRows = await executor
      .select({ promoId: promoBranchUsage.promoId, usedPcs: promoBranchUsage.usedPcs, usedNotes: promoBranchUsage.usedNotes })
      .from(promoBranchUsage)
      .where(and(inArray(promoBranchUsage.promoId, ids), eq(promoBranchUsage.branchId, branchId)))
    const usedOf = new Map(usageRows.map((u) => [u.promoId, u]))
    for (const rule of quotaRules) {
      const u = usedOf.get(rule.id)
      const used = rule.quotaKind === 'PCS' ? (u?.usedPcs ?? 0) : (u?.usedNotes ?? 0)
      remainingQuota.set(rule.id, Math.max(0, rule.quotaPerBranch! - used))
    }
  }

  const stockRules = rules.filter((r) => r.requireStock)
  if (stockRules.length > 0) {
    const productIds = [...new Set(stockRules.flatMap((r) => r.rewards.map((rw) => rw.productId)))]
    const stockRows = await executor
      .select({ productId: productStocks.productId, qty: productStocks.qty })
      .from(productStocks)
      .where(and(inArray(productStocks.productId, productIds), eq(productStocks.branchId, branchId)))
    // product_stocks selalu base UOM; untuk syarat stok cukup "ada / tidak" (> 0), jadi qty base
    // dipakai apa adanya untuk tiap satuan hadiah barang itu.
    const qtyOf = new Map(stockRows.map((s) => [s.productId, s.qty]))
    for (const rule of stockRules) {
      for (const reward of rule.rewards) stock.set(`${reward.productId}:${reward.uomId}`, qtyOf.get(reward.productId) ?? 0)
    }
  }

  // Harga Retail barang hadiah GRATIS — mesin butuh ini untuk membuat baris hadiah (harga barang
  // gratis tidak ada di keranjang). Barang hadiah tanpa harga Retail di cabang itu dilewati mesin.
  const giftItems = rules.flatMap((r) => r.rewards.filter((rw) => rw.type === 'GRATIS').map((rw) => ({ productId: rw.productId, uomId: rw.uomId })))
  if (giftItems.length > 0) {
    const giftProductIds = [...new Set(giftItems.map((g) => g.productId))]
    const giftUomIds = [...new Set(giftItems.map((g) => g.uomId))]
    const priceRows = await executor
      .select({ productId: productPrices.productId, uomId: productPrices.uomId, price: productPrices.price })
      .from(productPrices)
      .where(and(
        inArray(productPrices.productId, giftProductIds),
        inArray(productPrices.uomId, giftUomIds),
        eq(productPrices.branchId, branchId),
        eq(productPrices.tierType, PROMO_TIER),
      ))
    for (const row of priceRows) rewardPrices.set(`${row.productId}:${row.uomId}`, row.price)
  }

  return { remainingQuota, stock, rewardPrices }
}

/**
 * Server sebagai hakim: hitung ulang promo nota ini dan bandingkan dengan kiriman layar. Tidak
 * cocok → PromoSaleError (seluruh nota ditolak sebelum apa pun ditulis). Hasilnya potongan promo
 * per baris (urutan sama dengan `items`; null = baris tanpa promo).
 *
 * Dipanggil DI DALAM transaksi DB (executor = `tx`): sisa jatah kuota dibaca sambil mengunci
 * baris `promo_branch_usage`, dan kuncinya ditahan sampai `recordPromoUsageInTx` menambah
 * pemakaian pada transaksi yang sama.
 */
export async function judgeSalePromos(
  payload: SalePromoPayload,
  now: Date = new Date(),
  executor: Executor = db,
): Promise<{ awards: (PromoAward | null)[]; packageNos: (number | null)[] }> {
  const outOfScope = isOutsidePromo(payload)
  const claimed = payload.items.some((i) => i.promo)
  const enabled = outOfScope ? false : await getPromoEnabled()
  const rules = outOfScope || !enabled ? [] : await loadPromoRules(payload.branchId, now, executor)
  // Tanpa promo berjalan dan tanpa kiriman promo: tidak ada yang perlu dibaca lagi.
  if (rules.length === 0 && !claimed) return { awards: payload.items.map(() => null), packageNos: payload.items.map(() => null) }

  // Sekuensial, bukan Promise.all: saat executor = `tx`, beberapa kueri paralel berbagi satu
  // koneksi transaksi dan bisa saling tabrak. Kueri-kueri ini kecil.
  const productIds = [...new Set(payload.items.map((i) => Number(i.productId)))]
  const kindRows = productIds.length > 0
    ? await executor.select({ id: products.id, kind: products.productKind }).from(products).where(inArray(products.id, productIds))
    : []
  const customerRows = payload.customerId
    ? await executor.select({ tier: customers.defaultTierType }).from(customers).where(eq(customers.id, payload.customerId)).limit(1)
    : []
  const usage = await loadPromoUsageContext(executor, payload.branchId, rules, { lock: true })
  const kindOf = new Map(kindRows.map((p) => [p.id, p.kind]))

  const judgement = judgePromos(
    payload.items.map((i) => ({
      productId: Number(i.productId),
      uomId: Number(i.uomId),
      qty: Math.round(Number(i.qty)),
      unitPrice: Math.round(Number(i.unitPrice)),
      priceTier: i.priceTier,
      discountAmount: Math.round(Number(i.discountAmount)),
      subtotal: Math.round(Number(i.subtotal)),
      promo: i.promo ?? null,
      hasManualDiscount: i.manualDiscount != null,
      excluded: isOngkirKind(kindOf.get(Number(i.productId))),
    })),
    rules,
    {
      branchId: payload.branchId,
      customerTier: customerRows[0]?.tier ?? null,
      now,
      enabled,
      outOfScope,
      remainingQuota: usage.remainingQuota,
      stock: usage.stock,
      rewardPrices: usage.rewardPrices,
    },
    {
      subtotal: Math.round(Number(payload.totals.subtotal)),
      discountTotal: Math.round(Number(payload.totals.discountTotal)),
      grandTotal: Math.round(Number(payload.totals.grandTotal)),
    },
  )
  if (!judgement.ok) throw new PromoSaleError(judgement.message, judgement.code)
  const ruleOf = new Map(rules.map((r) => [r.id, r]))
  return {
    awards: judgement.awards.map((award) => (award ? { ...award, rule: ruleOf.get(award.promoId)! } : null)),
    packageNos: judgement.packageNos,
  }
}

/**
 * Tambah pemakaian kuota (P3c), sesudah `judgeSalePromos` lolos dalam transaksi yang sama. Kuota
 * pcs bertambah sebanyak pcs hadiah yang kena promo; kuota nota bertambah 1 per promo yang dipakai
 * nota ini. Promo tanpa kuota dilewati. Baris sudah ada & terkunci dari `judgeSalePromos`.
 */
export async function recordPromoUsageInTx(tx: Tx, params: { branchId: number; awards: (PromoAward | null)[] }): Promise<void> {
  const byPromo = new Map<number, { rule: PromoRule; pcs: number }>()
  for (const award of params.awards) {
    if (!award) continue
    const entry = byPromo.get(award.promoId) ?? { rule: award.rule, pcs: 0 }
    entry.pcs += award.units
    byPromo.set(award.promoId, entry)
  }
  for (const [promoId, { rule, pcs }] of byPromo) {
    if (rule.quotaKind == null || rule.quotaPerBranch == null) continue
    const addPcs = rule.quotaKind === 'PCS' ? pcs : 0
    const addNotes = rule.quotaKind === 'NOTA' ? 1 : 0
    await tx
      .insert(promoBranchUsage)
      .values({ promoId, branchId: params.branchId, usedPcs: addPcs, usedNotes: addNotes })
      .onConflictDoUpdate({
        target: [promoBranchUsage.promoId, promoBranchUsage.branchId],
        set: {
          usedPcs: sql`${promoBranchUsage.usedPcs} + ${addPcs}`,
          usedNotes: sql`${promoBranchUsage.usedNotes} + ${addNotes}`,
        },
      })
  }
}

/**
 * Kembalikan jatah kuota saat nota DIBATALKAN (void) — dikurangi persis yang tercatat untuk nota
 * itu, dari salinan aturan di `transaction_item_discounts`. Retur TIDAK memanggil ini (jatah
 * hangus — keputusan owner 2026-10-18). Promo tanpa kuota dilewati.
 */
export async function reversePromoUsageInTx(tx: Tx, params: { transactionId: number; branchId: number }): Promise<void> {
  const rows = await tx
    .select({ promotionId: transactionItemDiscounts.promotionId, snapshot: transactionItemDiscounts.promotionSnapshot })
    .from(transactionItemDiscounts)
    .where(and(eq(transactionItemDiscounts.transactionId, params.transactionId), eq(transactionItemDiscounts.kind, DISCOUNT_KIND_PROMO)))
  if (rows.length === 0) return
  const byPromo = new Map<number, { pcs: number; notes: number }>()
  for (const row of rows) {
    if (row.promotionId == null) continue
    const snap = (row.snapshot ?? {}) as { quotaKind?: string | null; units?: number }
    if (snap.quotaKind == null) continue
    const entry = byPromo.get(row.promotionId) ?? { pcs: 0, notes: 0 }
    if (snap.quotaKind === 'PCS') entry.pcs += Number(snap.units ?? 0)
    else if (snap.quotaKind === 'NOTA') entry.notes = 1
    byPromo.set(row.promotionId, entry)
  }
  for (const [promoId, { pcs, notes }] of byPromo) {
    if (pcs === 0 && notes === 0) continue
    await tx
      .update(promoBranchUsage)
      .set({
        usedPcs: sql`GREATEST(0, ${promoBranchUsage.usedPcs} - ${pcs})`,
        usedNotes: sql`GREATEST(0, ${promoBranchUsage.usedNotes} - ${notes})`,
      })
      .where(and(eq(promoBranchUsage.promoId, promoId), eq(promoBranchUsage.branchId, params.branchId)))
  }
}

/** Mencatat potongan promo satu baris nota (sudah lolos `judgeSalePromos`). */
export async function recordPromoDiscountInTx(tx: Tx, params: {
  transactionId: number
  transactionItemId: number
  award: PromoAward | null | undefined
  cashierId?: number | null
}): Promise<void> {
  const award = params.award
  if (!award) return
  await tx.insert(transactionItemDiscounts).values({
    transactionId: params.transactionId,
    transactionItemId: params.transactionItemId,
    kind: DISCOUNT_KIND_PROMO,
    amount: award.amount,
    promotionId: award.promoId,
    promotionName: award.promoName,
    promotionSnapshot: { ...award.rule, units: award.units },
    createdById: params.cashierId ?? null,
  })
}
