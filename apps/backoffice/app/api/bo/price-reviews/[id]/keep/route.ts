import { z } from 'zod'
import { keepPriceReview } from '@/lib/services/price-review-service'
import { handlePriceReviewAction } from '@/lib/services/price-review-http'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({ reason: z.string().trim().min(1, 'Alasan wajib diisi').max(500) })

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handlePriceReviewAction(
    req,
    params,
    bodySchema,
    (tx, { id, userId, body }) => keepPriceReview(tx, { id, userId, reason: body.reason }),
    'POST /api/bo/price-reviews/[id]/keep',
  )
}
