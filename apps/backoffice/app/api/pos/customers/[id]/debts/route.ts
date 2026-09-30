import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requirePermission } from '@/lib/authz'
import { getPosBranchId } from '@/lib/pos-branch'
import { getCustomerDebtDetail } from '@/lib/services/pos-debt-service'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requirePermission('debt.pay')
  if (gate instanceof NextResponse) return gate

  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'ID pelanggan tidak valid' }, { status: 400 })
  }

  try {
    const branchId = getPosBranchId(gate, await cookies())
    const detail = await getCustomerDebtDetail(branchId, Number(id))
    if (!detail) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json(detail)
  } catch (error: unknown) {
    console.error('GET /api/pos/customers/[id]/debts error:', error)
    return NextResponse.json({ error: 'Gagal memuat piutang pelanggan' }, { status: 500 })
  }
}
