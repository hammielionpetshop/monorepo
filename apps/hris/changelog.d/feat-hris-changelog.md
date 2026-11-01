<!-- tayang: 2026-11-01 20:23 -->
### Added

- **Apa yang baru.** Halaman riwayat perubahan HRIS di menu Sistem, seperti Changelog di aplikasi kasir. Perubahan yang sudah tayang di staging tetapi belum dirilis tampil sebagai "Sedang diuji".
- **Tanda Baru.** Menu dan bagian halaman yang baru diberi tanda **Baru** selama 7 hari (lama tampilnya bisa diubah di Pengaturan › "Tanda Baru tampil"). Di HP, tombol Menu diberi titik bila ada menu baru di dalamnya.
- **Pengaturan.** Angka aturan HRIS bertanggal berlaku: panjang alasan paling sedikit, jeda tombol konfirmasi, masa training sebelum dinilai, dan lama tanda Baru. Tiap angka menampilkan nilai sekarang, berlaku sejak, dan nilai berikutnya; bisa diubah (nilai baru → tanggal berlaku + alasan → periksa), dilihat riwayatnya, dan dibatalkan bila belum berlaku. Yang menyangkut hitungan paling cepat berlaku besok, tidak ada yang berlaku mundur. Hanya Pemilik dan GM yang mengubah.
- **Pengaturan Jabatan.** Tabel jabatan dengan tanda "Saran role kasir" dan "Tugas lapangan otomatis", bertanggal berlaku dengan riwayat per jabatan. HR bisa melihat; usulan HR menyusul bersama kotak Persetujuan.
- **Akun & Tautan.** Pemilik dan GM membuat akun untuk karyawan (wajib ganti password saat masuk pertama), menautkan akun lama, melepas tautan, reset password, mengeluarkan dari semua perangkat, serta memberi, mengubah, dan mencabut akses kasir (role, cabang utama, cabang tugas). Role akses kasir terisi dari saran jabatan dan tetap bisa diganti.
- **Riwayat Masuk.** Semua masuk dan gagal masuk ke HRIS dan kasir, bisa disaring per orang, hasil, dan tanggal. Di Profil saya: perangkat yang sedang masuk dan riwayat masuk 30 hari.
- **Karyawan.** Daftar karyawan (cari dan saring), Tambah karyawan dengan kode otomatis `HML-0001`, Halaman orang (ubah data, pindah cabang / ganti jabatan / ganti status kerja bertanggal, nonaktifkan dan aktifkan lagi, izin menyetir dan kenek), Promosi Training, dan Profil saya (ubah kontak sendiri, ganti password). Tidak ada data yang dihapus; riwayat tetap tersimpan. Menonaktifkan karyawan ikut menonaktifkan akunnya di semua aplikasi.
- **Izin tugas lapangan otomatis.** Orang yang jabatannya bertanda tugas lapangan otomatis ditandai "Otomatis (jabatan …)".
- **Cabang & Jabatan dan Hak Akses Jabatan.** Cabang, departemen, dan 13 jabatan awal beserta hak awalnya. Menu hanya tampil bagi yang berhak dan setiap perubahan tercatat. Pemilik dan GM memegang semua hak.
- **Tampilan HRIS.** Tampilan baru untuk HP dan komputer: menu samping berkelompok yang bisa dilipat, bilah bawah di HP, tema Terang / Gelap / Ikuti perangkat.

### Changed

- **Alasan lebih jelas.** Semua isian alasan (lepas tautan, nonaktifkan, cabut izin, batalkan catatan, ubah pengaturan) paling sedikit 15 huruf.
- **Masa training dari Pengaturan.** Antrean Promosi Training memakai masa training dari Pengaturan; mengubahnya tidak menggeser orang yang sudah genap sebelum tanggal berlakunya.

### Fixed

- **Menu samping tidak ikut tergulir.** Di layar lebar, menu samping dan header diam; hanya isi halaman yang digulir.
