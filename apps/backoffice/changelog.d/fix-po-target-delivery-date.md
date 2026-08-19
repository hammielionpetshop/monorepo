### Added
- **Tombol "Kembali ke PO Internal" di halaman Bulk Sale** setelah transaksi dari transfer internal berhasil diproses, mengarahkan langsung ke detail transfer internal asalnya.

### Changed
- **Transfer internal (IBT) otomatis berstatus APPROVED saat selesai diproses via Bulk Sale**, tidak lagi lewat persetujuan manual. Tombol "Setujui"/"Ajukan & Setujui" dihapus dari halaman detail transfer internal — sebelum diproses via Bulk Sale, transfer tetap berstatus "Menunggu Approval" dan hanya bisa dibatalkan.

### Fixed
- **Gagal menambahkan produk saat membuat Purchase Order dengan error "Invalid ISO Date".** Skema validasi backend mewajibkan `targetDeliveryDate` berupa datetime ISO penuh, padahal form hanya mengirim tanggal (`YYYY-MM-DD`) atau `null` saat kosong. Validasi sekarang menerima format tanggal saja dan `null`.
- **Tab "Transfer Masuk" di web POS tersembunyi dari Kasir**, padahal permission `internal_transfer.receive` sudah mengizinkan Kasir menerima transfer antar cabang (IBT). Tab sekarang tampil untuk semua role sehingga Kasir bisa melihat & konfirmasi penerimaan barang transfer masuk.
