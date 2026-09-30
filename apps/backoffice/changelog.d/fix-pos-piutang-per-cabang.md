### Changed

- POS → Piutang: kasir kini hanya melihat dan melunasi piutang **cabangnya sendiri** — daftar pelanggan, rincian nota, riwayat pembayaran, alokasi pelunasan, dan peringatan piutang di keranjang semuanya dibatasi ke cabang POS aktif. Piutang lama tanpa cabang tidak tampil di POS dan dilunasi dari backoffice.
- POS → Piutang: tab "Piutang" di navigasi atas dihapus (terlalu sesak di layar kecil), diganti tombol **Piutang** di bar shift halaman kasir; di layar kecil tampil sebagai ikon saja. Halaman piutang punya tautan "Kembali ke Kasir".

### Fixed

- Piutang milik cabang lain (mis. tagihan IBT Gudang ke toko) tidak lagi muncul dan tidak bisa dilunasi dari kasir toko.
