<!-- tayang: 2026-11-04 05:00 -->
### Added
- **Laporan Bongkaran** (Gaji › Laporan Bongkaran): Kepala Gudang mencatat bongkaran dalam 5 langkah dari HP — supplier dan tanggal kerja, barang (dicari dari daftar produk kasir), peserta, foto surat jalan, lalu periksa. Sistem yang menghitung: kg tiap barang = jumlah × berat per satuan, total upah = total kg × tarif per kg (awal Rp20), dibagi rata ke peserta; sisa rupiah diberikan Rp1 per orang menurut abjad. Laporan langsung berlaku dan Finance diberi tahu untuk membayar. Isian tersimpan di HP selama belum terkirim (foto perlu diambil ulang bila halaman dimuat ulang).
- **Berat per satuan** disimpan per produk dan satuan saat pertama diisi (berat dari kasir ditampilkan sebagai saran), lalu terisi otomatis di bongkaran berikutnya. Mengubah berat wajib alasan; perubahan lebih dari 10% masuk daftar **Berat berubah** untuk Pemilik/GM. Laporan lama tidak ikut berubah.
- **Barang lain**: hanya muncul bila pencarian tidak menemukan barang; wajib nama, kg, dan alasan. Pemilik/GM melihat semuanya di tab Barang lain dan bisa memasangkannya ke produk (kg dan upah laporan itu tidak berubah).
- **Laporan terlambat**: tanggal kerja lebih dari 3 hari lalu wajib alasan dan menunggu persetujuan Pemilik/GM yang bukan pembuat dan bukan peserta; selama menunggu belum ada upah.
- Tanda di laporan (bukan penahan): pembuat ikut jadi peserta, Barang lain, berat berubah, tanpa surat jalan, tanggal mundur, serupa dengan laporan lain. Laporan kedua dengan tanggal, supplier, dan total kg yang sama wajib dikonfirmasi "Ini bongkaran lain".
- Peserta yang hari itu tercatat izin, sakit, cuti, atau alpha tetap mendapat bagian, dan muncul di **Bongkaran Perlu Dilihat** untuk HR (tanpa nominal).
- **Pekerja Lepas** (Karyawan › Pekerja Lepas): nama dan nomor HP saja, tanpa akun, absen, atau slip. Bisa ditambah langsung dari Laporan Bongkaran; nomor HP yang sudah dipakai orang lain ditolak.
- Kartu Beranda: laporan bongkaran belum dibayar, peserta perlu dilihat, dan perubahan berat yang perlu dilihat.
- Pengaturan baru: tarif bongkaran per kg, batas mundur tanggal kerja, cabang penanggung biaya (awal Gudang), ambang beda berat, dan batas lebih bayar.
