import { NextResponse } from 'next/server'
import { scopeFilter } from '@/lib/authz'
import { db, shifts, branches, users, eq, ne, and, or, desc, gte, lte, isNull, isNotNull, sql } from '@/lib/db'
import { getDepositSettings } from '@/lib/services/deposit-service'
import type { SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { requireShiftAccess } from './_access'

export const dynamic = 'force-dynamic'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const verifier = alias(users, 'deposit_verifier')

export async function GET(req: Request) {
  try {
    const gate = await requireShiftAccess()
    if (gate instanceof NextResponse) return gate

    const { searchParams } = new URL(req.url)
    const branchId = searchParams.get('branchId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const deposit = searchParams.get('deposit')

    if (startDate && !ISO_DATE_RE.test(startDate)) {
      return NextResponse.json({ error: 'Format startDate tidak valid (YYYY-MM-DD)' }, { status: 400 })
    }
    if (endDate && !ISO_DATE_RE.test(endDate)) {
      return NextResponse.json({ error: 'Format endDate tidak valid (YYYY-MM-DD)' }, { status: 400 })
    }

    // F2-2: shift yang ditutup sejak tanggal mulai Setoran diverifikasi lewat menu Setoran.
    const { startDate: depositStart } = await getDepositSettings()
    const closedOn = sql`to_char(COALESCE(${shifts.closedAt}, ${shifts.forceClosedAt}, ${shifts.openedAt}) AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`
    const activeDeposit = (status: string) => sql`EXISTS (
      SELECT 1 FROM petshop.cash_deposit_shifts ds JOIN petshop.cash_deposits d ON d.id = ds.deposit_id
      WHERE ds.shift_id = ${shifts.id} AND ds.released_at IS NULL AND d.status = ${status})`

    const conditions: SQL<unknown>[] = []
    const scope = scopeFilter(gate, shifts.branchId)
    if (scope) conditions.push(scope)
    // PENDING = sudah ditutup tapi uangnya belum dicatat diterima finance.
    if (deposit === 'PENDING') {
      conditions.push(
        ne(shifts.status, 'OPEN'),
        isNull(shifts.depositVerifiedAt),
        sql`NOT ${activeDeposit('VERIFIED')}`,
        or(ne(shifts.origin, 'BACKOFFICE'), sql`${closedOn} >= ${depositStart}`) as SQL,
      )
    } else if (deposit === 'VERIFIED') {
      conditions.push(or(isNotNull(shifts.depositVerifiedAt), activeDeposit('VERIFIED')) as SQL)
    } else if (deposit === 'DISCREPANCY') {
      conditions.push(or(
        and(isNotNull(shifts.depositVerifiedAt), ne(shifts.depositVariance, 0)),
        sql`EXISTS (SELECT 1 FROM petshop.cash_deposit_variances v JOIN petshop.cash_deposits d ON d.id = v.deposit_id
          WHERE v.shift_id = ${shifts.id} AND d.status = 'VERIFIED')`,
      ) as SQL)
    }
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
        origin: shifts.origin,
        openingCash: shifts.openingCash,
        totalClosingCashReal: shifts.totalClosingCashReal,
        totalClosingCashExpected: shifts.totalClosingCashExpected,
        totalVariance: shifts.totalVariance,
        assignedCashiers: shifts.assignedCashiers,
        settlementNotes: shifts.settlementNotes,
        depositReceivedCash: shifts.depositReceivedCash,
        depositVariance: shifts.depositVariance,
        depositVerifiedAt: shifts.depositVerifiedAt,
        depositNotes: shifts.depositNotes,
        depositVerifiedByName: verifier.name,
        depositFlow: sql<boolean>`(${shifts.status} <> 'OPEN' AND ${shifts.depositVerifiedAt} IS NULL
          AND (${closedOn} >= ${depositStart} OR ${shifts.origin} = 'POS'))`,
        cashDepositStatus: sql<string | null>`(SELECT d.status FROM petshop.cash_deposit_shifts ds JOIN petshop.cash_deposits d ON d.id = ds.deposit_id
          WHERE ds.shift_id = ${shifts.id} AND ds.released_at IS NULL LIMIT 1)`,
        cashDepositNumber: sql<string | null>`(SELECT d.deposit_number FROM petshop.cash_deposit_shifts ds JOIN petshop.cash_deposits d ON d.id = ds.deposit_id
          WHERE ds.shift_id = ${shifts.id} AND ds.released_at IS NULL LIMIT 1)`,
        branchName: branches.name,
        openedByName: users.name,
      })
      .from(shifts)
      .leftJoin(branches, eq(shifts.branchId, branches.id))
      .leftJoin(users, eq(shifts.openedById, users.id))
      .leftJoin(verifier, eq(shifts.depositVerifiedById, verifier.id))
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
