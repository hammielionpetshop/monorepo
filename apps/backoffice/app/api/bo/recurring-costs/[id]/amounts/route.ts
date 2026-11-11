import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth } from '@/lib/authz'
import { changeRecurringCostAmount } from '@/lib/services/recurring-cost-service'
import { MONTH_RE, canManageRecurringCosts, costActorOf, recurringCostErrorResponse } from '@/lib/recurring-cost-access'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  effectiveMonth: z.string().regex(MONTH_RE, 'Bulan berlaku tidak valid'),
  amount: z.number({ message: 'Jumlah wajib diisi' }).int('Jumlah harus angka bulat').positive('Jumlah harus lebih dari 0'),
})

/** Ubah jumlah mulai bulan X (tagihan bulan sebelumnya tidak berubah). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  if (!canManageRecurringCosts(payload)) return NextResponse.json({ error: 'Hanya Owner dan GM yang boleh mengatur Biaya Rutin' }, { status: 403 })
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    await changeRecurringCostAmount(id, parsed.data, costActorOf(payload))
    return NextResponse.json({ success: true })
  } catch (error) {
    return recurringCostErrorResponse(error, 'POST /api/bo/recurring-costs/[id]/amounts', 'Gagal mengubah jumlah')
  }
}
