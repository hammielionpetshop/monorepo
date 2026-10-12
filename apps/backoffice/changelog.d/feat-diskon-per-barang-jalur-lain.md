### Changed
- **Koreksi nota mengunci barang yang sudah didiskon.** Barang berdiskon per barang tidak bisa diubah jumlah/harganya atau dihapus lewat Koreksi (gunakan batal nota atau retur); barang lain di nota yang sama tetap bisa dikoreksi. Koreksi juga tidak bisa dipakai untuk menambah diskon — diskon hanya lewat tombol Diskon di kasir.
- **"Total Diskon" di tutup shift ikut menghitung diskon per barang** — di struk tutup shift, pratinjau tutup shift, rekap estafet, dan Riwayat Shift Back Office. Gratis ongkir tetap tidak dihitung sebagai diskon.
- Melanjutkan nota dari daftar tunggu: diskon per barang ikut kembali dan potongannya dihitung ulang.

### Fixed
- Koreksi nota pada nota yang punya gratis ongkir **dan** diskon total nota menghilangkan diskon notanya (tagihan naik tanpa terlihat). Sekarang diskon nota dipertahankan.
