import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth } from '@/lib/authz'
import { parseJsonBody } from '@/lib/grooming-master-http'
import { CASHIER_VARIANCE_SETTINGS_ROLES } from '@/lib/cashier-variance'
import {
  CashierVarianceSettingError,
  setCashierVarianceSettings,
} from '@/lib/services/cashier-variance-service'

export const dynamic = 'force-dynamic'

const schema = z.object({
  tolerance: z.number().int('Batas toleransi harus rupiah bulat'),
  anomalyThreshold: z.number().int('Batas tak wajar harus rupiah bulat'),
})

export async function PUT(req: NextRequest) {
  try {
    const payload = await getAuth()
    if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    if (!CASHIER_VARIANCE_SETTINGS_ROLES.includes(payload.role)) {
      return NextResponse.json({ error: 'Hanya Owner dan GM yang boleh mengubah toleransi' }, { status: 403 })
    }
    const data = await parseJsonBody(req, schema)
    if (data instanceof NextResponse) return data
    const settings = await setCashierVarianceSettings(data, { userId: payload.userId, branchId: payload.branchId })
    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof CashierVarianceSettingError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error('PUT /api/bo/cashier-variance/settings error:', error)
    return NextResponse.json({ error: 'Gagal menyimpan pengaturan toleransi' }, { status: 500 })
  }
}
