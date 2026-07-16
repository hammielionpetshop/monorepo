import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { db, shifts, branches, users, eq, and, desc, gte, lte } from '@/lib/db'
import type { SQL } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: Request) {
  try {
    const gate = await requirePermission('shift.read')
    if (gate instanceof NextResponse) return gate

    const { searchParams } = new URL(req.url)
    const branchId = searchParams.get('branchId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (startDate && !ISO_DATE_RE.test(startDate)) {
      return NextResponse.json({ error: 'Format startDate tidak valid (YYYY-MM-DD)' }, { status: 400 })
    }
    if (endDate && !ISO_DATE_RE.test(endDate)) {
      return NextResponse.json({ error: 'Format endDate tidak valid (YYYY-MM-DD)' }, { status: 400 })
    }

    const conditions: SQL<unknown>[] = []
    if (branchId) conditions.push(eq(shifts.branchId, parseInt(branchId)))
    if (status) conditions.push(eq(shifts.status, status))
    if (startDate) conditions.push(gte(shifts.openedAt, new Date(startDate + 'T00:00:00.000+07:00')))
    if (endDate) {
      conditions.push(lte(shifts.openedAt, new Date(endDate + 'T23:59:59.999+07:00')))
    }

    const rows = await db
      .select({
        id: shifts.id,
        shiftNumber: shifts.shiftNumber,
        branchId: shifts.branchId,
        openedById: shifts.openedById,
        openedAt: shifts.openedAt,
        closedAt: shifts.closedAt,
        forceClosedAt: shifts.forceClosedAt,
        status: shifts.status,
        openingCash: shifts.openingCash,
        totalClosingCashReal: shifts.totalClosingCashReal,
        totalClosingCashExpected: shifts.totalClosingCashExpected,
        totalVariance: shifts.totalVariance,
        assignedCashiers: shifts.assignedCashiers,
        settlementNotes: shifts.settlementNotes,
        branchName: branches.name,
        openedByName: users.name,
      })
      .from(shifts)
      .leftJoin(branches, eq(shifts.branchId, branches.id))
      .leftJoin(users, eq(shifts.openedById, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(shifts.openedAt))
      .limit(200)

    const data = rows.map((r) => ({
      ...r,
      openingCash: Number(r.openingCash),
      totalClosingCashReal: r.totalClosingCashReal != null ? Number(r.totalClosingCashReal) : null,
      totalClosingCashExpected: r.totalClosingCashExpected != null ? Number(r.totalClosingCashExpected) : null,
      totalVariance: r.totalVariance != null ? Number(r.totalVariance) : null,
      cashierCount: Array.isArray(r.assignedCashiers) ? (r.assignedCashiers as number[]).length : 0,
    }))

    return NextResponse.json({ data, total: data.length })
  } catch (error: unknown) {
    console.error('[bo/shifts] GET error:', error)
    return NextResponse.json({ error: 'Gagal mengambil data shift' }, { status: 500 })
  }
}
