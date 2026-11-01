# Spec HRIS L3b — Absen dan Istirahat

Tanggal: 2026-11-01 · Status: **disetujui owner 2026-11-01 (§9 seluruhnya sesuai saran)**
Cakupan: bagian kedua L3, yaitu 4D-2a di [PRD 05](../../hris_planning/PRD/fase_1/05-kehadiran.md), ditambah satu layar dari 4D-2b.
Sumber: v3 `02-kehadiran` KEH-08, 10 s.d. 18, 21, 22, 24 s.d. 26, 30, 82 s.d. 88, 108 s.d. 113; `kehadiran-spec` §3.2, §10 (no 19 s.d. 34), §12 (W9 s.d. W15).
Dasar kode: L3a (shift, jadwal, QR, hari tutup), L2f-1 (lampiran tertutup, `notify()`), L2e (pengaturan bertanggal).
Aliran migrasi: **`hris` 0009**. Modul: `apps/hris/modules/attendance`.

**Syarat owner:** absen QR wajib dengan GPS (tanpa lokasi ditolak; di luar radius tetap dicatat dan ditinjau), dan foto diri hanya dari kamera langsung.

## 1. Batas

**Dikerjakan:** Absen, Langkah Absen, Perbantuan atau Salah Scan, Istirahat dan Masuk Kembali, Daftar Perbantuan, Foto Absen Hari Ini, perhitungan telat, pulang cepat, dan lewat batas istirahat, penghapus foto 60 hari.

**Tidak dikerjakan di L3b:**

| Hal | Di mana | Akibat sementara |
|---|---|---|
| Laporan Pulang (KEH-89) | Bagian Laporan Pulang | Pulang langsung tercatat saat Kirim |
| Sudah Pindah Cabang? (KEH-L10) | Bagian Laporan Pulang, karena muncul sesudah laporan (§9 butir 6) | Pertanyaan belum muncul; hari berturut-turut tetap bisa dihitung dari catatan |
| Tinjau absen, koreksi, pola mencurigakan, rekap, Kehadiran Saya | L3c (4D-2b) | Tanda "perlu ditinjau" tersimpan dan terlihat, belum bisa diputuskan |
| Jadwal libur (pesan "Hari ini jadwal libur Anda") | Bagian Libur dan Izin | Hanya hari tutup yang menutup tombol Masuk |
| Penanda lupa absen pulang, alpha, Perlu Dijelaskan | Bagian Perlu Dijelaskan | Dapat dihitung nanti dari catatan |
| Daftar Pengecualian per orang (KEH-09) | Bagian Perlu Dijelaskan | Semua orang mengikuti cabang dan jabatannya |
| Slip tertahan (KEH-14) | Gaji (L4) | Belum ada slip |

HRIS belum dipakai sungguhan, jadi urutan bertahap ini tidak menimbulkan celah di data nyata.

## 2. Data (`hris` 0009)

Catatan absen tidak bisa diubah atau dihapus (pagar trigger, KEH-16, PRI-02). Koreksi nanti ditulis terpisah di L3c.

| Tabel | Isi | Kunci/pagar |
|---|---|---|
| `attendance_attempts` | orang, waktu server, jenis yang dicoba, QR, cabang QR, lintang, bujur, akurasi, jarak, hasil (`OK`, `OUTSIDE`, `NO_LOCATION`, `BAD_QR`, `WRONG_BRANCH`, `TOO_EARLY`, `CLOSED`, `TOO_SOON`) | hanya tambah; semua percobaan tercatat (KEH-12) |
| `attendance_days` | orang, tanggal hari kerja, cabang tempat Masuk, shift, versi jam, asal shift, menit telat, menit pulang cepat, menit lewat batas istirahat, catatan "tidak istirahat karena sendiri" | unik orang + tanggal |
| `attendance_records` | hari kerja, jenis (`IN`, `BREAK`, `RETURN`, `OUT`), cabang, jam server, titik, akurasi, jarak, perlu ditinjau, foto, percobaan asal | unik hari kerja + jenis, sehingga tekan dua kali tercatat sekali |
| `branch_assists` | orang, tanggal, cabang asal, cabang tujuan, jawaban (perbantuan atau salah scan), shift yang dipakai, dipilih sendiri | perbantuan paling banyak satu per orang + tanggal |
| `attendance_photo_views` | foto, dibuka oleh, kapan | hanya tambah (KEH-119) |

Foto memakai `files` dari L2f-1, ditambah kolom waktu dihapus. Isi berkasnya dibuang saat lewat masa simpan; baris absen, jam, dan angkanya tetap.

**Pengaturan baru (bertanggal berlaku, layar yang sudah ada):**

| Kunci | Isi awal | Sumber |
|---|---|---|
| `attendance.earliest_in_minutes` | 120 | KEH-111 |
| `attendance.min_out_minutes` | 15 | KEH-17 |
| `attendance.out_cutoff_time` | 04.00 | KEH-18 |
| `attendance.photo_retention_days` | 60 | KEH-15 |
| `attendance.guard_minimum` | 1 | KEH-85 |
| `position.late_applies` (Kena telat) | ya | KEH-25 |
| `position.break_required` (Wajib absen istirahat) | ya; tidak untuk jabatan gudang, Driver, Kenek | KEH-84 |
| `position.is_guard` (Penjaga cabang) | tidak; ya untuk Kasir | KEH-85 |

## 3. Aturan

Aturan murni ada di `modules/attendance/rules`, tanpa DB, dan paling banyak dites.

- **Tombol** hanya yang berlaku saat ini (tabel KEH-L06). Tidak ada pertanyaan "masuk atau pulang?" (KEH-108).
- **Jam selalu jam server.** Jam HP tidak dikirim dan tidak dipakai (KEH-16).
- **Hari kerja:** absen masuk tanpa pulang tetap menjadi hari kerja aktif sampai batas 04.00 keesokan hari (KEH-18). Sesudah itu layar kembali ke Masuk untuk hari baru.
- **Masuk paling awal** 2 jam sebelum jam masuk shift. Pesan menyebut jam dibukanya (KEH-111). Shift belum ditentukan: boleh Masuk, tanpa hitungan telat (KEH-103).
- **Pulang** paling cepat 15 menit sesudah Masuk, diperiksa juga di server (KEH-17).
- **Masuk Kembali dan Pulang** harus memakai QR cabang tempat Masuk (KEH-110).
- **Jam kerja sehari** mengikuti cabang tempat Masuk (KEH-08). Hari tutup diperiksa pada cabang QR yang dipindai (KEH-113).
- **Perbantuan:** pertanyaan muncul sebelum lokasi dan foto. Shift memakai nama yang sama di cabang tujuan; bila tidak ada, orang memilih sendiri dan kepala cabang tujuan diberi tahu (KEH-109).
- **Lokasi:** tanpa titik GPS, absen ditolak dan percobaannya dicatat. Jarak dihitung server dari titik yang dikirim HP ke titik cabang. Di luar radius tetap lanjut dan ditandai perlu ditinjau (KEH-14). Radius memakai nilai pada tanggal absen.
- **Foto:** dari kamera langsung lewat browser (`getUserMedia`), tanpa pilihan berkas, tersimpan tidak terbalik, dikompres di HP. Berkas tidak dipasang di Caddy; keluarnya hanya lewat route yang memeriksa hak dan mencatat pembukaan.
- **Kirim:** server memeriksa ulang QR, urutan, dan batas waktu dalam satu transaksi. Hasil lokasi harus dari langkah lokasi 5 menit terakhir; lebih dari itu orang diminta mengulang. Bila sinyal putus: "Belum terkirim. Coba lagi", dan tidak ada yang tercatat.
- **Telat** dihitung sekali saat Masuk dan disimpan, hanya bila `position.late_applies` ya dan shift diketahui (KEH-21). Angka tidak tampil di layar absen. **Pulang cepat** dihitung saat Pulang (KEH-24).
- **Istirahat:** satu kali per hari, hanya dalam rentang jam mulai, tanpa QR dan tanpa foto (KEH-83). Lokasi dicatat bila ada (§9 butir 2).
- **Masuk Kembali:** langkah lengkap. Lewat batas = Masuk Kembali − mulai − lama istirahat, disimpan sekali, tanpa akibat (KEH-86).
- **Penjaga:** hanya diperiksa bila yang menekan berjabatan penjaga (KEH-112). Sesudah ia istirahat harus tersisa paling sedikit 1 penjaga yang sudah masuk, belum pulang, dan tidak istirahat. Pemeriksaan memakai kunci per cabang supaya dua kasir yang menekan bersamaan tidak lolos keduanya (KEH-85).

**Batas yang perlu diketahui:** titik GPS berasal dari HP, jadi aplikasi pemalsu lokasi tidak bisa dideteksi dari browser. Penangkalnya foto diri, tanda pola lokasi di L3c, dan peninjauan HR.

## 4. Layar

| Layar | Alamat | Menu | Isi |
|---|---|---|---|
| Absen (KEH-L06) | `/absen` | Saya + bilah bawah | Cabang, shift, keadaan sekarang, tombol yang berlaku |
| Langkah Absen (KEH-L07) | bagian `/absen` | — | Pindai QR → Lokasi → Foto → Kirim. Kembali, Ulangi, Foto ulang |
| Perbantuan atau Salah Scan (KEH-L08) | bagian `/absen` | — | Dua tombol besar; pilih shift bila tidak ada yang sama |
| Istirahat dan Masuk Kembali (KEH-L09) | bagian `/absen` | — | Tekan Istirahat; sisa waktu; pesan penolakan menyebut nama teman dan jamnya |
| Daftar Perbantuan (KEH-L11) | `/kehadiran/perbantuan` | Kehadiran | Hari ini + 7 hari, cari, saring cabang, tanda Shift dipilih sendiri |
| Foto Absen Hari Ini (KEH-L14) | `/kehadiran/foto-hari-ini` | Kehadiran | Deretan foto per cabang, stempel, tanda Perlu ditinjau. Tanpa unduh |

**QR:** kedua cara berjalan. Kamera HP biasa membuka tautan QR `/absen?c=<kode>`, dan sesudah login orang kembali ke alamat itu dengan langkah pindai terlewati. Di dalam aplikasi ada tombol Pindai dengan kamera. QR yang sudah tercetak dari L3a tetap berlaku.

**Stempel foto** ditampilkan di atas foto saat dilihat, dari data absen (nama, jam server, cabang, titik, jarak). Lihat §9 butir 4.

## 5. Hak

Pemilik dan GM memiliki semuanya untuk melihat (KAR-67). S = semua, C = cabang atau departemennya.

| Tindakan | HR | Admin HR | Kepala Toko | Kepala Gudang | Finance |
|---|---|---|---|---|---|
| `attendance.self.check` (absen sendiri) | semua jabatan dengan cara absen `QR` | | | | |
| `attendance.assist.view` | S | S | C | C | — |
| `attendance.photo.view` | S | — | C | C | — |
| `attendance.attempts.view` (dipakai L3c) | S | — | — | — | — |

Pemilik dan GM tidak diabsen, sehingga menu Absen tidak tampil bagi mereka. Driver dan Kenek menunggu absen lewat trip (L6).

## 6. Mesin terjadwal

| Pekerjaan | Jadwal (WIB) | Isi |
|---|---|---|
| `attendance-photo-purge` | Tiap hari 02.00 | Membuang isi foto lewat masa simpan. Jam dan angka tetap. Aman diulang |

## 7. Pemberitahuan

| Kejadian | Kepada |
|---|---|
| Perbantuan dengan shift dipilih sendiri | Kepala cabang tujuan |

Perbantuan lain cukup terlihat di Daftar Perbantuan.

## 8. Tes

**Unit (`rules`):** W9 tombol; W10 pulang 15 menit; W11 batas 04.00; W12 masuk paling awal bertanggal; W13 shift perbantuan; W14 lewat batas; W15 jam server; jarak dan radius; telat dan pulang cepat, termasuk shift lewat tengah malam; penjaga (no 25 s.d. 27).

**Integrasi DB:** catatan tidak bisa diubah atau dihapus; tekan dua kali tercatat sekali; QR mati ditolak; tanpa lokasi ditolak dan percobaan tercatat; luar radius tercatat dengan tanda; QR cabang lain ditolak saat Pulang; dua kasir bersamaan; penghapus foto menyisakan jam; hak foto dan jejak pembukaan.

**Uji owner di staging**, memakai karyawan uji di HP sungguhan, Android dan iPhone: daftar langkah dikirim saat tayang. Harus ada uji di dalam dan di luar radius, serta izin lokasi ditolak.

**Syarat HRIS:** fragment `apps/hris/changelog.d` + tanda Baru di `lib/new-features.ts` untuk tiap menu baru.

## 9. Keputusan owner (disetujui 2026-11-01)

1. **Akurasi GPS:** di dalam ruangan GPS bisa meleset puluhan meter, sehingga orang yang benar di toko bisa terbaca di luar radius. **Saran: dinilai dari titiknya saja**, akurasi disimpan dan diperlihatkan ke peninjau. Absen tetap tercatat, jadi akibatnya hanya tambahan tinjauan HR.
2. **Istirahat tanpa GPS:** syarat wajib GPS Anda untuk absen QR, sedangkan Istirahat tanpa QR. **Saran: Istirahat tetap diterima bila lokasi tidak terbaca**, karena orang boleh keluar makan dan titiknya tidak dinilai (KEH-83). Masuk Kembali tetap wajib GPS.
3. **Pemindai QR di aplikasi:** butuh pustaka baru `jsqr` karena iPhone belum punya pemindai bawaan di browser. **Saran: setuju.** Hanya dimuat di layar absen.
4. **Stempel foto:** v3 menulis stempel pada foto. **Saran: tampilkan di atas foto dari data absen**, tanpa pustaka olah gambar di server. Isinya sama, dan foto memang tidak bisa diunduh.
5. **Foto Absen Hari Ini dimajukan dari L3c:** **saran: setuju**, supaya foto dan tanda luar radius bisa diperiksa sejak bagian ini.
6. **Sudah Pindah Cabang? dimundurkan ke bagian Laporan Pulang:** v3 memunculkannya sesudah laporan. **Saran: setuju.**
7. **Pembulatan telat:** **saran: dibulatkan ke bawah per menit.** Masuk 08.05 lewat 40 detik dihitung telat 5 menit. Ini berakibat ke batas tanpa potongan 5 menit (KEH-22).
8. **Laporan Pulang sementara:** **saran: Pulang langsung tercatat saat Kirim** sampai bagian Laporan Pulang dibangun, lalu aturan KEH-89 berlaku sebelum HRIS dipakai sungguhan.
