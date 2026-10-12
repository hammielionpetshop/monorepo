### Added
- **Tombol "Tambah belanja" di tab Grooming.** Untuk pelanggan yang menitipkan kucing sekaligus belanja barang: daftar grooming (dan ongkos kirim delivery-nya) pindah ke keranjang tab Kasir, kasir menambahkan barangnya, lalu dibayar **satu nota**. Begitu nota tersimpan, layar kembali ke tab Grooming dan karcis tiap kucing tercetak.
  - Di keranjang tab Kasir, baris grooming tampil terkunci: tidak bisa diubah jumlahnya, tidak digabung dengan baris lain, dan pelanggan nota terkunci ke pemilik kucing. Bila batal, tekan "Lepas grooming" — barang belanjaan tetap di keranjang.

### Changed
- **Jasa grooming hanya dijual lewat tab Grooming.** Produk grooming tidak lagi muncul di daftar produk tab Kasir, dan server menolak nota grooming yang tidak membawa data kucing dan groomer — supaya karcis, riwayat, dan bonus groomer selalu lengkap. **Ongkos kirim tetap ada di tab Kasir** (dipakai juga untuk antar barang).
- **Nota berisi grooming tidak bisa ditahan (Tunggu).** Tombol Tahan menolak dengan pesan yang jelas; nota barang biasa tetap bisa ditahan seperti sebelumnya.
