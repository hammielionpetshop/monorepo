### Added
- **Tanda "Belum ada berat" di daftar Master Data Produk.** Produk barang yang berat satuan terkecilnya masih kosong (atau 0) diberi tanda kuning di samping namanya, supaya mudah dicari dan dilengkapi. Tanda yang sama tampil di halaman detail produk.
  - Produk jasa (grooming, ongkir) tidak diberi tanda karena memang tidak punya berat.
  - Produk yang satuan terkecilnya GRAM atau KG tidak diberi tanda — beratnya sudah pasti.

### Changed
- **Mesin berat: berat satuan besar (dus, sak, dst.) sekarang selalu dihitung otomatis = isi × berat 1 satuan terkecil.** Tonase di surat jalan Penjualan Grosir (cetak baru maupun cetak ulang) memakai hitungan ini. Sebelumnya berat dus/sak bisa diketik sendiri di tab Satuan dan sering tidak cocok dengan isinya, sehingga tonase salah.
  - Isian "Berat (gram)" di tab Satuan diganti tampilan berat hasil hitungan (tidak bisa diketik). Angka lama yang pernah diketik tidak dihapus dari data, hanya tidak dipakai lagi.
  - Produk dengan satuan terkecil GRAM selalu dihitung 1 gram dan KG selalu 1.000 gram, apa pun yang tertulis di data produk.
  - Label di form produk diperjelas menjadi "Berat 1 satuan terkecil (gram)".

### Fixed
- **Berat produk berangka pecahan tidak lagi berisiko gagal disimpan.** Berat dibulatkan ke gram terdekat saat disimpan.
