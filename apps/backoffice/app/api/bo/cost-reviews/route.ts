import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { getCostReviews } from '@/lib/services/cost-sync-service'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  tab: z.enum(['PENDING', 'APPROVED', 'APPLIED', 'REJECTED']),
  branchId: z.string().regex(/^\d+$/).optional(),
  sourceType: z.enum(['PO_RECEIVING', 'PO_INVOICE', 'IBT_RECEIVE', 'STOCK_ADJUSTMENT', 'PO_REVERSAL']).optional(),
  q: z.string().max(100).optional(),
})

export async function GET(req: Request) {
  const gate = await requirePermission('master.price.manage')
  if (gate instanceof NextResponse) return gate

  const { searchParams } = new URL(req.url)
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Parameter tidak valid' }, { status: 400 })
  }

  try {
    const { tab, branchId, sourceType, q } = parsed.data
    return NextResponse.json(
      await getCostReviews(tab, { branchId: branchId ? Number(branchId) : null, sourceType: sourceType ?? null, q: q ?? null }),
    )
  } catch (error: unknown) {
    console.error('GET /api/bo/cost-reviews error:', error)
    return NextResponse.json({ error: 'Gagal mengambil daftar tinjauan modal' }, { status: 500 })
  }
}
