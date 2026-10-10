### Added
- **Halaman Hutang Supplier (menu Pembelian → Hutang Supplier).** Menampilkan tagihan setiap PO supplier yang sudah diterima: tagihan, sudah bayar, sisa, dan status, dengan filter supplier, cabang, serta pencarian no. PO / faktur.
  - Tombol **Catat Bayar** (izin `payable.pay`: OWNER, GM, MANAGER, FINANCE) untuk mencatat pembayaran penuh atau sebagian, lengkap dengan tanggal bayar, metode, no. bukti transfer, dan catatan.
  - Tanggal bayar bisa diisi mundur (tidak boleh melewati hari ini) supaya pembayaran lama yang terjadi di luar sistem bisa dicatat belakangan.
  - Riwayat pembayaran per PO (jumlah, tanggal, metode, pencatat).
  - Pembayaran supplier belum dicatat ke Pendapatan & Pengeluaran (sesuai keputusan owner).
- **Status pembayaran supplier di detail PO.** Detail PO yang sudah diterima menampilkan status bayar, tagihan, sudah bayar, sisa, dan tautan ke halaman Hutang Supplier.

### Fixed
- **Status hutang supplier ikut dihitung ulang saat faktur PO dikoreksi.** Sebelumnya hutang yang sudah lunas tetap berstatus Lunas walau faktur dikoreksi naik, sehingga sisanya tidak bisa dibayar.
- **Metode bayar hutang supplier dibatasi 20 karakter** sesuai kolom database, agar tidak gagal tersimpan dengan pesan kesalahan server.
