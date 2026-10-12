import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { idParam, parseJsonBody } from '@/lib/grooming-master-http'
import { groomingOrderErrorResponse } from '@/lib/grooming-order-http'
import { changeGroomer, GROOMER_CHANGE_REASON_MAX, GROOMER_CHANGE_REASON_MIN } from '@/lib/services/grooming-report-service'

export const dynamic = 'force-dynamic'

const schema = z.object({
  groomerId: z.number().int().positive('Pilih groomer penggantinya'),
  reason: z
    .string()
    .trim()
    .min(GROOMER_CHANGE_REASON_MIN, `Alasan ganti groomer wajib diisi (minimal ${GROOMER_CHANGE_REASON_MIN} huruf)`)
    .max(GROOMER_CHANGE_REASON_MAX, `Alasan maksimal ${GROOMER_CHANGE_REASON_MAX} huruf`),
})

// Ganti Groomer (Owner/GM): catatan lama tidak ditimpa diam-diam — tiap pergantian berjejak.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('grooming.order.change_groomer')
    if (gate instanceof NextResponse) return gate
    const id = idParam.safeParse((await params).id)
    if (!id.success) return NextResponse.json({ error: 'ID grooming tidak valid' }, { status: 400 })
    const data = await parseJsonBody(req, schema)
    if (data instanceof NextResponse) return data
    const result = await changeGroomer(Number(id.data), data, {
      userId: gate.userId,
      branchId: gate.branchId,
      allBranches: gate.branchScope === 'ALL',
    })
    return NextResponse.json(result)
  } catch (error) {
    return groomingOrderErrorResponse(error, 'POST /api/bo/grooming/orders/[id]/change-groomer')
  }
}
