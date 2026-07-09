import { NextResponse } from 'next/server'

import { getAuth } from '@/lib/authz'
import {
  db,
  purchaseOrders,
  interBranchTransfers,
  interBranchPayables,
  stockOpnames,
  customerDebts,
  voidRequests,
  eq,
  and,
  or,
  inArray,
  notInArray,
  sql,
} from '@/lib/db'
import type { SQL } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'

export const dynamic = 'force-dynamic'

async function countWhere(table: PgTable, condition: SQL | undefined): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`CAST(COUNT(*) AS INTEGER)` })
    .from(table)
    .where(condition)
  return Number(row?.c ?? 0)
}

export async function GET() {
  try {
    const payload = await getAuth()
    if (!payload) {
      return NextResponse.json(
        { error: 'Sesi tidak valid, silakan login kembali' },
        { status: 401 },
      )
    }

    const isGlobal = payload.branchScope === 'ALL'
    const branchId = payload.branchId

    // Purchase Order menunggu approval
    const poCond = and(
      eq(purchaseOrders.status, 'PENDING_APPROVAL'),
      isGlobal ? undefined : eq(purchaseOrders.branchId, branchId),
    )

    // Transfer internal yang masih berjalan (belum tuntas / belum dibatalkan)
    const transferActive = notInArray(interBranchTransfers.status, [
      'FULLY_RECEIVED',
      'CANCELLED',
    ])
    const transferCond = isGlobal
      ? transferActive
      : and(
          transferActive,
          or(
            eq(interBranchTransfers.sourceBranchId, branchId),
            eq(interBranchTransfers.destinationBranchId, branchId),
          ),
        )

    // Hutang/piutang internal belum lunas
    const payableActive = inArray(interBranchPayables.status, ['UNPAID', 'PARTIAL'])
    const payableCond = isGlobal
      ? payableActive
      : and(
          payableActive,
          or(
            eq(interBranchPayables.debtorBranchId, branchId),
            eq(interBranchPayables.creditorBranchId, branchId),
          ),
        )

    // Stock opname menunggu (PENDING)
    const opnameCond = and(
      eq(stockOpnames.status, 'PENDING'),
      isGlobal ? undefined : eq(stockOpnames.branchId, branchId),
    )

    // Piutang pelanggan belum lunas
    const debtActive = inArray(customerDebts.status, ['UNPAID', 'PARTIAL'])
    const debtCond = isGlobal
      ? debtActive
      : and(debtActive, eq(customerDebts.branchId, branchId))

    const [
      purchaseOrdersCount,
      internalTransfersCount,
      internalPayablesCount,
      stockOpnameCount,
      receivablesCount,
      voidRequestsCount,
    ] = await Promise.all([
      countWhere(purchaseOrders, poCond),
      countWhere(interBranchTransfers, transferCond),
      countWhere(interBranchPayables, payableCond),
      countWhere(stockOpnames, opnameCond),
      countWhere(customerDebts, debtCond),
      // Persetujuan void hanya untuk OWNER/GM (menu disembunyikan untuk peran lain)
      isGlobal
        ? countWhere(voidRequests, eq(voidRequests.status, 'PENDING'))
        : Promise.resolve(0),
    ])

    return NextResponse.json({
      '/purchase-orders': purchaseOrdersCount,
      '/purchase-orders/internal': internalTransfersCount,
      '/purchase-orders/internal/payables': internalPayablesCount,
      '/inventory/stock-opname': stockOpnameCount,
      '/reports/receivables': receivablesCount,
      '/void-requests': voidRequestsCount,
    })
  } catch (error) {
    console.error('GET /api/bo/nav-badges error:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil badge navigasi' },
      { status: 500 },
    )
  }
}
