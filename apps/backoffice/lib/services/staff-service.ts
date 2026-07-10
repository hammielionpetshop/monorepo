import Big from 'big.js'
import {
  db,
  transactions,
  shifts,
  purchaseOrders,
  interBranchTransfers,
  interBranchPayables,
  stockOpnames,
  customerDebts,
  eq,
  and,
  or,
  inArray,
  notInArray,
  sql,
  desc,
} from '@/lib/db'
import type { SQL } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'

// Widget /staff dibatasi ke cabang user (branchScope 'OWN'). Tak ada omzet/laba
// GLOBAL di sini — MANAGER hanya melihat cabang sendiri, tanpa laba kotor.

export interface ManagerSummary {
  shiftStatus: 'OPEN' | 'CLOSED' | 'FORCE_CLOSED' | null
  shiftId: number | null
  todayTransactions: number
  todayRevenue: string
  pendingPoApproval: number
}

export interface GudangSummary {
  pendingOpname: number
  activeTransfers: number
  poAwaitingReceiving: number
}

export interface FinanceSummary {
  unpaidReceivables: number
  unpaidPayables: number
}

export interface StaffDashboardData {
  manager?: ManagerSummary
  gudang?: GudangSummary
  finance?: FinanceSummary
}

const todayJkt = (col: SQL | ReturnType<typeof sql.raw> | unknown) =>
  sql`(${col} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date`

async function countWhere(table: PgTable, condition: SQL | undefined): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`CAST(COUNT(*) AS INTEGER)` })
    .from(table)
    .where(condition)
  return Number(row?.c ?? 0)
}

async function getManagerSummary(branchId: number): Promise<ManagerSummary> {
  const [shiftRow, txRow, pendingPo] = await Promise.all([
    // Shift terbaru cabang: hari ini atau yang masih OPEN
    db
      .select({ id: shifts.id, status: shifts.status })
      .from(shifts)
      .where(
        and(
          eq(shifts.branchId, branchId),
          or(todayJkt(shifts.openedAt), eq(shifts.status, 'OPEN')),
        ),
      )
      .orderBy(desc(shifts.id))
      .limit(1),

    // Transaksi selesai hari ini di cabang (omzet cabang sendiri, tanpa laba)
    db
      .select({
        cnt: sql<number>`COUNT(${transactions.id})::integer`,
        rev: sql<string | null>`SUM(${transactions.payableAmount})`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.branchId, branchId),
          eq(transactions.status, 'COMPLETED'),
          todayJkt(transactions.createdAt),
        ),
      ),

    countWhere(
      purchaseOrders,
      and(eq(purchaseOrders.status, 'PENDING_APPROVAL'), eq(purchaseOrders.branchId, branchId)),
    ),
  ])

  return {
    shiftStatus: (shiftRow[0]?.status as ManagerSummary['shiftStatus']) ?? null,
    shiftId: shiftRow[0]?.id ?? null,
    todayTransactions: txRow[0]?.cnt ?? 0,
    todayRevenue: new Big(txRow[0]?.rev ?? '0').toString(),
    pendingPoApproval: pendingPo,
  }
}

async function getGudangSummary(branchId: number): Promise<GudangSummary> {
  // Parity dengan nav-badges: transfer "berjalan" = belum tuntas / belum dibatalkan.
  const transferCond = and(
    notInArray(interBranchTransfers.status, ['FULLY_RECEIVED', 'CANCELLED']),
    or(
      eq(interBranchTransfers.sourceBranchId, branchId),
      eq(interBranchTransfers.destinationBranchId, branchId),
    ),
  )

  const [pendingOpname, activeTransfers, poAwaitingReceiving] = await Promise.all([
    countWhere(
      stockOpnames,
      and(eq(stockOpnames.status, 'PENDING'), eq(stockOpnames.branchId, branchId)),
    ),
    countWhere(interBranchTransfers, transferCond),
    countWhere(
      purchaseOrders,
      and(
        inArray(purchaseOrders.status, ['APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED']),
        eq(purchaseOrders.branchId, branchId),
      ),
    ),
  ])

  return { pendingOpname, activeTransfers, poAwaitingReceiving }
}

async function getFinanceSummary(branchId: number): Promise<FinanceSummary> {
  const [unpaidReceivables, unpaidPayables] = await Promise.all([
    countWhere(
      customerDebts,
      and(inArray(customerDebts.status, ['UNPAID', 'PARTIAL']), eq(customerDebts.branchId, branchId)),
    ),
    countWhere(
      interBranchPayables,
      and(
        inArray(interBranchPayables.status, ['UNPAID', 'PARTIAL']),
        or(
          eq(interBranchPayables.debtorBranchId, branchId),
          eq(interBranchPayables.creditorBranchId, branchId),
        ),
      ),
    ),
  ])

  return { unpaidReceivables, unpaidPayables }
}

// Ambil data widget sesuai peran, dibatasi ke `branchId` user.
export async function getStaffDashboard(role: string, branchId: number): Promise<StaffDashboardData> {
  if (role === 'MANAGER') return { manager: await getManagerSummary(branchId) }
  if (role === 'GUDANG') return { gudang: await getGudangSummary(branchId) }
  if (role === 'FINANCE') return { finance: await getFinanceSummary(branchId) }
  return {}
}
