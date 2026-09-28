import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { STOCK_LEDGER_MOVEMENT_TYPES } from '@/lib/services/stock-ledger'
import { getStockMutationTimeline } from '@/lib/services/stock-mutation-summary'

export const dynamic = 'force-dynamic'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const isoDate = z
  .string()
  .regex(ISO_DATE_RE, 'Format tanggal harus YYYY-MM-DD')
  .refine((v) => !isNaN(new Date(v).getTime()), 'Tanggal tidak valid')

const querySchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate,
    branchId: z.coerce.number().int().positive({ message: 'Cabang wajib dipilih' }),
    mode: z.enum(['transaction', 'daily']).default('transaction'),
    types: z
      .string()
      .optional()
      .transform((v) => (v ? v.split(',').filter(Boolean) : []))
      .pipe(z.array(z.enum(STOCK_LEDGER_MOVEMENT_TYPES))),
    cursor: z.coerce.number().int().nonnegative().optional(),
  })
  .refine((d) => d.startDate <= d.endDate, { message: 'Tanggal mulai tidak boleh melewati tanggal akhir' })

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  const gate = await requirePermission('report.stock_overview.view')
  if (gate instanceof NextResponse) return gate

  const { productId } = await params
  if (!/^\d+$/.test(productId)) {
    return NextResponse.json({ error: 'ID produk tidak valid' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const parsed = querySchema.safeParse({
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
    branchId: searchParams.get('branchId') ?? undefined,
    mode: searchParams.get('mode') ?? undefined,
    types: searchParams.get('types') ?? undefined,
    cursor: searchParams.get('cursor') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Parameter tidak valid' }, { status: 400 })
  }

  if (gate.branchScope !== 'ALL' && parsed.data.branchId !== gate.branchId) {
    return NextResponse.json({ error: 'Anda hanya dapat melihat mutasi cabang sendiri' }, { status: 403 })
  }

  try {
    const timeline = await getStockMutationTimeline({
      productId: Number(productId),
      ...parsed.data,
    })

    if (!timeline) {
      return NextResponse.json({ error: 'Produk atau cabang tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(timeline)
  } catch (error: unknown) {
    console.error('GET /api/bo/reports/stock-overview/[productId]/mutations/timeline error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil timeline mutasi stok' }, { status: 500 })
  }
}
