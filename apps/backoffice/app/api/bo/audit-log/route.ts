import { NextResponse } from 'next/server'
import { db, auditLogs, users, branches, eq, desc, and, gte, lte } from '@/lib/db'
import type { SQL } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (startDate && !ISO_DATE_RE.test(startDate)) {
      return NextResponse.json({ error: 'Format startDate tidak valid (gunakan YYYY-MM-DD)' }, { status: 400 })
    }
    if (endDate && !ISO_DATE_RE.test(endDate)) {
      return NextResponse.json({ error: 'Format endDate tidak valid (gunakan YYYY-MM-DD)' }, { status: 400 })
    }

    const conditions: SQL<unknown>[] = []
    if (action) conditions.push(eq(auditLogs.action, action))
    if (startDate) conditions.push(gte(auditLogs.createdAt, new Date(startDate + 'T00:00:00.000+07:00')))
    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(endDate + 'T23:59:59.999+07:00')))
    }

    const rows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        tableName: auditLogs.tableName,
        recordId: auditLogs.recordId,
        oldData: auditLogs.oldData,
        newData: auditLogs.newData,
        createdAt: auditLogs.createdAt,
        branchName: branches.name,
        userName: users.name,
      })
      .from(auditLogs)
      .leftJoin(branches, eq(auditLogs.branchId, branches.id))
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(100)

    return NextResponse.json({ data: rows, total: rows.length })
  } catch (error: unknown) {
    console.error('[audit-log] GET error:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil data audit log' },
      { status: 500 }
    )
  }
}
