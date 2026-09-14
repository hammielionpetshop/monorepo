import {
  and,
  branches,
  db,
  eq,
  ilike,
  isNull,
  or,
  products,
  sql,
  stockShortfalls,
  transactions,
  unitsOfMeasure,
} from '@/lib/db'

// Berapa hari sebuah shortfall dianggap "sudah lama" dan perlu ditinjau (dicek apakah
// memang belum sempat direstock atau barangnya benar hilang/rusak). Konstanta, bukan
// setting — konsisten dengan cara nilai serupa lain dihitung di kode ini.
export const SHORTFALL_AGING_DAYS = 7

export interface StockShortfallFilter {
  branchId?: number | null
  search?: string | null
}

export interface StockShortfallListItem {
  id: number
  productId: number
  productName: string
  sku: string | null
  branchId: number
  branchName: string
  uomCode: string
  qtyShort: number
  qtyRemaining: number
  costPricePerUnit: number
  sourceType: string
  sourceTransactionId: number | null
  trxNumber: string | null
  createdAt: Date
  ageDays: number
  isAging: boolean
}

/**
 * Daftar shortfall (utang stok akibat oversell) yang masih terbuka — belum lunas lewat
 * penerimaan PO, belum ditutup lewat recount SO/adjustment, dan belum ditulis-off manual.
 * Urut dari yang tertua dulu: itulah yang paling mendesak ditinjau.
 */
export async function getOpenShortfalls(filter: StockShortfallFilter): Promise<StockShortfallListItem[]> {
  const search = filter.search?.trim()

  const rows = await db
    .select({
      id: stockShortfalls.id,
      productId: stockShortfalls.productId,
      productName: sql<string>`COALESCE(${products.name}, '(produk terhapus id ' || ${stockShortfalls.productId} || ')')`,
      sku: products.sku,
      branchId: stockShortfalls.branchId,
      branchName: branches.name,
      uomCode: sql<string>`COALESCE(${unitsOfMeasure.code}, '-')`,
      qtyShort: stockShortfalls.qtyShort,
      qtyRemaining: stockShortfalls.qtyRemaining,
      costPricePerUnit: stockShortfalls.costPricePerUnit,
      sourceType: stockShortfalls.sourceType,
      sourceTransactionId: stockShortfalls.sourceTransactionId,
      trxNumber: transactions.trxNumber,
      createdAt: stockShortfalls.createdAt,
    })
    .from(stockShortfalls)
    .innerJoin(branches, eq(stockShortfalls.branchId, branches.id))
    .leftJoin(products, eq(stockShortfalls.productId, products.id))
    .leftJoin(unitsOfMeasure, eq(unitsOfMeasure.id, products.baseUomId))
    .leftJoin(transactions, eq(transactions.id, stockShortfalls.sourceTransactionId))
    .where(
      and(
        isNull(stockShortfalls.closedAt),
        isNull(stockShortfalls.writtenOffAt),
        filter.branchId != null ? eq(stockShortfalls.branchId, filter.branchId) : undefined,
        search
          ? or(ilike(products.name, `%${search}%`), ilike(products.sku, `%${search}%`))
          : undefined
      )
    )
    .orderBy(stockShortfalls.createdAt)

  const now = Date.now()
  return rows.map((r) => {
    const ageDays = Math.floor((now - new Date(r.createdAt).getTime()) / 86_400_000)
    return { ...r, ageDays, isAging: ageDays >= SHORTFALL_AGING_DAYS }
  })
}
