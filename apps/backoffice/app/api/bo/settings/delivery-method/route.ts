import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth } from '@/lib/authz'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { getDeliverySettings, setDeliverySettings } from '@/lib/delivery-method-server'

export const dynamic = 'force-dynamic'

// Saklar "Wajib pilih cara kirim" + cabang yang tombol Truk Gudang-nya paling depan. Owner/GM saja.
const schema = z.object({
  required: z.boolean(),
  truckFirstBranchIds: z.array(z.number().int().positive()).max(100),
})

async function ownerOrGm() {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  if (!['OWNER', 'GM'].includes(payload.role)) return NextResponse.json({ error: 'Hanya Pemilik atau GM' }, { status: 403 })
  return payload
}

export async function GET() {
  try {
    const payload = await ownerOrGm()
    if (payload instanceof NextResponse) return payload
    return NextResponse.json(await getDeliverySettings())
  } catch (error) {
    console.error('GET /api/bo/settings/delivery-method error:', error)
    return NextResponse.json({ error: 'Gagal membaca pengaturan cara kirim' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const payload = await ownerOrGm()
    if (payload instanceof NextResponse) return payload
    const data = await parseJsonBody(req, schema)
    if (data instanceof NextResponse) return data
    return NextResponse.json(await setDeliverySettings(data, payload.userId))
  } catch (error) {
    console.error('PUT /api/bo/settings/delivery-method error:', error)
    return NextResponse.json({ error: 'Gagal menyimpan pengaturan cara kirim' }, { status: 500 })
  }
}
