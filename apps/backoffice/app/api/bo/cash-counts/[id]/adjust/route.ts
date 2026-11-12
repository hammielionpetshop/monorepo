import { NextResponse } from 'next/server'
import { z } from 'zod'
import { adjustCashCount } from '@/lib/services/cash-count-service'
import { cashCountActorOf, cashCountErrorResponse, requireCashCountManager } from '@/lib/services/cash-count-access'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  direction: z.enum(['SHORT', 'OVER'], { message: 'Pilih Kurang atau Lebih' }),
  amount: z
    .number({ message: 'Jumlah wajib diisi' })
    .int('Jumlah harus angka bulat')
    .positive('Jumlah harus lebih dari 0')
    .max(2_000_000_000, 'Jumlah terlalu besar'),
  reason: z.string({ message: 'Alasan wajib diisi' }).trim().min(3, 'Alasan penyesuaian wajib diisi (minimal 3 huruf)').max(200),
})

/** Catat penyesuaian (Owner/GM): Arus Kas "Selisih kas kurang/lebih" bertanggal hitungan. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCashCountManager()
  if (gate instanceof NextResponse) return gate
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Hitungan tidak valid' }, { status: 400 })
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    return NextResponse.json(await adjustCashCount(id, parsed.data, cashCountActorOf(gate)), { status: 201 })
  } catch (error) {
    return cashCountErrorResponse(error, 'POST /api/bo/cash-counts/[id]/adjust', 'Gagal menyimpan penyesuaian')
  }
}
