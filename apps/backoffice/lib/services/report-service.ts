import Big from 'big.js'
import {
  db,
  transactions,
  transactionItems,
  branches,
  products,
  productUomConversions,
  productUomCosts,
  productStockBatches,
  eq,
  and,
  gt,
  sql,
  desc,
} from '@/lib/db'

export interface PLReportItem {
  branchId: number
  branchName: string
  revenue: string
  cogs: string
  grossProfit: string
  transactionCount: number
}

export interface PLReportData {
  startDate: string
  endDate: string
  items: PLReportItem[]
  totalRevenue: string
  totalCogs: string
  totalGrossProfit: string
  totalTransactionCount: number
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

  const [revenueRows, cogsRows, branchRows] = await Promise.all([
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
  ])

  const revenueMap = new Map(revenueRows.map((r) => [r.branchId, r]))
  const cogsMap = new Map(cogsRows.map((r) => [r.branchId, r]))

  let totalRevenue = new Big(0)
  let totalCogs = new Big(0)
  let totalTransactionCount = 0

  const items: PLReportItem[] = branchRows.map((branch) => {
    const rev = revenueMap.get(branch.id)
    const cog = cogsMap.get(branch.id)
    const revenue = new Big(rev?.revenue ?? '0')
    const cogs = new Big(cog?.cogs ?? '0')
    const grossProfit = revenue.minus(cogs)
    const transactionCount = rev?.transactionCount ?? 0

    totalRevenue = totalRevenue.plus(revenue)
    totalCogs = totalCogs.plus(cogs)
    totalTransactionCount += transactionCount

    return {
      branchId: branch.id,
      branchName: branch.name,
      revenue: revenue.toString(),
      cogs: cogs.toString(),
      grossProfit: grossProfit.toString(),
      transactionCount,
    }
  })

  const totalGrossProfit = totalRevenue.minus(totalCogs)

  return {
    startDate: params.startDate,
    endDate: params.endDate,
    items,
    totalRevenue: totalRevenue.toString(),
    totalCogs: totalCogs.toString(),
    totalGrossProfit: totalGrossProfit.toString(),
    totalTransactionCount,
  }
}

export interface StockValuationItem {
  productId: number
  productName: string
  sku: string | null
  branchId: number
  branchName: string
  totalQty: string
  totalValue: string
}

export interface StockValuationData {
  generatedAt: string
  items: StockValuationItem[]
  totalValue: string
}

export async function getStockValuationReport(): Promise<StockValuationData> {
  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      sku: products.sku,
      branchId: branches.id,
      branchName: branches.name,
      // totalQty dalam base UOM — konversi via ratio; base UOM tidak ada di conversions → COALESCE ke 1
      totalQty: sql<string>`COALESCE(SUM(${productStockBatches.qtyRemaining} * COALESCE(${productUomConversions.ratio}, 1)), '0')`,
      // totalValue tetap benar tanpa konversi: qty_uom × cost_per_uom = total value
      totalValue: sql<string>`COALESCE(SUM(${productStockBatches.qtyRemaining} * ${productStockBatches.costPrice}), '0')`,
    })
    .from(productStockBatches)
    .innerJoin(products, eq(productStockBatches.productId, products.id))
    .innerJoin(branches, eq(productStockBatches.branchId, branches.id))
    .leftJoin(
      productUomConversions,
      and(
        eq(productUomConversions.productId, productStockBatches.productId),
        eq(productUomConversions.uomId, productStockBatches.uomId)
      )
    )
    .where(
      and(
        gt(productStockBatches.qtyRemaining, 0),
        eq(products.isActive, true)
      )
    )
    .groupBy(products.id, products.name, products.sku, branches.id, branches.name)
    .orderBy(branches.name, products.name)

  let grandTotal = new Big(0)

  const items: StockValuationItem[] = rows.map((row) => {
    const value = new Big(row.totalValue)
    grandTotal = grandTotal.plus(value)
    return {
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      branchId: row.branchId,
      branchName: row.branchName,
      totalQty: new Big(row.totalQty).toString(),
      totalValue: value.toString(),
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    items,
    totalValue: grandTotal.toString(),
  }
}

export interface SalesByProductItem {
  productId: number | null
  productName: string
  sku: string | null
  qtySold: number
  transactionCount: number
  revenue: string
  cogs: string
  grossProfit: string
}

export interface SalesByProductData {
  startDate: string
  endDate: string
  productId: number | null
  branchId: number | null
  items: SalesByProductItem[]
  totalQty: number
  totalRevenue: string
  totalCogs: string
  totalGrossProfit: string
}

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

  const rows = await db
    .select({
      productId: transactionItems.productId,
      productName: sql<string>`COALESCE(${products.name}, MAX(${transactionItems.productName}), 'Produk Dihapus')`,
      sku: sql<string | null>`COALESCE(${products.sku}, MAX(${transactionItems.productSku}))`,
      qtySold: sql<number>`COALESCE(SUM(${transactionItems.qty}), 0)::integer`,
      transactionCount: sql<number>`COUNT(DISTINCT ${transactions.id})::integer`,
      revenue: sql<string | null>`COALESCE(SUM(${transactionItems.totalPrice} - ${transactionItems.discountAmount}), '0')`,
      // HPP dihitung ulang dari harga modal per base UOM saat ini (product_uom_costs base → default_cost_price)
      // × qty base (qty × ratio). Snapshot transactionItems.cogs hanya dipakai bila master cost tidak ada.
      cogs: sql<string | null>`COALESCE(SUM(
        CASE WHEN COALESCE(${productUomCosts.costPrice}, ${products.defaultCostPrice}, 0) > 0
             THEN ${transactionItems.qty} * COALESCE(${productUomConversions.ratio}, 1) * COALESCE(${productUomCosts.costPrice}, ${products.defaultCostPrice})
             ELSE COALESCE(${transactionItems.cogs}, 0)
        END
      ), '0')`,
    })
    .from(transactionItems)
    .innerJoin(
      transactions,
      and(eq(transactionItems.transactionId, transactions.id), dateFilter)
    )
    .leftJoin(products, eq(transactionItems.productId, products.id))
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
    .where(productFilter)
    .groupBy(transactionItems.productId, products.name, products.sku)
    .orderBy(desc(sql`SUM(${transactionItems.totalPrice} - ${transactionItems.discountAmount})`))

  let totalQty = 0
  let totalRevenue = new Big(0)
  let totalCogs = new Big(0)

  const items: SalesByProductItem[] = rows.map((row) => {
    const revenue = new Big(row.revenue ?? '0')
    const cogs = new Big(row.cogs ?? '0')
    const grossProfit = revenue.minus(cogs)

    totalQty += row.qtySold
    totalRevenue = totalRevenue.plus(revenue)
    totalCogs = totalCogs.plus(cogs)

    return {
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      qtySold: row.qtySold,
      transactionCount: row.transactionCount,
      revenue: revenue.toString(),
      cogs: cogs.toString(),
      grossProfit: grossProfit.toString(),
    }
  })

  return {
    startDate: params.startDate,
    endDate: params.endDate,
    productId: params.productId ?? null,
    branchId: params.branchId ?? null,
    items,
    totalQty,
    totalRevenue: totalRevenue.toString(),
    totalCogs: totalCogs.toString(),
    totalGrossProfit: totalRevenue.minus(totalCogs).toString(),
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
      totalQty: sql<string>`COALESCE(SUM(${productStockBatches.qtyRemaining} * COALESCE(${productUomConversions.ratio}, 1)), '0')`,
      totalValue: sql<string>`COALESCE(SUM(${productStockBatches.qtyRemaining} * ${productStockBatches.costPrice}), '0')`,
    })
    .from(productStockBatches)
    .innerJoin(branches, eq(productStockBatches.branchId, branches.id))
    .leftJoin(
      productUomConversions,
      and(
        eq(productUomConversions.productId, productStockBatches.productId),
        eq(productUomConversions.uomId, productStockBatches.uomId)
      )
    )
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

export interface ProductTransactionRow {
  transactionId: number
  trxNumber: string
  createdAt: string
  branchName: string
  qty: number
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
      qty: sql<number>`COALESCE(SUM(${transactionItems.qty}), 0)::integer`,
      revenue: sql<string | null>`COALESCE(SUM(${transactionItems.totalPrice} - ${transactionItems.discountAmount}), '0')`,
    })
    .from(transactionItems)
    .innerJoin(transactions, eq(transactionItems.transactionId, transactions.id))
    .innerJoin(branches, eq(transactions.branchId, branches.id))
    .where(filter)
    .groupBy(transactions.id, transactions.trxNumber, transactions.createdAt, branches.name)
    .orderBy(desc(transactions.createdAt))
    .limit(params.limit ?? 200)

  return rows.map((row) => ({
    transactionId: row.transactionId,
    trxNumber: row.trxNumber,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    branchName: row.branchName,
    qty: row.qty,
    revenue: new Big(row.revenue ?? '0').toString(),
  }))
}
