import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import { listDebtors } from '@/lib/services/pos-debt-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const gate = await requirePermission('debt.pay')
  if (gate instanceof NextResponse) return gate

  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 100)
    return NextResponse.json(await listDebtors(q))
  } catch (error: unknown) {
    console.error('GET /api/pos/debts error:', error)
    return NextResponse.json({ error: 'Gagal memuat daftar piutang' }, { status: 500 })
  }
}
