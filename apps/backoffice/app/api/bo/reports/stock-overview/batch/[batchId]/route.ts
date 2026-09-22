import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, productStockBatches, auditLogs, eq } from '@/lib/db'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  costPrice: z.number().int().min(0),
  reason: z.string().trim().min(1, 'Alasan koreksi wajib diisi'),
})

// Koreksi modal/unit satu batch secara langsung (bukan lewat alur FIFO stock-adjustment).
// Dipakai untuk membetulkan cost_price batch yang tercemar (lihat docs/audit-hpp-fase0) tanpa
// raw SQL manual ke produksi. Sengaja tidak menyentuh qtyRemaining — itu tetap lewat Stock
// Adjustment (menjaga aggregate product_stocks tetap sinkron).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const gate = await requirePermission('inventory.stock_batch.correct_cost')
  if (gate instanceof NextResponse) return gate
  const payload = gate

  const { batchId } = await params
  if (!/^\d+$/.test(batchId)) {
    return NextResponse.json({ error: 'ID batch tidak valid' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
  }
  const { costPrice, reason } = parsed.data

  try {
    const result = await db.transaction(async (trx) => {
      const [batch] = await trx
        .select()
        .from(productStockBatches)
        .where(eq(productStockBatches.id, Number(batchId)))
        .for('update')

      if (!batch) throw new Error('BATCH_NOT_FOUND')

      if (payload.branchScope !== 'ALL' && batch.branchId !== payload.branchId) {
        throw new Error('FORBIDDEN_BRANCH')
      }

      if (costPrice === batch.costPrice) {
        throw new Error('NO_CHANGE')
      }

      await trx
        .update(productStockBatches)
        .set({ costPrice })
        .where(eq(productStockBatches.id, batch.id))

      await trx.insert(auditLogs).values({
        branchId: batch.branchId,
        userId: payload.userId,
        action: 'STOCK_BATCH_CORRECT_COST',
        tableName: 'product_stock_batches',
        recordId: String(batch.id),
        oldData: JSON.stringify({ costPrice: batch.costPrice }),
        newData: JSON.stringify({ costPrice, reason }),
      })

      return { id: batch.id, costPrice }
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'BATCH_NOT_FOUND') {
        return NextResponse.json({ error: 'Batch tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'FORBIDDEN_BRANCH') {
        return NextResponse.json({ error: 'Tidak punya akses ke cabang batch ini' }, { status: 403 })
      }
      if (error.message === 'NO_CHANGE') {
        return NextResponse.json({ error: 'Tidak ada perubahan nilai' }, { status: 400 })
      }
    }
    console.error('PATCH /api/bo/reports/stock-overview/batch/[batchId] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengoreksi modal batch' }, { status: 500 })
  }
}
