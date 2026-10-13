import { NextResponse } from 'next/server'
import { idParam } from '@/lib/grooming-master-http'
import { promoErrorResponse, requirePromoManager } from '@/lib/promo/promo-http'
import { deactivatePromo, listPromos } from '@/lib/services/promo-service'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePromoManager()
    if (gate instanceof NextResponse) return gate
    const parsed = idParam.safeParse((await params).id)
    if (!parsed.success) return NextResponse.json({ error: 'ID promo tidak valid' }, { status: 400 })
    const promoId = Number(parsed.data)
    if (gate.branchScope !== 'ALL') {
      const own = await listPromos({ branchId: gate.branchId })
      const promo = own.find((p) => p.id === promoId)
      if (!promo || promo.branchIds.some((b) => b !== gate.branchId)) {
        return NextResponse.json({ error: 'Promo ini bukan milik cabang Anda saja' }, { status: 403 })
      }
    }
    await deactivatePromo(promoId, { userId: gate.userId, branchId: gate.branchId })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return promoErrorResponse(error, 'POST /api/bo/promos/[id]/deactivate')
  }
}
