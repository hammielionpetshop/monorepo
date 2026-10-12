### Added
- **Nilai gratis ongkir di Pengaturan** (Back Office → Pengaturan → Groomer & Pengantar). Bawaan **Rp 10.000** (ongkir standar toko), hanya Owner/GM yang bisa mengubah, setiap perubahan tercatat. Nota lama tidak ikut berubah.
- **Struk lebih jelas untuk pelanggan.** Ongkir dicetak **"Ongkos kirim 15.000"** (tanpa "15 METER x 1.000"). Gratis ongkir dicetak "Ongkos kirim 10.000" lalu **"GRATIS ONGKIR -10.000"**, dan di bawah total **"Anda hemat Rp 10.000 (gratis ongkir)"**. Berlaku di semua cara cetak (printer kasir, Bluetooth, cetak browser, gambar struk) dan saat cetak ulang dari riwayat.
- **Ringkasan antaran** di Laporan → Riwayat Grooming & Bonus: jumlah antaran (berbayar · gratis), ongkir diterima, dan gratis ongkir yang ditanggung toko — untuk dibandingkan dengan catatan bensin.

### Changed
- **Gratis ongkir selalu bernilai ongkir standar.** Saat kasir mencentang "Gratis ongkir" (tab Kasir) atau "Gratis antar-jemput" (tab Grooming), ongkir otomatis menjadi nilai standar dari Pengaturan dan tidak ditagih; kasir tidak perlu menghitung jarak. Server menolak gratis ongkir dengan nilai lain.
- Aturan & tampilan ongkir kini dipusatkan di satu "mesin ongkir", dijaga pemeriksaan otomatis supaya tidak ada bagian yang tertinggal saat aturan ongkir berubah.

### Fixed
- **Laporan Penjualan per Produk** mengurangi potongan per baris dua kali. Tidak pernah terlihat karena potongan per baris belum pernah dipakai, tetapi gratis ongkir akan membuat baris ongkir tampil minus. Angka lama tidak berubah (potongan per baris lama semuanya 0).
