import { NextResponse } from 'next/server'

import { getAuth } from '@/lib/authz'
import {
  db,
  purchaseOrders,
  interBranchTransfers,
  interBranchPayables,
  stockOpnames,
  customerDebts,
  customerOrders,
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

import { DB_UNAVAILABLE_MESSAGE, isDbUnavailable } from '@/lib/db-errors'

export const dynamic = 'force-dynamic'
// Lihat alasan yang sama di `/api/pos/nav-badges`.
export const maxDuration = 20

// Satu subquery scalar per badge, semuanya digabung jadi SATU query.
// Sebelumnya tiap badge adalah query terpisah yang dijalankan lewat Promise.all,
// sehingga satu kali muat sidebar merebut sampai 7 koneksi sekaligus dari pool
// instance — penyebab utama produksi kehabisan slot koneksi.
function countExpr(table: PgTable, condition: SQL | undefined): SQL<number> {
  return sql<number>`(SELECT CAST(COUNT(*) AS INTEGER) FROM ${table} WHERE ${condition ?? sql`TRUE`})`
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

    // Order Customer Portal menunggu konfirmasi
    const orderCond = and(
      eq(customerOrders.status, 'PENDING'),
      isGlobal ? undefined : eq(customerOrders.branchId, branchId),
    )

    // Persetujuan void hanya untuk OWNER/GM (menu disembunyikan untuk peran lain)
    const voidExpr = isGlobal
      ? countExpr(voidRequests, eq(voidRequests.status, 'PENDING'))
      : sql<number>`0`

    const rows = await db.execute<{
      purchase_orders: number
      internal_transfers: number
      internal_payables: number
      stock_opname: number
      receivables: number
      void_requests: number
      customer_orders: number
    }>(sql`
      SELECT
        ${countExpr(purchaseOrders, poCond)} AS purchase_orders,
        ${countExpr(interBranchTransfers, transferCond)} AS internal_transfers,
        ${countExpr(interBranchPayables, payableCond)} AS internal_payables,
        ${countExpr(stockOpnames, opnameCond)} AS stock_opname,
        ${countExpr(customerDebts, debtCond)} AS receivables,
        ${voidExpr} AS void_requests,
        ${countExpr(customerOrders, orderCond)} AS customer_orders
    `)

    const row = rows[0]

    return NextResponse.json({
      '/purchase-orders': Number(row?.purchase_orders ?? 0),
      '/purchase-orders/internal': Number(row?.internal_transfers ?? 0),
      '/purchase-orders/internal/payables': Number(row?.internal_payables ?? 0),
      '/inventory/stock-opname': Number(row?.stock_opname ?? 0),
      '/reports/receivables': Number(row?.receivables ?? 0),
      '/void-requests': Number(row?.void_requests ?? 0),
      '/orders': Number(row?.customer_orders ?? 0),
    })
  } catch (error) {
    console.error('GET /api/bo/nav-badges error:', error)
    if (isDbUnavailable(error)) {
      return NextResponse.json({ error: DB_UNAVAILABLE_MESSAGE }, { status: 503 })
    }
    return NextResponse.json(
      { error: 'Gagal mengambil badge navigasi' },
      { status: 500 },
    )
  }
}
