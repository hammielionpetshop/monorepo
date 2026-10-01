import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { getCostReviews } from '@/lib/services/cost-sync-service'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  tab: z.enum(['PENDING', 'APPROVED', 'APPLIED', 'REJECTED']),
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
    return NextResponse.json(await getCostReviews(parsed.data.tab))
  } catch (error: unknown) {
    console.error('GET /api/bo/cost-reviews error:', error)
    return NextResponse.json({ error: 'Gagal mengambil daftar tinjauan modal' }, { status: 500 })
  }
}
