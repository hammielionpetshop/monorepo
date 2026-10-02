### Fixed

- Transfer manual memotong batch FIFO lintas satuan dalam qty dasar, serta meneruskan expiry batch pertama yang benar-benar dipotong.
- Bypass Owner mencatat kekurangan sebagai defisit stok dengan referensi transfer/item; supplier berikutnya dapat melunasinya.
- Pengiriman mengunci header dan membaca ulang item dalam transaksi sehingga request ganda tidak memotong stok dua kali. Pengiriman hasil Bulk Sale tetap tidak memotong stok kembali.
- Laporan shortfall menampilkan nomor transfer dan ledger keluar memberi keterangan defisit bypass.
