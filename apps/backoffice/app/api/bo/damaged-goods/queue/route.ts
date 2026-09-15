import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { getDamagedGoodsByStatus } from '@/lib/services/damaged-goods-approval'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
})

export async function GET(req: Request) {
  const gate = await requirePermission('damaged_goods.approve')
  if (gate instanceof NextResponse) return gate

  const { searchParams } = new URL(req.url)
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Parameter tidak valid' }, { status: 400 })
  }

  try {
    const data = await getDamagedGoodsByStatus(parsed.data.status)
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('GET /api/bo/damaged-goods/queue error:', error)
    return NextResponse.json({ error: 'Gagal mengambil daftar barang rusak' }, { status: 500 })
  }
}
