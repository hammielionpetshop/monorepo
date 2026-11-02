<!-- tayang: 2026-11-02 08:58 -->
### Added

- **Perlu Dijelaskan** (menu Saya, dengan angka): tiap pagi pukul 04.20 sistem memeriksa hari kemarin dan mencatat yang perlu Anda jelaskan: **Alpha** (hari kerja tanpa absen dan tanpa izin), **Lupa absen pulang** (termasuk Laporan Pulang yang tidak terkirim), **Lupa Masuk Kembali**, **Telat** lebih dari 30 menit, dan **Pulang cepat** lebih dari 30 menit. Tiap kartu menyebut sisa waktu (kuning sisa 1 hari, merah hari terakhir) dan akibatnya bila dibiarkan. Batasnya 3 hari sesudah tanggalnya, pukul 23.59. Tab Menunggu keputusan dan Selesai menyimpan riwayatnya.
- **Isi Penjelasan**: alpha dijelaskan sebagai sakit tanpa surat, sakit dengan surat dokter (boleh menyusul), lupa absen (isi jam masuk dan pulang), atau izin mendadak; tidak ada pilihan "pakai jatah libur". Alpha beberapa hari berturut-turut bisa dijelaskan sekaligus. Lupa absen pulang dan Masuk Kembali mengisi jam yang benar; telat dan pulang cepat mengisi alasan. Untuk lupa absen, tombol Kirim ditahan dan menyebut bahwa ini dikenai denda lupa absen, termasuk "kejadian ke-5, ada tambahan" (nominal tampil di slip nanti).
- **Ajukan terlambat**: lupa absen yang lewat batas 3 hari masih bisa diajukan dengan alasan keterlambatan; tercatat terlambat dan denda tetap berlaku. Alpha dan telat yang lewat batas tetap berlaku.
- **Perlu Dijelaskan Tim** (menu Kehadiran): siapa yang belum menjelaskan, yang hampir lewat batas, penjelasan yang menunggu keputusan, dan **tidak masuk 7 hari kerja berturut-turut** (sakit tanpa surat, izin, atau alpha) dengan tombol Sudah dilihat. Kepala Toko dan Kepala Gudang hanya melihat lingkupnya.
- **Keterangan pembantu di Persetujuan** untuk penjelasan: catatan asli server berdampingan dengan jam yang diisi (selisih janggal ditandai), hitungan kejadian lupa absen periode ini, jumlah penjelasan sebelumnya, bentrokan, dan label Terlambat / Ajukan ulang ke-n. Penyetuju tidak mengubah jam; bila salah, tolak dengan alasan. Persetujuan bisa dicabut dengan alasan.
- **Laporan Kebiasaan Lupa Absen** (menu Kehadiran, hanya Pemilik dan GM): orang yang lupa absen lebih dari 4 kali dalam satu periode, dengan jumlah lupa masuk, lupa pulang, dan lupa Masuk Kembali, tanpa nominal.
- **Status hari Alpha** di Catatan Hari Kerja, Rekap Kehadiran, dan Kehadiran Saya. Penjelasan sakit atau izin yang disetujui mengubahnya menjadi Sakit/Izin; lupa absen yang disetujui menjadi Hadir bertanda "Diisi lewat klarifikasi".
- **Pemberitahuan**: saat ada yang perlu dijelaskan, sisa 1 hari, dan hari terakhir; tanda tidak masuk berturut-turut ke HR, Pemilik, dan GM; Pemilik dan GM diberi tahu bila seseorang melewati ambang lupa absen. Beranda menampilkan jumlah yang perlu dijelaskan.
- **Pengaturan baru**: batas menjelaskan, ambang telat dan pulang cepat yang wajib dijelaskan, tanda tidak masuk berturut-turut, dan ambang kebiasaan lupa absen.

### Changed

- Izin, sakit, atau cuti yang ditolak atau dicabut sesudah tanggalnya lewat kini menjadi alpha dengan batas menjelaskan 3 hari dari saat itu. Koreksi HR yang mengisi hari itu melepas kartunya dari Perlu Dijelaskan.
