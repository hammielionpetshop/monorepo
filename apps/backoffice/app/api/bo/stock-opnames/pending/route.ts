import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { db, stockOpnames, stockOpnameItems, branches, users, eq, and, inArray, sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const gate = await requirePermission('stock_opname.approve')
    if (gate instanceof NextResponse) return gate
    const payload = gate

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
      .where(
        payload.branchScope === 'ALL'
          ? eq(stockOpnames.status, 'PENDING')
          : and(eq(stockOpnames.status, 'PENDING'), eq(stockOpnames.branchId, payload.branchId))
      )
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
