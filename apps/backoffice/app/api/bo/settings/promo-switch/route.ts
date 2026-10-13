import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { promoErrorResponse, requirePromoManager } from '@/lib/promo/promo-http'
import { getPromoEnabled, setPromoEnabled } from '@/lib/services/promo-service'

export const dynamic = 'force-dynamic'

// Saklar darurat "matikan semua promo" — Owner/GM, berlaku untuk semua cabang.
const schema = z.object({ enabled: z.boolean() })

export async function GET() {
  const gate = await requirePromoManager()
  if (gate instanceof NextResponse) return gate
  return NextResponse.json({ enabled: await getPromoEnabled() })
}

export async function PUT(req: NextRequest) {
  try {
    const gate = await requirePromoManager()
    if (gate instanceof NextResponse) return gate
    const data = await parseJsonBody(req, schema)
    if (data instanceof NextResponse) return data
    const enabled = await setPromoEnabled(data.enabled, { userId: gate.userId, branchId: gate.branchId })
    return NextResponse.json({ enabled })
  } catch (error) {
    return promoErrorResponse(error, 'PUT /api/bo/settings/promo-switch')
  }
}
