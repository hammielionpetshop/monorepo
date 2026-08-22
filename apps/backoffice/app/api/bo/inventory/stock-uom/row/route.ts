import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, productStocks, productStockBatches, auditLogs, eq, and } from '@/lib/db'

export const dynamic = 'force-dynamic'

const deleteSchema = z.object({
  productId: z.number().int().positive(),
  branchId: z.number().int().positive(),
  uomId: z.number().int().positive(),
})

// Hapus baris product_stocks + product_stock_batches yang sudah kosong (qty = 0) pada
// satu kombinasi produk+cabang+satuan. Dipakai untuk membereskan sisa baris satuan lama
// yang memblokir ganti satuan dasar produk (lihat guard BASE_UOM_IN_USE di
// api/bo/master-data/products/[id]). Tidak pernah menghapus baris yang masih bermuatan —
// itu stok sungguhan, bukan sampah.
export async function DELETE(req: NextRequest) {
  try {
    const gate = await requirePermission('master.product.manage')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = deleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }
    const { productId, branchId, uomId } = parsed.data

    const result = await db.transaction(async (trx) => {
      const stockRows = await trx
        .select({ id: productStocks.id, qty: productStocks.qty })
        .from(productStocks)
        .where(and(
          eq(productStocks.productId, productId),
          eq(productStocks.branchId, branchId),
          eq(productStocks.uomId, uomId),
        ))
        .for('update')

      const batchRows = await trx
        .select({ id: productStockBatches.id, qtyRemaining: productStockBatches.qtyRemaining })
        .from(productStockBatches)
        .where(and(
          eq(productStockBatches.productId, productId),
          eq(productStockBatches.branchId, branchId),
          eq(productStockBatches.uomId, uomId),
        ))
        .for('update')

      if (stockRows.length === 0 && batchRows.length === 0) {
        throw new Error('NOTHING_TO_DELETE')
      }

      const hasStock = stockRows.some((r) => r.qty !== 0)
      const hasBatch = batchRows.some((r) => r.qtyRemaining !== 0)
      if (hasStock || hasBatch) {
        throw new Error('NOT_EMPTY')
      }

      if (stockRows.length > 0) {
        await trx.delete(productStocks).where(and(
          eq(productStocks.productId, productId),
          eq(productStocks.branchId, branchId),
          eq(productStocks.uomId, uomId),
        ))
      }
      if (batchRows.length > 0) {
        await trx.delete(productStockBatches).where(and(
          eq(productStockBatches.productId, productId),
          eq(productStockBatches.branchId, branchId),
          eq(productStockBatches.uomId, uomId),
        ))
      }

      await trx.insert(auditLogs).values({
        branchId,
        userId: payload.userId,
        action: 'STOCK_UOM_ROW_DELETE',
        tableName: 'product_stocks',
        recordId: String(productId),
        oldData: JSON.stringify({ uomId, stockRows: stockRows.length, batchRows: batchRows.length }),
        newData: null,
      })

      return { deletedStock: stockRows.length, deletedBatches: batchRows.length }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'NOTHING_TO_DELETE') {
        return NextResponse.json({ error: 'Tidak ada baris stok/batch untuk kombinasi ini' }, { status: 404 })
      }
      if (error.message === 'NOT_EMPTY') {
        return NextResponse.json({ error: 'Masih ada stok pada satuan ini, tidak bisa dihapus' }, { status: 409 })
      }
    }
    console.error('DELETE /api/bo/inventory/stock-uom/row error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menghapus baris stok' }, { status: 500 })
  }
}
