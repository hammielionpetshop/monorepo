import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { cancelSupplierReturn, supplierReturnErrorResponse } from '@/lib/services/supplier-return-service'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  reason: z.string().trim().min(5, 'Alasan pembatalan wajib diisi (minimal 5 huruf)').max(500, 'Alasan maksimal 500 karakter'),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Pembatal = penyetuju retur (OWNER/GM).
  const gate = await requirePermission('void.approve')
  if (gate instanceof NextResponse) return gate

  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'ID retur tidak valid' }, { status: 400 })
  }
  if (!req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
  }
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
  }

  try {
    const data = await cancelSupplierReturn({ id: Number(id), userId: gate.userId, reason: parsed.data.reason })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const known = supplierReturnErrorResponse(error)
    if (known) return NextResponse.json({ error: known.error }, { status: known.status })
    console.error('POST /api/bo/supplier-returns/[id]/cancel error:', error)
    return NextResponse.json({ error: 'Gagal membatalkan retur supplier' }, { status: 500 })
  }
}
