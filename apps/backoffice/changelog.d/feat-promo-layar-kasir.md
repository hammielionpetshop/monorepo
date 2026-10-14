### Added

- Layar kasir mengenali **promo otomatis**: promo yang sedang berlaku dihitung langsung di keranjang (memakai jam server), baris yang kena promo diberi tanda nama promo beserta potongannya, dan total sudah termasuk promo. (P2d)

### Changed

- Baris keranjang yang sedang kena promo tidak lagi menampilkan tombol "+ Diskon" — promo dan diskon manual tidak bisa digabung dalam satu barang (promo yang dipakai).
- Layar bayar mengirim potongan promo tiap barang ke server; bila promo berubah saat nota disimpan (mulai/berakhir/dimatikan), nota ditolak dan layar memuat ulang promo lalu menghitung ulang supaya kasir memeriksa dan membayar lagi.
