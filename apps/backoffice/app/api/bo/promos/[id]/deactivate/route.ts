import { NextResponse } from 'next/server'
import { idParam } from '@/lib/grooming-master-http'
import { guardPromoScope, promoErrorResponse, requirePromoManager } from '@/lib/promo/promo-http'
import { deactivatePromo } from '@/lib/services/promo-service'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePromoManager()
    if (gate instanceof NextResponse) return gate
    const parsed = idParam.safeParse((await params).id)
    if (!parsed.success) return NextResponse.json({ error: 'ID promo tidak valid' }, { status: 400 })
    const promoId = Number(parsed.data)
    const denied = await guardPromoScope(gate, promoId)
    if (denied) return denied
    await deactivatePromo(promoId, { userId: gate.userId, branchId: gate.branchId })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return promoErrorResponse(error, 'POST /api/bo/promos/[id]/deactivate')
  }
}
