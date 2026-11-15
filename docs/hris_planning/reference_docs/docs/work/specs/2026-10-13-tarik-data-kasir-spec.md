# Spec Siap Bangun: Tarik Data Kasir (Tahap 4C)

Tanggal: 13 Oktober 2026
Status: **disetujui penuh 13 Oktober 2026** (T1 s.d. T8 sesuai saran, bagian 13).

Bahan: PRI-39 (dan pelapisnya PRI-41), PRI-01, 02, 04, 10, 31 s.d. 33, 35;
TAM-01 s.d. 07, 13 s.d. 17, 24, 25; SIS-05, 07, 09, 29; LOG-01, 08, 38, 42, 65,
76, 89; GAJ-61; DRV-38, 39; KEU-47, 52, 57, 58, 62, 72, 94, 97, 111;
`2026-10-13-tarik-data-kasir-desain.md` (3F, tidak diulang di sini),
`2026-10-13-perlengkapan-bersama-spec.md` (BER-L30, L40, L41).

Bentuk spec mengikuti bagian 0 `2026-10-13-karyawan-dan-akses-spec.md`. Kode
layar memakai awalan **TDK**. Tampilan disusun dari komponen baku
(`../desain/README.md`); tidak digambar.

---

## 1. Batas

**Dikerjakan:** satu-satunya pintu antara HRIS dan sistem kasir: menarik data,
menerima file unggahan, mencatat tiap tarikan, memasangkan nama kasir dengan
data HRIS, menandai perubahan dan data yang tidak cocok, potret keadaan awal.

**Tidak dikerjakan di spec ini:**

| Hal | Di mana |
|---|---|
| Pintu baca di sisi kasir (kunci, daftar yang disediakan) | Project kasir; titipan Tahap 5 (diminta terpisah, aturan push project kasir berlaku) |
| Tampilan data kasir di Logistik, Keuangan, Gaji, Kinerja | Spec modul masing-masing (4F, 4E, 4G, 4H, 4I); mereka hanya membaca hasil modul ini |
| Rumus bonus grooming dan bonus ongkir | GAJ-61 dan LOG-76 (spec 4E dan 4F) |
| Baris mesin di Kesehatan Mesin | BER-L30 (4B); modul ini hanya mendaftarkan mesinnya |
| Jam buka cabang | 4D Kehadiran (modul ini hanya membacanya) |
| Menulis ke kasir dalam bentuk apa pun | **Tidak ada** (PRI-39 butir 1, K7) |
| Posisi isi file contoh asli per jenis data | Titipan Tahap 5 (T4) |

---

## 2. Daftar layar

| Kode | Layar | Letak di menu | Dipakai | Ukuran utama |
|---|---|---|---|---|
| TDK-L01 | Data Kasir (status per jenis data) | Kantor › Data Kasir | Kepala Gudang, Finance, GM, Owner | PC |
| TDK-L02 | Riwayat Tarikan | dari TDK-L01 | Finance, GM, Owner | PC |
| TDK-L03 | Unggah File (3 langkah) | dari TDK-L01 | Finance, GM, Owner | PC |
| TDK-L04 | Belum Dipasangkan | Kantor › Data Kasir | Finance, HR, GM, Owner (tab menurut hak) | PC |
| TDK-L05 | Pasangkan satu nama | dari TDK-L04 | sama | PC |
| TDK-L06 | Perlu Diperiksa | Kantor › Data Kasir | pemegang datanya | PC |
| TDK-L07 | Rincian periksa | dari TDK-L06 | sama | PC |
| TDK-L08 | Potret Keadaan Awal | dari TDK-L01 | Finance, GM, Owner | PC |

Jumlah: 8 layar. Jadwal dan angka lain tidak punya layar sendiri: diubah lewat
kerangka Pengaturan 4B (BER-L40, L41).

---

## 3. Rincian layar

Berlaku untuk semua layar: error di jendela "OK, paham"; tombol simpan terkunci
sampai selesai; isian tidak hilang kalau sinyal putus; daftar dibagi per halaman
dan bisa dicari (PRI-10); jam dari server (PRI-01).

### TDK-L01. Data Kasir

- **Isi:** satu baris per jenis data (daftar jenis di 3F bagian 1): nama, **data
  kasir terakhir masuk: jam …** (PRI-39 butir 3), cara masuk yang menyala
  (**Diketik**, **File**, **Sambungan**), jadwal, hasil terakhir (label **Sehat**,
  **Gagal**, **Telat**, **Dimatikan**, sama dengan BER-L30), tombol
  **Tarik sekarang** (hanya jenis yang bercara Sambungan), tautan Riwayat dan
  Unggah File.
- **Tarik sekarang:** konfirmasi biasa; hasilnya tidak dobel kalau ditekan dua
  kali (PRI-33 butir 3). Tombol terkunci selama tarikan jenis itu berjalan.
- **Beda jabatan:** Kepala Gudang hanya melihat baris dan tombol Tarik sekarang,
  tanpa Riwayat, Unggah, dan tautan lain (T3). GM dan Owner juga melihat tombol
  **Nyalakan sambungan** / **Matikan sambungan** per jenis (T8, TDK-L01 bagian
  bawah, tombol ditahan 3 detik, alasan wajib).
- **Menyalakan sambungan** diumumkan lewat Papan Perubahan Aturan paling lambat
  7 hari sebelum berlaku (T8); sistem menolak tanggal lebih dekat.

### TDK-L02. Riwayat Tarikan

- Satu baris per tarikan: kapan, jenis, cara (sambungan / file / Tarik
  sekarang), oleh siapa atau oleh mesin, **baru**, **berubah**, **batal**,
  hasil, dan pesan gagal berbahasa sederhana dengan kode rujukan.
- Saring: jenis, hasil, tanggal. Bawaan 7 hari. Tidak bisa diubah atau dihapus.

### TDK-L03. Unggah File

1. **Pilih** jenis (daftar produk, nota supplier, sisa utang supplier versi
   kasir, jasa grooming, baris ongkir, dan jenis lain yang bercara File) dan
   berkasnya.
2. **Periksa:** pratinjau 10 baris pertama, jumlah baris, jumlah baris yang
   ditolak beserta alasannya. Kalau **kolom wajib tidak ada**, seluruh file
   ditolak dengan penjelasan (T4); tidak ada yang masuk setengah.
3. **Simpan:** pesan berhasil menyebut jumlah baru, berubah, dan batal.
- File yang isinya sama diunggah lagi tidak membuat baris dobel (T4).
- Mengunggah ulang daftar produk memperbarui daftar tanpa menghilangkan berat
  yang sudah tersimpan (DRV-38).

### TDK-L04 dan L05. Belum Dipasangkan

- **L04:** tab **Supplier**, **Toko**, **Groomer**, **Pengantar**, **Cabang**.
  Tiap tab: nama di kasir, dari jenis data apa, berapa baris menunggu, umur
  yang tertua. Nama **RETAIL** (transaksi tanpa pelanggan) tidak masuk daftar
  ini; ia hanya dihitung ke omzet.
- **Hak per tab (PRI-39 butir 6):** Supplier dan Toko untuk Finance; Groomer dan
  Pengantar untuk HR; Cabang untuk GM dan Owner; GM dan Owner melihat semuanya.
- **L05:** pilih orang atau pekerja lepas (Groomer, Pengantar), supplier atau toko
  (menurut tab), atau cabang. Satu nama kasir = satu pasangan (T2). Kalau orangnya
  belum ada: **Tambah pekerja lepas** (tindakan milik 4A, KAR-L28). Pasangan
  baru berlaku untuk semua baris yang namanya sama dan belum terkunci.
- **Pembetulan pasangan** (T2): memperbarui baris yang belum terkunci dengan tanda
  "berubah dari … menjadi …"; baris yang sudah terkunci masuk TDK-L06. Jendela
  konfirmasi menyebut berapa baris yang terkena kedua kelompok itu.
- Baris yang namanya belum dipasangkan **ditahan**: tidak dihitung ke bonus atau
  ke utang supplier, tetapi terlihat dengan umurnya (GAJ-61, KEU-62).

### TDK-L06 dan L07. Perlu Diperiksa

- **Tab Berubah di kasir:** baris data yang sudah terkunci (sudah diperiksa
  Finance, sudah tercatat di kasir, bulannya ditutup, atau bonusnya sudah
  disahkan atau dibayar) lalu berubah atau batal di kasir.
- **Tab Tidak cocok:** ketikan manual yang setelah 2 hari sambungan hidup tidak
  menemukan pasangannya di kasir, dan sebaliknya.
- **Pemegang:** Kepala Gudang untuk surat jalan; Finance untuk nota, omzet,
  settlement, QRIS, piutang; HR untuk bonus grooming dan ongkir (PRI-39 butir 4).
  Masing-masing hanya melihat bagiannya.
- **L07:** nilai sebelum dan sesudah, tanggal berubah di kasir, modul pemakai,
  dua tombol (T1):
  - **Terima perubahan:** dibuat baris koreksi bertanggal di modul pemakainya;
    yang lama tetap utuh (PRI-04). Alasan wajib.
  - **Biarkan dengan alasan:** angka lama tetap dipakai. Alasan wajib.
- Keputusan tidak bisa dicabut; kalau salah, baris baru muncul bila kasir
  mengubahnya lagi.

### TDK-L08. Potret Keadaan Awal

- Isi: stok per cabang, piutang toko, utang supplier versi kasir pada hari mulai
  (KEU-94). Satu tombol **Ambil potret**, ditahan 3 detik (TAM-15).
- **Sebelum jalan:** sistem memeriksa tarikan terakhir tidak lebih tua dari 15
  menit; kalau lebih, tombol mati dengan penjelasan (T7).
- **Hanya sekali.** Setelah ada, layar hanya menampilkan potret dan siapa yang
  mengambilnya. Salah angka dibetulkan lewat baris penyesuaian di Keuangan
  (KEU-94), bukan potret ulang.

---

## 4. Data

Semua tabel punya kolom perusahaan (PRI-31), jejak dibuat dan diubah, tidak ada
yang dihapus (PRI-02), dan indeks pada kolom pencarian (PRI-14).

| Tabel | Isi penting | Dicari dengan | Dibaca modul lain |
|---|---|---|---|
| jenis_data_kasir | kode jenis, nama, cara masuk menyala, jadwal, aktif | kode | semua |
| tarikan | jenis, mulai, selesai, cara, oleh (orang / mesin), baru, berubah, batal, hasil, pesan | jenis + waktu | Kesehatan Mesin |
| tarikan_file | tarikan, nama file, ukuran, sidik isi (mencegah dobel), baris ditolak | sidik isi | — |
| kasir_transaksi, kasir_transaksi_baris | nomor struk, cabang kasir, tanggal, pelanggan kasir (atau RETAIL), total, barang, jumlah, harga, batal | nomor struk + cabang | Logistik, Kinerja, Keuangan |
| kasir_settlement, kasir_qris | cabang, shift, cash, non-tunai per metode, piutang; per transaksi QRIS | cabang + shift | Keuangan |
| kasir_pelanggan, kasir_piutang | kode, nama; umur dan jatuh tempo | kode | Logistik, Keuangan |
| kasir_produk, kasir_po | kode, nama, satuan; nomor PO, barang, jumlah | kode | Gaji Driver |
| kasir_nota_supplier, kasir_utang_supplier | nama supplier kasir, nomor nota, nilai, sisa | nomor nota | Keuangan |
| kasir_omzet_harian, kasir_nilai_stok | cabang, tanggal, omzet, harga pokok; nilai stok, tidak laku, reject | cabang + tanggal | Keuangan, Kinerja |
| kasir_jasa_grooming, kasir_ongkir | groomer / pengantar (nama kasir), harga setelah diskon, nomor nota, cabang, tanggal diambil, batal atau retur | nomor nota | Gaji, Logistik |
| pasangan_nama_kasir | jenis (supplier, toko, groomer, pengantar, cabang), nama kasir, dipasangkan ke, oleh, kapan, dicabut | jenis + nama | semua modul pemakai |
| daftar_periksa_kasir | jenis data, baris, nilai sebelum, nilai sesudah, pemegang, status, keputusan, alasan, oleh | pemegang + status | modul pemakai |
| potret_awal | kapan, oleh, isi per cabang | — | Keuangan (KEU-94) |

Setiap baris data kasir membawa: **sumber** (sambungan / file / diketik),
**tarikan**, **kode asli kasir**, tanda **batal**, dan **berubah dari** bila
berubah. Cabang kasir dipasangkan ke cabang HRIS lewat `pasangan_nama_kasir`.

---

## 5. Tindakan bernama dan isi awal hak

Lingkup S = semua. Pemilik dan GM punya semua tindakan (KAR-67).

| Tindakan | HR | Finance | Kepala Gudang | Lainnya |
|---|---|---|---|---|
| lihat status Data Kasir | — | S | S | — |
| tarik sekarang | — | S | S | — |
| lihat riwayat tarikan | — | S | — | — |
| unggah file | — | S | — | — |
| lihat belum dipasangkan (supplier, toko) | — | S | — | — |
| lihat belum dipasangkan (groomer, pengantar) | S | — | — | — |
| pasangkan nama supplier, toko | — | S | — | — |
| pasangkan nama groomer, pengantar | S | — | — | — |
| pasangkan cabang | — | — | — | — |
| periksa perubahan surat jalan | — | — | S | — |
| periksa perubahan nota, omzet, settlement, piutang | — | S | — | — |
| periksa perubahan bonus grooming dan ongkir | S | — | — | — |
| nyalakan atau matikan sambungan | — | — | — | — |
| ambil potret keadaan awal | — | S | — | — |

Yang kosong di semua kolom hanya dimiliki Pemilik dan GM. Admin HR tidak punya
tindakan di modul ini kecuali yang dipakai HR yang diberi lewat Hak Akses
Jabatan.

---

## 6. Mesin otomatis

Semua punya penjaga (PRI-33): tiap jalan tercatat; gagal atau tidak jalan di
jadwalnya muncul di "perlu perhatian" GM; terlewat dikejar tanpa dobel.

| Mesin | Jadwal (pengaturan, PRI-32) | Kerjanya |
|---|---|---|
| Penarik 1 menit | Tiap 1 menit | transaksi (termasuk jasa grooming dan baris ongkir), settlement, QRIS, pelanggan |
| Penarik 1 jam | Tiap 1 jam | nota supplier, sisa utang versi kasir, piutang toko, PO |
| Penarik malam | Tiap malam | omzet dan harga pokok per cabang per hari |
| Penarik bulanan | Tanggal 1 pukul 02.00, dan ulang otomatis begitu opname terakhir di kasir berubah (4J-4 Q1; satu-satunya penarik nilai stok) | nilai stok, tidak laku, reject |
| Pencocok manual | Tiap 1 jam | mencocokkan ketikan manual dengan kasir lewat nomor struk atau nota + cabang (T5) |
| Pengejar kegagalan | Tiap 5 menit | mencoba lagi yang gagal; menilai gagal lebih dari 15 menit di jam buka (T6) |

**Jam buka** dibaca dari jam kerja cabang di Kehadiran; hari tutup tidak
dihitung (T6). Di luar jam buka gagal dikejar diam-diam; kalau masih gagal saat
jam buka pertama berikutnya, hitungan 15 menit dimulai dari jam itu.

---

## 7. Pemberitahuan (titipan 4J)

| Pemberitahuan | Kepada | Antrean atau Beranda | Alasan |
|---|---|---|---|
| Tarikan gagal lebih dari 15 menit di jam buka | GM, Owner | Antrean | Layar lain memakai data usang |
| Penarik tidak jalan pada jadwalnya | GM, Owner | Antrean | PRI-33 butir 2 |
| Nama baru belum dipasangkan (supplier, toko) | Finance | Antrean bila lebih dari 1 hari | Uang menunggu |
| Nama baru belum dipasangkan (groomer, pengantar) | HR | Antrean bila lebih dari 1 hari | Bonus ditahan (GAJ-61) |
| Cabang kasir belum dipasangkan | GM, Owner | Antrean | Semua data cabang itu tertahan |
| Ada baris Perlu Diperiksa | pemegang | Antrean | Orang lain menunggu |
| Ketikan manual tidak cocok setelah 2 hari | pemegang | Beranda | Perlu dilihat, bukan menahan orang |
| Sambungan dinyalakan atau dimatikan | semua orang yang memakai jenis itu | Pengumuman (Papan) | PRI-35 |
| File berhasil diunggah | pengunggah | Layar saja | Bukan tugas |

---

## 8. Pengaturan (titipan 4J)

| Pengaturan | Angka awal | Wajib diumumkan | Boleh dikecualikan per orang |
|---|---|---|---|
| Jadwal tiap jenis data | lihat bagian 6 | tidak | tidak |
| Pelanggan kasir yang ditandai "toko sendiri" (per cabang; dasar penjualan antar cabang, KEU-73; diisi Finance) | kosong | tidak | tidak |
| Batas gagal sebelum "perlu perhatian" | 15 menit | tidak | tidak |
| Cara masuk menyala per jenis | Diketik (semua), File (daftar produk, nota supplier) | **ya** (7 hari sebelumnya) | tidak |
| Lama ketikan manual menunggu pasangan | 2 hari | tidak | tidak |
| Masa simpan riwayat tarikan | 12 bulan (ringkasan tetap, PRI-40 butir 4) | tidak | tidak |
| Sidik isi file untuk mencegah dobel | menyala | tidak | tidak |

---

## 9. Jenis pengajuan milik modul ini (titipan 4J)

**Tidak ada.** Perubahan dari kasir ditangani lewat Perlu Diperiksa (TDK-L06),
bukan Mesin Pengajuan: tidak ada orang yang "meminta", data datang dari mesin.

---

## 10. Kejadian di lapangan

| No | Kejadian | Sistem berbuat apa | Aturan |
|---|---|---|---|
| 1 | Kasir mati 30 menit di jam buka | Layar lain tetap jalan dengan data terakhir ("terakhir masuk: jam …"); menit ke-15 GM diberi tahu | PRI-39 b3 |
| 2 | Kasir mati malam, hidup pagi | Dikejar tanpa dobel; GM tidak dibangunkan | T6 |
| 3 | Tombol Tarik sekarang ditekan dua kali | Hanya satu tarikan; tidak dobel | PRI-33 b3 |
| 4 | Finance mengunggah file yang sama dua kali | Pesan "file ini sudah masuk"; tidak ada baris dobel | T4 |
| 5 | File kehilangan kolom wajib | Ditolak seluruhnya dengan penjelasan | T4 |
| 6 | Transaksi dibatalkan di kasir | Ditandai batal di HRIS; kalau terkunci masuk Perlu Diperiksa | PRI-39 b4, PRI-02 |
| 7 | Nota yang sudah diperiksa Finance dikoreksi di kasir | Masuk Perlu Diperiksa dengan nilai sebelum dan sesudah | T1 |
| 8 | Nama groomer baru muncul | Ditahan; HR melihatnya di Belum Dipasangkan | GAJ-61 |
| 9 | Nama dipasangkan ke orang yang salah, lalu dibetulkan | Baris belum terkunci diperbarui bertanda; yang terkunci masuk Perlu Diperiksa | T2 |
| 10 | Transaksi tanpa nama pelanggan | Ditulis RETAIL; tidak masuk Belum Dipasangkan | 3F |
| 11 | Surat jalan diketik manual saat kasir mati, lalu kasir pulih | Dicocokkan lewat nomor struk + cabang; yang tidak cocok setelah 2 hari masuk Perlu Diperiksa | T5 |
| 12 | Ketikan manual tanpa nomor struk | Ditolak: nomor wajib | T5 |
| 13 | Kepala Gudang membuka Riwayat Tarikan | Ditolak; hanya status dan Tarik sekarang | T3 |
| 14 | HR membuka tab Supplier | Tidak tampil; dipaksa ditolak server | PRI-39 b6 |
| 15 | Finance mencoba menyalakan sambungan | Tombol tidak tampil; dipaksa ditolak server | T8 |
| 16 | Sambungan akan dinyalakan 3 hari lagi | Ditolak: pengumuman wajib 7 hari sebelumnya | T8 |
| 17 | Sambungan bermasalah setelah dinyalakan | Dimatikan GM atau Owner; data yang sudah masuk tetap; kembali Diketik | T8 |
| 18 | Potret awal diminta, tarikan terakhir 40 menit lalu | Tombol mati dengan penjelasan | T7 |
| 19 | Potret awal ditekan dua kali | Hanya sekali | T7 |
| 20 | Kucing diterima sebelum hari mulai, diambil sesudahnya | Ikut ditarik dan berbonus di v3 | GAJ-61, PRI-39 b5 |
| 21 | Cabang baru di kasir | Cabang kasir belum dipasangkan; datanya ditahan; GM diberi tahu | bagian 7 |

---

## 11. Jalan keluar

| Tindakan | Kembali / ulangi | Batalkan | Oleh siapa, sampai kapan | Akibat ke data lain |
|---|---|---|---|---|
| Tarik sekarang | Ulangi kapan saja | Tidak ada yang dibatalkan | Kepala Gudang, Finance, GM, Owner | Angka layar lain diperbarui |
| Unggah file | Kembali sebelum Simpan | Tidak dibatalkan; ditimpa unggahan baru | Finance, GM, Owner | Daftar produk diperbarui tanpa menghapus berat |
| Pasangkan nama | Kembali sebelum Simpan | Dibetulkan dengan pasangan baru (T2) | Finance atau HR sesuai tab | Baris belum terkunci diperbarui |
| Terima perubahan | — | Tidak bisa dicabut; kasir mengubah lagi → baris baru | Pemegang | Baris koreksi di modul pemakai |
| Biarkan dengan alasan | — | Sama | Pemegang | Angka lama tetap |
| Nyalakan / matikan sambungan | Kembali sebelum Simpan | Dimatikan kapan saja | GM, Owner | Jenis itu kembali Diketik |
| Ambil potret awal | — | Dibetulkan lewat baris penyesuaian Keuangan | Finance, GM, Owner | Titik awal Cek Modal |

---

## 12. Daftar tes

Modul ini **tidak menghitung uang**; ia membawa data uang. Diuji: waktu yang
memengaruhi uang, hak akses (WAJ-06), dan tidak ada angka yang berubah diam-diam.

**Waktu**

| No | Tes | Contoh |
|---|---|---|
| W1 | Ambang gagal 15 menit | Gagal 14 menit 59 detik: belum; 15 menit 01 detik di jam buka: masuk perlu perhatian |
| W2 | Gagal di luar jam buka | Mati 22.00, hidup 06.30, jam buka 08.00: tidak ada pemberitahuan; kalau masih mati 08.00, hitungan sampai 08.15 |
| W3 | Tanggal bonus grooming | Kucing diterima 24 November, diambil 27 November, periode 26 Oktober s.d. 25 November: bonus masuk periode berikutnya karena tanggal diambil |
| W4 | Pengumuman 7 hari | Sambungan dinyalakan 20 November, pengumuman 13 November 08.00: boleh; 14 November: ditolak |
| W5 | Cocok manual 2 hari | Diketik Senin 09.00, tak cocok Selasa 08.59: belum masuk Perlu Diperiksa; Rabu 09.01: masuk |

**Tidak berubah diam-diam**

| No | Tes | Hasil benar |
|---|---|---|
| D1 | Tarikan menemukan nilai nota berubah, nota belum terkunci | Nilai diperbarui, tanda "berubah dari … menjadi …" |
| D2 | Sama, nota terkunci | Nilai tetap; masuk Perlu Diperiksa |
| D3 | Transaksi hilang dari tarikan berikutnya | Tidak dihapus; ditandai batal |
| D4 | Mesin dijalankan dua kali pada data yang sama | Tidak ada baris dobel |
| D5 | Unggah file sama dua kali | Tidak ada baris dobel |

**Hak akses**

| No | Percobaan | Hasil yang benar |
|---|---|---|
| H1 | Kepala Gudang membuka Riwayat Tarikan atau Unggah File | Ditolak |
| H2 | HR membaca tab Supplier atau Toko | Ditolak |
| H3 | Finance membaca tab Groomer atau Pengantar | Ditolak |
| H4 | Finance menyalakan sambungan | Ditolak |
| H5 | Orang tanpa hak menekan Tarik sekarang | Ditolak |
| H6 | Siapa pun menulis ke tabel kasir lewat layar atau tindakan | Ditolak; hanya mesin penarik dan unggah file yang menulis |
| H7 | Pemegang memeriksa baris milik modul lain | Ditolak |

---

## 13. Pertanyaan dan jawaban

Diajukan di percakapan 13 Oktober 2026 (KER-13, 14). Jawaban pemilik: **"ok saya
setuju saran anda"**, T1 s.d. T8 sesuai saran.

1. **T1:** dua tombol di daftar periksa: Terima perubahan (baris koreksi
   bertanggal, yang lama utuh) dan Biarkan dengan alasan.
2. **T2:** satu nama kasir satu orang; pembetulan memperbarui yang belum
   terkunci, yang terkunci masuk Perlu Diperiksa; yang belum dipasangkan
   ditahan lalu dihitung dengan tanggal aslinya.
3. **T3:** Kepala Gudang hanya status dan Tarik sekarang; riwayat untuk
   Finance, GM, Owner; HR hanya tab groomer dan pengantar.
4. **T4:** susunan kolom file ditetapkan dari file contoh asli saat membangun
   (titipan Tahap 5); pratinjau; kolom wajib hilang → tolak seluruhnya; file
   sama tidak dobel.
5. **T5:** kunci pencocok nomor struk atau nota + cabang, wajib diisi saat
   mengetik manual; tidak cocok setelah 2 hari masuk Perlu Diperiksa.
6. **T6:** jam buka dari jam kerja cabang (titipan 4D); di luar jam buka tidak
   membangunkan GM; hitungan mulai dari jam buka pertama berikutnya.
7. **T7:** potret awal dipicu tangan Finance, GM, atau Owner, ditahan 3 detik,
   sekali, setelah tarikan segar; salah dibetulkan lewat penyesuaian Keuangan.
8. **T8:** sambungan dinyalakan hanya Owner dan GM, per jenis, dengan alasan,
   wajib diumumkan 7 hari sebelumnya, boleh dimatikan kapan saja.

Dicatat sebagai PRI-41 (pelapis PRI-39) di `../../aturan/00-prinsip-rancangan.md`.

---

## 14. Daftar periksa (peta jalan Tahap 4)

- [x] Tidak melanggar WAJ-01 s.d. 12 (satu pintu, tidak menulis ke kasir, tidak
      ada nama jabatan di mesin, tidak ada yang dihapus).
- [x] Setiap layar memenuhi TAM-01 s.d. 25 (jendela error, langkah bertahap,
      tombol 3 detik untuk potret dan sambungan, jalan keluar terlihat).
- [x] Rancangan data memenuhi PRI-01 s.d. 41 (perusahaan, tanpa hapus, indeks,
      mesin berpenjaga, jadwal sebagai pengaturan).
- [x] Setiap aturan bisnis ada di buku aturan dengan nomor (PRI-41 ditambah).
- [x] Kejadian di lapangan dan jalan keluar terisi.
- [x] Tiap layar menyebut ukuran utamanya, beda jabatan dicatat, dan bisa
      disusun dari komponen baku. Bentuk yang belum ada komponennya: pratinjau
      file dengan baris ditolak (TDK-L03) dan perbandingan sebelum/sesudah dua
      kolom (TDK-L07); keduanya ditambahkan sebagai komponen saat dibangun.
- [x] Perhitungan uang punya contoh angka: modul ini tidak menghitung uang;
      waktu yang memengaruhi uang punya contoh (bagian 12).
