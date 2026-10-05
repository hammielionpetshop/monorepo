### Fixed

- Retur kini mengurangi penjualan, bukan hanya memotong piutang:
  - **Laba Rugi**: pendapatan dan HPP dikurangi retur yang diproses dalam periode (berdasarkan tanggal retur), sehingga laba kotor & laba bersih ikut turun. Nilai retur ditampilkan di bawah angka pendapatan/HPP dan ikut ke Export CSV.
  - **Penjualan per Produk**: qty, pendapatan, dan HPP produk dikurangi retur; produk yang dijual periode lalu tapi diretur periode ini muncul dengan angka negatif agar total sama dengan Laba Rugi. Ikut ke Export CSV.
  - **Riwayat Transaksi**: nota yang punya retur menampilkan nilai bersih (nilai nota − retur). Detail nota menampilkan qty yang diretur per item, daftar retur, dan Total Bersih.
  - **Dashboard**: omzet & estimasi laba hari ini dikurangi retur hari ini.
- HPP retur dihitung sesuai porsi yang diretur (HPP baris × qty retur ÷ qty baris). Sebelumnya data retur menyimpan HPP seluruh baris transaksi, sehingga retur parsial akan tercatat dengan HPP terlalu besar.
- Retur yang dibatalkan tidak ikut dihitung di laporan mana pun.
