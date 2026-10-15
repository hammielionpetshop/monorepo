import type { SQL } from 'drizzle-orm'
import {
  db, transactions, transactionItems, transactionItemDiscounts, branches,
  products, productUomCosts, productUomConversions, promoRewards,
  and, eq, gte, lt, sql,
} from '../db'
import { DISCOUNT_KIND_PROMO } from '../manual-discount'
import { listPromos } from './promo-service'
import {
  assemblePromoReport,
  type PromoReportView,
  type PromoUsageRow,
  type PromoBaselineRow,
  type PromoMetaRow,
  type BranchUsageRow,
} from '../promo/promo-report'

// Laporan Promo (P2f) — hanya membaca nota COMPLETED. Tidak menulis apa pun. Modal (HPP) memakai
// rumus yang sama dengan Laporan Laba Rugi. Penyusunan & hitungan di `lib/promo/promo-report.ts`.

export interface PromoReportParams {
  /** Batas cabang dari hak akses pengguna (`scopeFilter(payload, transactions.branchId)`). */
  branchScope?: SQL
  branchId?: number
  from: Date
  to: Date
}

// Modal per baris: pakai HPP tersimpan di nota; bila kosong, modal satuan × qty; lalu modal
// bawaan produk × qty × rasio satuan. Sama persis dengan report-service.ts (Laba Rugi).
const cogsExpr = sql<string | null>`COALESCE(SUM(COALESCE(${transactionItems.cogs}, ${productUomCosts.costPrice} * ${transactionItems.qty}, ${products.defaultCostPrice} * ${transactionItems.qty} * COALESCE(${productUomConversions.ratio}, 1), 0)), '0')`

export async function getPromoReport(params: PromoReportParams): Promise<PromoReportView> {
  const { from, to } = params
  // Masa pembanding = sepanjang periode, tepat sebelum tanggal mulai.
  const beforeFrom = new Date(from.getTime() - (to.getTime() - from.getTime()))

  const promoLineFilter = and(
    eq(transactionItemDiscounts.kind, DISCOUNT_KIND_PROMO),
    eq(transactions.status, 'COMPLETED'),
    gte(transactions.createdAt, from),
    lt(transactions.createdAt, to),
    params.branchScope,
    params.branchId ? eq(transactions.branchId, params.branchId) : undefined,
  )

  const [usageRows, rankingRows, promoList] = await Promise.all([
    // Pemakaian per promo (nota, qty, omzet, potongan, modal).
    db
      .select({
        promotionId: transactionItemDiscounts.promotionId,
        promotionName: sql<string | null>`MAX(${transactionItemDiscounts.promotionName})`,
        noteCount: sql<number>`COUNT(DISTINCT ${transactions.id})::integer`,
        qty: sql<string | null>`COALESCE(SUM(${transactionItems.qty}), '0')`,
        omzet: sql<string | null>`COALESCE(SUM(${transactionItems.totalPrice}), '0')`,
        discount: sql<string | null>`COALESCE(SUM(${transactionItemDiscounts.amount}), '0')`,
        cogs: cogsExpr,
      })
      .from(transactionItemDiscounts)
      .innerJoin(transactionItems, eq(transactionItems.id, transactionItemDiscounts.transactionItemId))
      .innerJoin(transactions, eq(transactions.id, transactionItemDiscounts.transactionId))
      .leftJoin(
        productUomCosts,
        and(
          eq(productUomCosts.productId, transactionItems.productId),
          eq(productUomCosts.branchId, transactions.branchId),
          eq(productUomCosts.uomId, transactionItems.uomId),
        ),
      )
      .leftJoin(products, eq(transactionItems.productId, products.id))
      .leftJoin(
        productUomConversions,
        and(
          eq(productUomConversions.productId, transactionItems.productId),
          eq(productUomConversions.uomId, transactionItems.uomId),
        ),
      )
      .where(promoLineFilter)
      .groupBy(transactionItemDiscounts.promotionId),

    // Peringkat toko — pemakaian promo per cabang.
    db
      .select({
        branchId: transactions.branchId,
        branchName: branches.name,
        noteCount: sql<number>`COUNT(DISTINCT ${transactions.id})::integer`,
        qty: sql<string | null>`COALESCE(SUM(${transactionItems.qty}), '0')`,
        omzet: sql<string | null>`COALESCE(SUM(${transactionItems.totalPrice}), '0')`,
        discount: sql<string | null>`COALESCE(SUM(${transactionItemDiscounts.amount}), '0')`,
      })
      .from(transactionItemDiscounts)
      .innerJoin(transactionItems, eq(transactionItems.id, transactionItemDiscounts.transactionItemId))
      .innerJoin(transactions, eq(transactions.id, transactionItemDiscounts.transactionId))
      .innerJoin(branches, eq(branches.id, transactions.branchId))
      .where(promoLineFilter)
      .groupBy(transactions.branchId, branches.name),

    // Keterangan promo (nama terbaru, status, cabang, masa) — promo yang berlaku di cabang terpilih.
    listPromos({ branchId: params.branchId, now: new Date() }),
  ])

  const usage: PromoUsageRow[] = usageRows
    .filter((r): r is typeof r & { promotionId: number } => r.promotionId != null)
    .map((r) => ({
      promotionId: r.promotionId,
      promotionName: r.promotionName,
      noteCount: r.noteCount,
      qty: Number(r.qty ?? 0),
      omzet: Number(r.omzet ?? 0),
      discount: Number(r.discount ?? 0),
      cogs: Number(r.cogs ?? 0),
    }))

  // Hanya promo yang masanya menyentuh periode laporan (menghindari daftar promo lama/akan datang).
  const meta: PromoMetaRow[] = promoList
    .map((p) => ({ p, startsAt: new Date(p.startsAt), endsAt: new Date(p.endsAt) }))
    .filter(({ startsAt, endsAt }) => startsAt < to && endsAt >= from)
    .map(({ p, startsAt, endsAt }) => ({
      promotionId: p.id,
      name: p.name,
      status: p.status,
      branchNames: p.branchNames,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    }))

  const promoIds = new Set<number>([...usage.map((u) => u.promotionId), ...meta.map((m) => m.promotionId)])
  const baseline = promoIds.size > 0 ? await loadBaseline(params, beforeFrom, [...promoIds]) : []

  const ranking: BranchUsageRow[] = rankingRows.map((r) => ({
    branchId: r.branchId,
    branchName: r.branchName,
    noteCount: r.noteCount,
    qty: Number(r.qty ?? 0),
    omzet: Number(r.omzet ?? 0),
    discount: Number(r.discount ?? 0),
  }))

  return assemblePromoReport(meta, usage, baseline, ranking)
}

/**
 * Penjualan barang hadiah tiap promo (Retail) pada masa promo [from,to) dan masa sebelumnya
 * [beforeFrom,from) yang sama panjang — supaya terlihat apakah promo menaikkan penjualan. Dihitung
 * untuk semua baris barang hadiah, bukan hanya baris yang kena promo.
 */
async function loadBaseline(params: PromoReportParams, beforeFrom: Date, promoIds: number[]): Promise<PromoBaselineRow[]> {
  const { from, to } = params
  const inPeriod = gte(transactions.createdAt, from)
  const beforePeriod = lt(transactions.createdAt, from)
  const rows = await db
    .select({
      promotionId: promoRewards.promoId,
      periodQty: sql<string | null>`COALESCE(SUM(CASE WHEN ${inPeriod} THEN ${transactionItems.qty} ELSE 0 END), '0')`,
      periodOmzet: sql<string | null>`COALESCE(SUM(CASE WHEN ${inPeriod} THEN ${transactionItems.totalPrice} ELSE 0 END), '0')`,
      beforeQty: sql<string | null>`COALESCE(SUM(CASE WHEN ${beforePeriod} THEN ${transactionItems.qty} ELSE 0 END), '0')`,
      beforeOmzet: sql<string | null>`COALESCE(SUM(CASE WHEN ${beforePeriod} THEN ${transactionItems.totalPrice} ELSE 0 END), '0')`,
    })
    .from(promoRewards)
    .innerJoin(
      transactionItems,
      and(
        eq(transactionItems.productId, promoRewards.productId),
        eq(transactionItems.uomId, promoRewards.uomId),
      ),
    )
    .innerJoin(
      transactions,
      and(
        eq(transactions.id, transactionItems.transactionId),
        eq(transactions.status, 'COMPLETED'),
        eq(transactions.saleType, 'RETAIL'),
        gte(transactions.createdAt, beforeFrom),
        lt(transactions.createdAt, to),
        params.branchScope,
        params.branchId ? eq(transactions.branchId, params.branchId) : undefined,
      ),
    )
    .where(sql`${promoRewards.promoId} IN (${sql.join(promoIds, sql`, `)})`)
    .groupBy(promoRewards.promoId)

  return rows.map((r) => ({
    promotionId: r.promotionId,
    periodQty: Number(r.periodQty ?? 0),
    periodOmzet: Number(r.periodOmzet ?? 0),
    beforeQty: Number(r.beforeQty ?? 0),
    beforeOmzet: Number(r.beforeOmzet ?? 0),
  }))
}
