### Fixed

- Promo **"beli X gratis Y"** tidak lagi gagal dibayar dengan pesan *"Promo ... sudah tidak
  berlaku untuk keranjang ini. Keranjang dihitung ulang"*. Penyebabnya: validasi baris nota di
  `POST /api/pos/transactions` membuang penanda `gift` pada baris hadiah gratis (field itu belum
  terdaftar di skema), sehingga server mengira baris hadiah adalah barang beli berpromo lalu
  menolak seluruh nota. Semua promo jenis hadiah gratis terdampak, berapa pun stok dan harga
  barang hadiahnya. Penanda `gift` kini diteruskan apa adanya ke mesin penghakiman promo.
