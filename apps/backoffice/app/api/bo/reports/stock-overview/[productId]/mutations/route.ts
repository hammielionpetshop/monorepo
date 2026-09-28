import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { getStockMutationSummary } from '@/lib/services/stock-mutation-summary'

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
    branchId: z.coerce.number().int().positive().optional(),
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
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Parameter tidak valid' }, { status: 400 })
  }

  try {
    const summary = await getStockMutationSummary({
      productId: Number(productId),
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      branchId: gate.branchScope === 'ALL' ? parsed.data.branchId : gate.branchId,
    })

    if (!summary) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(summary)
  } catch (error: unknown) {
    console.error('GET /api/bo/reports/stock-overview/[productId]/mutations error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil ringkasan mutasi stok' }, { status: 500 })
  }
}
