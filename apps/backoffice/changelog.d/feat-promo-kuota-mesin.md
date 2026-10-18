### Added

- Promo otomatis sekarang bisa dibatasi **kuota per cabang** dan **syarat stok** (fondasi di mesin
  promo & database, migrasi `0045`). Tiap cabang punya jatah sendiri yang tidak dicampur. Kuota
  dipilih salah satu: **jatah pcs** (berapa pcs barang hadiah yang boleh kena promo) atau **jatah
  nota** (berapa nota yang boleh pakai promo). Bila jatah pcs mepet, sisanya dipotong sebagian (mis.
  sisa 2 dari pembelian 5 → 2 pcs kena promo). **Syarat stok:** bila dinyalakan, promo hanya
  ditawarkan selama stok barang hadiah di cabang itu masih ada. Layar pembuatan promo, perhitungan
  di kasir, dan laporan menyusul di tahap berikutnya.
