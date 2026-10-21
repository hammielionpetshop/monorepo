### Added
- **Laporan Penjualan per Produk kini bisa dipecah per kelas harga (Retail / Reseller / Grosir / Member).** Klik nama produk untuk membuka rincian tiap kelas harga: qty terjual, harga realisasi, pendapatan, HPP, laba kotor, dan **margin %** per kelas — supaya kelihatan kelas mana yang omzetnya paling besar dan mana yang marginnya paling tebal.
  - Datanya diambil dari kelas harga yang tercatat di tiap baris nota, jadi transaksi lama pun ikut terpecah. Retur dikurangkan per kelas harga agar angkanya setara dengan baris induk produk.
  - Koreksi Revisi Harga Beli kiriman internal tetap ditampilkan di tingkat produk (bukan per kelas harga) karena tidak melekat ke satu kelas.
  - Margin kotor (%) juga muncul pada baris induk produk dan baris TOTAL.
  - Export CSV ikut memuat baris "Per kelas harga" dan kolom baru "Margin Kotor (%)".
- **Laporan Laba Rugi punya bagian baru "Penjualan & Laba Kotor per Kelas Harga".** Memecah omzet, HPP, laba kotor, dan margin % seluruh cabang per kelas harga (Retail / Reseller / Grosir / Member) dalam periode terpilih, sudah dikurangi retur per kelas.
  - Omzet dihitung dari nilai baris nota (sama dengan Laporan Penjualan per Produk), sehingga bila ada diskon/pajak tingkat nota, totalnya bisa beda tipis dari Pendapatan Laba Rugi — selisihnya ditampilkan sebagai catatan rekonsiliasi karena tidak melekat ke satu kelas harga.
  - Export CSV Laba Rugi ikut memuat blok rincian per kelas harga.
