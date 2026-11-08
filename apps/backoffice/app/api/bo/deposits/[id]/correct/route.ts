import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { correctCashDeposit } from '@/lib/services/deposit-service'
import { actorOf, depositErrorResponse, idParam, isoDate, requireDepositVerifier, verifySchema } from '../../_http'

export const dynamic = 'force-dynamic'

const schema = verifySchema.extend({
  depositDate: isoDate.nullable().optional(),
  reason: z.string().trim().min(1, 'Alasan koreksi wajib diisi').max(200, 'Alasan maksimal 200 karakter'),
})

/** Koreksi setoran terverifikasi — Owner/GM (diperiksa di layanan). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireDepositVerifier()
    if (gate instanceof NextResponse) return gate
    const id = idParam.safeParse((await params).id)
    if (!id.success) return NextResponse.json({ error: 'ID setoran tidak valid' }, { status: 400 })
    const data = await parseJsonBody(req, schema)
    if (data instanceof NextResponse) return data
    const created = await correctCashDeposit(Number(id.data), data, actorOf(gate))
    return NextResponse.json({ id: created.id, depositNumber: created.depositNumber, settlement: created.settlement })
  } catch (error) {
    return depositErrorResponse(error, 'POST /api/bo/deposits/[id]/correct')
  }
}
