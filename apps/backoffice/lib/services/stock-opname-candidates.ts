import {
  and,
  db,
  eq,
  inArray,
  products,
  productStocks,
  productUomConversions,
  stockOpnameItems,
  stockOpnames,
  unitsOfMeasure,
} from '@/lib/db'

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
  // Hanya terisi untuk dokumen hitung ulang (lihat getRecountCandidates): qty fisik &
  // selisih dari SO induk (hitung#1), plus mutasi stok bersih sejak SO induk disetujui.
  parentPhysicalQty: number | null
  parentVarianceQty: number | null
  movementSinceParent: number | null
}

export interface RecountContext {
  parentSoId: number
  parentSoNumber: string
  parentCompletedAt: Date | null
}

export interface SOFullCandidateResult {
  branchId: number
  type: string
  items: SOFullCandidate[]
  // Terisi hanya bila SO ini dokumen hitung ulang (recount_of_so_id != null).
  recount?: RecountContext
}

/**
 * Cakupan produk untuk SO Besar: semua produk aktif di master data, dibatasi
 * `categoryScope` bila ada, plus produk yang sudah punya baris di
 * `stock_opname_items` (mis. sudah dihitung dari POS, atau produk yang kini
 * nonaktif). Stok sistem 0 tetap ikut, karena fisiknya bisa saja ada di rak.
 * Baris yang belum dihitung ikut tampil dengan qty fisik/selisih `null`.
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
      recountOfSoId: stockOpnames.recountOfSoId,
    })
    .from(stockOpnames)
    .where(eq(stockOpnames.id, soId))
    .limit(1)

  if (!header) return null

  if (header.type !== 'FULL') {
    return { branchId: header.branchId, type: header.type, items: [] }
  }

  // Dokumen hitung ulang: cakupan dibatasi ke item SO induk, bukan semua produk aktif.
  if (header.recountOfSoId != null) {
    return getRecountCandidates(soId, header.branchId, header.recountOfSoId)
  }

  const branchId = header.branchId

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

  const categoryScope = Array.isArray(header.categoryScope)
    ? (header.categoryScope as number[])
    : null
  const activeProductRows = await db
    .select({ id: products.id })
    .from(products)
    .where(
      categoryScope && categoryScope.length > 0
        ? and(eq(products.isActive, true), eq(products.productKind, 'BARANG'), inArray(products.categoryId, categoryScope))
        : and(eq(products.isActive, true), eq(products.productKind, 'BARANG')),
    )
  const eligibleIds = new Set<number>(activeProductRows.map((row) => row.id))

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
      parentPhysicalQty: null,
      parentVarianceQty: null,
      movementSinceParent: null,
    }
  })

  items.sort((a, b) => a.productName.localeCompare(b.productName, 'id'))

  return { branchId, type: header.type, items }
}

/**
 * Kandidat untuk dokumen hitung ulang: hanya item SO induk (bukan semua produk aktif).
 * Semua item induk diikutkan beserta `parentVarianceQty` supaya layar bisa menyaring
 * default ke yang berselisih dan opsional menampilkan yang cocok. systemQty = stok sistem
 * terkini (pembanding), dan "mutasi sejak SO induk" menjelaskan selisihnya dari hitung#1.
 */
async function getRecountCandidates(
  soId: number,
  branchId: number,
  parentSoId: number,
): Promise<SOFullCandidateResult | null> {
  // Import dinamis: menjaga stock-ledger (dan `stockLedgerUnion` yang dievaluasi saat
  // modul dimuat) keluar dari jalur muat normal candidates — hanya dibutuhkan saat
  // benar-benar memproses dokumen hitung ulang.
  const { getMovementSinceParent } = await import('./so-recount-service')

  const [parent] = await db
    .select({
      id: stockOpnames.id,
      soNumber: stockOpnames.soNumber,
      completedAt: stockOpnames.completedAt,
    })
    .from(stockOpnames)
    .where(eq(stockOpnames.id, parentSoId))
    .limit(1)

  const recount: RecountContext = {
    parentSoId,
    parentSoNumber: parent?.soNumber ?? `#${parentSoId}`,
    parentCompletedAt: parent?.completedAt ?? null,
  }

  // Item SO induk (hitung#1) jadi cakupan hitung ulang.
  const parentItems = await db
    .select({
      productId: stockOpnameItems.productId,
      uomId: stockOpnameItems.uomId,
      physicalQty: stockOpnameItems.physicalQty,
      varianceQty: stockOpnameItems.varianceQty,
    })
    .from(stockOpnameItems)
    .where(eq(stockOpnameItems.soId, parentSoId))

  if (parentItems.length === 0) {
    return { branchId, type: 'FULL', items: [], recount }
  }

  // Item yang sudah dihitung di dokumen hitung ulang ini (menimpa nilai live).
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

  const productIds = [...new Set(parentItems.map((i) => i.productId))]

  const productRows = await db
    .select({ id: products.id, name: products.name, sku: products.sku })
    .from(products)
    .where(inArray(products.id, productIds))
  const productById = new Map(productRows.map((p) => [p.id, p]))

  const uomIds = [...new Set(parentItems.map((i) => i.uomId))]
  const uomRows = uomIds.length
    ? await db
        .select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code })
        .from(unitsOfMeasure)
        .where(inArray(unitsOfMeasure.id, uomIds))
    : []
  const uomCodeById = new Map(uomRows.map((row) => [row.id, row.code]))

  // Stok sistem terkini per produk (base), dikonversi ke satuan item induk.
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
    .where(and(eq(productStocks.branchId, branchId), inArray(productStocks.productId, productIds)))
  const baseQtyByProduct = new Map<number, number>()
  for (const row of stockRows) {
    baseQtyByProduct.set(row.productId, (baseQtyByProduct.get(row.productId) ?? 0) + Number(row.qty) * (row.ratio ?? 1))
  }

  const conversionRows = await db
    .select({
      productId: productUomConversions.productId,
      uomId: productUomConversions.uomId,
      ratio: productUomConversions.ratio,
    })
    .from(productUomConversions)
    .where(inArray(productUomConversions.productId, productIds))
  const ratioByKey = new Map(conversionRows.map((row) => [`${row.productId}:${row.uomId}`, row.ratio]))

  const movementBase = recount.parentCompletedAt
    ? await getMovementSinceParent(branchId, recount.parentCompletedAt, productIds, soId)
    : new Map<number, number>()

  const items: SOFullCandidate[] = parentItems.map((parentItem) => {
    const product = productById.get(parentItem.productId)
    const uomId = parentItem.uomId
    const ratio = ratioByKey.get(`${parentItem.productId}:${uomId}`) ?? 1
    const liveSystemQty = Math.floor((baseQtyByProduct.get(parentItem.productId) ?? 0) / ratio)
    const existing = existingByProductId.get(parentItem.productId)
    const moveBase = movementBase.get(parentItem.productId) ?? 0

    return {
      productId: parentItem.productId,
      productName: product?.name ?? `(produk #${parentItem.productId})`,
      sku: product?.sku ?? null,
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
      parentPhysicalQty: parentItem.physicalQty,
      parentVarianceQty: parentItem.varianceQty,
      movementSinceParent: Math.round(moveBase / ratio),
    }
  })

  items.sort((a, b) => a.productName.localeCompare(b.productName, 'id'))

  return { branchId, type: 'FULL', items, recount }
}
