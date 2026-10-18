### Added

- **Hadiah gratis muncul otomatis di keranjang kasir (promo "Beli X gratis Y").** Begitu barang syaratnya cukup di keranjang, baris hadiah "🎁 … GRATIS" muncul sendiri (qty sesuai kelipatan) dan terkunci — kasir tidak bisa menghapus atau mengubahnya; hadiah hilang/berkurang sendiri bila barang syaratnya dihapus atau qty-nya turun. Hadiah gratis tidak menambah total nota (tercatat Rp 0), stok hadiah tetap dipotong. Promo "Bundling" (beberapa barang syarat) memotong barang yang dipilih seperti promo potongan biasa.

### Changed

- Nota dari layar kasir kini ikut mengirim baris hadiah gratis ke server; server tetap menghitung ulang hadiah dari barang yang dibeli dan menolak bila tidak cocok (kasir diminta periksa & bayar lagi). Daftar tunggu tidak menyimpan hadiah — dihitung ulang dari isi keranjang + promo terbaru saat dibuka/dibayar.
