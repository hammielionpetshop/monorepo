### Added
- **Batalkan retur** pada Retur Supplier Luar yang sudah disetujui (Back Office → Retur Supplier Luar, khusus Owner/GM, alasan wajib, popup wajib pilih). Dokumen tidak dihapus — statusnya menjadi **Dibatalkan** dan semua akibatnya dibalik berjejak: stok masuk lagi dengan modal yang sama, potongan tagihan PO dibatalkan (baris pembayaran negatif **BATAL RETUR** di riwayat Hutang Supplier), saldo supplier dari retur itu dikurangi. Ditolak bila saldo itu sudah terpakai membayar tagihan lain (RI3b).
- **Tarik pengajuan**: pengaju boleh menarik pengajuan retur supplier miliknya yang masih menunggu persetujuan (POS & Back Office); status **Ditarik**, tanpa efek stok/uang (RI3b).
- Mutasi Stok: jenis baru **Batal Retur Supplier** (stok masuk lagi); baris retur keluarnya tetap tampil. Cetakan retur menampilkan keterangan pembatalan.

### Changed
- Qty barang PO dari retur yang ditarik atau dibatalkan bisa diretur lagi lewat pengajuan baru.
