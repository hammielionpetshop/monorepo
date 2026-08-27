import { sql, interBranchTransferItems, interBranchTransfers } from '@/lib/db'

// Nilai PO transfer internal, dihitung LIVE dari item:
//   SUM(qty_requested × cost_price_at_transfer)
//
// Sengaja TIDAK memakai kolom inter_branch_transfers.total_transfer_value sebagai
// sumber utama. Kolom itu hanya di-set saat IBT dibuat/diedit lalu tidak pernah
// dihitung ulang. Saat IBT dikonversi ke Bulk Sale, cost_price_at_transfer tiap item
// ditimpa dengan harga jual gudang (lib/services/transaction-service.ts) tetapi kolom
// total dibiarkan — jadi nilai tersimpan bisa menyimpang dari transaksi & piutang
// internal yang keduanya dihitung dari harga per-unit yang baru. SUM live selalu
// konsisten.
//
// Fallback ke kolom lama HANYA saat transfer tidak punya baris item sama sekali:
// SUM atas nol baris = NULL, jadi COALESCE turun ke total_transfer_value. Ini kasus
// data legacy Juni 2026 (id ≤ 17) yang itemnya sudah tidak ada — nilainya cuma
// tersisa di kolom itu. Transfer yang punya item tidak pernah menyentuh fallback.
//
// Pakai di dalam .select({ ... }) pada query yang from(interBranchTransfers).
export function ibtTransferValueSql() {
  return sql<number>`COALESCE(
    (
      SELECT SUM(${interBranchTransferItems.qtyRequested} * ${interBranchTransferItems.costPriceAtTransfer})
      FROM ${interBranchTransferItems}
      WHERE ${interBranchTransferItems.transferId} = ${interBranchTransfers.id}
    ),
    ${interBranchTransfers.totalTransferValue},
    0
  )`
}
