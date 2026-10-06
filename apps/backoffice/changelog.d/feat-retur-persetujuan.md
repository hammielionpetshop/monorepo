### Changed

- **Retur kini wajib disetujui OWNER/GM, seperti void.** Tombol di halaman Retur berubah jadi "Ajukan Retur Barang": isian langsung diperiksa (sisa qty, cabang, status nota), lalu masuk ke **Permintaan Persetujuan** dengan label RETUR beserta daftar barang dan nilainya. Stok, potongan piutang, dan laporan baru berubah setelah disetujui. Kalau ditolak, tidak ada yang berubah.
- Retur tidak bisa diajukan untuk nota yang sedang menunggu void, sudah di-void, atau masih punya pengajuan lain yang belum diputuskan.
- Pengajuan retur yang belum diputuskan tidak menahan settle shift, karena retur tidak mengubah angka setoran shift.
