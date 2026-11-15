<!-- tayang: 2026-11-04 23:20 -->
### Added

- **Logistik › Trip: Siap Kirim.** Kepala Gudang menekan **Siap Kirim** di rincian trip setelah trip lengkap (awak, isi, dan tarif diperiksa). Driver dan kenek baru melihat trip itu di Trip Saya, dan **Berangkat hanya bisa dari Siap Kirim**. Mau mengubah lagi? Tekan **Kembali ke Draft** selama belum berangkat.
- **Trip Saya: kunjungan toko di HP.** Tiap toko punya kartu berisi alamat, telepon (bisa ditekan), catatan pengiriman, dan daftar nota. Tombol **Terkirim** (foto barang diterima), **Kirim Besok**, dan **Gagal** (pilih alasan baku + foto; Lainnya wajib keterangan). Terkirim menunggu Ambil barang di cabang asal selesai. Kirim Besok bisa **Coba lagi** selama trip masih berjalan. Bila dua awak menekan bersamaan, yang kedua diberi tahu "Sudah diproses [nama] pukul [jam]". Ada hitungan "x dari y selesai".
- **Foto bak kosong → Menuju Garasi.** Sesudah semua kunjungan, ambil barang, dan belanja beres, awak memotret bak (kosong, atau barang yang ikut pulang) lalu trip menjadi **Menuju Garasi**. Belum beres tapi harus pulang? **Selesai lebih awal** (alasan + foto): sisa kunjungan menjadi Kirim Besok dan surat jalannya kembali ke antrean, ambil barang menjadi Belum siap, belanja tidak jadi. Kepala Gudang, Pemilik, dan GM diberi tahu.
- **Sampai Garasi + foto amper bensin.** Sampai Garasi sekarang sesudah Menuju Garasi, di titik garasi, dengan foto amper bensin. Ritase dan jam pulang tetap tercatat saat itu, sama seperti sebelumnya.
- **Laporan Pulang driver.** Sesudah Sampai Garasi, driver mengisi tiga layar: **keadaan mobil** (Baik / Perlu perhatian + masalahnya, foto boleh), **perlu isi bensin besok?** (perkiraan nominal, kelipatan Rp 1.000), dan **ada masalah?** (boleh dilewati). Kenek tidak mengisi. Bila ditunda, kartu "Laporan Pulang menunggu" tetap ada di Trip Saya sampai besok.
- **Logistik › Bensin & Mobil** (Kepala Gudang, Finance, Pemilik, GM): daftar **Perlu isi bensin** (satu per mobil; laporan baru menggantikan yang lama) dengan tombol **Sudah diisi**, dan **Mobil perlu perhatian** dengan tombol **Selesai** (catatan boleh), ditambah Laporan Pulang terakhir. Pencatatan uang bensin ke Buku Kas menyusul.
- **Surat Jalan: tab Perlu keputusan, Terkirim, dan Batal logistik.** Kiriman Gagal masuk **Perlu keputusan**: Kepala Gudang, Pemilik, atau GM memilih **Kirim ulang** (kembali ke antrean, bertanda tertunda) atau **Batal** (alasan wajib, dengan pengingat untuk membatalkan juga di kasir). Pemilik/GM bisa **Buka lagi** surat jalan Batal sampai 7 hari. Ada pemberitahuan saat kiriman Gagal.
- **Beranda:** kartu surat jalan perlu keputusan, mobil perlu isi bensin, dan mobil perlu perhatian.

### Changed

- Trip tidak lagi menutup otomatis kunjungan yang belum diproses saat Sampai Garasi. Sekarang trip harus Menuju Garasi dulu, atau lewat Selesai lebih awal. Tutup atas nama driver oleh kantor tetap menjadikan sisanya Kirim Besok.

### Fixed

- Tab **Dalam perjalanan** di Surat Jalan sekarang benar-benar menampilkan surat jalan yang sedang di trip. Sebelumnya tab itu menampilkan isi Menunggu dikirim.
