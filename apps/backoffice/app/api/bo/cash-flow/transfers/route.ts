import { NextRequest, NextResponse } from 'next/server'
import { closedMonthMessage } from '@/lib/db-errors'
import { z } from 'zod'
import { getAuth, hasPermission } from '@/lib/authz'
import { proofPhotoUrlSchema } from '@/lib/proof-photo'
import { MoneyTransferError, createMoneyTransfer, listMoneyTransfers } from '@/lib/services/money-transfer-service'

export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const createSchema = z.object({
  fromMoneyPlaceId: z.number({ message: 'Pilih Tempat Uang asal' }).int().positive('Pilih Tempat Uang asal'),
  toMoneyPlaceId: z.number({ message: 'Pilih Tempat Uang tujuan' }).int().positive('Pilih Tempat Uang tujuan'),
  amount: z.number({ message: 'Jumlah wajib diisi' }).int('Jumlah harus angka bulat').positive('Jumlah harus lebih dari 0'),
  occurredOn: z.string().regex(DATE_RE, 'Tanggal uang tidak valid'),
  note: z.string().trim().max(255, 'Catatan maksimal 255 karakter').optional(),
  proofPhotoUrl: proofPhotoUrlSchema,
})

function actorOf(payload: NonNullable<Awaited<ReturnType<typeof getAuth>>>) {
  return {
    userId: payload.userId,
    isOwner: payload.role === 'OWNER',
    canCancelAny: hasPermission(payload, 'cashflow.cancel'),
  }
}

export async function GET(req: NextRequest) {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  if (!hasPermission(payload, 'cashflow.record') && !hasPermission(payload, 'cashflow.cancel')) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }
  try {
    const p = req.nextUrl.searchParams
    const from = p.get('from')
    const to = p.get('to')
    const rows = await listMoneyTransfers(
      {
        from: from && DATE_RE.test(from) ? from : undefined,
        to: to && DATE_RE.test(to) ? to : undefined,
        includeCancelled: p.get('includeCancelled') === '1',
      },
      actorOf(payload),
    )
    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET /api/bo/cash-flow/transfers error:', error)
    return NextResponse.json({ error: 'Gagal mengambil daftar Pindah Dana' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  if (!hasPermission(payload, 'cashflow.record')) {
    return NextResponse.json({ error: 'Hanya Owner, GM, dan Finance yang boleh mencatat Pindah Dana' }, { status: 403 })
  }
  try {
    const parsed = createSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    const d = parsed.data
    const created = await createMoneyTransfer(
      {
        fromMoneyPlaceId: d.fromMoneyPlaceId,
        toMoneyPlaceId: d.toMoneyPlaceId,
        amount: d.amount,
        occurredOn: d.occurredOn,
        note: d.note?.trim() ? d.note.trim() : null,
        proofPhotoUrl: d.proofPhotoUrl ?? null,
      },
      actorOf(payload),
    )
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    const closedMonth = closedMonthMessage(error)
    if (closedMonth) return NextResponse.json({ error: closedMonth }, { status: 409 })
    if (error instanceof MoneyTransferError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('POST /api/bo/cash-flow/transfers error:', error)
    return NextResponse.json({ error: 'Gagal menyimpan Pindah Dana' }, { status: 500 })
  }
}
