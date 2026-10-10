import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import {
  approveSupplierReturn,
  supplierReturnApproveSchema,
  supplierReturnErrorResponse,
} from '@/lib/services/supplier-return-service'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Penyetuju retur = penyetuju di Permintaan Persetujuan (OWNER/GM).
  const gate = await requirePermission('void.approve')
  if (gate instanceof NextResponse) return gate

  const { id } = await params
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'ID pengajuan tidak valid' }, { status: 400 })
  }

  let raw: unknown = {}
  if (req.headers.get('content-type')?.includes('application/json')) {
    try {
      raw = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }
  }
  const parsed = supplierReturnApproveSchema.safeParse(raw ?? {})
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
  }

  try {
    const data = await approveSupplierReturn({ id: Number(id), userId: gate.userId, prices: parsed.data.prices })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    const known = supplierReturnErrorResponse(error)
    if (known) return NextResponse.json({ error: known.error }, { status: known.status })
    console.error('POST /api/bo/supplier-returns/[id]/approve error:', error)
    return NextResponse.json({ error: 'Gagal menyetujui retur supplier' }, { status: 500 })
  }
}
