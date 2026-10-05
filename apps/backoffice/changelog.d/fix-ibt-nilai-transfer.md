### Added

- Transfer Internal: daftar dan detail kini menampilkan **Nilai Dipesan**, **Dikirim**, dan **Diterima**. Nilai Diterima adalah angka yang ditagih di Piutang Internal, jadi Finance bisa langsung mencocokkannya. Barang yang dikirim tapi tidak sampai ditandai terpisah ("kurang Rp … di jalan").

### Fixed

- Piutang internal salah hitung kalau PO Internal dipesan dalam satu satuan tapi dijual di Bulk Sale dalam satuan lain (mis. dipesan PCS, dijual SAK). Harga per SAK dulu dikalikan jumlah PCS sehingga piutang dan modal stok di toko penerima berlipat. Sekarang harga dikonversi ke satuan transfer dan mengikuti nilai bersih nota (setelah diskon).
- Produk yang ditambahkan di Bulk Sale tapi tidak ada di PO Internal kini ikut menjadi baris transfer (ditandai "tambahan di nota"). Dulu barang itu terjual di nota tapi tidak ikut dikirim/diterima: tidak tertagih ke cabang dan stok toko penerima tidak bertambah.
