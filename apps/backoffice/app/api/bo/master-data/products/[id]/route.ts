import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import {
  db,
  products,
  unitsOfMeasure,
  productStocks,
  productStockBatches,
  productPrices,
  productUomCosts,
  productUomConversions,
  productBarcodes,
  transactionItems,
  purchaseOrderItems,
  interBranchTransferItems,
  stockAdjustments,
  stockAutoBreaks,
  stockOpnameItems,
  damagedGoodsItems,
  ownerPriceOverrides,
  returnItems,
  customerOrderItems,
  customerCartItems,
  eq,
  and,
  ne,
  gt,
  count,
} from '@/lib/db'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID produk tidak valid'),
})

const updateSchema = z.object({
  name: z.string().min(1, 'Nama produk wajib diisi').optional(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(),
  brandId: z.number().int().positive().optional().nullable(),
  baseUomId: z.number().int().positive().optional(),
  weightGram: z.union([z.string(), z.number()]).optional().nullable(),
  defaultCostPrice: z.number().int().nonnegative().optional().nullable(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePermission('master.product.manage')
    if (gate instanceof NextResponse) return gate

    const { id } = await params
    const paramParsed = paramsSchema.safeParse({ id })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID produk tidak valid' }, { status: 400 })
    }
    const productId = Number(paramParsed.data.id)

    const body = await req.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Data tidak valid'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const data = parsed.data

    const updated = await db.transaction(async (trx) => {
      // Cek produk ada
      const existing = await trx
        .select({ id: products.id, baseUomId: products.baseUomId })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1)

      if (existing.length === 0) {
        throw new Error('NOT_FOUND')
      }

      // Validasi baseUomId jika diubah
      if (data.baseUomId !== undefined) {
        const uom = await trx.select({ id: unitsOfMeasure.id }).from(unitsOfMeasure).where(eq(unitsOfMeasure.id, data.baseUomId)).limit(1)
        if (uom.length === 0) throw new Error('UOM dasar tidak ditemukan')
      }

      // Stok, batch, harga, dan modal selalu disimpan pada satuan dasar produk. Mengganti
      // satuan dasar saat data itu masih ada membuat semuanya yatim: stok tak lagi terbaca
      // (POS menampilkan 0) dan harga di satuan lama hilang dari POS sehingga produk tak
      // bisa dijual. Blokir perubahan sampai data satuan lama dibereskan.
      const oldBaseUomId = existing[0].baseUomId
      if (data.baseUomId !== undefined && data.baseUomId !== oldBaseUomId) {
        const [stockCount, batchCount, priceCount, costCount] = await Promise.all([
          trx.select({ n: count() }).from(productStocks).where(
            and(eq(productStocks.productId, productId), eq(productStocks.uomId, oldBaseUomId))
          ),
          trx.select({ n: count() }).from(productStockBatches).where(
            and(eq(productStockBatches.productId, productId), eq(productStockBatches.uomId, oldBaseUomId))
          ),
          trx.select({ n: count() }).from(productPrices).where(
            and(eq(productPrices.productId, productId), eq(productPrices.uomId, oldBaseUomId))
          ),
          trx.select({ n: count() }).from(productUomCosts).where(
            and(eq(productUomCosts.productId, productId), eq(productUomCosts.uomId, oldBaseUomId))
          ),
        ])

        const blockers: string[] = []
        if ((stockCount[0]?.n ?? 0) > 0) blockers.push(`${stockCount[0].n} baris stok`)
        if ((batchCount[0]?.n ?? 0) > 0) blockers.push(`${batchCount[0].n} batch stok`)
        if ((priceCount[0]?.n ?? 0) > 0) blockers.push(`${priceCount[0].n} harga`)
        if ((costCount[0]?.n ?? 0) > 0) blockers.push(`${costCount[0].n} harga modal`)

        if (blockers.length > 0) {
          const [oldUom] = await trx
            .select({ code: unitsOfMeasure.code })
            .from(unitsOfMeasure)
            .where(eq(unitsOfMeasure.id, oldBaseUomId))
            .limit(1)
          throw new Error(
            `BASE_UOM_IN_USE:Satuan dasar tidak bisa diubah — masih ada ${blockers.join(', ')} ` +
            `pada satuan lama (${oldUom?.code ?? oldBaseUomId}). Pindahkan atau hapus data tersebut dulu.`
          )
        }
      }

      // Cek uniqueness SKU saat update (exclude produk itu sendiri)
      if (data.sku) {
        const existingSku = await trx
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.sku, data.sku), ne(products.id, productId)))
          .limit(1)
        if (existingSku.length > 0) throw new Error('DUPLICATE_SKU')
      }

      // Cek uniqueness barcode saat update (exclude produk itu sendiri)
      if (data.barcode) {
        const existingBarcode = await trx
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.barcode, data.barcode), ne(products.id, productId)))
          .limit(1)
        if (existingBarcode.length > 0) throw new Error('DUPLICATE_BARCODE')
      }

      const updateData: {
        name?: string
        sku?: string | null
        barcode?: string | null
        categoryId?: number | null
        brandId?: number | null
        baseUomId?: number
        weightGram?: number | null
        defaultCostPrice?: number | null
        isActive?: boolean
        updatedAt: Date
      } = { updatedAt: new Date() }

      if (data.name !== undefined) updateData.name = data.name
      if (data.sku !== undefined) updateData.sku = data.sku
      if (data.barcode !== undefined) updateData.barcode = data.barcode
      if (data.categoryId !== undefined) updateData.categoryId = data.categoryId
      if (data.brandId !== undefined) updateData.brandId = data.brandId
      if (data.baseUomId !== undefined) updateData.baseUomId = data.baseUomId
      if (data.weightGram !== undefined) updateData.weightGram = data.weightGram != null ? Number(data.weightGram) : null
      if (data.defaultCostPrice !== undefined) updateData.defaultCostPrice = data.defaultCostPrice ?? null
      if (data.isActive !== undefined) updateData.isActive = data.isActive

      const result = await trx
        .update(products)
        .set(updateData)
        .where(eq(products.id, productId))
        .returning()

      if (result.length === 0) throw new Error('UPDATE_FAILED')
      return result
    })

    return NextResponse.json(updated[0])
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'DUPLICATE_SKU') {
        return NextResponse.json({ error: 'SKU sudah digunakan oleh produk lain' }, { status: 409 })
      }
      if (error.message === 'DUPLICATE_BARCODE') {
        return NextResponse.json({ error: 'Barcode sudah digunakan oleh produk lain' }, { status: 409 })
      }
      if (error.message === 'UPDATE_FAILED') {
        return NextResponse.json({ error: 'Gagal memperbarui produk' }, { status: 500 })
      }
      if (error.message.startsWith('BASE_UOM_IN_USE:')) {
        return NextResponse.json(
          { error: error.message.slice('BASE_UOM_IN_USE:'.length) },
          { status: 409 }
        )
      }
      if (
        error.message === 'UOM dasar tidak ditemukan' ||
        error.message === 'UOM yang dipilih bukan UOM dasar'
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }
    console.error('PATCH /api/bo/master-data/products/[id] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat memperbarui produk' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePermission('master.product.manage')
    if (gate instanceof NextResponse) return gate

    const { id } = await params
    const paramParsed = paramsSchema.safeParse({ id })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID produk tidak valid' }, { status: 400 })
    }
    const productId = Number(paramParsed.data.id)

    await db.transaction(async (trx) => {
      const existing = await trx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1)
      if (existing.length === 0) throw new Error('NOT_FOUND')

      // Guard: produk yang sudah pernah dipakai (stok, riwayat transaksi, PO, transfer antar
      // cabang, opname, kerusakan, retur, override harga, order portal) tidak boleh dihapus
      // permanen — histori transaksi kritis tidak boleh di-wipe. Arahkan ke "Nonaktifkan".
      const [
        stockRows,
        trxItemRows,
        poItemRows,
        ibtItemRows,
        batchRows,
        adjustmentRows,
        autoBreakRows,
        opnameItemRows,
        damagedItemRows,
        overrideRows,
        returnItemRows,
        orderItemRows,
      ] = await Promise.all([
        trx.select({ n: count() }).from(productStocks).where(and(eq(productStocks.productId, productId), gt(productStocks.qty, 0))),
        trx.select({ n: count() }).from(transactionItems).where(eq(transactionItems.productId, productId)),
        trx.select({ n: count() }).from(purchaseOrderItems).where(eq(purchaseOrderItems.productId, productId)),
        trx.select({ n: count() }).from(interBranchTransferItems).where(eq(interBranchTransferItems.productId, productId)),
        trx.select({ n: count() }).from(productStockBatches).where(eq(productStockBatches.productId, productId)),
        trx.select({ n: count() }).from(stockAdjustments).where(eq(stockAdjustments.productId, productId)),
        trx.select({ n: count() }).from(stockAutoBreaks).where(eq(stockAutoBreaks.productId, productId)),
        trx.select({ n: count() }).from(stockOpnameItems).where(eq(stockOpnameItems.productId, productId)),
        trx.select({ n: count() }).from(damagedGoodsItems).where(eq(damagedGoodsItems.productId, productId)),
        trx.select({ n: count() }).from(ownerPriceOverrides).where(eq(ownerPriceOverrides.productId, productId)),
        trx.select({ n: count() }).from(returnItems).where(eq(returnItems.productId, productId)),
        trx.select({ n: count() }).from(customerOrderItems).where(eq(customerOrderItems.productId, productId)),
      ])

      const blockers: string[] = []
      if ((stockRows[0]?.n ?? 0) > 0) blockers.push('masih memiliki stok')
      if ((trxItemRows[0]?.n ?? 0) > 0) blockers.push('pernah terjual (riwayat transaksi)')
      if ((poItemRows[0]?.n ?? 0) > 0) blockers.push('pernah dipesan lewat purchase order')
      if ((ibtItemRows[0]?.n ?? 0) > 0) blockers.push('pernah ditransfer antar cabang')
      if ((batchRows[0]?.n ?? 0) > 0) blockers.push('memiliki riwayat batch stok')
      if ((adjustmentRows[0]?.n ?? 0) > 0) blockers.push('memiliki riwayat penyesuaian stok')
      if ((autoBreakRows[0]?.n ?? 0) > 0) blockers.push('memiliki riwayat pemecahan satuan')
      if ((opnameItemRows[0]?.n ?? 0) > 0) blockers.push('pernah dihitung di stock opname')
      if ((damagedItemRows[0]?.n ?? 0) > 0) blockers.push('memiliki riwayat barang rusak/hilang')
      if ((overrideRows[0]?.n ?? 0) > 0) blockers.push('memiliki riwayat override harga owner')
      if ((returnItemRows[0]?.n ?? 0) > 0) blockers.push('memiliki riwayat retur')
      if ((orderItemRows[0]?.n ?? 0) > 0) blockers.push('pernah dipesan lewat portal pelanggan')

      if (blockers.length > 0) {
        throw new Error(
          `PRODUCT_IN_USE:Produk tidak bisa dihapus karena ${blockers.join(', ')}. ` +
          `Gunakan tombol "Nonaktifkan" agar produk tidak muncul di POS tanpa menghapus riwayatnya.`
        )
      }

      // Lolos guard = produk memang belum pernah dipakai. Sisa datanya cuma konfigurasi milik
      // produk ini sendiri (bukan riwayat transaksi) — aman dihapus manual karena FK-nya
      // ON DELETE NO ACTION (bukan CASCADE) di database.
      await trx.delete(productStocks).where(eq(productStocks.productId, productId))
      await trx.delete(customerCartItems).where(eq(customerCartItems.productId, productId))
      await trx.delete(productBarcodes).where(eq(productBarcodes.productId, productId))
      await trx.delete(productUomCosts).where(eq(productUomCosts.productId, productId))
      await trx.delete(productPrices).where(eq(productPrices.productId, productId))
      await trx.delete(productUomConversions).where(eq(productUomConversions.productId, productId))
      await trx.delete(products).where(eq(products.id, productId))
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
      }
      if (error.message.startsWith('PRODUCT_IN_USE:')) {
        return NextResponse.json({ error: error.message.slice('PRODUCT_IN_USE:'.length) }, { status: 409 })
      }
    }
    console.error('DELETE /api/bo/master-data/products/[id] error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menghapus produk' }, { status: 500 })
  }
}
