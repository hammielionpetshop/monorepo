### Added

- Kasir bisa membatalkan satu baris hitungan yang terlanjur tersimpan ke SO Besar, lewat tombol hapus di layar Hitung Ulang. Sebelumnya produk yang salah dipindai cuma bisa dihitung ulang dan tetap menyeret admin untuk memutuskan selisih yang sebetulnya tidak pernah dimaksud ada. Item yang sudah diputuskan admin tetap terkunci, dan SO kembali ke status "Dihitung" kalau baris terakhirnya dibatalkan.

### Changed

- SO Besar yang sudah ada hitungannya (status "Menunggu") kini bisa dibatalkan sekaligus dari halaman Stock Opname, selama belum ada satu pun itemnya yang disetujui. Item yang masih menunggu ikut ditutup supaya POS tidak bisa mengirim hitung ulang ke SO yang sudah batal. Begitu ada item yang disetujui — stok cabang sudah bergeser karenanya — pembatalan borongan ditolak dan sisanya wajib diselesaikan per item lewat halaman Review.
- Tombol pembatalan SO memakai label "Batalkan" untuk SO Besar dan SO yang masih dihitung, "Tolak" hanya untuk SO Harian yang hitungannya sudah lengkap.
- Waktu selesai ikut dicatat saat SO ditolak atau dibatalkan dari backoffice, jadi laporan detail SO tidak lagi menampilkan "—" pada SO yang batal.
