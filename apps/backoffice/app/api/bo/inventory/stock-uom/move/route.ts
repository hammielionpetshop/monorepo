import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// DINONAKTIFKAN SEMENTARA (2026-08-22): implementasi lama salah mengasumsikan
// qtyReceived/qtyRemaining/costPrice batch dalam satuan `fromUomId`. Faktanya kolom itu
// SELALU dalam satuan dasar produk (lihat StockService.addStock) -- uomId batch cuma
// jejak audit satuan pembelian, bukan penanda satuan penyimpanan qty. Endpoint ini jadi
// mengonversi dobel (persis bug lama "batch 25 SAK tampil 625" di project-batch-qty-base-uom).
// Jangan aktifkan lagi sebelum di-redesign: rasio harus diterapkan ke SEMUA batch
// produk+cabang (bukan cuma yang uomId-nya = fromUomId), dan uomId batch tidak boleh
// diubah sama sekali. Kode lama dihapus dari sini, cari di riwayat git commit sebelum ini.
export async function POST() {
  return NextResponse.json(
    { error: 'Fitur pindah satuan sedang diperbaiki, sementara tidak bisa dipakai' },
    { status: 503 }
  )
}

/* Implementasi lama (SALAH — jangan aktifkan lagi tanpa redesign, lihat catatan di atas POST):

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

*/
