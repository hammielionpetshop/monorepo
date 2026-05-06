import Big from 'big.js'
import {
  db,
  transactions,
  transactionItems,
  shifts,
  shiftExpenses,
  branches,
  eq,
  and,
  or,
  sql,
  desc,
} from '@/lib/db'

export interface ShiftStatusItem {
  branchId: number
  branchName: string
  shiftId: number | null
  status: 'OPEN' | 'CLOSED' | 'FORCE_CLOSED' | null
}

export interface DailySummaryData {
  totalRevenue: string
  totalTransactions: number
  grossProfitEstimate: string
  totalExpenses: string
  shiftStatuses: ShiftStatusItem[]
}

const SHIFT_TODAY_FILTER = sql`(${shifts.openedAt} AT TIME ZONE 'Asia/Jakarta')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date`

export async function getDailySummary(): Promise<DailySummaryData> {
  const [revenueRows, cogsRows, shiftRows] = await Promise.all([
    // Query 1a: Revenue dan jumlah transaksi
    db
      .select({
        totalRevenue: sql<string | null>`SUM(${transactions.payableAmount})`,
        totalTransactions: sql<number>`COUNT(${transactions.id})::integer`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.status, 'COMPLETED'),
          sql`(${transactions.createdAt} AT TIME ZONE 'Asia/Jakarta')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date`
        )
      ),

    // Query 1b: COGS dari transaction_items (inner join untuk filter status)
    db
      .select({
        totalCogs: sql<string | null>`SUM(${transactionItems.cogs})`,
      })
      .from(transactionItems)
      .innerJoin(
        transactions,
        and(
          eq(transactionItems.transactionId, transactions.id),
          eq(transactions.status, 'COMPLETED'),
          sql`(${transactions.createdAt} AT TIME ZONE 'Asia/Jakarta')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date`
        )
      ),

    // Query 2: Status shift dan pengeluaran per cabang
    db
      .select({
        branchId: branches.id,
        branchName: branches.name,
        shiftId: shifts.id,
        shiftStatus: shifts.status,
        expenseAmount: shiftExpenses.amount,
      })
      .from(branches)
      .leftJoin(
        shifts,
        and(
          eq(shifts.branchId, branches.id),
          or(
            SHIFT_TODAY_FILTER,
            eq(shifts.status, 'OPEN'),
          ),
        ),
      )
      .leftJoin(shiftExpenses, eq(shiftExpenses.shiftId, shifts.id))
      .where(eq(branches.isActive, true))
      .orderBy(branches.name, desc(shifts.id)),
  ])

  // Kalkulasi finansial dengan big.js
  const totalRevenue = new Big(revenueRows[0]?.totalRevenue ?? '0')
  const totalCogs = new Big(cogsRows[0]?.totalCogs ?? '0')
  const grossProfitEstimate = totalRevenue.minus(totalCogs)
  const totalTransactions = revenueRows[0]?.totalTransactions ?? 0

  // Proses data shift: kelompokkan per cabang
  type BranchEntry = {
    branchId: number
    branchName: string
    shiftId: number | null
    status: 'OPEN' | 'CLOSED' | 'FORCE_CLOSED' | null
    totalExpenses: Big
  }

  const branchMap = new Map<number, BranchEntry>()

  for (const row of shiftRows) {
    const existing = branchMap.get(row.branchId)

    if (!existing) {
      // Baris pertama per cabang = shift paling baru (ORDER BY shifts.id DESC)
      branchMap.set(row.branchId, {
        branchId: row.branchId,
        branchName: row.branchName,
        shiftId: row.shiftId ?? null,
        status: (row.shiftStatus as BranchEntry['status']) ?? null,
        totalExpenses: row.expenseAmount ? new Big(row.expenseAmount) : new Big(0),
      })
    } else {
      // Baris berikutnya per cabang: akumulasi pengeluaran dari semua shift hari ini
      if (row.expenseAmount) {
        existing.totalExpenses = existing.totalExpenses.plus(new Big(row.expenseAmount))
      }
    }
  }

  // Agregasi total pengeluaran dari semua cabang
  let totalExpenses = new Big(0)
  const shiftStatuses: ShiftStatusItem[] = []

  for (const branch of branchMap.values()) {
    totalExpenses = totalExpenses.plus(branch.totalExpenses)
    shiftStatuses.push({
      branchId: branch.branchId,
      branchName: branch.branchName,
      shiftId: branch.shiftId,
      status: branch.status,
    })
  }

  return {
    totalRevenue: totalRevenue.toString(),
    totalTransactions,
    grossProfitEstimate: grossProfitEstimate.toString(),
    totalExpenses: totalExpenses.toString(),
    shiftStatuses,
  }
}

export interface BranchOfflineStatus {
  branchId: number
  branchName: string
  lastSeenAt: string | null
  isOffline: boolean
  offlineMinutes: number | null
}

const OFFLINE_THRESHOLD_MS = 30 * 60 * 1000 // 30 menit

export async function getOfflineBranches(): Promise<BranchOfflineStatus[]> {
  const allBranches = await db
    .select({
      id: branches.id,
      name: branches.name,
      lastSeenAt: branches.lastSeenAt,
    })
    .from(branches)
    .where(eq(branches.isActive, true))
    .orderBy(branches.name)

  const now = Date.now()

  return allBranches.map((b) => {
    const lastSeenAt = b.lastSeenAt ? b.lastSeenAt.toISOString() : null
    const isOffline =
      !b.lastSeenAt || now - b.lastSeenAt.getTime() > OFFLINE_THRESHOLD_MS
    const offlineMinutes = b.lastSeenAt
      ? Math.max(0, Math.floor((now - b.lastSeenAt.getTime()) / 60_000))
      : null

    return {
      branchId: b.id,
      branchName: b.name,
      lastSeenAt,
      isOffline,
      offlineMinutes,
    }
  })
}
