import { NextResponse } from 'next/server'
import { requirePermission, scopeFilter } from '@/lib/authz'
import { shifts } from '@/lib/db'
import { listShiftExpenses } from '@/lib/services/shift-expense-service'

export const dynamic = 'force-dynamic'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function numParam(value: string | null): number | undefined {
  if (!value) return undefined
  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? undefined : parsed
}

export async function GET(req: Request) {
  try {
    const gate = await requirePermission('shift_expense.read')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (startDate && !ISO_DATE_RE.test(startDate)) {
      return NextResponse.json({ error: 'Format tanggal mulai tidak valid (YYYY-MM-DD)' }, { status: 400 })
    }
    if (endDate && !ISO_DATE_RE.test(endDate)) {
      return NextResponse.json({ error: 'Format tanggal akhir tidak valid (YYYY-MM-DD)' }, { status: 400 })
    }
    if (startDate && endDate && startDate > endDate) {
      return NextResponse.json({ error: 'Tanggal mulai tidak boleh lebih besar dari tanggal akhir' }, { status: 400 })
    }

    const q = searchParams.get('q')?.trim()

    const data = await listShiftExpenses(
      {
        branchId: numParam(searchParams.get('branchId')),
        cashierId: numParam(searchParams.get('cashierId')),
        shiftId: numParam(searchParams.get('shiftId')),
        categoryId: numParam(searchParams.get('categoryId')),
        onlyOpenShift: searchParams.get('onlyOpenShift') === 'true',
        startDate: startDate ?? undefined,
        endDate: endDate ?? undefined,
        q: q ? q : undefined,
      },
      scopeFilter(payload, shifts.branchId),
    )

    return NextResponse.json({
      data,
      total: data.length,
      totalAmount: data.reduce((sum, e) => sum + e.amount, 0),
      canManage: payload.permissions.includes('shift_expense.manage'),
    })
  } catch (error: unknown) {
    console.error('[bo/shift-expenses] GET error:', error)
    return NextResponse.json({ error: 'Gagal mengambil data pengeluaran shift' }, { status: 500 })
  }
}
