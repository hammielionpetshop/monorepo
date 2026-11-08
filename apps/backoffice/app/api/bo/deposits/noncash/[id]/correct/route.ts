import { NextRequest, NextResponse } from 'next/server'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { correctNoncashVerification } from '@/lib/services/deposit-service'
import { actorOf, depositErrorResponse, idParam, noncashCorrectSchema, requireDepositVerifier } from '../../../_http'

export const dynamic = 'force-dynamic'

/** Koreksi verifikasi non-tunai — Owner/GM (diperiksa di layanan). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requireDepositVerifier()
    if (gate instanceof NextResponse) return gate
    const id = idParam.safeParse((await params).id)
    if (!id.success) return NextResponse.json({ error: 'ID verifikasi tidak valid' }, { status: 400 })
    const data = await parseJsonBody(req, noncashCorrectSchema)
    if (data instanceof NextResponse) return data
    const row = await correctNoncashVerification(Number(id.data), data, actorOf(gate))
    return NextResponse.json({ id: row.id })
  } catch (error) {
    return depositErrorResponse(error, 'POST /api/bo/deposits/noncash/[id]/correct')
  }
}
