### Fixed
- **Cancel PO Internal yang sudah dijual via Bulk Sale meninggalkan sales & piutang menggantung.**
  Transfer internal yang sudah diproses lewat Bulk Sale (auto-approve, status APPROVED +
  tertaut nomor transaksi) sebelumnya masih bisa langsung di-cancel dari halaman detail
  transfer. Aksi cancel itu hanya mengubah status transfer jadi CANCELLED tanpa menyentuh
  transaksi penjualan maupun hutang customer yang sudah tercatat — kalau pembayarannya
  hutang, piutangnya jadi menggantung tanpa transfer yang menaunginya lagi.
  - Tombol "Batalkan" disembunyikan saat transfer sudah tertaut Bulk Sale.
  - `PATCH /api/bo/internal-transfers/[id]/status` menolak aksi `cancel` (409) untuk transfer
    yang `convertedTransactionId`-nya sudah terisi, dengan pesan mengarahkan user untuk
    membatalkan lewat void transaksi penjualannya — jalur itu sudah otomatis mengembalikan
    transfer ke PENDING_APPROVAL sekaligus membatalkan hutang customer terkait.
