<!-- tayang: 2026-11-03 15:53 -->
### Added
- **Bayar di luar slip** (Jadwal Bayar): bonus yang disahkan atau koreksi plus untuk orang yang slip terakhirnya sudah Dibayar kini muncul otomatis sebagai tagihan "Bayar di luar slip". Pemilik dan GM diberi tahu saat tagihan muncul.
- Saat dibayar (3 langkah, tombol ditahan), tagihan **dipotongkan ke Piutang Lain** orang itu lebih dulu tanpa uang bergerak; sisanya dibayar dengan uang dari Sumber Uang, tanggal uang, dan foto bukti. Bila habis dipotongkan ke piutang, langkah uang dilewati.
- **Batal bayar di luar slip** (Pemilik atau GM, alasan wajib): potongan piutang dikembalikan, mutasi dana dibalik, bonus kembali Disahkan, dan tagihan kembali Menunggu dibayar.
- **Ringkasan Gaji** (tab Ringkasan di halaman periode): jumlah slip per status, pendapatan per jenis, terpotong per kelompok, sisa dibawa, Piutang Lain dan tidak tertagih, Dana Disiplin dan Dana Tidak Hadir, bersih, sudah dibayar per sumber uang, dan belum dibayar; per cabang dengan baris terpisah "Gaji Pemilik dan GM". HR melihat tanpa jabatan bertanda.
- Finance membuka **Ringkasan** dari daftar Periode Slip: total seluruh perusahaan saja, tanpa per cabang, tanpa dana, dan tanpa gaji Pemilik dan GM.
### Changed
- Piutang Lain menampilkan jumlah yang sudah dipotong bayar di luar slip dan sisanya; piutang yang habis dipotong berstatus **Lunas**.
- Bonus yang dibayar di luar slip berstatus **Dibayar di luar slip**. Slip terakhir tidak bisa dibuka kembali selama ada pembayaran di luar slip untuk orang itu.
