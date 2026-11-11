import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { cancelOpeningBalance } from '@/lib/services/money-place-opening-balance-service'
import { idParam } from '../../../_http'
import { openingBalanceErrorResponse, requireOpeningBalanceManager } from '../../_http'

export const dynamic = 'force-dynamic'

const schema = z.object({
  reason: z.string({ message: 'Alasan wajib diisi' }).trim().min(1, 'Alasan wajib diisi').max(255, 'Alasan maksimal 255 karakter'),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireOpeningBalanceManager()
    if (gate instanceof NextResponse) return gate
    const { id } = await params
    if (!idParam.safeParse(id).success) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    const data = await parseJsonBody(req, schema)
    if (data instanceof NextResponse) return data
    await cancelOpeningBalance(Number(id), data.reason, { userId: gate.userId, branchId: gate.branchId })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return openingBalanceErrorResponse(error, 'POST /api/bo/settings/money-places/opening-balances/[id]/cancel')
  }
}
