### Added

- PO Internal: tombol **Proses Ulang** di detail transfer untuk transfer yang sudah jadi nota Bulk Sale tapi barangnya belum dikirim. Nota di-void (stok kembali ke gudang, nota tidak lagi dihitung di laporan) dan transfer kembali ke Menunggu Persetujuan untuk diproses lagi dengan item/harga yang benar. Khusus Owner/GM.
- Log Audit: filter aksi baru "PO Internal dibatalkan" dan "PO Internal diproses ulang".

### Fixed

- PO Internal yang sudah diproses jadi transaksi lalu sudah **Disiapkan** tidak bisa dibatalkan sama sekali: batal transfer menyuruh void nota, void nota menyuruh batalkan transfer. Sekarang transfer bisa dibatalkan selama barang belum dikirim (sampai status Disiapkan). Kalau sudah jadi nota, pembatalan otomatis me-void notanya sekaligus dan hanya bisa dilakukan Owner/GM.
- Void nota Bulk Sale dari PO Internal kini juga diizinkan saat transfernya berstatus Disiapkan, tidak hanya Disetujui.

### Changed

- Membatalkan PO Internal di backoffice kini wajib mengisi alasan, dan alasannya tercatat di audit log.
- Detail PO Internal menampilkan riwayat pembatalan/proses ulang: siapa, kapan, alasannya, dan nota yang di-void. Transfer yang dibatalkan ditandai kotak merah di atas.
- Buku Panduan PO Internal: tambah cara membatalkan atau memproses ulang pesanan yang salah, dan arti harga berwarna kuning di Bulk Sale.
