### Added
- Struk settlement shift ke-2 (estafet) kini memuat **Rekap Hari Ini**: angka ringkas tiap shift hari itu (tunai, non-tunai, hutang, pengeluaran, pelunasan piutang tunai, omzet, kas disetor) beserta totalnya, dan daftar transaksi non-tunai seluruh shift hari itu dikelompokkan per shift. Rekonsiliasi kas (kas harus ada, disetor, selisih) tetap hanya untuk shift yang ditutup. Cetak ulang dari Riwayat Shift di backoffice ikut menampilkan rekap yang sama.
- Riwayat Shift: shift kasir satu cabang di hari yang sama (estafet) tampil sebagai satu baris **"Estafet N shift"** berisi total hari itu (kas expected, kas real, selisih, status setoran "x/y diverifikasi"). Klik ▶ untuk melihat rincian tiap shift beserta tombol Detail & verifikasi setorannya (tetap per shift). Tombol **Detail Hari** menampilkan angka tiap shift berdampingan + total dan bisa mencetak struk gabungan. Pengelompokan tidak dipakai saat filter Status/Setoran aktif; shift buatan backoffice (penjualan grosir) tidak ikut digabung.

### Changed
- Kotak "Shift Ditutup!" di kasir sekarang menutupi seluruh layar dan hanya bisa ditinggalkan lewat tombolnya: tombol Esc dan tombol Kembali browser tidak berlaku, muat ulang/tutup tab meminta konfirmasi.
- Tombol "Serah Terima ke Kasir Berikutnya" hanya muncul saat menutup shift 1; shift ke-2 dst. langsung selesai.
