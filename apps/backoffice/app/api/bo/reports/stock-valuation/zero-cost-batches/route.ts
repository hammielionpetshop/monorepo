import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { allowedBranchIds } from '@/lib/active-branch'
import { listZeroCostBatches, applyZeroCostBatchCosts } from '@/lib/services/zero-cost-batch-service'

export const dynamic = 'force-dynamic'

const PERMISSION = 'inventory.stock_batch.correct_cost'

const postSchema = z.object({
  batchIds: z.array(z.number().int().positive()).min(1, 'Pilih minimal satu batch').max(2000),
})

export async function GET() {
  const gate = await requirePermission(PERMISSION)
  if (gate instanceof NextResponse) return gate

  try {
    return NextResponse.json({ items: await listZeroCostBatches(allowedBranchIds(gate)) })
  } catch (error) {
    console.error('GET /api/bo/reports/stock-valuation/zero-cost-batches error:', error)
    return NextResponse.json({ error: 'Gagal mengambil batch bermodal kosong' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const gate = await requirePermission(PERMISSION)
  if (gate instanceof NextResponse) return gate

  if (!req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
  }

  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
  }

  try {
    const result = await applyZeroCostBatchCosts({
      batchIds: Array.from(new Set(parsed.data.batchIds)),
      branchIds: allowedBranchIds(gate),
      userId: gate.userId,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/bo/reports/stock-valuation/zero-cost-batches error:', error)
    return NextResponse.json({ error: 'Gagal mengisi modal batch' }, { status: 500 })
  }
}
