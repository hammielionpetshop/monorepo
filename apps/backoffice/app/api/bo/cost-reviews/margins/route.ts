import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { getMarginAlerts } from '@/lib/services/cost-sync-service'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  branchId: z.string().regex(/^\d+$/).optional(),
  q: z.string().max(100).optional(),
})

export async function GET(req: Request) {
  const gate = await requirePermission('master.price.manage')
  if (gate instanceof NextResponse) return gate

  const { searchParams } = new URL(req.url)
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parameter tidak valid' }, { status: 400 })
  }

  try {
    const data = await getMarginAlerts({
      branchId: parsed.data.branchId ? Number(parsed.data.branchId) : null,
      q: parsed.data.q ?? null,
    })
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('GET /api/bo/cost-reviews/margins error:', error)
    return NextResponse.json({ error: 'Gagal mengambil daftar margin' }, { status: 500 })
  }
}
