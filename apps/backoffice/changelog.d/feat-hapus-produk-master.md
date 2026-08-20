### Added
- **Hapus produk secara permanen dari master data.** Tombol "Hapus" baru di daftar produk
  (selain "Nonaktifkan" yang sudah ada) memanggil `DELETE /api/bo/master-data/products/[id]`.
  - Produk hanya bisa dihapus kalau belum pernah dipakai sama sekali: tidak ada stok tersisa,
    tidak pernah muncul di riwayat transaksi, purchase order, transfer antar cabang, batch stok,
    penyesuaian stok, pemecahan satuan, stock opname, barang rusak/hilang, override harga owner,
    retur, maupun order dari portal pelanggan. Kalau salah satu ada, permintaan ditolak (409)
    dengan pesan yang mengarahkan ke tombol "Nonaktifkan" sebagai alternatif.
  - Kalau lolos semua guard, data konfigurasi milik produk itu sendiri (harga, modal, konversi
    UOM, barcode tambahan, keranjang pelanggan) ikut dihapus dalam transaksi yang sama sebelum
    baris produknya dihapus.
