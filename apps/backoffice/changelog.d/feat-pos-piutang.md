### Added

- POS: menu baru **Piutang** (`/pos/piutang`) — kasir bisa melihat daftar pelanggan berpiutang, rincian nota yang belum lunas (termasuk jatuh tempo & riwayat pembayaran), lalu mencatat pelunasan. Nominal dialokasikan ke nota paling lama lebih dulu; uangnya tercatat ke cabang & shift kasir yang menerima sehingga ikut dihitung saat settlement. Wajib ada shift aktif dan kasir sudah bergabung di shift itu; metode "hutang" tidak bisa dipakai untuk melunasi.
- POS: saat memilih pelanggan di keranjang, piutang yang belum lunas tampil sebagai peringatan merah beserta tautan "Lihat / bayar".
- Permission baru `debt.pay` (Terima Pelunasan Piutang) untuk OWNER, GM, MANAGER, KASIR.

### Fixed

- Ringkasan pelanggan di POS tidak lagi ikut menjumlahkan piutang yang sudah di-void ke total piutang.
