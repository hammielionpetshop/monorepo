import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { db, stockOpnames, stockOpnameItems, branches, users, eq, inArray, sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['OWNER', 'MANAGER']

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    if (!ALLOWED_ROLES.includes(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const soHeaders = await db
      .select({
        id: stockOpnames.id,
        soNumber: stockOpnames.soNumber,
        type: stockOpnames.type,
        branchName: branches.name,
        createdByName: sql<string>`COALESCE(${users.name}, 'User dihapus')`,
        createdAt: stockOpnames.createdAt,
      })
      .from(stockOpnames)
      .innerJoin(branches, eq(stockOpnames.branchId, branches.id))
      .leftJoin(users, eq(stockOpnames.createdById, users.id))
      .where(eq(stockOpnames.status, 'PENDING'))
      .orderBy(stockOpnames.createdAt)

    const soIds = soHeaders.map((so) => so.id)

    const itemCounts =
      soIds.length > 0
        ? await db
            .select({
              soId: stockOpnameItems.soId,
              itemCount: sql<number>`CAST(COUNT(*) AS INTEGER)`,
            })
            .from(stockOpnameItems)
            .where(inArray(stockOpnameItems.soId, soIds))
            .groupBy(stockOpnameItems.soId)
        : []

    const countMap = new Map(itemCounts.map((r) => [r.soId, r.itemCount]))

    const result = soHeaders.map((so) => ({
      ...so,
      itemCount: countMap.get(so.id) ?? 0,
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('GET /api/bo/stock-opnames/pending error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil data stock opname' }, { status: 500 })
  }
}
