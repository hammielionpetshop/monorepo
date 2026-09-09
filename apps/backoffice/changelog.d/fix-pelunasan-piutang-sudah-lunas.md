### Changed
- **Halaman detail customer dibagi menjadi dua tab: "Riwayat Transaksi" dan "Hutang / Piutang".** Masing-masing tab kini punya kotak pencarian, filter status, dan pagination sendiri (10 baris per halaman) memakai komponen tabel standar.
  - Tab transaksi: cari per no. transaksi + filter status (Selesai / Menunggu Batal / Dibatalkan).
  - Tab hutang: cari per no. transaksi atau keterangan + filter status (Belum Bayar / Sebagian / Lunas / Dibatalkan / Jatuh Tempo Terlewat); banner Total Outstanding & tombol "Tambah Hutang Manual" tetap ada.
  - Query transaksi customer dinaikkan dari 50 → 200 baris terbaru agar filter lebih berguna.

### Fixed
- **Pelunasan piutang tak lagi menampilkan error "Hutang ini sudah lunas" padahal pembayaran berhasil.** Bila hutang sudah lunas dari tab lain, kasir lain, atau submit ganda, daftar/riwayat kini diselaraskan diam-diam dengan pesan info netral, bukan alarm merah.
  - Halaman Laporan Piutang & detail customer: baris hutang yang ternyata sudah lunas langsung dibuang/di-set `PAID` dari state lokal saat server membalas 409.
  - Tambah guard anti submit ganda (`if (submitting) return`) di form pencatatan pembayaran kedua halaman, supaya klik/Enter beruntun tidak mengirim dua request.
