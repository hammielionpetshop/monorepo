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
import { DB_UNAVAILABLE_MESSAGE, isDbUnavailable } from '@/lib/db-errors'
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

    // Digabung jadi satu query agar satu kali muat sidebar hanya memakai satu
    // koneksi — lihat catatan yang sama di /api/bo/nav-badges.
    const rows = await db.execute<{ open_bills: number; incoming: number }>(sql`
      SELECT
        (SELECT CAST(COUNT(*) AS INTEGER) FROM ${openBills}
          WHERE ${eq(openBills.branchId, branchId)}) AS open_bills,
        (SELECT CAST(COUNT(*) AS INTEGER) FROM ${interBranchTransfers}
          WHERE ${and(
            eq(interBranchTransfers.destinationBranchId, branchId),
            eq(interBranchTransfers.status, 'IN_TRANSIT'),
          )}) AS incoming
    `)

    const row = rows[0]

    return NextResponse.json({
      '/pos': Number(row?.open_bills ?? 0),
      '/pos/incoming-transfers': Number(row?.incoming ?? 0),
    })
  } catch (error) {
    console.error('GET /api/pos/nav-badges error:', error)
    if (isDbUnavailable(error)) {
      return NextResponse.json({ error: DB_UNAVAILABLE_MESSAGE }, { status: 503 })
    }
    return NextResponse.json(
      { error: 'Gagal mengambil badge navigasi POS' },
      { status: 500 },
    )
  }
}
