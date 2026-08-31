import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import {
  and,
  db,
  eq,
  products,
  stockOpnameItems,
  stockOpnames,
  unitsOfMeasure,
} from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { buildSOExportCsv, type SOExportRow } from '@/lib/so-review-csv'
import { getSOFullCandidates } from '@/lib/services/stock-opname-candidates'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await requirePermission('stock_opname.read')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const { id } = await params
    const parsed = paramsSchema.safeParse({ id })
    if (!parsed.success) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const soId = Number(parsed.data.id)

    const [header] = await db
      .select({
        soNumber: stockOpnames.soNumber,
        branchId: stockOpnames.branchId,
        type: stockOpnames.type,
      })
      .from(stockOpnames)
      .where(eq(stockOpnames.id, soId))
      .limit(1)

    if (!header) {
      return NextResponse.json({ error: 'Stock opname tidak ditemukan' }, { status: 404 })
    }

    if (payload.branchScope !== 'ALL' && payload.branchId !== header.branchId) {
      return NextResponse.json(
        { error: 'Anda hanya dapat mengekspor stock opname cabang sendiri' },
        { status: 403 },
      )
    }

    let rows: SOExportRow[]

    if (header.type === 'FULL') {
      // SO Besar: seluruh cakupan produk — termasuk yang belum dihitung.
      const result = await getSOFullCandidates(soId)
      rows = (result?.items ?? []).map((item) => ({
        productName: item.productName,
        sku: item.sku,
        uomCode: item.uomCode,
        systemQty: item.systemQty,
        physicalQty: item.physicalQty,
        varianceQty: item.varianceQty,
        varianceCostValue: item.varianceCostValue,
        varianceReason: item.varianceReason,
        itemStatus: item.itemStatus,
        isRecounted: item.isRecounted,
        recountPhysicalQty: item.recountPhysicalQty,
        recountVarianceQty: item.recountVarianceQty,
        decisionNote: item.decisionNote,
        counted: item.soItemId !== null,
      }))
    } else {
      // SO Harian: item dibuat sekaligus dengan headernya, jadi tabel item sudah lengkap.
      const items = await db
        .select({
          productName: products.name,
          sku: products.sku,
          uomCode: unitsOfMeasure.code,
          systemQty: stockOpnameItems.systemQty,
          physicalQty: stockOpnameItems.physicalQty,
          varianceQty: stockOpnameItems.varianceQty,
          varianceCostValue: stockOpnameItems.varianceCostValue,
          varianceReason: stockOpnameItems.varianceReason,
          itemStatus: stockOpnameItems.itemStatus,
          isRecounted: stockOpnameItems.isRecounted,
          recountPhysicalQty: stockOpnameItems.recountPhysicalQty,
          recountVarianceQty: stockOpnameItems.recountVarianceQty,
          decisionNote: stockOpnameItems.decisionNote,
        })
        .from(stockOpnameItems)
        .innerJoin(products, eq(stockOpnameItems.productId, products.id))
        .innerJoin(unitsOfMeasure, eq(stockOpnameItems.uomId, unitsOfMeasure.id))
        .where(and(eq(stockOpnameItems.soId, soId)))

      rows = items.map((item) => ({ ...item, counted: true }))
    }

    const csv = buildSOExportCsv(rows)

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${header.soNumber}-item.csv"`,
      },
    })
  } catch (error) {
    console.error('GET /api/bo/stock-opnames/[id]/export error:', error)
    return NextResponse.json(
      { error: 'Gagal mengekspor detail stock opname' },
      { status: 500 },
    )
  }
}
