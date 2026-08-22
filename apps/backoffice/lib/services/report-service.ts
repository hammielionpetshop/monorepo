import Big from 'big.js'
import {
  db,
  transactions,
  transactionItems,
  branches,
  products,
  productUomConversions,
  productUomCosts,
  productPrices,
  productStockBatches,
  damagedGoods,
  damagedGoodsItems,
  transactionPayments,
  paymentMethods,
  debtPayments,
  customerDebts,
  unitsOfMeasure,
  users,
  categories,
  brands,
  eq,
  and,
  or,
  gt,
  ilike,
  inArray,
  isNull,
  sql,
  asc,
  desc,
} from '@/lib/db'
import {
  buildSalesByProductItems,
  sumSalesTotals,
  type SalesByProductData,
} from './sales-by-product-uom'
import { breakdownQty, formatQtyBreakdown, type UomUnit } from '../uom-breakdown'

export interface PLReportItem {
  branchId: number
  branchName: string
  revenue: string
  cogs: string
  grossProfit: string
  damagedLoss: string
  netProfit: string
  transactionCount: number
  /** Porsi penjualan periode ini yang dibayar dengan hutang — sudah termasuk di revenue,
   *  tapi uangnya belum tentu diterima. Informatif saja, tidak mengurangi laba. */
  debtSales: string
  /** Pelunasan piutang yang diterima periode ini, termasuk atas penjualan periode sebelumnya.
   *  BUKAN pendapatan — omzetnya sudah diakui saat transaksi hutang dibuat. */
  debtCollected: string
}

export interface PLReportData {
  startDate: string
  endDate: string
  items: PLReportItem[]
  totalRevenue: string
  totalCogs: string
  totalGrossProfit: string
  totalDamagedLoss: string
  totalNetProfit: string
  totalTransactionCount: number
  totalDebtSales: string
  totalDebtCollected: string
}

export async function getProfitLossReport(params: {
  startDate: string
  endDate: string
}): Promise<PLReportData> {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(params.startDate) || !dateRegex.test(params.endDate)) {
    throw new Error('Format tanggal harus YYYY-MM-DD')
  }

  if (params.startDate > params.endDate) {
    throw new Error('Tanggal mulai tidak boleh lebih besar dari tanggal selesai')
  }

  const dateFilter = and(
    eq(transactions.status, 'COMPLETED'),
    sql`(${transactions.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date >= ${params.startDate}::date`,
    sql`(${transactions.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date <= ${params.endDate}::date`
  )

  // Filter periode untuk barang rusak (berdasarkan reportedAt, WIB)
  const damagedDateFilter = and(
    sql`(${damagedGoods.reportedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date >= ${params.startDate}::date`,
    sql`(${damagedGoods.reportedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date <= ${params.endDate}::date`
  )

  const [revenueRows, cogsRows, branchRows, damagedRows, debtSalesRows, debtCollectedRows] = await Promise.all([
    // Query 1: Revenue dan jumlah transaksi per cabang
    db
      .select({
        branchId: transactions.branchId,
        revenue: sql<string | null>`COALESCE(SUM(${transactions.payableAmount}), '0')`,
        transactionCount: sql<number>`COUNT(${transactions.id})::integer`,
      })
      .from(transactions)
      .where(dateFilter)
      .groupBy(transactions.branchId),

    // Query 2: COGS per cabang (INNER JOIN — hanya item dari transaksi COMPLETED)
    // Dua query terpisah untuk menghindari double-count payableAmount saat GROUP BY
    db
      .select({
        branchId: transactions.branchId,
        cogs: sql<string | null>`COALESCE(SUM(COALESCE(${transactionItems.cogs}, ${productUomCosts.costPrice} * ${transactionItems.qty}, ${products.defaultCostPrice} * ${transactionItems.qty} * COALESCE(${productUomConversions.ratio}, 1), 0)), '0')`,
      })
      .from(transactionItems)
      .innerJoin(
        transactions,
        and(
          eq(transactionItems.transactionId, transactions.id),
          dateFilter
        )
      )
      .leftJoin(
        productUomCosts,
        and(
          eq(productUomCosts.productId, transactionItems.productId),
          eq(productUomCosts.branchId, transactions.branchId),
          eq(productUomCosts.uomId, transactionItems.uomId)
        )
      )
      .leftJoin(products, eq(transactionItems.productId, products.id))
      .leftJoin(
        productUomConversions,
        and(
          eq(productUomConversions.productId, transactionItems.productId),
          eq(productUomConversions.uomId, transactionItems.uomId)
        )
      )
      .groupBy(transactions.branchId),

    // Query 3: Semua cabang aktif (untuk menampilkan baris Rp 0 jika tidak ada transaksi)
    db
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .where(eq(branches.isActive, true))
      .orderBy(branches.name),

    // Query 4: Kerugian barang rusak per cabang (RUSAK/EXPIRED/HILANG) dalam periode
    db
      .select({
        branchId: damagedGoods.branchId,
        loss: sql<string | null>`COALESCE(SUM(${damagedGoods.totalLossValue}), '0')`,
      })
      .from(damagedGoods)
      .where(damagedDateFilter)
      .groupBy(damagedGoods.branchId),

    // Query 5: Porsi hutang dari penjualan periode ini — bagian dari revenue yang uangnya
    // belum diterima. Dibaca dari transaction_payments, bukan dari sisa customer_debts,
    // supaya angkanya tetap mencerminkan kondisi saat penjualan meski sudah dicicil.
    db
      .select({
        branchId: transactions.branchId,
        amount: sql<string | null>`COALESCE(SUM(${transactionPayments.amount}), '0')`,
      })
      .from(transactionPayments)
      .innerJoin(transactions, and(eq(transactionPayments.transactionId, transactions.id), dateFilter))
      .innerJoin(
        paymentMethods,
        and(eq(transactionPayments.paymentMethodId, paymentMethods.id), eq(paymentMethods.type, 'DEBT'))
      )
      .groupBy(transactions.branchId),

    // Query 6: Pelunasan piutang yang diterima periode ini (void diabaikan). Bisa berasal dari
    // penjualan periode sebelumnya — sengaja TIDAK dimasukkan ke revenue agar omzet tidak
    // dihitung dua kali. Cabang diambil dari pembayaran, fallback ke cabang hutangnya.
    db
      .select({
        branchId: sql<number | null>`COALESCE(${debtPayments.branchId}, ${customerDebts.branchId})`,
        amount: sql<string | null>`COALESCE(SUM(${debtPayments.amount}), '0')`,
      })
      .from(debtPayments)
      .innerJoin(customerDebts, eq(debtPayments.debtId, customerDebts.id))
      .where(
        and(
          isNull(debtPayments.voidedAt),
          sql`(${debtPayments.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date >= ${params.startDate}::date`,
          sql`(${debtPayments.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date <= ${params.endDate}::date`
        )
      )
      .groupBy(sql`COALESCE(${debtPayments.branchId}, ${customerDebts.branchId})`),
  ])

  const revenueMap = new Map(revenueRows.map((r) => [r.branchId, r]))
  const cogsMap = new Map(cogsRows.map((r) => [r.branchId, r]))
  const damagedMap = new Map(damagedRows.map((r) => [r.branchId, r]))
  const debtSalesMap = new Map(debtSalesRows.map((r) => [r.branchId, r]))
  const debtCollectedMap = new Map(debtCollectedRows.map((r) => [r.branchId, r]))

  let totalRevenue = new Big(0)
  let totalCogs = new Big(0)
  let totalDamagedLoss = new Big(0)
  let totalTransactionCount = 0
  let totalDebtSales = new Big(0)
  // Dijumlah dari baris query, bukan dari total per cabang, agar pelunasan yang cabangnya
  // masih NULL (hutang lama) tetap terhitung walau tidak muncul di baris cabang manapun.
  const totalDebtCollected = debtCollectedRows.reduce(
    (sum, r) => sum.plus(new Big(r.amount ?? '0')),
    new Big(0)
  )

  const items: PLReportItem[] = branchRows.map((branch) => {
    const rev = revenueMap.get(branch.id)
    const cog = cogsMap.get(branch.id)
    const dmg = damagedMap.get(branch.id)
    const revenue = new Big(rev?.revenue ?? '0')
    const cogs = new Big(cog?.cogs ?? '0')
    const grossProfit = revenue.minus(cogs)
    const damagedLoss = new Big(dmg?.loss ?? '0')
    const netProfit = grossProfit.minus(damagedLoss)
    const transactionCount = rev?.transactionCount ?? 0
    const debtSales = new Big(debtSalesMap.get(branch.id)?.amount ?? '0')
    const debtCollected = new Big(debtCollectedMap.get(branch.id)?.amount ?? '0')

    totalRevenue = totalRevenue.plus(revenue)
    totalCogs = totalCogs.plus(cogs)
    totalDamagedLoss = totalDamagedLoss.plus(damagedLoss)
    totalTransactionCount += transactionCount
    totalDebtSales = totalDebtSales.plus(debtSales)

    return {
      branchId: branch.id,
      branchName: branch.name,
      revenue: revenue.toString(),
      cogs: cogs.toString(),
      grossProfit: grossProfit.toString(),
      damagedLoss: damagedLoss.toString(),
      netProfit: netProfit.toString(),
      transactionCount,
      debtSales: debtSales.toString(),
      debtCollected: debtCollected.toString(),
    }
  })

  const totalGrossProfit = totalRevenue.minus(totalCogs)
  const totalNetProfit = totalGrossProfit.minus(totalDamagedLoss)

  return {
    startDate: params.startDate,
    endDate: params.endDate,
    items,
    totalRevenue: totalRevenue.toString(),
    totalCogs: totalCogs.toString(),
    totalGrossProfit: totalGrossProfit.toString(),
    totalDamagedLoss: totalDamagedLoss.toString(),
    totalNetProfit: totalNetProfit.toString(),
    totalDebtSales: totalDebtSales.toString(),
    totalDebtCollected: totalDebtCollected.toString(),
    totalTransactionCount,
  }
}

export interface DamagedReportEntryItem {
  productName: string
  sku: string | null
  uomCode: string
  qty: number
  costPrice: string
  lossValue: string
}

export interface DamagedReportEntry {
  id: number
  branchId: number
  branchName: string
  reportedByName: string
  reportedAt: string
  reason: string
  notes: string | null
  totalLossValue: string
  items: DamagedReportEntryItem[]
}

export interface DamagedReportReasonSummary {
  reason: string
  entryCount: number
  lossValue: string
}

export interface DamagedReportData {
  startDate: string
  endDate: string
  branchId: number | null
  entries: DamagedReportEntry[]
  totalLossValue: string
  totalEntries: number
  byReason: DamagedReportReasonSummary[]
}

export async function getDamagedGoodsReport(params: {
  startDate: string
  endDate: string
  branchId?: number | null
}): Promise<DamagedReportData> {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(params.startDate) || !dateRegex.test(params.endDate)) {
    throw new Error('Format tanggal harus YYYY-MM-DD')
  }

  if (params.startDate > params.endDate) {
    throw new Error('Tanggal mulai tidak boleh lebih besar dari tanggal selesai')
  }

  const dateFilter = and(
    sql`(${damagedGoods.reportedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date >= ${params.startDate}::date`,
    sql`(${damagedGoods.reportedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date <= ${params.endDate}::date`,
    params.branchId != null ? eq(damagedGoods.branchId, params.branchId) : undefined
  )

  const headerRows = await db
    .select({
      id: damagedGoods.id,
      branchId: damagedGoods.branchId,
      branchName: branches.name,
      reportedByName: users.name,
      reportedAt: damagedGoods.reportedAt,
      reason: damagedGoods.reason,
      notes: damagedGoods.notes,
      totalLossValue: damagedGoods.totalLossValue,
    })
    .from(damagedGoods)
    .innerJoin(branches, eq(damagedGoods.branchId, branches.id))
    .leftJoin(users, eq(damagedGoods.reportedById, users.id))
    .where(dateFilter)
    .orderBy(desc(damagedGoods.reportedAt))

  const entryIds = headerRows.map((row) => row.id)

  const itemRows = entryIds.length
    ? await db
        .select({
          damagedGoodsId: damagedGoodsItems.damagedGoodsId,
          productName: products.name,
          sku: products.sku,
          uomCode: unitsOfMeasure.code,
          qty: damagedGoodsItems.qty,
          costPrice: damagedGoodsItems.costPrice,
          lossValue: damagedGoodsItems.lossValue,
        })
        .from(damagedGoodsItems)
        .leftJoin(products, eq(damagedGoodsItems.productId, products.id))
        .leftJoin(unitsOfMeasure, eq(damagedGoodsItems.uomId, unitsOfMeasure.id))
        .where(inArray(damagedGoodsItems.damagedGoodsId, entryIds))
    : []

  const itemsByEntry = new Map<number, DamagedReportEntryItem[]>()
  for (const row of itemRows) {
    const list = itemsByEntry.get(row.damagedGoodsId) ?? []
    list.push({
      productName: row.productName ?? 'Produk Dihapus',
      sku: row.sku ?? null,
      uomCode: row.uomCode ?? '-',
      qty: row.qty,
      costPrice: new Big(row.costPrice ?? 0).toString(),
      lossValue: new Big(row.lossValue ?? 0).toString(),
    })
    itemsByEntry.set(row.damagedGoodsId, list)
  }

  let totalLossValue = new Big(0)
  const reasonMap = new Map<string, { entryCount: number; lossValue: Big }>()

  const entries: DamagedReportEntry[] = headerRows.map((row) => {
    const loss = new Big(row.totalLossValue ?? 0)
    totalLossValue = totalLossValue.plus(loss)

    const reasonAgg = reasonMap.get(row.reason) ?? { entryCount: 0, lossValue: new Big(0) }
    reasonAgg.entryCount += 1
    reasonAgg.lossValue = reasonAgg.lossValue.plus(loss)
    reasonMap.set(row.reason, reasonAgg)

    return {
      id: row.id,
      branchId: row.branchId,
      branchName: row.branchName,
      reportedByName: row.reportedByName ?? 'Tidak diketahui',
      reportedAt:
        row.reportedAt instanceof Date ? row.reportedAt.toISOString() : String(row.reportedAt),
      reason: row.reason,
      notes: row.notes,
      totalLossValue: loss.toString(),
      items: itemsByEntry.get(row.id) ?? [],
    }
  })

  const byReason: DamagedReportReasonSummary[] = Array.from(reasonMap.entries()).map(
    ([reason, agg]) => ({
      reason,
      entryCount: agg.entryCount,
      lossValue: agg.lossValue.toString(),
    })
  )

  return {
    startDate: params.startDate,
    endDate: params.endDate,
    branchId: params.branchId ?? null,
    entries,
    totalLossValue: totalLossValue.toString(),
    totalEntries: headerRows.length,
    byReason,
  }
}

export interface StockValuationItem {
  productId: number
  productName: string
  sku: string | null
  categoryName: string | null
  brandName: string | null
  branchId: number
  branchName: string
  totalQty: string
  totalValue: string
  /** Breakdown qty ke satuan produk (terbesar->terkecil), mis. "5 Dus 0 Box 0 Pcs". */
  stockDisplay: string
}

export const STOCK_VALUATION_SORTS = [
  'branch',
  'value_desc',
  'value_asc',
  'qty_desc',
  'name',
] as const

export type StockValuationSort = (typeof STOCK_VALUATION_SORTS)[number]

export interface StockValuationFilters {
  branchId: number | null
  categoryId: number | null
  brandId: number | null
  search: string | null
  minValue: number | null
  includeInactive: boolean
  sort: StockValuationSort
}

export interface StockValuationData {
  generatedAt: string
  items: StockValuationItem[]
  totalValue: string
  /** Jumlah baris hasil (produk × cabang), bukan jumlah produk unik. */
  totalRows: number
  /** Produk unik yang lolos filter — satu produk bisa muncul di beberapa cabang. */
  totalProducts: number
  filters: StockValuationFilters
}

export function parseStockValuationFilters(params: {
  branchId?: string | null
  categoryId?: string | null
  brandId?: string | null
  search?: string | null
  minValue?: string | null
  includeInactive?: string | null
  sort?: string | null
}): StockValuationFilters {
  const toId = (raw?: string | null) => (raw && /^\d+$/.test(raw) ? Number(raw) : null)
  const search = params.search?.trim()
  const sort = params.sort as StockValuationSort | undefined

  return {
    branchId: toId(params.branchId),
    categoryId: toId(params.categoryId),
    brandId: toId(params.brandId),
    search: search ? search : null,
    minValue: toId(params.minValue),
    includeInactive: params.includeInactive === '1' || params.includeInactive === 'true',
    sort: sort && STOCK_VALUATION_SORTS.includes(sort) ? sort : 'branch',
  }
}

/**
 * Sisa stok satu batch, sudah dalam satuan dasar.
 *
 * `product_stock_batches.qty_remaining` **sudah disimpan dalam satuan dasar** — lihat
 * `StockService.addStock`, yang menulis `qtyRemaining: qtyBase`, dan `deductStock`, yang
 * memotongnya dengan qty base tanpa rasio apa pun. Kolom `uom_id` di tabel itu hanya jejak
 * audit satuan penerimaan, bukan satuan penyimpanan qty.
 *
 * Jadi mengalikannya dengan `product_uom_conversions.ratio` adalah konversi dobel: batch
 * yang diterima 25 SAK (= 625 PCS) akan terbaca 625 × 25. Jangan di-join ke tabel konversi
 * di sini.
 */
const batchQtyBase = sql<string>`COALESCE(SUM(${productStockBatches.qtyRemaining}), '0')`

export async function getStockValuationReport(
  filters: Partial<StockValuationFilters> = {}
): Promise<StockValuationData> {
  const applied: StockValuationFilters = {
    branchId: filters.branchId ?? null,
    categoryId: filters.categoryId ?? null,
    brandId: filters.brandId ?? null,
    search: filters.search?.trim() || null,
    minValue: filters.minValue ?? null,
    includeInactive: filters.includeInactive ?? false,
    sort: filters.sort ?? 'branch',
  }

  const totalQtyExpr = batchQtyBase
  // cost_price batch juga per satuan dasar, jadi qty_base × cost_base = nilai total
  const totalValueExpr = sql<string>`COALESCE(SUM(${productStockBatches.qtyRemaining} * ${productStockBatches.costPrice}), '0')`

  // Wildcard LIKE di-escape supaya '%' yang diketik kasir dicari sebagai karakter biasa.
  const searchPattern = applied.search
    ? `%${applied.search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`
    : null

  const orderBy = {
    branch: [asc(branches.name), asc(products.name)],
    name: [asc(products.name), asc(branches.name)],
    value_desc: [desc(totalValueExpr), asc(products.name)],
    value_asc: [asc(totalValueExpr), asc(products.name)],
    qty_desc: [desc(totalQtyExpr), asc(products.name)],
  }[applied.sort]

  const query = db
    .select({
      productId: products.id,
      productName: products.name,
      sku: products.sku,
      categoryName: categories.name,
      brandName: brands.name,
      branchId: branches.id,
      branchName: branches.name,
      baseUomId: products.baseUomId,
      baseUomCode: unitsOfMeasure.code,
      totalQty: totalQtyExpr,
      totalValue: totalValueExpr,
    })
    .from(productStockBatches)
    .innerJoin(products, eq(productStockBatches.productId, products.id))
    .innerJoin(branches, eq(productStockBatches.branchId, branches.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(unitsOfMeasure, eq(products.baseUomId, unitsOfMeasure.id))
    .where(
      and(
        gt(productStockBatches.qtyRemaining, 0),
        applied.includeInactive ? undefined : eq(products.isActive, true),
        applied.branchId != null ? eq(productStockBatches.branchId, applied.branchId) : undefined,
        applied.categoryId != null ? eq(products.categoryId, applied.categoryId) : undefined,
        applied.brandId != null ? eq(products.brandId, applied.brandId) : undefined,
        searchPattern
          ? or(ilike(products.name, searchPattern), ilike(products.sku, searchPattern))
          : undefined
      )
    )
    .groupBy(
      products.id,
      products.name,
      products.sku,
      categories.name,
      brands.name,
      branches.id,
      branches.name,
      products.baseUomId,
      unitsOfMeasure.code
    )

  // Nilai minimum menyaring hasil agregat, jadi harus HAVING — bukan WHERE.
  const rows = await (applied.minValue != null && applied.minValue > 0
    ? query.having(sql`${totalValueExpr} >= ${applied.minValue}`)
    : query
  ).orderBy(...orderBy)

  const productIds = Array.from(new Set(rows.map((r) => r.productId)))

  // Satuan per produk untuk breakdown qty (base + semua konversi), diambil sekali untuk
  // semua produk hasil filter — bukan N+1 per baris.
  const conversionRows = productIds.length > 0
    ? await db
        .select({
          productId: productUomConversions.productId,
          uomId: productUomConversions.uomId,
          code: unitsOfMeasure.code,
          ratio: productUomConversions.ratio,
        })
        .from(productUomConversions)
        .innerJoin(unitsOfMeasure, eq(productUomConversions.uomId, unitsOfMeasure.id))
        .where(inArray(productUomConversions.productId, productIds))
    : []

  const unitsByProduct = new Map<number, UomUnit[]>()
  for (const row of rows) {
    if (!unitsByProduct.has(row.productId)) {
      unitsByProduct.set(row.productId, [{ uomId: row.baseUomId, code: row.baseUomCode ?? '?', ratio: 1 }])
    }
  }
  for (const c of conversionRows) {
    unitsByProduct.get(c.productId)?.push({ uomId: c.uomId, code: c.code, ratio: c.ratio })
  }

  let grandTotal = new Big(0)

  const items: StockValuationItem[] = rows.map((row) => {
    const value = new Big(row.totalValue)
    grandTotal = grandTotal.plus(value)
    const qtyBase = new Big(row.totalQty).toNumber()
    const units = unitsByProduct.get(row.productId) ?? [{ uomId: row.baseUomId, code: row.baseUomCode ?? '?', ratio: 1 }]
    return {
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      categoryName: row.categoryName,
      brandName: row.brandName,
      branchId: row.branchId,
      branchName: row.branchName,
      totalQty: new Big(row.totalQty).toString(),
      totalValue: value.toString(),
      stockDisplay: formatQtyBreakdown(breakdownQty(qtyBase, units)),
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    items,
    totalValue: grandTotal.toString(),
    totalRows: items.length,
    totalProducts: productIds.length,
    filters: applied,
  }
}

/**
 * Rasio satuan item terhadap satuan dasar produk.
 *
 * Satuan dasar dipaksa ke 1 alih-alih memercayai baris konversinya: menurut aturan repo
 * `base_uom_id` selalu satuan terkecil, jadi baris konversi untuk satuan dasar dengan ratio
 * selain 1 adalah data rusak — dan mengalikannya di sini persis pola yang dulu meledakkan
 * HPP LOQY KLG TUNA jadi 24× lipat.
 */
const uomRatioToBase = sql<number>`CASE
  WHEN ${transactionItems.uomId} = ${products.baseUomId} THEN 1
  ELSE COALESCE(${productUomConversions.ratio}, 1)
END`

/**
 * HPP dihitung ulang dari harga modal per satuan dasar saat ini (product_uom_costs base →
 * default_cost_price) × qty dalam satuan dasar (qty × ratio). Snapshot transactionItems.cogs
 * hanya dipakai bila master cost tidak ada.
 */
const cogsExpr = sql<string | null>`COALESCE(SUM(
  CASE WHEN COALESCE(${productUomCosts.costPrice}, ${products.defaultCostPrice}, 0) > 0
       THEN ${transactionItems.qty} * ${uomRatioToBase} * COALESCE(${productUomCosts.costPrice}, ${products.defaultCostPrice})
       ELSE COALESCE(${transactionItems.cogs}, 0)
  END
), '0')`

const revenueExpr = sql<string | null>`COALESCE(SUM(${transactionItems.totalPrice} - ${transactionItems.discountAmount}), '0')`

const qtyBaseExpr = sql<number>`COALESCE(SUM(${transactionItems.qty} * ${uomRatioToBase}), 0)::integer`

export type {
  SalesByProductItem,
  SalesByProductUomRow,
  SalesByProductData,
} from './sales-by-product-uom'

export async function getSalesByProductReport(params: {
  startDate: string
  endDate: string
  productId?: number | null
  branchId?: number | null
}): Promise<SalesByProductData> {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(params.startDate) || !dateRegex.test(params.endDate)) {
    throw new Error('Format tanggal harus YYYY-MM-DD')
  }

  if (params.startDate > params.endDate) {
    throw new Error('Tanggal mulai tidak boleh lebih besar dari tanggal selesai')
  }

  const dateFilter = and(
    eq(transactions.status, 'COMPLETED'),
    params.branchId != null ? eq(transactions.branchId, params.branchId) : undefined,
    sql`(${transactions.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date >= ${params.startDate}::date`,
    sql`(${transactions.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date <= ${params.endDate}::date`
  )

  const productFilter =
    params.productId != null ? eq(transactionItems.productId, params.productId) : undefined

  // Dua agregasi terpisah, bukan satu: jumlah transaksi induk harus COUNT(DISTINCT) per produk.
  // Menjumlahkan hitungan per satuan akan mendobel transaksi yang membeli PCS dan DUS sekaligus.
  const [productRows, uomRows] = await Promise.all([
    db
      .select({
        productId: transactionItems.productId,
        productName: sql<string>`COALESCE(${products.name}, MAX(${transactionItems.productName}), 'Produk Dihapus')`,
        sku: sql<string | null>`COALESCE(${products.sku}, MAX(${transactionItems.productSku}))`,
        baseUomCode: unitsOfMeasure.code,
        qtyBase: qtyBaseExpr,
        transactionCount: sql<number>`COUNT(DISTINCT ${transactions.id})::integer`,
        revenue: revenueExpr,
        cogs: cogsExpr,
        masterBasePriceMin: sql<string | number | null>`MIN(${productPrices.price})`,
        masterBasePriceMax: sql<string | number | null>`MAX(${productPrices.price})`,
      })
      .from(transactionItems)
      .innerJoin(transactions, and(eq(transactionItems.transactionId, transactions.id), dateFilter))
      .leftJoin(products, eq(transactionItems.productId, products.id))
      .leftJoin(unitsOfMeasure, eq(products.baseUomId, unitsOfMeasure.id))
      .leftJoin(
        productUomCosts,
        and(
          eq(productUomCosts.productId, transactionItems.productId),
          eq(productUomCosts.branchId, transactions.branchId),
          eq(productUomCosts.uomId, products.baseUomId)
        )
      )
      .leftJoin(
        productUomConversions,
        and(
          eq(productUomConversions.productId, transactionItems.productId),
          eq(productUomConversions.uomId, transactionItems.uomId)
        )
      )
      // Harga master per satuan dasar, hanya di cabang yang benar-benar menjual.
      // Kuncinya unik (produk, cabang, satuan, tier) sehingga join ini tidak melipatgandakan baris.
      .leftJoin(
        productPrices,
        and(
          eq(productPrices.productId, transactionItems.productId),
          eq(productPrices.branchId, transactions.branchId),
          eq(productPrices.uomId, products.baseUomId),
          eq(productPrices.tierType, 'RETAIL')
        )
      )
      .where(productFilter)
      .groupBy(transactionItems.productId, products.name, products.sku, unitsOfMeasure.code)
      .orderBy(desc(sql`SUM(${transactionItems.totalPrice} - ${transactionItems.discountAmount})`)),

    db
      .select({
        productId: transactionItems.productId,
        uomId: transactionItems.uomId,
        uomCode: unitsOfMeasure.code,
        uomName: unitsOfMeasure.name,
        ratioToBase: uomRatioToBase,
        qty: sql<number>`COALESCE(SUM(${transactionItems.qty}), 0)::integer`,
        qtyBase: qtyBaseExpr,
        transactionCount: sql<number>`COUNT(DISTINCT ${transactions.id})::integer`,
        revenue: revenueExpr,
        cogs: cogsExpr,
        masterPriceMin: sql<string | number | null>`MIN(${productPrices.price})`,
        masterPriceMax: sql<string | number | null>`MAX(${productPrices.price})`,
      })
      .from(transactionItems)
      .innerJoin(transactions, and(eq(transactionItems.transactionId, transactions.id), dateFilter))
      .leftJoin(products, eq(transactionItems.productId, products.id))
      .leftJoin(unitsOfMeasure, eq(transactionItems.uomId, unitsOfMeasure.id))
      .leftJoin(
        productUomCosts,
        and(
          eq(productUomCosts.productId, transactionItems.productId),
          eq(productUomCosts.branchId, transactions.branchId),
          eq(productUomCosts.uomId, products.baseUomId)
        )
      )
      .leftJoin(
        productUomConversions,
        and(
          eq(productUomConversions.productId, transactionItems.productId),
          eq(productUomConversions.uomId, transactionItems.uomId)
        )
      )
      .leftJoin(
        productPrices,
        and(
          eq(productPrices.productId, transactionItems.productId),
          eq(productPrices.branchId, transactions.branchId),
          eq(productPrices.uomId, transactionItems.uomId),
          eq(productPrices.tierType, 'RETAIL')
        )
      )
      .where(productFilter)
      .groupBy(
        transactionItems.productId,
        transactionItems.uomId,
        unitsOfMeasure.code,
        unitsOfMeasure.name,
        products.baseUomId,
        productUomConversions.ratio
      ),
  ])

  const items = buildSalesByProductItems(productRows, uomRows)

  return {
    startDate: params.startDate,
    endDate: params.endDate,
    productId: params.productId ?? null,
    branchId: params.branchId ?? null,
    items,
    ...sumSalesTotals(items),
  }
}

export interface ProductStockValueBranch {
  branchId: number
  branchName: string
  totalQty: string
  totalValue: string
}

export interface ProductStockValueData {
  productId: number
  totalQty: string
  totalValue: string
  branches: ProductStockValueBranch[]
}

export async function getProductStockValue(params: {
  productId: number
  branchId?: number | null
}): Promise<ProductStockValueData> {
  const rows = await db
    .select({
      branchId: branches.id,
      branchName: branches.name,
      totalQty: batchQtyBase,
      totalValue: sql<string>`COALESCE(SUM(${productStockBatches.qtyRemaining} * ${productStockBatches.costPrice}), '0')`,
    })
    .from(productStockBatches)
    .innerJoin(branches, eq(productStockBatches.branchId, branches.id))
    .where(
      and(
        eq(productStockBatches.productId, params.productId),
        gt(productStockBatches.qtyRemaining, 0),
        params.branchId != null ? eq(productStockBatches.branchId, params.branchId) : undefined
      )
    )
    .groupBy(branches.id, branches.name)
    .orderBy(branches.name)

  let totalQty = new Big(0)
  let totalValue = new Big(0)

  const branchItems: ProductStockValueBranch[] = rows.map((row) => {
    totalQty = totalQty.plus(new Big(row.totalQty))
    totalValue = totalValue.plus(new Big(row.totalValue))
    return {
      branchId: row.branchId,
      branchName: row.branchName,
      totalQty: new Big(row.totalQty).toString(),
      totalValue: new Big(row.totalValue).toString(),
    }
  })

  return {
    productId: params.productId,
    totalQty: totalQty.toString(),
    totalValue: totalValue.toString(),
    branches: branchItems,
  }
}

export interface ProductTransactionUomQty {
  uomCode: string
  qty: number
}

export interface ProductTransactionRow {
  transactionId: number
  trxNumber: string
  createdAt: string
  branchName: string
  /** Qty apa adanya per satuan yang dipakai di nota — tidak dijumlahkan lintas satuan. */
  uoms: ProductTransactionUomQty[]
  /** Qty seluruh baris nota ini dalam satuan dasar produk. */
  qtyBase: number
  revenue: string
}

export async function getTransactionsWithProduct(params: {
  startDate: string
  endDate: string
  productId: number
  branchId?: number | null
  limit?: number
}): Promise<ProductTransactionRow[]> {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(params.startDate) || !dateRegex.test(params.endDate)) {
    throw new Error('Format tanggal harus YYYY-MM-DD')
  }

  const filter = and(
    eq(transactions.status, 'COMPLETED'),
    eq(transactionItems.productId, params.productId),
    params.branchId != null ? eq(transactions.branchId, params.branchId) : undefined,
    sql`(${transactions.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date >= ${params.startDate}::date`,
    sql`(${transactions.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date <= ${params.endDate}::date`
  )

  const rows = await db
    .select({
      transactionId: transactions.id,
      trxNumber: transactions.trxNumber,
      createdAt: transactions.createdAt,
      branchName: branches.name,
      revenue: sql<string | null>`COALESCE(SUM(${transactionItems.totalPrice} - ${transactionItems.discountAmount}), '0')`,
    })
    .from(transactionItems)
    .innerJoin(transactions, eq(transactionItems.transactionId, transactions.id))
    .innerJoin(branches, eq(transactions.branchId, branches.id))
    .where(filter)
    .groupBy(transactions.id, transactions.trxNumber, transactions.createdAt, branches.name)
    .orderBy(desc(transactions.createdAt))
    .limit(params.limit ?? 200)

  if (rows.length === 0) return []

  // Rincian satuan diambil terpisah supaya batas jumlah transaksi di atas tetap utuh —
  // satu nota bisa memuat produk yang sama dalam PCS dan DUS sekaligus.
  const uomRows = await db
    .select({
      transactionId: transactionItems.transactionId,
      uomCode: unitsOfMeasure.code,
      ratioToBase: uomRatioToBase,
      qty: sql<number>`COALESCE(SUM(${transactionItems.qty}), 0)::integer`,
    })
    .from(transactionItems)
    .leftJoin(products, eq(transactionItems.productId, products.id))
    .leftJoin(unitsOfMeasure, eq(transactionItems.uomId, unitsOfMeasure.id))
    .leftJoin(
      productUomConversions,
      and(
        eq(productUomConversions.productId, transactionItems.productId),
        eq(productUomConversions.uomId, transactionItems.uomId)
      )
    )
    .where(
      and(
        eq(transactionItems.productId, params.productId),
        inArray(
          transactionItems.transactionId,
          rows.map((row) => row.transactionId)
        )
      )
    )
    .groupBy(
      transactionItems.transactionId,
      transactionItems.uomId,
      unitsOfMeasure.code,
      products.baseUomId,
      productUomConversions.ratio
    )

  const uomsByTransaction = new Map<number, { uoms: ProductTransactionUomQty[]; qtyBase: number }>()
  for (const row of uomRows) {
    const entry = uomsByTransaction.get(row.transactionId) ?? { uoms: [], qtyBase: 0 }
    entry.uoms.push({ uomCode: row.uomCode ?? '—', qty: row.qty })
    entry.qtyBase += row.qty * row.ratioToBase
    uomsByTransaction.set(row.transactionId, entry)
  }
  for (const entry of uomsByTransaction.values()) {
    entry.uoms.sort((a, b) => a.uomCode.localeCompare(b.uomCode))
  }

  return rows.map((row) => {
    const detail = uomsByTransaction.get(row.transactionId)
    return {
      transactionId: row.transactionId,
      trxNumber: row.trxNumber,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      branchName: row.branchName,
      uoms: detail?.uoms ?? [],
      qtyBase: detail?.qtyBase ?? 0,
      revenue: new Big(row.revenue ?? '0').toString(),
    }
  })
}
