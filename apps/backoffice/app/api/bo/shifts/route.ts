import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db, shifts, branches, users, eq, and, desc, gte, lte } from '@/lib/db'
import { verifyAccessToken } from '@/lib/auth'
import type { SQL } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ALLOWED_ROLES = ['OWNER', 'GM']

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload || !ALLOWED_ROLES.includes(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

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
    if (startDate) conditions.push(gte(shifts.openedAt, new Date(startDate)))
    if (endDate) {
      const end = new Date(endDate)
      end.setUTCHours(23, 59, 59, 999)
      conditions.push(lte(shifts.openedAt, end))
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
