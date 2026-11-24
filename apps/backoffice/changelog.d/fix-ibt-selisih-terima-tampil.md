### Changed

- **PO Internal: selisih terima kini jelas terlihat.** Saat cabang penerima mengoreksi qty (dikirim 10, diterima 0), staf toko sebelumnya mengira koreksinya tidak tersimpan, padahal sistem sudah mengembalikan selisihnya ke stok cabang pengirim. Sekarang di detail PO Internal (kasir dan Back Office):
  - status **"Diterima Sebagian"** diganti **"Diterima – Ada Selisih"** (juga di daftar PO Internal dan Penerimaan), supaya tidak terkesan masih menunggu sisa barang;
  - qty terima **0 ditulis "0"** (bukan "-"), ada kolom baru **Selisih** (-10 / ✓), dan baris yang selisih diwarnai;
  - kasir melihat **Nilai Dikirim, Nilai Diterima (yang ditagih), dan Tidak Diterima (tidak ditagih)** menggantikan "Est. Nilai Transfer" setelah barang diterima;
  - kotak keterangan: *"Barangnya sudah dikembalikan otomatis ke stok [cabang pengirim] (Retur RTN-…) dan tidak ditagih. Tidak perlu tindakan apa-apa."* — di Back Office nomor retur bisa diklik ke nota Bulk Sale-nya.
