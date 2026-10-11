### Fixed

- **Mutasi Stok kini mencatat pembatalan retur pelanggan.** Sebelumnya retur yang dibatalkan hanya tampil sebagai barang masuk ("Retur"), padahal stoknya sudah dipotong lagi — sehingga angka Mutasi Stok tidak cocok dengan stok. Sekarang ada baris baru **"Batal Retur"** (barang keluar) pada jam pembatalan, lengkap dengan alasan dan nama yang membatalkan; di Laporan Stok kolom "Retur" menampilkan angka bersih (retur dikurangi yang dibatalkan). Retur lama yang pernah dibatalkan ikut tampil benar. Hanya laporan yang berubah — stok, uang, dan piutang tidak disentuh.
