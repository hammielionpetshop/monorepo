### Fixed

- **"Gagal menyimpan transaksi" karena nomor transaksi kembar.** Nomor transaksi memakai 4 angka acak per hari, sehingga beberapa kali sehari dua transaksi mendapat nomor yang sama dan kasir harus menekan simpan lagi. Sekarang bila nomornya kembar, sistem otomatis mencoba lagi dengan nomor baru (sampai 5 kali) tanpa kasir perlu mengulang. Bentuk nomor transaksi tidak berubah. Berlaku untuk kasir, Bulk Sale, dan kirim PO Internal. Pengaman transaksi dobel (Bayar tertekan dua kali / internet lambat) tidak diubah.
