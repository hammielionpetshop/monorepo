import { db, sql } from '@/lib/db'

// Pemeriksaan Satuan (permintaan owner 2026-11-19): baris transaksi dan PO Internal yang satuannya
// bukan satuan dasar produk dan tidak ada di konversi master produk. Penyebabnya bisa data lama
// sebelum validasi, atau satuan produk yang diubah/dihapus sesudah dokumen dibuat — lihat Riwayat
// Satuan di detail produk. Laporan ini hanya membaca; koreksi tetap lewat dokumen koreksi.

export const UOM_MISMATCH_LIMIT = 500

export interface UomMismatchTransactionRow {
  itemId: number
  trxNumber: string
  createdAt: string
  branchName: string | null
  status: string
  productId: number
  productName: string
  uomName: string | null
  baseUomName: string | null
  qty: number
  unitPrice: number
  isRemoved: boolean
}

export interface UomMismatchTransferRow {
  itemId: number
  transferId: number
  ibtNumber: string
  createdAt: string
  sourceBranchName: string | null
  destinationBranchName: string | null
  status: string
  productId: number
  productName: string
  uomName: string | null
  baseUomName: string | null
  qtyRequested: number
  costPriceAtTransfer: number
}

export interface UomMismatchReport {
  transactions: UomMismatchTransactionRow[]
  transactionTotal: number
  transfers: UomMismatchTransferRow[]
  transferTotal: number
}

const mismatch = (alias: string) => sql.raw(`
  ${alias}.uom_id <> p.base_uom_id
  AND NOT EXISTS (
    SELECT 1 FROM petshop.product_uom_conversions c
    WHERE c.product_id = ${alias}.product_id AND c.uom_id = ${alias}.uom_id
  )`)

export async function getUomMismatchReport(): Promise<UomMismatchReport> {
  const [trxRows, trxCount, ibtRows, ibtCount] = await Promise.all([
    db.execute(sql`
      SELECT ti.id AS "itemId", t.trx_number AS "trxNumber", t.created_at AS "createdAt",
             b.name AS "branchName", t.status, p.id AS "productId", p.name AS "productName",
             u.name AS "uomName", bu.name AS "baseUomName", ti.qty, ti.unit_price AS "unitPrice",
             ti.is_removed AS "isRemoved"
      FROM petshop.transaction_items ti
      JOIN petshop.transactions t ON t.id = ti.transaction_id
      JOIN petshop.products p ON p.id = ti.product_id
      LEFT JOIN petshop.units_of_measure u ON u.id = ti.uom_id
      LEFT JOIN petshop.units_of_measure bu ON bu.id = p.base_uom_id
      LEFT JOIN petshop.branches b ON b.id = t.branch_id
      WHERE ${mismatch('ti')}
      ORDER BY t.created_at DESC
      LIMIT ${UOM_MISMATCH_LIMIT}`),
    db.execute(sql`
      SELECT COUNT(*)::int AS n FROM petshop.transaction_items ti
      JOIN petshop.products p ON p.id = ti.product_id
      WHERE ${mismatch('ti')}`),
    db.execute(sql`
      SELECT ii.id AS "itemId", i.id AS "transferId", i.ibt_number AS "ibtNumber", i.created_at AS "createdAt",
             sb.name AS "sourceBranchName", dbr.name AS "destinationBranchName", i.status,
             p.id AS "productId", p.name AS "productName", u.name AS "uomName", bu.name AS "baseUomName",
             ii.qty_requested AS "qtyRequested", ii.cost_price_at_transfer AS "costPriceAtTransfer"
      FROM petshop.inter_branch_transfer_items ii
      JOIN petshop.inter_branch_transfers i ON i.id = ii.transfer_id
      JOIN petshop.products p ON p.id = ii.product_id
      LEFT JOIN petshop.units_of_measure u ON u.id = ii.uom_id
      LEFT JOIN petshop.units_of_measure bu ON bu.id = p.base_uom_id
      LEFT JOIN petshop.branches sb ON sb.id = i.source_branch_id
      LEFT JOIN petshop.branches dbr ON dbr.id = i.destination_branch_id
      WHERE ${mismatch('ii')}
      ORDER BY i.created_at DESC
      LIMIT ${UOM_MISMATCH_LIMIT}`),
    db.execute(sql`
      SELECT COUNT(*)::int AS n FROM petshop.inter_branch_transfer_items ii
      JOIN petshop.products p ON p.id = ii.product_id
      WHERE ${mismatch('ii')}`),
  ])

  const toIso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v))
  const rowsOf = <T,>(result: unknown) =>
    (Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])) as T[]
  const countOf = (result: unknown) => Number(rowsOf<{ n: number }>(result)[0]?.n ?? 0)

  return {
    transactions: rowsOf<UomMismatchTransactionRow>(trxRows).map((r) => ({
      ...r,
      createdAt: toIso(r.createdAt),
      qty: Number(r.qty),
      unitPrice: Number(r.unitPrice),
    })),
    transactionTotal: countOf(trxCount),
    transfers: rowsOf<UomMismatchTransferRow>(ibtRows).map((r) => ({
      ...r,
      createdAt: toIso(r.createdAt),
      qtyRequested: Number(r.qtyRequested),
      costPriceAtTransfer: Number(r.costPriceAtTransfer),
    })),
    transferTotal: countOf(ibtCount),
  }
}
