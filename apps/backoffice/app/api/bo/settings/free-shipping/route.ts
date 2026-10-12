import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { FreeShippingSettingError, getFreeShippingValue, setFreeShippingValue } from '@/lib/ongkir-server'

export const dynamic = 'force-dynamic'

// Pengaturan nilai gratis ongkir — Owner/GM (izin yang sama dengan daftar Groomer & Pengantar).
const schema = z.object({ value: z.number().int('Nilai harus angka rupiah bulat') })

export async function GET() {
  const gate = await requirePermission('grooming.groomer.manage')
  if (gate instanceof NextResponse) return gate
  return NextResponse.json({ value: await getFreeShippingValue() })
}

export async function PUT(req: NextRequest) {
  try {
    const gate = await requirePermission('grooming.groomer.manage')
    if (gate instanceof NextResponse) return gate
    const data = await parseJsonBody(req, schema)
    if (data instanceof NextResponse) return data
    const value = await setFreeShippingValue(data.value, { userId: gate.userId, branchId: gate.branchId })
    return NextResponse.json({ value })
  } catch (error) {
    if (error instanceof FreeShippingSettingError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error('PUT /api/bo/settings/free-shipping error:', error)
    return NextResponse.json({ error: 'Gagal menyimpan nilai gratis ongkir' }, { status: 500 })
  }
}
