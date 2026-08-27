import { sql, interBranchTransferItems, interBranchTransfers } from '@/lib/db'

// Nilai PO transfer internal, dihitung LIVE dari item:
//   SUM(qty_requested × cost_price_at_transfer)
//
// Sengaja TIDAK memakai kolom inter_branch_transfers.total_transfer_value. Kolom itu
// hanya di-set saat IBT dibuat/diedit lalu tidak pernah dihitung ulang. Saat IBT
// dikonversi ke Bulk Sale, cost_price_at_transfer tiap item ditimpa dengan harga jual
// gudang (lib/services/transaction-service.ts) tetapi kolom total dibiarkan — jadi
// nilai tersimpan bisa menyimpang dari transaksi & piutang internal yang keduanya
// memang dihitung dari harga per-unit yang baru. Subquery ini selalu konsisten.
//
// Pakai di dalam .select({ ... }) pada query yang from(interBranchTransfers).
export function ibtTransferValueSql() {
  return sql<number>`COALESCE((
    SELECT SUM(${interBranchTransferItems.qtyRequested} * ${interBranchTransferItems.costPriceAtTransfer})
    FROM ${interBranchTransferItems}
    WHERE ${interBranchTransferItems.transferId} = ${interBranchTransfers.id}
  ), 0)`
}
