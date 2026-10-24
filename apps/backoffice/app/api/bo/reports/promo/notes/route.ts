import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuth, scopeFilter } from '@/lib/authz'
import { transactions } from '@/lib/db'
import { wibDayStart } from '@/lib/grooming-order-http'
import { listPromoNotes } from '@/lib/services/promo-report-service'

export const dynamic = 'force-dynamic'

// Daftar nota di balik angka "Nota" laporan Promo (pop-up). Sama hak aksesnya dengan halaman
// Laporan Promo: hanya Owner & GM. Cabang dibatasi hak akses pengguna.
const ALLOWED_ROLES = ['OWNER', 'GM']

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const isoDate = z
  .string()
  .regex(ISO_DATE_RE, 'Format tanggal harus YYYY-MM-DD')
  .refine((v) => !isNaN(new Date(v).getTime()), 'Tanggal tidak valid')

const querySchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate,
    promotionId: z.coerce.number().int().positive().optional(),
    branchId: z.coerce.number().int().positive().optional(),
  })
  .refine((d) => d.startDate <= d.endDate, { message: 'Tanggal mulai tidak boleh melewati tanggal akhir' })

function shiftDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const payload = await getAuth()
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }
  if (!ALLOWED_ROLES.includes(payload.role)) {
    return NextResponse.json({ error: 'Laporan Promo hanya bisa dilihat Owner dan GM.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const parsed = querySchema.safeParse({
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
    promotionId: searchParams.get('promotionId') ?? undefined,
    branchId: searchParams.get('branchId') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Parameter tidak valid' }, { status: 400 })
  }

  const isGlobal = payload.branchScope === 'ALL'

  try {
    const notes = await listPromoNotes({
      branchScope: scopeFilter(payload, transactions.branchId),
      branchId: isGlobal ? parsed.data.branchId : payload.branchId,
      promotionId: parsed.data.promotionId,
      from: wibDayStart(parsed.data.startDate) as Date,
      to: wibDayStart(shiftDays(parsed.data.endDate, 1)) as Date,
    })
    return NextResponse.json(notes)
  } catch (error: unknown) {
    console.error('GET /api/bo/reports/promo/notes error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil daftar nota promo' }, { status: 500 })
  }
}
