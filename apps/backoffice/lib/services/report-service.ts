import Big from 'big.js'
import {
  db,
  transactions,
  transactionItems,
  branches,
  eq,
  and,
  sql,
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
    sql`(${transactions.createdAt} AT TIME ZONE 'Asia/Jakarta')::date >= ${params.startDate}::date`,
    sql`(${transactions.createdAt} AT TIME ZONE 'Asia/Jakarta')::date <= ${params.endDate}::date`
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
        cogs: sql<string | null>`COALESCE(SUM(COALESCE(${transactionItems.cogs}, 0)), '0')`,
      })
      .from(transactionItems)
      .innerJoin(
        transactions,
        and(
          eq(transactionItems.transactionId, transactions.id),
          dateFilter
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
