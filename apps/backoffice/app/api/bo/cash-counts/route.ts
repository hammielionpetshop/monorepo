import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth } from '@/lib/authz'
import { proofPhotoUrlSchema } from '@/lib/proof-photo'
import { listCashCounts, listCountPlaces, recordCashCount } from '@/lib/services/cash-count-service'
import { canRecordCashCounts, cashCountActorOf, cashCountErrorResponse } from '@/lib/services/cash-count-access'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  moneyPlaceId: z.number({ message: 'Pilih Tempat Uang' }).int().positive('Pilih Tempat Uang'),
  countedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal hitung tidak valid'),
  amount: z
    .number({ message: 'Jumlah uang nyata wajib diisi' })
    .int('Jumlah harus angka bulat')
    .min(0, 'Jumlah tidak boleh minus')
    .max(2_000_000_000, 'Jumlah terlalu besar'),
  note: z.string().trim().max(255, 'Catatan maksimal 255 karakter').nullable().optional(),
  photoUrl: proofPhotoUrlSchema,
})

/** Daftar Tunai/Rekening + hitungan terakhir, dan riwayat satu bulan. Tidak memuat saldo sistem. */
export async function GET(req: Request) {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  if (!canRecordCashCounts(payload)) return NextResponse.json({ error: 'Hitung Kas hanya untuk Owner, GM, dan Finance' }, { status: 403 })
  const url = new URL(req.url)
  const month = url.searchParams.get('month') ?? ''
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: 'Bulan tidak valid' }, { status: 400 })
  const placeId = Number(url.searchParams.get('place') ?? '')
  try {
    const [places, counts] = await Promise.all([
      listCountPlaces(),
      listCashCounts({ month, moneyPlaceId: Number.isInteger(placeId) && placeId > 0 ? placeId : null }),
    ])
    return NextResponse.json({ places, counts })
  } catch (error) {
    return cashCountErrorResponse(error, 'GET /api/bo/cash-counts', 'Gagal memuat Hitung Kas')
  }
}

export async function POST(req: Request) {
  const payload = await getAuth()
  if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  if (!canRecordCashCounts(payload)) {
    return NextResponse.json({ error: 'Hanya Owner, GM, dan Finance yang boleh mencatat Hitung Kas' }, { status: 403 })
  }
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    const d = parsed.data
    const created = await recordCashCount(
      { moneyPlaceId: d.moneyPlaceId, countedOn: d.countedOn, amount: d.amount, note: d.note?.trim() || null, photoUrl: d.photoUrl ?? null },
      cashCountActorOf(payload),
    )
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return cashCountErrorResponse(error, 'POST /api/bo/cash-counts', 'Gagal menyimpan hitungan')
  }
}
