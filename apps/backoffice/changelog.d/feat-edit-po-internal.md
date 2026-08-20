### Added
- **Edit PO Transfer Internal (IBT) setelah dibuat.** Selama status masih Draft/Menunggu
  Approval/Disetujui/Sedang Disiapkan, qty tiap item bisa diubah, item bisa ditambah atau
  dihapus, dan cabang tujuan bisa diganti langsung dari halaman detail transfer internal.
  Begitu status masuk Dalam Pengiriman, transfer tidak bisa diedit lagi — harus dibatalkan lalu
  dibuat ulang.
  - Endpoint baru `PATCH /api/bo/internal-transfers/[id]` (terpisah dari `PATCH .../status` yang
    khusus transisi status alur).
  - Sebelum disetujui: yang boleh mengedit adalah pemilik permission `internal_transfer.manage`
    (Owner/GM) di cabang tujuan. Setelah disetujui/sedang disiapkan: butuh
    `internal_transfer.approve` (Owner/GM/Manager) di cabang pengirim, karena cabang pengirim
    sudah mulai memproses permintaannya.
