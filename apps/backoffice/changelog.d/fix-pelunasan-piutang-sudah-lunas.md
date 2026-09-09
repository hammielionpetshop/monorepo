### Fixed
- **Pelunasan piutang tak lagi menampilkan error "Hutang ini sudah lunas" padahal pembayaran berhasil.** Bila hutang sudah lunas dari tab lain, kasir lain, atau submit ganda, daftar/riwayat kini diselaraskan diam-diam dengan pesan info netral, bukan alarm merah.
  - Halaman Laporan Piutang & detail customer: baris hutang yang ternyata sudah lunas langsung dibuang/di-set `PAID` dari state lokal saat server membalas 409.
  - Tambah guard anti submit ganda (`if (submitting) return`) di form pencatatan pembayaran kedua halaman, supaya klik/Enter beruntun tidak mengirim dua request.
