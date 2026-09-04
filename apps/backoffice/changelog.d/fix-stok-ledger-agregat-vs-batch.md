### Fixed

- Stok di menu Nilai Stok tidak lagi menjauh dari stok yang tampil di POS. Setiap penjualan yang melebihi stok (oversell) dulu memotong stok agregat sebanyak qty yang dijual, padahal batch FIFO hanya terpotong sebanyak stok yang benar-benar ada — selisihnya menumpuk permanen dan tidak pernah bisa kembali sejajar. Sekarang keduanya dipotong dengan angka yang sama.
- Produk yang belum punya baris stok tidak lagi dibuatkan stok bernilai minus saat dijual; barisnya dibuat dengan nilai 0.
- Pengiriman transfer antar cabang yang dipaksakan lewat PIN Owner saat stok kurang tidak lagi membuat stok cabang pengirim jadi minus tanpa batch pasangannya. Kekurangannya tetap tercatat di Log Audit sebagai `INTERNAL_TRANSFER_SHIP_STOCK_BYPASS`.
- Persetujuan Stock Opname tidak lagi melewati item yang hitungan fisiknya sudah cocok dengan sistem. Item seperti itu justru bukti stok POS sudah benar, jadi kini batch FIFO-nya ikut disamakan ke sana — sebelumnya dilewati, sehingga SO Besar tidak pernah membersihkan selisih Nilai Stok pada produk yang hitungannya pas.
