import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { verifyAccessToken } from '@/lib/auth'
import {
  db,
  openBills,
  interBranchTransfers,
  eq,
  and,
  sql,
} from '@/lib/db'
import { getPosBranchId } from '@/lib/pos-branch'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json(
        { error: 'Sesi tidak valid, silakan login kembali' },
        { status: 401 },
      )
    }

    const branchId = getPosBranchId(payload, cookieStore)

    const [openBillsRow, incomingRow] = await Promise.all([
      db
        .select({ c: sql<number>`CAST(COUNT(*) AS INTEGER)` })
        .from(openBills)
        .where(eq(openBills.branchId, branchId)),
      db
        .select({ c: sql<number>`CAST(COUNT(*) AS INTEGER)` })
        .from(interBranchTransfers)
        .where(
          and(
            eq(interBranchTransfers.destinationBranchId, branchId),
            eq(interBranchTransfers.status, 'IN_TRANSIT'),
          ),
        ),
    ])

    return NextResponse.json({
      '/pos': Number(openBillsRow[0]?.c ?? 0),
      '/pos/incoming-transfers': Number(incomingRow[0]?.c ?? 0),
    })
  } catch (error) {
    console.error('GET /api/pos/nav-badges error:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil badge navigasi POS' },
      { status: 500 },
    )
  }
}
