import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requirePermission } from '@/lib/authz'
import {
  getStockOpnameItems,
  getStockOpnameReport,
} from '@/lib/services/stock-opname-report'
import { validateStockOpnameExportDate } from '@/lib/stock-opname-export-date'
import { CATEGORY_LABELS, METHOD_LABELS, STATUS_LABELS, TYPE_LABELS } from '@/lib/stock-opname-labels'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  mode: z.enum(['recap', 'mismatch', 'detail']).default('recap'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal mulai tidak valid'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal selesai tidak valid'),
  branchId: z.string().regex(/^\d+$/, 'ID cabang tidak valid').optional(),
  status: z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED']).optional(),
})

function escapeCsvCell(val: string): string {
  const sanitized =
    val.startsWith('=') || val.startsWith('+') || val.startsWith('-') || val.startsWith('@')
      ? `'${val}`
      : val
  return `"${sanitized.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
}

function csvResponse(rows: (string | number)[][], filename: string) {
  const csv = rows.map((row) => row.map((cell) => escapeCsvCell(String(cell))).join(',')).join('\r\n')
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requirePermission('stock_opname.read')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const { searchParams } = new URL(req.url)
    const parsed = querySchema.safeParse({
      mode: searchParams.get('mode') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      branchId: searchParams.get('branchId') ?? undefined,
      status: searchParams.get('status') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Parameter tidak valid' },
        { status: 400 }
      )
    }

    const exportDateError = validateStockOpnameExportDate(parsed.data.startDate, parsed.data.endDate)
    if (exportDateError) {
      return NextResponse.json({ error: exportDateError }, { status: 400 })
    }

    const requestedBranchId = parsed.data.branchId ? Number(parsed.data.branchId) : null
    if (payload.branchScope !== 'ALL' && requestedBranchId !== null && requestedBranchId !== payload.branchId) {
      return NextResponse.json(
        { error: 'Anda hanya dapat mengekspor stock opname cabang sendiri' },
        { status: 403 }
      )
    }
    const branchId = payload.branchScope === 'ALL' ? requestedBranchId : payload.branchId

    const filter = {
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      branchId,
      status: parsed.data.status ?? null,
    }
    const period = `${parsed.data.startDate}-sd-${parsed.data.endDate}`

    if (parsed.data.mode === 'mismatch' || parsed.data.mode === 'detail') {
      const onlyMismatch = parsed.data.mode === 'mismatch'
      const items = await getStockOpnameItems(filter, { onlyMismatch })
      const rows: (string | number)[][] = [
        [
          'nomor so',
          'tanggal',
          'cabang',
          'status so',
          'nama produk',
          'sku',
          'satuan',
          'qty system',
          'real stock',
          'selisih',
          'nilai selisih',
          'kategori',
          'alasan',
        ],
        ...items.map((item) => [
          item.soNumber,
          new Date(item.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }),
          item.branchName,
          STATUS_LABELS[item.soStatus] ?? item.soStatus,
          item.productName,
          item.sku ?? '',
          item.uomCode,
          item.systemQty,
          item.physicalQty,
          item.varianceQty,
          item.soStatus === 'APPROVED' ? item.varianceCostValue ?? 0 : '',
          item.varianceCategory ? CATEGORY_LABELS[item.varianceCategory] ?? item.varianceCategory : '',
          item.varianceReason ?? '',
        ]),
      ]
      const filename = onlyMismatch
        ? `so-produk-tidak-match-${period}.csv`
        : `so-detail-item-${period}.csv`
      return csvResponse(rows, filename)
    }

    const report = await getStockOpnameReport(filter)
    const rows: (string | number)[][] = [
      [
        'nomor so',
        'tanggal',
        'cabang',
        'tipe',
        'metode',
        'status',
        'penghitung',
        'penyetuju',
        'item dihitung',
        'item tidak match',
        'akurasi %',
        'nilai selisih minus',
        'nilai selisih plus',
      ],
      ...report.rows.map((row) => [
        row.soNumber,
        new Date(row.createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }),
        row.branchName,
        TYPE_LABELS[row.type] ?? row.type,
        row.method ? METHOD_LABELS[row.method] ?? row.method : '',
        STATUS_LABELS[row.status] ?? row.status,
        row.createdByName,
        row.decidedByName ?? '',
        row.itemCount,
        row.mismatchCount,
        row.accuracyPct,
        row.status === 'APPROVED' ? row.minusValue : '',
        row.status === 'APPROVED' ? row.plusValue : '',
      ]),
    ]
    return csvResponse(rows, `rekap-stock-opname-${period}.csv`)
  } catch (error: unknown) {
    console.error('Export SO Report API error:', error)
    return NextResponse.json({ error: 'Gagal mengekspor laporan stock opname' }, { status: 500 })
  }
}
