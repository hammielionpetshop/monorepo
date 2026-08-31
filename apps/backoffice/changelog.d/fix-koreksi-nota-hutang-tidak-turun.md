### Fixed

- Koreksi nota pada transaksi berbayar hutang: nilai piutang pelanggan kini ikut turun mengikuti total nota hasil koreksi. Sebelumnya baris hutang diambil apa adanya dari nominal lama yang dikirim kasir, sehingga saat qty/harga dikurangi, total & laba nota berubah tapi piutang tetap di angka semula (dan `paidAmount`/`changeAmount` header jadi tidak konsisten). Baris hutang sekarang selalu dihitung sebagai sisa tagihan setelah pembayaran tunai/transfer; kalau tunai sudah menutup tagihan, hutangnya dibatalkan.
