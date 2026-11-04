import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth } from '@/lib/authz'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { DELIVERY_REASON_MAX, DeliveryMethodError } from '@/lib/delivery-method'
import { changeTransferDeliveryMethod, listDeliveryMethodChanges } from '@/lib/delivery-method-server'

export const dynamic = 'force-dynamic'

const schema = z.object({
  deliveryMethod: z.string().min(1, 'Pilih cara kirim'),
  reason: z.string().trim().min(1, 'Alasan wajib diisi').max(DELIVERY_REASON_MAX, 'Alasan terlalu panjang'),
})

async function transferId(params: Promise<{ id: string }>) {
  const id = Number((await params).id)
  return Number.isInteger(id) && id > 0 ? id : null
}

// Riwayat ubah cara kirim PO Internal.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuth()
    if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    const id = await transferId(params)
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    const rows = await listDeliveryMethodChanges('INTERNAL_TRANSFER', id)
    return NextResponse.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })))
  } catch (error) {
    console.error('GET /api/bo/internal-transfers/[id]/delivery-method error:', error)
    return NextResponse.json({ error: 'Gagal membaca riwayat cara kirim' }, { status: 500 })
  }
}

// Ubah cara kirim PO Internal yang sudah dikirim (jalan keluar salah tandai).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getAuth()
    if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    const data = await parseJsonBody(req, schema)
    if (data instanceof NextResponse) return data
    const id = await transferId(params)
    if (!id) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    const result = await changeTransferDeliveryMethod(payload, { transferId: id, newMethod: data.deliveryMethod, reason: data.reason })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof DeliveryMethodError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('PATCH /api/bo/internal-transfers/[id]/delivery-method error:', error)
    return NextResponse.json({ error: 'Gagal mengubah cara kirim PO Internal' }, { status: 500 })
  }
}
