### Added

- Menu baru **Shift › Setoran** untuk Owner, GM, dan Finance dengan 4 tab: **Menunggu Verifikasi**, **Non-tunai**, **Tunai belum disetor**, dan **Riwayat**. Finance mengetik uang yang benar-benar diterima, merinci sebab selisih (biaya setor bank, kurang/lebih dari kasir, lainnya), lalu menekan Verifikasi — perpindahan uang dari Laci ke tujuan tercatat otomatis.
- Tombol **Terima Setoran** untuk uang tunai yang diantar ke kantor (termasuk tunai Bulk Sale Gudang): pilih cabang dan shift, tujuan Brankas/Tunai, ketik uang diterima — langsung terverifikasi.
- Menu baru **POS › Setor Tunai** untuk tim cabang yang menyetor tunai ke bank: centang shift yang disetor, pilih rekening, nominal, tanggal, dan foto slip (opsional), lalu kirim ke Finance. Bisa dibatalkan selama belum diverifikasi.
- Verifikasi **non-tunai per shift per metode** (QRIS, transfer, e-wallet) dari mutasi rekening, termasuk pelunasan non-tunai dari Back Office tanpa shift. Bisa disimpan sebagai **Dana belum cair** lalu diselesaikan kemudian; tanda merah bila lewat batas hari.
- Peringatan tunai belum disetor (bawaan 5 hari atau Rp25 juta) dan badge jumlah setoran menunggu verifikasi di menu Setoran.
- Kolom **Tunai (setoran)** di Pengaturan › Tempat Uang › Metode Bayar per Cabang untuk tujuan bawaan setoran tunai tiap cabang.
- Detail Shift menampilkan status tunai (belum disetor / menunggu verifikasi / terverifikasi + nomor setoran) dan status non-tunai per metode, termasuk tanda bila angka sistem berubah sesudah diverifikasi.

### Changed

- Verifikasi setoran di Riwayat Shift diganti tautan ke menu Setoran; shift yang sudah diverifikasi cara lama tetap tampil seperti sebelumnya. Shift lama yang belum diverifikasi ikut masuk Tunai belum disetor dengan tanda *lama*.
- Laporan Minus Kasir untuk shift yang disetor lewat menu Setoran membaca rincian sebab dari Finance: hanya kurang/lebih dari kasir dan salah input kasir yang dibebankan ke kasir; biaya bank tidak masuk.
- Setoran yang sudah terverifikasi hanya bisa dikoreksi Owner/GM dengan setoran koreksi baru; catatan lama tidak ditimpa.
