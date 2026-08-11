### Added

- **Harga POS otomatis mengikuti tier pelanggan.** Memilih pelanggan bertier RESELLER (atau GROSIR,
  MEMBER, DISTRIBUTOR, PROMO) membuat POS langsung memakai harga tier tersebut — di kartu produk,
  dialog pilih satuan, dan seluruh isi keranjang. Melepas pelanggan mengembalikan harga ke RETAIL.
  Tombol **Ubah Tier** tetap bisa dipakai untuk menyetel manual sesudahnya.
- **Tier harga pelanggan kini bisa diisi dari Back Office.** Kolomnya sudah lama ada di database
  (dipakai portal order online) tapi tidak pernah bisa diubah dari mana pun; sekarang tersedia di
  form tambah/edit customer, kolom daftar customer, dan halaman detailnya.

### Changed

- Produk yang **belum punya harga di tier pelanggan tetap bisa dijual** — harganya jatuh ke RETAIL,
  bukan ditolak. Supaya harga yang belum diisi tidak menyamar jadi harga yang benar, tier yang
  sedang dipakai ditandai di tiga tempat: label kuning di kartu produk, keterangan di dialog satuan
  (`Harga RESELLER belum diisi untuk satuan ini — memakai RETAIL`), dan hitungan item di keranjang.
