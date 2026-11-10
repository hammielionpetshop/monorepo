import { NextRequest, NextResponse } from 'next/server'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { guardPromoScope, newPromoSchema, promoErrorResponse, requirePromoManager } from '@/lib/promo/promo-http'
import { createPromo, getPromoEnabled, listPromos } from '@/lib/services/promo-service'

export const dynamic = 'force-dynamic'

// Daftar & buat promo otomatis — Owner/GM. Isi promo tidak bisa diubah/dihapus; yang boleh hanya
// tanggalnya ([id]/dates) atau salin jadi promo baru (`replacePromoId` menonaktifkan yang lama).
export async function GET() {
  try {
    const gate = await requirePromoManager()
    if (gate instanceof NextResponse) return gate
    const [items, enabled] = await Promise.all([
      listPromos(gate.branchScope === 'ALL' ? {} : { branchId: gate.branchId }),
      getPromoEnabled(),
    ])
    return NextResponse.json({ items, enabled })
  } catch (error) {
    return promoErrorResponse(error, 'GET /api/bo/promos')
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requirePromoManager()
    if (gate instanceof NextResponse) return gate
    const data = await parseJsonBody(req, newPromoSchema)
    if (data instanceof NextResponse) return data
    const { acceptLoss, replacePromoId, ...input } = data
    if (gate.branchScope !== 'ALL' && input.branchIds.some((b) => b !== gate.branchId)) {
      return NextResponse.json({ error: 'Anda hanya bisa membuat promo untuk cabang sendiri' }, { status: 403 })
    }
    if (replacePromoId != null) {
      const denied = await guardPromoScope(gate, replacePromoId)
      if (denied) return denied
    }
    const created = await createPromo(input, { userId: gate.userId, branchId: gate.branchId }, { acceptLoss, replacePromoId })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return promoErrorResponse(error, 'POST /api/bo/promos')
  }
}
