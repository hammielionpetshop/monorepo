### Added
- **Mesin promo mendukung hadiah barang gratis (beli X gratis Y) & bundling.** Dasar untuk promo
  "beli X gratis Y" (P4): mesin promo kini menghitung hadiah `GRATIS` sebagai barang gratis yang
  harus ditambahkan ke keranjang (keluaran baru `gifts`), menghitung nilainya sebagai potongan agar
  ikut pemilihan "paling murah untuk pelanggan" serta kuota pcs & syarat stok; bundling (beberapa
  barang syarat → potongan pada barang yang ditentukan) memakai mesin potongan yang sudah ada. Kolom
  `promo_package_no` (migrasi `0046`) disiapkan untuk menandai baris segrup satu paket, supaya retur
  nanti hanya boleh satu paket utuh. Belum ada perubahan di layar/kasir — bentuk promo ini belum bisa
  dibuat sampai tahap berikutnya.
