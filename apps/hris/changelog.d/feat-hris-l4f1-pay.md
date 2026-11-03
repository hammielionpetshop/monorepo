<!-- tayang: 2026-11-03 15:32 -->
### Added
- **Bayar slip** (layar Slip dan Jadwal Bayar, 3 langkah, tombol ditahan): Pemilik atau GM menandai slip yang sudah ditutup sebagai Dibayar. Nominal otomatis sebesar gaji bersih slip; dipilih sumber uang, tanggal uang (boleh mundur sampai 7 hari, lebih jauh dengan alasan), dan foto bukti (dianjurkan). Banyak slip bisa dibayar sekaligus; yang gagal tidak membatalkan yang lain. Orangnya diberi tahu tanggal dan cara bayarnya.
- **Batal bayar** (Pemilik atau GM, alasan wajib): pembayaran dibatalkan tanpa dihapus, slip kembali Ditutup dan muncul lagi di Jadwal Bayar. Orangnya dan pemilik lain diberi tahu.
- **Jadwal Bayar** (Kantor › Gaji): slip yang belum ditandai Dibayar per periode, berkelompok Lewat, Hari ini, dan 7 hari ke depan; centang lalu Bayar terpilih. Finance melihat jumlah slip per periode tanpa nama.
- **Pengingat belum Dibayar**: mulai pukul 07.00 sehari sesudah tanggal bayar, Pemilik dan GM diingatkan setiap hari sampai semua slip ditandai Dibayar. Tanggal bayar gaji ada di Pengaturan (awal: tanggal 1).
- **Daftar Transfer** untuk Finance, Pemilik, dan GM: nama, bank, nomor rekening, pemilik rekening, dan gaji bersih slip yang belum Dibayar, urut per bank, bisa diunduh sebagai CSV untuk Excel. Gaji jabatan Pemilik dan GM tidak ada di daftar ini. Tiap buka dan unduh dicatat.
- **Sumber Uang** (Pengaturan): daftar tempat uang gaji dibayar (awal: Brankas tunai, Rekening Kantor transfer); bisa ditambah, diubah, dan dinonaktifkan Pemilik atau GM.
- Slip bersih Rp0 langsung **Dibayar tanpa uang** saat ditutup, tidak masuk Jadwal Bayar.
- Halaman periode dan daftar Periode Slip menampilkan jumlah **Dibayar** dan status **Lunas** bila semua slip periode itu sudah Dibayar; saringan Ditutup belum Dibayar dan Dibayar.
### Changed
- Slip yang sudah Dibayar tidak bisa dibuka kembali sebelum pembayarannya dibatalkan.
