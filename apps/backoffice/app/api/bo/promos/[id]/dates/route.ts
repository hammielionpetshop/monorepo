import { NextRequest, NextResponse } from 'next/server'
import { idParam, parseJsonBody } from '@/lib/grooming-master-http'
import { guardPromoScope, promoDatesSchema, promoErrorResponse, requirePromoManager } from '@/lib/promo/promo-http'
import { updatePromoDates } from '@/lib/services/promo-service'

export const dynamic = 'force-dynamic'

// Ubah masa berlaku promo (Owner/GM). Isi promo lainnya tetap tidak bisa diubah.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePromoManager()
    if (gate instanceof NextResponse) return gate
    const parsed = idParam.safeParse((await params).id)
    if (!parsed.success) return NextResponse.json({ error: 'ID promo tidak valid' }, { status: 400 })
    const promoId = Number(parsed.data)
    const data = await parseJsonBody(req, promoDatesSchema)
    if (data instanceof NextResponse) return data
    const denied = await guardPromoScope(gate, promoId)
    if (denied) return denied
    await updatePromoDates(promoId, data, { userId: gate.userId, branchId: gate.branchId })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return promoErrorResponse(error, 'PATCH /api/bo/promos/[id]/dates')
  }
}
