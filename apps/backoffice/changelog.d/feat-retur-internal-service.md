### Added
- Mesin **Retur Internal — Barang Dikembalikan** (belum ada layar, menyusul RI6): pengajuan wajib memakai kode transaksi (nomor IBT atau nota Bulk Sale) dan qty tidak boleh melebihi sisa kiriman yang diterima. Saat disetujui Owner/GM, dalam satu langkah: stok cabang penerima keluar, stok **cabang pengirim** (Gudang atau toko) masuk lagi dengan modal nota, nota Bulk Sale pengirim diretur, hutang internal kiriman itu dipotong dan kelebihannya menjadi **Saldo Internal**. Ditolak bila stok di cabang penerima sudah tidak ada. Tolak, tarik pengajuan (hanya pengaju), dan **Batalkan** (semua efek dibalik berjejak; ditolak bila stok pengirim sudah tidak cukup atau saldonya sudah terpakai) (RI5).
- Mutasi Stok & Ringkasan Mutasi: jenis baru **Retur Internal** (keluar dari penerima, masuk ke pengirim, dan pembaliknya saat dibatalkan) (RI5).

### Changed
- Riwayat pembayaran Hutang Piutang Internal menampilkan baris otomatis sebagai **RETUR INTERNAL** / **SALDO INTERNAL** / **BATAL RETUR INTERNAL** (bukan uang kas) (RI5).
