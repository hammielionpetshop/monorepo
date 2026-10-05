### Added

- PO Internal: tombol **Proses Ulang** di detail transfer untuk transfer yang sudah jadi nota Bulk Sale tapi barangnya belum dikirim. Nota di-void (stok kembali ke gudang, piutang internal dibatalkan) dan transfer kembali ke Menunggu Persetujuan untuk diproses lagi dengan item/harga yang benar. Khusus Owner/GM.

### Fixed

- PO Internal yang sudah diproses jadi transaksi lalu sudah **Disiapkan** tidak bisa dibatalkan sama sekali: batal transfer menyuruh void nota, void nota menyuruh batalkan transfer. Sekarang transfer bisa dibatalkan selama barang belum dikirim (sampai status Disiapkan). Kalau sudah jadi nota, pembatalan otomatis me-void notanya sekaligus dan hanya bisa dilakukan Owner/GM.
- Void nota Bulk Sale dari PO Internal kini juga diizinkan saat transfernya berstatus Disiapkan, tidak hanya Disetujui.

### Changed

- Membatalkan PO Internal di backoffice kini wajib mengisi alasan, dan alasannya tercatat di audit log.

### Added

- Log Audit: filter aksi baru "PO Internal dibatalkan" dan "PO Internal diproses ulang".
