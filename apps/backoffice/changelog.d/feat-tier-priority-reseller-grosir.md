### Changed
- **Urutan prioritas tier harga di POS diubah jadi RETAIL → RESELLER → GROSIR → MEMBER → DISTRIBUTOR → PROMO** (sebelumnya RESELLER ada di urutan ke-4). Ini mempengaruhi urutan tampilan tier di dialog pilih satuan/harga saat menambah produk ke keranjang, tier yang ditampilkan di kartu produk saat belum ada pelanggan terpilih, dan tier fallback saat harga tier pelanggan belum diisi.

### Fixed
- **Kotak jumlah di dialog pilih satuan/harga POS tidak lagi memaksa jadi 1 saat dikosongkan.** Sebelumnya, menghapus semua angka lewat keyboard otomatis mengembalikannya jadi "1" — sehingga angka baru yang diketik ikut menempel di belakang "1" tadi (mis. mau isi "5" jadi "15"). Sekarang kotaknya boleh kosong (dianggap 0), dan tombol "Tambah ke Keranjang" otomatis nonaktif selama jumlahnya 0.
