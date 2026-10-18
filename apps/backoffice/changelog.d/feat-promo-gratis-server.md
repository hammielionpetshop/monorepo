### Added
- **Server menjadi hakim promo "Beli X gratis Y" & "Bundling" saat nota disimpan.** Dasar untuk
  promo hadiah gratis (P4): saat kasir menyimpan nota, server menghitung ulang hadiah dari barang
  yang dibeli, mencocokkannya dengan baris hadiah yang dikirim layar, dan menolak nota bila berbeda
  (layar lalu menghitung ulang). Baris hadiah tersimpan sebagai barang biasa seharga Rp 0 (potongan
  penuh tercatat sebagai promo), **stoknya tetap dipotong dan modalnya tetap dihitung** supaya laba
  tidak palsu. Baris syarat + hadiah dari satu kali pakai promo paket diberi nomor grup yang sama
  (untuk aturan "retur paket utuh" di tahap berikutnya). Membatalkan nota mengembalikan stok hadiah
  dan jatah kuotanya. Belum ada perubahan di layar kasir — baris hadiah otomatis menyusul di tahap
  berikutnya.
