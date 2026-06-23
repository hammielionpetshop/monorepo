import {
  db,
  products,
  productBarcodes,
  productStocks,
  unitsOfMeasure,
  eq,
  and,
  ne,
  sql,
} from '@/lib/db'

type DbOrTrx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export interface BarcodeLookupResult {
  id: number
  sku: string | null
  name: string
  barcode: string | null
  baseUomId: number
  baseUomCode: string | null
  stock: number
  matchedBarcode: string
  isPrimaryMatch: boolean
}

/**
 * Cari produk berdasarkan barcode. Mengecek dua sumber:
 * 1. products.barcode (barcode utama)
 * 2. product_barcodes.barcode (barcode tambahan)
 * Mengembalikan null bila tidak ditemukan / produk non-aktif.
 */
export async function findProductByBarcode(
  code: string,
  branchId: number
): Promise<BarcodeLookupResult | null> {
  const trimmed = code.trim()
  if (!trimmed) return null

  const primaryMatch = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      barcode: products.barcode,
      baseUomId: products.baseUomId,
      baseUomCode: unitsOfMeasure.code,
      stock: sql<number>`COALESCE(${productStocks.qty}, 0)`,
    })
    .from(products)
    .leftJoin(unitsOfMeasure, eq(products.baseUomId, unitsOfMeasure.id))
    .leftJoin(
      productStocks,
      and(
        eq(productStocks.productId, products.id),
        eq(productStocks.branchId, branchId),
        eq(productStocks.uomId, products.baseUomId)
      )
    )
    .where(and(eq(products.barcode, trimmed), eq(products.isActive, true)))
    .limit(1)

  if (primaryMatch.length > 0) {
    return { ...primaryMatch[0], matchedBarcode: trimmed, isPrimaryMatch: true }
  }

  const altMatch = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      barcode: products.barcode,
      baseUomId: products.baseUomId,
      baseUomCode: unitsOfMeasure.code,
      stock: sql<number>`COALESCE(${productStocks.qty}, 0)`,
    })
    .from(productBarcodes)
    .innerJoin(products, eq(productBarcodes.productId, products.id))
    .leftJoin(unitsOfMeasure, eq(products.baseUomId, unitsOfMeasure.id))
    .leftJoin(
      productStocks,
      and(
        eq(productStocks.productId, products.id),
        eq(productStocks.branchId, branchId),
        eq(productStocks.uomId, products.baseUomId)
      )
    )
    .where(and(eq(productBarcodes.barcode, trimmed), eq(products.isActive, true)))
    .limit(1)

  if (altMatch.length > 0) {
    return { ...altMatch[0], matchedBarcode: trimmed, isPrimaryMatch: false }
  }

  return null
}

/**
 * Pastikan barcode belum dipakai produk lain di KEDUA sumber
 * (products.barcode & product_barcodes.barcode).
 * Lempar Error('DUPLICATE_BARCODE') bila bentrok.
 * `excludeProductId` mengabaikan barcode milik produk itu sendiri.
 */
export async function assertBarcodeUnique(
  trx: DbOrTrx,
  code: string,
  excludeProductId?: number
): Promise<void> {
  const trimmed = code.trim()

  const primaryConflict = await trx
    .select({ id: products.id })
    .from(products)
    .where(
      excludeProductId
        ? and(eq(products.barcode, trimmed), ne(products.id, excludeProductId))
        : eq(products.barcode, trimmed)
    )
    .limit(1)
  if (primaryConflict.length > 0) throw new Error('DUPLICATE_BARCODE')

  const altConflict = await trx
    .select({ id: productBarcodes.id })
    .from(productBarcodes)
    .where(
      excludeProductId
        ? and(eq(productBarcodes.barcode, trimmed), ne(productBarcodes.productId, excludeProductId))
        : eq(productBarcodes.barcode, trimmed)
    )
    .limit(1)
  if (altConflict.length > 0) throw new Error('DUPLICATE_BARCODE')
}
