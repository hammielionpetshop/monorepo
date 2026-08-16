### Added

- Bulk sale: **Daftar Tunggu** — transaksi yang sedang diisi bisa ditahan (tombol Tahan / F8), lalu
  dilanjutkan atau dihapus lewat panel Daftar Tunggu di kanan atas. Ikut tersimpan: cabang, customer,
  item, diskon transaksi, metode & jumlah bayar, jatuh tempo, serta tautan Internal PO / Order Portal
  bila drafnya berasal dari sana. Draf disimpan di browser komputer itu saja (maksimal 20, terbaru di
  atas) — tidak terlihat di komputer atau browser lain.
- Bulk sale: harga muncul di dropdown pencarian produk, lengkap dengan satuannya (mis. `Rp 12.000/KG`)
  dan tier bila bukan RETAIL. Produk yang belum punya harga sama sekali ditandai `Harga belum diisi`.

### Fixed

- Bulk sale: produk yang satuan kecilnya belum punya harga (atau harganya 0) kini bisa dimasukkan —
  barisnya otomatis memakai satuan berharga terkecil, bukan memakai harga 0 atau baris harga acak yang
  kebetulan terbaca lebih dulu dari database. Satuan yang belum berharga tetap terlihat di dropdown
  satuan tetapi tidak bisa dipilih dan diberi keterangan `(harga belum diisi)`, karena server memang
  menolaknya saat disimpan.
- Bulk sale dari Internal PO / Order Portal: item yang harganya tercatat 0 kini dilewati dengan
  keterangan "harga belum tersedia" seperti item tanpa harga. Sebelumnya seluruh proses impor gagal
  dengan pesan "Gagal memuat Internal PO. Coba lagi." yang tidak menyebut penyebabnya.
