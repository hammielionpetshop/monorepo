import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db } from '@/lib/db'
import { approvePriceReview, PriceReviewError } from '@/lib/services/price-review-service'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({ ids: z.array(z.number().int().positive()).min(1, 'Pilih minimal satu barang').max(200) })

/** Setujui usulan untuk banyak barang. Tiap barang satu transaksi: yang gagal dilaporkan, yang lain tetap jalan. */
export async function POST(req: Request) {
  const gate = await requirePermission('master.price.manage')
  if (gate instanceof NextResponse) return gate
  if (req.headers.get('content-type')?.includes('application/json') !== true) {
    return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
  }

  let approved = 0
  const failed: { id: number; error: string }[] = []
  for (const id of new Set(parsed.data.ids)) {
    try {
      await db.transaction(tx => approvePriceReview(tx, { id, userId: gate.userId, prices: null }))
      approved++
    } catch (error: unknown) {
      if (error instanceof PriceReviewError) failed.push({ id, error: error.message })
      else {
        console.error('POST /api/bo/price-reviews/approve-bulk error:', error)
        failed.push({ id, error: 'Gagal menyetujui' })
      }
    }
  }
  return NextResponse.json({ approved, failed })
}
