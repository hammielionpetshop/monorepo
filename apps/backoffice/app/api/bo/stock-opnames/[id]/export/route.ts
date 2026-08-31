import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import {
  and,
  branches,
  db,
  eq,
  products,
  stockOpnameItems,
  stockOpnames,
  unitsOfMeasure,
} from '@/lib/db'
import { requirePermission } from '@/lib/authz'
import { buildSOReviewCsv } from '@/lib/so-review-csv'

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

    const soRows = await db
      .select({
        soNumber: stockOpnames.soNumber,
        branchId: stockOpnames.branchId,
      })
      .from(stockOpnames)
      .innerJoin(branches, eq(stockOpnames.branchId, branches.id))
      .where(eq(stockOpnames.id, soId))
      .limit(1)

    if (soRows.length === 0) {
      return NextResponse.json({ error: 'Stock opname tidak ditemukan' }, { status: 404 })
    }
    const header = soRows[0]

    if (payload.branchScope !== 'ALL' && payload.branchId !== header.branchId) {
      return NextResponse.json(
        { error: 'Anda hanya dapat mengekspor stock opname cabang sendiri' },
        { status: 403 },
      )
    }

    const items = await db
      .select({
        id: stockOpnameItems.id,
        productId: stockOpnameItems.productId,
        productName: products.name,
        uomId: stockOpnameItems.uomId,
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

    const csv = buildSOReviewCsv(items)

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${header.soNumber}-review.csv"`,
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
