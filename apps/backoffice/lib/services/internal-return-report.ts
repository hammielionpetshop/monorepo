import { db, internalReturns, internalReturnItems, interBranchTransferItems, sql } from '@/lib/db'

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
