### Added

- **Laporan penjualan per produk sekarang menyebut satuannya dan harga jual per 1 satuan.** Setiap
  produk punya satu baris induk yang sudah disetarakan ke satuan terkecil, dan baris itu bisa dibuka
  untuk melihat rincian apa adanya per satuan jual.
  - Baris induk: qty dalam satuan dasar produk (mis. 32 KG), harga per 1 satuan dasar.
  - Rincian: satu baris per satuan yang benar-benar dipakai di nota, qty tanpa konversi
    (mis. 1 SAK dan 2 KG), lengkap dengan pengingat isi satuannya (`1 SAK = 30 KG`).
  - Produk yang hanya terjual dalam satuan dasar tidak punya tombol buka — rinciannya sudah sama
    dengan induknya.
- **Dua kolom harga berdampingan: Harga Realisasi dan Harga Master.** Realisasi = pendapatan ÷ qty,
  yaitu harga yang benar-benar terjadi termasuk diskon item. Master = daftar harga tier RETAIL yang
  berlaku sekarang di cabang yang menjual. Selisih keduanya memperlihatkan diskon dan harga yang
  belum diperbarui.
  - Bila harga master antar cabang berbeda, yang ditampilkan rentangnya (`Rp5.000 – Rp5.500`),
    bukan satu angka yang dipilih diam-diam.
  - Produk tanpa baris harga master ditampilkan `—`, bukan `Rp 0`.
- **Export CSV ikut memuat dua tingkat baris.** Kolom `Tingkat` membedakan `Total produk` dari
  `Per satuan`, dengan kolom terpisah untuk isi per satuan, qty apa adanya, dan qty dalam satuan dasar.

### Fixed

- **Kolom "Qty Terjual" tidak lagi menjumlahkan satuan yang berbeda menjadi satu angka.** Sebelumnya
  penjualan 1 SAK (isi 30 KG) dan 2 KG dilaporkan sebagai "3" — hasil `SUM(qty)` mentah lintas satuan
  yang tidak berarti apa-apa. Sekarang angka induk adalah qty dalam satuan dasar (32 KG) dan qty per
  satuan ditampilkan terpisah tanpa konversi.
  - Baris TOTAL sengaja tidak lagi menjumlahkan qty: menjumlahkan satuan dasar lintas produk (KG + PCS)
    sama tidak bermaknanya. Total uang tetap dijumlahkan seperti biasa.
- **Daftar transaksi yang memuat produk terpilih kini menulis satuan di kolom Qty** (`1 SAK`,
  atau `1 SAK + 2 KG` bila satu nota memakai dua satuan), menggantikan angka telanjang yang sebelumnya
  juga hasil penjumlahan lintas satuan.
- **Rasio satuan dasar dipaksa 1, tidak lagi memercayai baris konversinya.** Menurut aturan repo
  `base_uom_id` selalu satuan terkecil, jadi baris `product_uom_conversions` untuk satuan dasar dengan
  ratio selain 1 adalah data rusak. Sebelumnya perhitungan HPP mengalikan ratio itu apa adanya — pola
  persis yang dulu membuat HPP LOQY KLG TUNA jadi 24× lipat.
