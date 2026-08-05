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
  eq,
  and,
  ne,
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
