### Added
- **Rincian "Pelunasan Piutang Tunai" di Detail Shift (Riwayat Shift).** Kas Expected kini bisa dicocokkan dengan angka yang terlihat.
  - Di bawah tabel Breakdown Kasir ada ringkasan rekonsiliasi: `Total Kas Penjualan + Pelunasan Piutang Tunai = Kas Expected (di luar modal)`.
  - Tab baru **"Pelunasan Piutang"** (muncul bila ada datanya) menampilkan waktu, pelanggan, no. nota, metode, penerima, dan nominal — ditandai mana yang Tunai (menambah Kas Expected) dan mana yang non-tunai (hanya informasi).
  - Tooltip penjelas rumus pada label "Kas Expected" dan kolom "Kas Penjualan".

### Fixed
- **Angka "Kas Expected" yang terlihat tidak cocok dengan jumlah kolom "Kas Penjualan".** Dulu pelunasan piutang tunai menambah Kas Expected tapi tidak punya baris/kolom di layar Detail Shift, sehingga selisihnya seolah hilang (terasa terutama di Toko Pusat yang menerima pelunasan piutang tunai).
