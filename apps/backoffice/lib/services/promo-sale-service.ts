import { db, customers, products, transactionItemDiscounts, eq, inArray } from '../db'
import { isOngkirKind } from '../ongkir'
import { DISCOUNT_KIND_PROMO } from '../manual-discount'
import { judgePromos, type PromoClaim, type PromoJudgeCode } from '../promo/promo-judge'
import type { PromoLineResult, PromoRule } from '../promo/promo-engine'
import { getPromoEnabled, loadPromoRules } from './promo-service'

// Promo di nota kasir (P2c) — pintu baca & tulisnya. Hitungannya di mesin promo
// (`lib/promo/promo-engine.ts`) dan pemeriksaannya di `lib/promo/promo-judge.ts`; berkas ini
// hanya mengumpulkan bahan dari database (promo, saklar darurat, golongan pelanggan, jenis
// barang), memakai jam server, dan mencatat potongan `PROMO` sesudah baris nota tersimpan.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

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
 * Server sebagai hakim: hitung ulang promo nota ini dan bandingkan dengan kiriman layar. Tidak
 * cocok → PromoSaleError (seluruh nota ditolak sebelum apa pun ditulis). Hasilnya potongan promo
 * per baris (urutan sama dengan `items`; null = baris tanpa promo).
 */
export async function judgeSalePromos(payload: SalePromoPayload, now: Date = new Date()): Promise<(PromoAward | null)[]> {
  const outOfScope = isOutsidePromo(payload)
  const claimed = payload.items.some((i) => i.promo)
  const enabled = outOfScope ? false : await getPromoEnabled()
  const rules = outOfScope || !enabled ? [] : await loadPromoRules(payload.branchId, now)
  // Tanpa promo berjalan dan tanpa kiriman promo: tidak ada yang perlu dibaca lagi.
  if (rules.length === 0 && !claimed) return payload.items.map(() => null)

  const productIds = [...new Set(payload.items.map((i) => Number(i.productId)))]
  const [kindRows, customerRows] = await Promise.all([
    productIds.length > 0
      ? db.select({ id: products.id, kind: products.productKind }).from(products).where(inArray(products.id, productIds))
      : Promise.resolve([]),
    payload.customerId
      ? db.select({ tier: customers.defaultTierType }).from(customers).where(eq(customers.id, payload.customerId)).limit(1)
      : Promise.resolve([]),
  ])
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
    },
    {
      subtotal: Math.round(Number(payload.totals.subtotal)),
      discountTotal: Math.round(Number(payload.totals.discountTotal)),
      grandTotal: Math.round(Number(payload.totals.grandTotal)),
    },
  )
  if (!judgement.ok) throw new PromoSaleError(judgement.message, judgement.code)
  const ruleOf = new Map(rules.map((r) => [r.id, r]))
  return judgement.awards.map((award) => (award ? { ...award, rule: ruleOf.get(award.promoId)! } : null))
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
