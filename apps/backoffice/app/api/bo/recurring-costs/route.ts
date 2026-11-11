import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth } from '@/lib/authz'
import { createRecurringCost, listRecurringCosts, recentTemporaryRent } from '@/lib/services/recurring-cost-service'
import {
  canManageRecurringCosts, canViewRecurringCosts, costActorOf, costSchema, recurringCostErrorResponse,
} from '@/lib/recurring-cost-access'

export const dynamic = 'force-dynamic'

const createSchema = costSchema.extend({
  amount: z.number({ message: 'Jumlah per bulan wajib diisi' }).int('Jumlah harus angka bulat').positive('Jumlah harus lebih dari 0'),
})

export async function GET() {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  if (!canViewRecurringCosts(payload)) return NextResponse.json({ error: 'Biaya Rutin hanya untuk Owner, GM, dan Finance' }, { status: 403 })
  try {
    const [data, temporaryRent] = await Promise.all([listRecurringCosts(costActorOf(payload)), recentTemporaryRent()])
    return NextResponse.json({ ...data, temporaryRent })
  } catch (error) {
    return recurringCostErrorResponse(error, 'GET /api/bo/recurring-costs', 'Gagal mengambil Biaya Rutin')
  }
}

export async function POST(req: Request) {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  if (!canManageRecurringCosts(payload)) return NextResponse.json({ error: 'Hanya Owner dan GM yang boleh mengatur Biaya Rutin' }, { status: 403 })
  try {
    const parsed = createSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    const d = parsed.data
    const created = await createRecurringCost({ ...d, note: d.note?.trim() || null }, costActorOf(payload))
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return recurringCostErrorResponse(error, 'POST /api/bo/recurring-costs', 'Gagal menyimpan Biaya Rutin')
  }
}
