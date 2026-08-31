import {
  and,
  db,
  eq,
  gte,
  inArray,
  lt,
  products,
  productStocks,
  productUomConversions,
  stockOpnameItems,
  stockOpnames,
  transactionItems,
  transactions,
  unitsOfMeasure,
} from '@/lib/db'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export interface SOFullCandidate {
  productId: number
  productName: string
  sku: string | null
  uomId: number
  uomCode: string
  systemQty: number
  liveSystemQty: number
  soItemId: number | null
  physicalQty: number | null
  varianceQty: number | null
  varianceCostValue: number | null
  varianceReason: string | null
  itemStatus: string | null
  isRecounted: boolean
  recountPhysicalQty: number | null
  recountVarianceQty: number | null
  decisionNote: string | null
}

export interface SOFullCandidateResult {
  branchId: number
  type: string
  items: SOFullCandidate[]
}

/**
 * Cakupan produk untuk SO Besar: produk dengan histori penjualan 30 hari sebelum
 * SO dibuat, ATAU stok sistem cabang ≠ 0, dibatasi `categoryScope` bila ada, plus
 * produk yang sudah punya baris di `stock_opname_items` (mis. sudah dihitung dari
 * POS). Baris yang belum dihitung ikut tampil dengan qty fisik/selisih `null`.
 *
 * Dipakai bersama oleh input SO Besar di backoffice (`/candidates`) dan ekspor CSV
 * (`/export`) supaya keduanya melihat daftar yang sama. Mengembalikan `null` bila
 * SO tidak ditemukan; untuk SO non-FULL `items` selalu kosong (pemanggil yang
 * memutuskan itu error atau tidak).
 */
export async function getSOFullCandidates(soId: number): Promise<SOFullCandidateResult | null> {
  const [header] = await db
    .select({
      id: stockOpnames.id,
      branchId: stockOpnames.branchId,
      type: stockOpnames.type,
      categoryScope: stockOpnames.categoryScope,
      createdAt: stockOpnames.createdAt,
    })
    .from(stockOpnames)
    .where(eq(stockOpnames.id, soId))
    .limit(1)

  if (!header) return null

  if (header.type !== 'FULL') {
    return { branchId: header.branchId, type: header.type, items: [] }
  }

  const branchId = header.branchId
  const createdAt = new Date(header.createdAt)
  const since = new Date(createdAt.getTime() - THIRTY_DAYS_MS)

  const existingItems = await db
    .select({
      id: stockOpnameItems.id,
      productId: stockOpnameItems.productId,
      uomId: stockOpnameItems.uomId,
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
    .where(eq(stockOpnameItems.soId, soId))

  const existingByProductId = new Map(existingItems.map((item) => [item.productId, item]))

  const saleRows = await db
    .selectDistinct({ productId: transactionItems.productId })
    .from(transactionItems)
    .innerJoin(transactions, eq(transactionItems.transactionId, transactions.id))
    .where(
      and(
        eq(transactions.branchId, branchId),
        eq(transactions.status, 'COMPLETED'),
        gte(transactions.createdAt, since),
        lt(transactions.createdAt, createdAt),
      ),
    )
  const saleProductIds = new Set(
    saleRows.map((row) => row.productId).filter((id): id is number => id !== null),
  )

  const stockRows = await db
    .select({
      productId: productStocks.productId,
      qty: productStocks.qty,
      ratio: productUomConversions.ratio,
    })
    .from(productStocks)
    .leftJoin(
      productUomConversions,
      and(
        eq(productUomConversions.productId, productStocks.productId),
        eq(productUomConversions.uomId, productStocks.uomId),
      ),
    )
    .where(eq(productStocks.branchId, branchId))

  const baseQtyByProduct = new Map<number, number>()
  for (const row of stockRows) {
    const add = Number(row.qty) * (row.ratio ?? 1)
    baseQtyByProduct.set(row.productId, (baseQtyByProduct.get(row.productId) ?? 0) + add)
  }
  const stockProductIds = new Set(
    [...baseQtyByProduct.entries()].filter(([, qty]) => qty !== 0).map(([productId]) => productId),
  )

  let eligibleIds = new Set<number>([...saleProductIds, ...stockProductIds])

  const categoryScope = Array.isArray(header.categoryScope)
    ? (header.categoryScope as number[])
    : null
  if (categoryScope && categoryScope.length > 0) {
    const categoryProductRows = await db
      .select({ id: products.id })
      .from(products)
      .where(inArray(products.categoryId, categoryScope))
    const inCategory = new Set(categoryProductRows.map((row) => row.id))
    eligibleIds = new Set([...eligibleIds].filter((productId) => inCategory.has(productId)))
  }

  for (const productId of existingByProductId.keys()) {
    eligibleIds.add(productId)
  }

  if (eligibleIds.size === 0) {
    return { branchId, type: header.type, items: [] }
  }

  const productIds = [...eligibleIds]

  const productRows = await db
    .select({ id: products.id, name: products.name, sku: products.sku, baseUomId: products.baseUomId })
    .from(products)
    .where(inArray(products.id, productIds))

  const uomIdsNeeded = new Set<number>()
  for (const product of productRows) {
    const existing = existingByProductId.get(product.id)
    uomIdsNeeded.add(existing ? existing.uomId : product.baseUomId)
  }

  const uomRows = uomIdsNeeded.size
    ? await db
        .select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code })
        .from(unitsOfMeasure)
        .where(inArray(unitsOfMeasure.id, [...uomIdsNeeded]))
    : []
  const uomCodeById = new Map(uomRows.map((row) => [row.id, row.code]))

  const conversionRows = await db
    .select({
      productId: productUomConversions.productId,
      uomId: productUomConversions.uomId,
      ratio: productUomConversions.ratio,
    })
    .from(productUomConversions)
    .where(inArray(productUomConversions.productId, productIds))
  const ratioByKey = new Map(conversionRows.map((row) => [`${row.productId}:${row.uomId}`, row.ratio]))

  const items: SOFullCandidate[] = productRows.map((product) => {
    const existing = existingByProductId.get(product.id)
    const uomId = existing ? existing.uomId : product.baseUomId
    const ratio = ratioByKey.get(`${product.id}:${uomId}`) ?? 1
    const liveSystemQty = Math.floor((baseQtyByProduct.get(product.id) ?? 0) / ratio)

    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      uomId,
      uomCode: uomCodeById.get(uomId) ?? '-',
      systemQty: existing ? existing.systemQty : liveSystemQty,
      liveSystemQty,
      soItemId: existing?.id ?? null,
      physicalQty: existing?.physicalQty ?? null,
      varianceQty: existing?.varianceQty ?? null,
      varianceCostValue: existing?.varianceCostValue ?? null,
      varianceReason: existing?.varianceReason ?? null,
      itemStatus: existing?.itemStatus ?? null,
      isRecounted: existing?.isRecounted ?? false,
      recountPhysicalQty: existing?.recountPhysicalQty ?? null,
      recountVarianceQty: existing?.recountVarianceQty ?? null,
      decisionNote: existing?.decisionNote ?? null,
    }
  })

  items.sort((a, b) => a.productName.localeCompare(b.productName, 'id'))

  return { branchId, type: header.type, items }
}
