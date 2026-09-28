### Added

- Riwayat Transaksi: filter "Hanya yang terindikasi double input" — menampilkan nota kembar (kasir, cabang, customer, total & item sama persis) berjarak ≤ 60 detik yang keduanya belum di-void. Setiap nota yang terindikasi diberi label "Dobel? ↔ <no. nota kembaran>" untuk memudahkan memilih mana yang diajukan void.

### Fixed

- Kasir: transaksi tidak lagi tercatat dobel saat koneksi lambat. Sebelumnya, bila respons server hilang di jalan, kasir melihat pesan "transaksi TIDAK tersimpan" padahal sudah tersimpan, lalu menekan Bayar lagi. Kini setiap isi keranjang membawa kunci unik (`client_request_id`); bayar ulang keranjang yang sama mengembalikan transaksi yang sudah ada, dengan keterangan "sudah tersimpan saat percobaan sebelumnya".
- Pesan koneksi putus di layar pembayaran tidak lagi mengklaim transaksi pasti tidak tersimpan — kasir diarahkan menekan Bayar lagi setelah koneksi pulih, yang kini aman.
