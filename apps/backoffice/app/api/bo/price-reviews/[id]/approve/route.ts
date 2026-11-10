import { z } from 'zod'
import { approvePriceReview } from '@/lib/services/price-review-service'
import { handlePriceReviewAction } from '@/lib/services/price-review-http'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  // Kosong = pakai usulan sistem.
  prices: z
    .array(z.object({ uomId: z.number().int().positive(), tierType: z.string().min(1), price: z.number().int().positive() }))
    .nullable()
    .optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handlePriceReviewAction(
    req,
    params,
    bodySchema,
    (tx, { id, userId, body }) => approvePriceReview(tx, { id, userId, prices: body.prices ?? null }),
    'POST /api/bo/price-reviews/[id]/approve',
  )
}
