import {
  db,
  internalReturns,
  internalReturnItems,
  interBranchTransferItems,
  transactions,
  transactionItems,
  products,
  productUomConversions,
  unitsOfMeasure,
  sql,
} from '@/lib/db'

export interface InternalReturnPLAdjustment {
  branchId: number
  /** Koreksi omzet cabang PENGIRIM dari Revisi Harga Beli — positif = omzet turun. */
  revenueCorrection: number
  /** Penyesuaian Modal (Revisi Harga Beli) cabang PENERIMA — positif = modal turun (laba naik). */
  costAdjustment: number
}

/**
 * Efek Revisi Harga Beli (RI8) ke Laba Rugi, pada tanggal revisi DISETUJUI (WIB). Dokumen yang
 * dibatalkan tidak ikut — sama dengan perlakuan retur penjualan.
 * - Pengirim: omzet nota Bulk Sale dikoreksi sebesar nilai dokumen (qty × selisih harga).
 * - Penerima: bagian kiriman yang sudah terpakai sebelum harga dibetulkan → Penyesuaian Modal.
 * - Barang Dikembalikan atas kiriman yang harganya sudah direvisi: retur nota Bulk Sale memakai
 *   harga nota asli padahal selisihnya sudah dikoreksi revisi — kelebihannya dikembalikan ke omzet
 *   pengirim di sini supaya tidak terpotong dua kali.
 */
export async function getInternalReturnPLAdjustments(startDate: string, endDate: string): Promise<InternalReturnPLAdjustment[]> {
  const inPeriod = sql`${internalReturns.status} = 'APPROVED'
    AND (${internalReturns.resolvedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date >= ${startDate}::date
    AND (${internalReturns.resolvedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date <= ${endDate}::date`
  const rows = await db.execute<{ branch_id: number; revenue_correction: string; cost_adjustment: string }>(sql`
    SELECT branch_id, SUM(revenue_correction) AS revenue_correction, SUM(cost_adjustment) AS cost_adjustment
    FROM (
      SELECT ${internalReturns.senderBranchId} AS branch_id, ${internalReturns.totalValue} AS revenue_correction, 0 AS cost_adjustment
      FROM ${internalReturns}
      WHERE ${internalReturns.kind} = 'REVISI_HARGA' AND ${inPeriod}
      UNION ALL
      SELECT ${internalReturns.receiverBranchId}, 0, ${internalReturns.cogsAdjustment}
      FROM ${internalReturns}
      WHERE ${internalReturns.kind} = 'REVISI_HARGA' AND ${inPeriod}
      UNION ALL
      SELECT ${internalReturns.senderBranchId},
        ${internalReturnItems.lineValue} - ${internalReturnItems.qty} * ${interBranchTransferItems.costPriceAtTransfer}, 0
      FROM ${internalReturnItems}
      INNER JOIN ${internalReturns} ON ${internalReturns.id} = ${internalReturnItems.internalReturnId}
      INNER JOIN ${interBranchTransferItems} ON ${interBranchTransferItems.id} = ${internalReturnItems.transferItemId}
      WHERE ${internalReturns.kind} = 'BARANG_DIKEMBALIKAN' AND ${inPeriod}
        AND ${internalReturnItems.lineValue} <> ${internalReturnItems.qty} * ${interBranchTransferItems.costPriceAtTransfer}
    ) adj
    GROUP BY branch_id
  `)
  return [...rows]
    .map(r => ({ branchId: Number(r.branch_id), revenueCorrection: Number(r.revenue_correction), costAdjustment: Number(r.cost_adjustment) }))
    .filter(r => r.revenueCorrection !== 0 || r.costAdjustment !== 0)
}

export interface InternalReturnProductAdjustment {
  productId: number
  productName: string
  sku: string | null
  baseUomCode: string | null
  uomId: number
  uomCode: string | null
  uomName: string | null
  ratioToBase: number
  /** Koreksi omzet penjualan produk ini di cabang pengirim — positif = omzet turun. */
  revenueCorrection: number
}

/**
 * Koreksi omzet Revisi Harga Beli per produk × satuan untuk laporan Penjualan per Produk — angka
 * yang sama dengan koreksi omzet cabang pengirim di Laba Rugi, dengan filter laporan itu (cabang
 * penjual = cabang pengirim, pelanggan = pelanggan nota Bulk Sale, produk/kategori/brand, tier nota).
 */
export async function getInternalReturnProductAdjustments(params: {
  startDate: string
  endDate: string
  branchId?: number | null
  customerId?: number | null
  productIds?: number[] | null
  categoryId?: number | null
  brandId?: number | null
  priceTier?: string | null
}): Promise<InternalReturnProductAdjustment[]> {
  const amount = sql`CASE WHEN ${internalReturns.kind} = 'REVISI_HARGA' THEN ${internalReturnItems.lineValue}
    ELSE ${internalReturnItems.lineValue} - ${internalReturnItems.qty} * ${interBranchTransferItems.costPriceAtTransfer} END`
  const filters = [
    sql`${internalReturns.status} = 'APPROVED'`,
    sql`${internalReturns.kind} IN ('REVISI_HARGA', 'BARANG_DIKEMBALIKAN')`,
    sql`(${internalReturns.resolvedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date >= ${params.startDate}::date`,
    sql`(${internalReturns.resolvedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date <= ${params.endDate}::date`,
  ]
  if (params.branchId != null) filters.push(sql`${internalReturns.senderBranchId} = ${params.branchId}`)
  if (params.customerId != null) filters.push(sql`${transactions.customerId} = ${params.customerId}`)
  if (params.productIds && params.productIds.length > 0)
    filters.push(sql`${internalReturnItems.productId} IN (${sql.join(params.productIds.map(id => sql`${id}`), sql`, `)})`)
  if (params.categoryId != null) filters.push(sql`${products.categoryId} = ${params.categoryId}`)
  if (params.brandId != null) filters.push(sql`${products.brandId} = ${params.brandId}`)
  if (params.priceTier != null)
    filters.push(sql`EXISTS (
      SELECT 1 FROM ${transactionItems}
      WHERE ${transactionItems.transactionId} = ${internalReturns.saleTransactionId}
        AND ${transactionItems.productId} = ${internalReturnItems.productId}
        AND ${transactionItems.priceTier} = ${params.priceTier}
    )`)

  const rows = await db.execute<{
    product_id: number; product_name: string; sku: string | null; base_uom_code: string | null
    uom_id: number; uom_code: string | null; uom_name: string | null; ratio_to_base: string; revenue_correction: string
  }>(sql`
    SELECT ${internalReturnItems.productId} AS product_id, ${products.name} AS product_name, ${products.sku} AS sku,
      base_uom.code AS base_uom_code, ${internalReturnItems.uomId} AS uom_id, item_uom.code AS uom_code, item_uom.name AS uom_name,
      CASE WHEN ${internalReturnItems.uomId} = ${products.baseUomId} THEN 1 ELSE COALESCE(${productUomConversions.ratio}, 1) END AS ratio_to_base,
      SUM(${amount}) AS revenue_correction
    FROM ${internalReturnItems}
    INNER JOIN ${internalReturns} ON ${internalReturns.id} = ${internalReturnItems.internalReturnId}
    INNER JOIN ${interBranchTransferItems} ON ${interBranchTransferItems.id} = ${internalReturnItems.transferItemId}
    INNER JOIN ${transactions} ON ${transactions.id} = ${internalReturns.saleTransactionId}
    INNER JOIN ${products} ON ${products.id} = ${internalReturnItems.productId}
    LEFT JOIN ${unitsOfMeasure} AS base_uom ON base_uom.id = ${products.baseUomId}
    LEFT JOIN ${unitsOfMeasure} AS item_uom ON item_uom.id = ${internalReturnItems.uomId}
    LEFT JOIN ${productUomConversions} ON ${productUomConversions.productId} = ${internalReturnItems.productId}
      AND ${productUomConversions.uomId} = ${internalReturnItems.uomId}
    WHERE ${sql.join(filters, sql` AND `)}
    GROUP BY ${internalReturnItems.productId}, ${products.name}, ${products.sku}, ${products.baseUomId}, base_uom.code,
      ${internalReturnItems.uomId}, item_uom.code, item_uom.name, ${productUomConversions.ratio}
    HAVING SUM(${amount}) <> 0
  `)
  return [...rows].map(r => ({
    productId: Number(r.product_id),
    productName: r.product_name,
    sku: r.sku,
    baseUomCode: r.base_uom_code,
    uomId: Number(r.uom_id),
    uomCode: r.uom_code,
    uomName: r.uom_name,
    ratioToBase: Number(r.ratio_to_base),
    revenueCorrection: Number(r.revenue_correction),
  }))
}
