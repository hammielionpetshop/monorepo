import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requirePermission } from '@/lib/authz'
import { getPosBranchId } from '@/lib/pos-branch'
import { listDebtors } from '@/lib/services/pos-debt-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const gate = await requirePermission('debt.pay')
  if (gate instanceof NextResponse) return gate

  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 100)
    const branchId = getPosBranchId(gate, await cookies())
    return NextResponse.json(await listDebtors(branchId, q))
  } catch (error: unknown) {
    console.error('GET /api/pos/debts error:', error)
    return NextResponse.json({ error: 'Gagal memuat daftar piutang' }, { status: 500 })
  }
}
