import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Big from 'big.js'
import { requirePermission } from '@/lib/authz'
import { db, products, unitsOfMeasure, productStocks, productStockBatches, auditLogs, eq, and } from '@/lib/db'

export const dynamic = 'force-dynamic'

const moveSchema = z.object({
  productId: z.number().int().positive(),
  branchId: z.number().int().positive(),
  fromUomId: z.number().int().positive(),
  toUomId: z.number().int().positive(),
  // "1 satuan lama = ratio x satuan baru" — mis. 1 SAK = 12 PCS -> ratio 12.
  ratio: z.number().int().positive('Rasio konversi wajib diisi, minimal 1'),
}).refine((d) => d.fromUomId !== d.toUomId, {
  message: 'Satuan tujuan harus berbeda dari satuan asal',
  path: ['toUomId'],
})

// Memindahkan baris product_stocks + product_stock_batches dari satu satuan ke satuan
// lain untuk produk+cabang yang sama, dengan mengonversi qty & cost price memakai rasio
// yang diinput manual. Dipakai saat satuan dasar produk pernah salah diset (mis. SAK
// alih-alih PCS) sehingga stok nyata masih tersimpan di satuan lama — beda dari
// row/route.ts yang hanya menghapus baris yang SUDAH kosong (qty = 0).
//
// Rasio diinput manual, bukan dibaca dari product_uom_conversions, karena tabel itu
// hanya bisa menyatakan "1 uom = ratio x base" (ratio integer >= 1) relatif ke base
// SAAT INI. Kalau base saat ini justru satuan besar yang salah (SAK), tidak ada baris
// yang bisa menyatakan "1 PCS = 1/12 SAK" — makanya baris konversinya sendiri tidak
// pernah ada untuk kasus ini.
export async function POST(req: NextRequest) {
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

    const parsed = moveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }
    const { productId, branchId, fromUomId, toUomId, ratio } = parsed.data

    const result = await db.transaction(async (trx) => {
      const productRows = await trx.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1)
      if (productRows.length === 0) throw new Error('PRODUCT_NOT_FOUND')

      const toUomRows = await trx.select({ id: unitsOfMeasure.id }).from(unitsOfMeasure).where(eq(unitsOfMeasure.id, toUomId)).limit(1)
      if (toUomRows.length === 0) throw new Error('UOM_NOT_FOUND')

      // product_stocks hanya punya SATU baris per (productId, branchId) — apa pun uomId-nya
      // (unique index tak menyertakan uomId). Kalau baris itu bukan di fromUomId, bukan berarti
      // data basi: cabang ini memang tidak punya komponen stok di satuan asal (mis. hanya batch
      // yatim yang tersisa di satuan lama) — cukup lewati update stok, tetap proses batch-nya.
      const stockRows = await trx
        .select({ id: productStocks.id, uomId: productStocks.uomId, qty: productStocks.qty })
        .from(productStocks)
        .where(and(eq(productStocks.productId, productId), eq(productStocks.branchId, branchId)))
        .for('update')

      const stockAtFromUom = stockRows.find((r) => r.uomId === fromUomId) ?? null

      const batchRows = await trx
        .select({ id: productStockBatches.id, qtyReceived: productStockBatches.qtyReceived, qtyRemaining: productStockBatches.qtyRemaining, costPrice: productStockBatches.costPrice })
        .from(productStockBatches)
        .where(and(
          eq(productStockBatches.productId, productId),
          eq(productStockBatches.branchId, branchId),
          eq(productStockBatches.uomId, fromUomId),
        ))
        .for('update')

      if (stockAtFromUom === null && batchRows.length === 0) {
        throw new Error('NOTHING_TO_MOVE')
      }

      let movedQty = '0'
      if (stockAtFromUom !== null) {
        const oldQty = new Big(stockAtFromUom.qty)
        const newQty = oldQty.times(ratio)
        movedQty = newQty.toString()
        await trx.update(productStocks)
          .set({ uomId: toUomId, qty: Math.round(newQty.toNumber()) })
          .where(eq(productStocks.id, stockAtFromUom.id))
      }

      for (const batch of batchRows) {
        const newQtyReceived = new Big(batch.qtyReceived).times(ratio)
        const newQtyRemaining = new Big(batch.qtyRemaining).times(ratio)
        const newCostPrice = new Big(batch.costPrice).div(ratio)
        await trx.update(productStockBatches)
          .set({
            uomId: toUomId,
            qtyReceived: Math.round(newQtyReceived.toNumber()),
            qtyRemaining: Math.round(newQtyRemaining.toNumber()),
            costPrice: Math.round(newCostPrice.toNumber()),
          })
          .where(eq(productStockBatches.id, batch.id))
      }

      await trx.insert(auditLogs).values({
        branchId,
        userId: payload.userId,
        action: 'STOCK_UOM_MOVE',
        tableName: 'product_stocks',
        recordId: String(productId),
        oldData: JSON.stringify({ fromUomId, stockQty: stockAtFromUom?.qty ?? 0, batches: batchRows.length }),
        newData: JSON.stringify({ toUomId, ratio, movedQty }),
      })

      return { movedStock: stockAtFromUom !== null, movedBatches: batchRows.length }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'PRODUCT_NOT_FOUND') {
        return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'UOM_NOT_FOUND') {
        return NextResponse.json({ error: 'Satuan tujuan tidak ditemukan' }, { status: 400 })
      }
      if (error.message === 'NOTHING_TO_MOVE') {
        return NextResponse.json({ error: 'Tidak ada stok/batch pada satuan asal untuk dipindahkan' }, { status: 404 })
      }
    }
    console.error('POST /api/bo/inventory/stock-uom/move error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat memindahkan stok' }, { status: 500 })
  }
}
