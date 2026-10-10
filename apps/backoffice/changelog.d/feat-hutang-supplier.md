### Added
- **Halaman Hutang Supplier (menu Pembelian → Hutang Supplier).** Tampilan mengikuti Laporan Piutang. Menampilkan tagihan setiap PO supplier yang sudah diterima: tagihan, sudah bayar, sisa, dan status, dengan filter supplier, cabang, serta pencarian no. PO / faktur.
  - Tombol **Catat Pembayaran** membuka popup (izin `payable.pay`: OWNER, GM, MANAGER, FINANCE) untuk mencatat pembayaran penuh atau sebagian, lengkap dengan tanggal bayar, metode, no. bukti transfer, dan catatan.
  - Tanggal bayar bisa diisi mundur (tidak boleh melewati hari ini) supaya pembayaran lama yang terjadi di luar sistem bisa dicatat belakangan.
  - Popup **Riwayat** pembayaran per PO (tanggal, nominal, metode, bukti, pencatat).
  - Pembayaran supplier belum dicatat ke Pendapatan & Pengeluaran (sesuai keputusan owner).
- **Status pembayaran supplier di detail PO.** Detail PO yang sudah diterima menampilkan status bayar, tagihan, sudah bayar, sisa, dan tautan ke halaman Hutang Supplier.
- **Jatuh tempo hutang supplier.** Dihitung dari tanggal penerimaan PO disetujui + termin supplier (Master Data → Supplier, 0 = tunai). Halaman Hutang Supplier mendapat kolom Jatuh Tempo (tanda terlambat / ≤ 7 hari), tab **Terlambat**, dan kartu **Lewat Jatuh Tempo** & **Jatuh Tempo ≤ 7 Hari**; detail PO ikut menampilkan jatuh tempo.
  - Tidak disimpan ke database: mengubah termin supplier langsung menggeser jatuh tempo semua tagihan supplier itu yang belum lunas.
- **Hutang Piutang Internal: Catat Pembayaran pakai popup** seperti Laporan Piutang, ditambah **tanggal bayar** (boleh mundur, tidak boleh ke depan). Catatan otomatis di Pendapatan & Pengeluaran kedua cabang ikut memakai tanggal bayar tersebut.
- **Hutang Piutang Internal: popup Riwayat** pembayaran per IBT (tanggal, nominal, metode, bukti, pencatat). Pembayaran lama tanpa metode ditandai "tidak tercatat".

### Changed
- **Hapus Hutang internal wajib mengisi alasan** (minimal 5 huruf) lewat popup yang menjelaskan akibatnya: sisa tagihan direlakan, stok **tidak** kembali ke pengirim, nota & pembayaran lama tidak berubah, dan tidak bisa dibatalkan.
  - Alasan disimpan di catatan hutang; siapa & kapan direkam di audit (`IBP_WAIVED`) dan tampil di popup Detail/Riwayat.
  - User non-global hanya bisa menghapus hutang yang piutangnya milik cabangnya (cabang pengirim).
  - Tombol Catat Pembayaran / Hapus Hutang kini mengikuti izin `payable.pay` / `payable.waive`, bukan daftar jabatan tetap.

### Fixed
- **Status hutang supplier ikut dihitung ulang saat faktur PO dikoreksi.** Sebelumnya hutang yang sudah lunas tetap berstatus Lunas walau faktur dikoreksi naik, sehingga sisanya tidak bisa dibayar.
- **Metode bayar hutang supplier dibatasi 20 karakter** sesuai kolom database, agar tidak gagal tersimpan dengan pesan kesalahan server.
