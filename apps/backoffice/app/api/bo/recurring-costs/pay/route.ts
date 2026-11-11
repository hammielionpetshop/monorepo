import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth, hasPermission } from '@/lib/authz'
import { proofPhotoUrlSchema } from '@/lib/proof-photo'
import { payRecurringCost } from '@/lib/services/recurring-cost-service'
import { MONTH_RE, costActorOf, recurringCostErrorResponse } from '@/lib/recurring-cost-access'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  recurringCostId: z.number().int().positive(),
  fromMonth: z.string().regex(MONTH_RE, 'Bulan tagihan tidak valid'),
  toMonth: z.string().regex(MONTH_RE, 'Bulan tagihan tidak valid'),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal uang tidak valid'),
  moneyPlaceId: z.number({ message: 'Pilih "Dibayar dari" (Tempat Uang)' }).int().positive('Pilih "Dibayar dari" (Tempat Uang)'),
  amount: z.number({ message: 'Jumlah dibayar wajib diisi' }).int('Jumlah harus angka bulat').positive('Jumlah harus lebih dari 0'),
  differenceReason: z.string().trim().max(200, 'Alasan maksimal 200 karakter').nullable().optional(),
  proofPhotoUrl: proofPhotoUrlSchema,
})

/** Sudah dibayar: satu bulan atau beberapa bulan berurutan sekaligus. */
export async function POST(req: Request) {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  if (!hasPermission(payload, 'cashflow.record')) {
    return NextResponse.json({ error: 'Hanya Owner, GM, dan Finance yang boleh membayar Biaya Rutin' }, { status: 403 })
  }
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    const d = parsed.data
    const result = await payRecurringCost(
      { ...d, differenceReason: d.differenceReason?.trim() || null, proofPhotoUrl: d.proofPhotoUrl ?? null },
      costActorOf(payload),
    )
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return recurringCostErrorResponse(error, 'POST /api/bo/recurring-costs/pay', 'Gagal menyimpan pembayaran')
  }
}
