# Spec HRIS L6 — Logistik Minimal + Absen lewat Trip

Tanggal: 2026-11-03 · Status: **disetujui owner 2026-11-03; lolos uji owner di staging 2026-11-03 (deployment `26e58be1`)** (§9 semua sesuai saran, "ok")
Cakupan: langkah **L6** di [PRD 08](../../hris_planning/PRD/fase_1/08-logistik-minimal.md) dan 4D-2c ([PRD 05](../../hris_planning/PRD/fase_1/05-kehadiran.md), KEH-L18, L19).
Sumber: v3 `04-logistik` LOG-15, 17, 18, 22 s.d. 25, 29 s.d. 36, 94, 98, 100 s.d. 104; `02-kehadiran` KEH-96 s.d. 101, 120 s.d. 124; `05-gaji-driver-kasbon` DRV-07 s.d. 18; `kehadiran-spec` §3.4 (4D-2c). Yang tidak disebut PRD 08 tidak dibawa.
Dasar kode: package `@petshop/logistics` (L0: schema `logistics` kosong, migrasi 0000), `position.attendance_mode` = `TRIP` dan `position.field_duty_auto` + izin tugas lapangan per orang (L2), titik + radius cabang (L3a/L3b), `files` (foto tertutup), Pemberitahuan + Beranda (L2f), Koreksi (L3c).
Aliran migrasi: **`logistics` 0001** (tabel, view, data awal) dan **`hris` 0031** (hak, pengaturan, jenis pemberitahuan).

Data dari owner (2026-11-03):

| Mobil | Rute kirim | Rute belanja (supplier) |
|---|---|---|
| Engkel Box (Z 8829 NO) | Garut | Aina PS |
| Grand Max Box (D 8209 YR) | Singaparna | H. Agus |
| L300 (D 8707 FO) | Ciamis - Banjar | Rajawali / Wiji Dadi |
| *(mobil bisa ditambah kelak)* | Tasik Kota | |
| | Karang Nunggal | |
| | Cirebon | |

Kenyataan di lapangan: **satu trip kirim kadang sekaligus belanja ke supplier**, dan upahnya berbeda. Jadi upah satu trip = **ritase kirim + upah belanja per supplier** (LOG-34, DRV-11). L6 mencatat keduanya; nominal tarifnya diatur di L7.

## 1. Batas

**Pokoknya:** Kepala Gudang membuat trip, berisi mobil, awak, rute kirim, dan supplier yang dibelanjai. Dari HP, driver menekan **Berangkat** dengan foto awak (= absen masuk) lalu **Sampai Garasi** di gudang (= absen pulang). Saat trip selesai, server mencatat **ritase** dan **belanja** sekali untuk tiap awak. HRIS hanya **membaca** hasilnya.

**Dikerjakan:**

| Bagian | Isi |
|---|---|
| Mobil & Rute | Daftar, tambah, ubah, nonaktifkan. Data awal tabel di atas |
| Trip | Buat (Draft), ganti awak, ubah rute/belanja, batalkan Draft, tutup atas nama driver, daftar trip menggantung |
| Trip Saya (HP) | Berangkat dengan satu foto awak, tandai belanja selesai (foto nota), Sampai Garasi di titik Gudang |
| Ritase | Dicatat server saat trip Selesai; Batalkan ritase (Pemilik); Ritase tangan (§9 butir 5) |
| Absen lewat trip | Absen Trip Saya (KEH-L18), Absen Trip Hari Ini (KEH-L19), status **Tidak jalan** |
| Pagar uji | Pemilik/GM boleh mematikan sementara pemeriksaan titik Gudang (LOG-104), supaya uji staging bisa dari luar gudang |
| View kontrak | `logistics.v_ritase`, `logistics.v_absen_trip` |

**Tidak dikerjakan di L6:**

| Hal | Di mana | Akibat sementara |
|---|---|---|
| Tarif ritase & upah belanja, slip mingguan, denda | L7 | Ritase tercatat **tanpa nominal**; syarat "pasangan mobil+rute sudah bertarif" (LOG-21) baru dipasang L7 |
| Upah Rp0 orang bergaji bulanan di hari kerjanya (DRV-16, 17) | L7 | L6 sudah mencatat ritasenya; L7 menentukan nominalnya |
| Rencana kirim, surat jalan, toko, urutan toko, laporan muat, nota, retur, bensin & foto amper, keadaan mobil, peta (PRD 08 §4) | Logistik penuh (fase berikut) | Trip langsung dibuat tanpa rencana kirim |
| Laporan Pulang driver (serah terima/bensin/keadaan mobil, KEH-100) | §9 butir 4 | — |

Tiap branch membawa fragment `apps/hris/changelog.d` dan tanda Baru di `lib/new-features.ts`.

## 2. Data

Schema **`logistics`** (milik `packages/logistics`, migrasi sendiri). Tanpa foreign key ke `hris`: id karyawan, cabang, akun, dan berkas disimpan sebagai angka/uuid biasa dan dijaga pintu server + tes (01 §2). Semua tabel: jejak dibuat/diubah oleh + kapan, tanpa hapus (PRI-02).

| Tabel | Isi |
|---|---|
| `vehicles` (mobil) | nama, plat (**unik**, disimpan huruf besar tanpa spasi ganda), aktif |
| `routes` (rute) | nama (unik), **jenis** `DELIVERY` (kirim) / `SHOPPING` (belanja supplier), aktif |
| `trips` | nomor `TR-YYMMDD-n` (urut per tanggal), mobil, rute kirim (**boleh kosong** = trip belanja saja), status `DRAFT` / `RUNNING` / `DONE` / `CANCELLED`, **tanggal trip** (diisi saat Berangkat, jam server WIB), jam berangkat, foto awak (`files`), lokasi berangkat (dicatat, tidak diperiksa, KEH-124), ditekan oleh; jam & lokasi & jarak Sampai Garasi, ditekan oleh, tanda "pagar mati"; **ditutup kantor** (oleh, alasan, foto); batal (oleh, alasan) |
| `trip_crew` (awak) | trip, karyawan, peran `DRIVER` / `ASSISTANT`, ditambahkan kapan + oleh, **"ditambahkan sesudah berangkat"**, dicopot kapan + oleh + alasan. **Satu driver aktif per trip**, orang yang sama tidak dua kali |
| `trip_shopping` (tugas belanja) | trip, rute belanja (supplier), status `OPEN` / `DONE` / `DROPPED`, foto nota (`files`), selesai oleh + kapan. Satu supplier sekali per trip |
| `trip_wages` (ritase & belanja) | trip, karyawan, peran, **jenis** `RITASE` / `SHOPPING`, tugas belanja (jenis SHOPPING), tanggal trip, mobil, rute, berkenek, asal `AUTO` / `MANUAL` (ritase tangan) + alasan, batal (oleh, alasan, kapan). **Unik**: (trip, orang, jenis, tugas belanja) di antara yang tidak batal |
| `fence_overrides` (pagar uji) | dimatikan oleh, alasan, dari, sampai (≤ 24 jam), dinyalakan lagi lebih awal |
| View `v_ritase` | baris `trip_wages`: orang, tanggal trip, mobil, rute, peran, berkenek, jenis, asal, batal |
| View `v_absen_trip` | per orang per tanggal trip: jam berangkat **trip pertama**, jam pulang **trip terakhir yang sudah ditutup**, jumlah trip, "ditutup kantor", "ditambahkan sesudah berangkat" |

Schema `hris` (0031): hak §5, pengaturan §3.9, jenis pemberitahuan §7. Tidak ada tabel absen baru: absen lewat trip **tidak ditulis ke `attendance_records`** (catatan QR yang wajib foto+GPS+percobaan). Kehadiran membacanya dari `v_absen_trip` (KEH-120: satu pencatat).

## 3. Aturan

### 3.1 Mobil & Rute (LOG-17, 18, 94)

- Diurus Kepala Gudang, Pemilik, GM. **Tidak dihapus**, hanya dinonaktifkan; yang nonaktif tidak bisa dipilih di trip baru.
- Tidak bisa dinonaktifkan selama dipakai trip Draft atau Berjalan (pesan menyebut nomor trip).
- **Jenis rute tidak bisa diubah sesudah pernah dipakai trip** (tarif L7 dicari menurut pasangan mobil + rute).
- Nama rute belanja = nama supplier. Tambah supplier baru = tambah rute berjenis belanja.

### 3.2 Membuat dan mengubah trip (LOG-15, 22, 23, 98, 101)

- Dibuat Kepala Gudang / Pemilik / GM: pilih **mobil**, **rute kirim** (boleh kosong), **supplier belanja** (0 atau lebih), **driver** (wajib, 1), **kenek** (0 atau lebih). Minimal ada rute kirim **atau** satu supplier.
- Pilihan driver hanya orang yang boleh menyetir, kenek hanya yang boleh jadi kenek (`position.field_duty_auto` jabatan + izin tugas lapangan per orang, KAR-05, 64, 65). Driver dan kenek tidak boleh orang yang sama. Orang nonaktif tidak bisa dipilih.
- Tidak ada trip untuk tanggal mendatang (LOG-16): tanggal trip baru lahir saat Berangkat.
- **Satu trip berjalan per mobil dan per orang** (LOG-98): mobil/orang boleh ada di beberapa Draft, tetapi Berangkat dan ganti awak ditolak bila mobil atau orang itu masih di trip lain yang Berjalan. Pesan menyebut trip tersebut.
- Selagi **Draft**: semua boleh diubah; **Batalkan** wajib alasan.
- Selagi **Berjalan** (LOG-22, 103): ganti/tambah/copot awak, **tambah atau lepas supplier belanja** (yang sudah Selesai terkunci). Mobil dan rute kirim tidak bisa diganti sesudah Berangkat (§9 butir 6).
- Sesudah **Selesai**: terkunci. Salah awak diperbaiki lewat Batalkan ritase + Ritase tangan.

### 3.3 Berangkat = absen masuk (LOG-25, KEH-96, 97, 121, 122, 124)

- Ditekan **driver atau kenek** trip itu dari Trip Saya, dengan **satu foto awak** dari kamera langsung (bukan galeri). Lokasi HP dicatat bila ada, tidak diperiksa.
- Satu tekanan = absen masuk **seluruh awak** pada jam server yang sama. Kenek tanpa HP tetap tercatat.
- **Tanggal trip** = tanggal saat Berangkat (WIB, jam server); Sampai Garasi lewat tengah malam tetap masuk tanggal itu.
- Orang yang **ditambahkan sesudah berangkat** tercatat masuk pada jam ditambahkan, bertanda "ditambahkan kantor", tanpa foto ulang. Orang yang **dicopot** tidak mendapat ritase otomatis (LOG-101); jam masuknya tetap tampil bertanda "dicopot".
- Tombol dikunci sekali tekan (dobel tekan tidak membuat dua catatan).

### 3.4 Belanja supplier (LOG-34, 100; DRV-11)

- Tiap supplier di trip diselesaikan dengan **Belanja selesai + foto nota supplier** (tanpa nominal; nilai belanja urusan Keuangan). Bisa ditekan driver atau kenek selagi trip Berjalan.
- Supplier yang tidak jadi dibelanjai: kantor **melepasnya** (Dropped, wajib alasan), atau dibiarkan Open → saat trip ditutup otomatis Dropped (§9 butir 3).

### 3.5 Sampai Garasi = absen pulang (LOG-29, 31, 103, 104; KEH-98, 99)

- Ditekan driver atau kenek (§9 butir 2) **di titik cabang Gudang**, memakai radius absen Gudang (`attendance.radius_m`). Di luar radius: **ditolak** dengan jaraknya, kecuali pagar uji sedang mati (tercatat bertanda).
- Trip langsung **Selesai**: absen pulang seluruh awak pada jam itu, ritase dan belanja dicatat (§3.7).
- Dua trip sehari: masing-masing ditutup sendiri; **absen pulang orang itu = trip terakhir yang ditutup** (KEH-98). Absen masuk tetap trip pertama.
- Telat, pulang cepat, istirahat, lembur **tidak dihitung** untuk absen lewat trip (KEH-99).

### 3.6 Tutup atas nama driver (LOG-30, 103; KEH-101, 123)

- Bila HP/GPS bermasalah: Kepala Gudang / Pemilik / GM menutup trip Berjalan, **wajib alasan + foto**. Bukan trip yang ia awaki sendiri.
- Absen pulang awak = jam penutupan, bertanda "ditutup kantor". Ritase tetap dicatat sekali. Tidak ada denda lupa absen (KEH-123).

### 3.7 Ritase dan belanja (LOG-33 s.d. 36, 101, 102; DRV-14, 15)

- Dicatat **hanya oleh server**, dalam transaksi yang sama dengan trip menjadi Selesai, untuk **awak yang masih tercatat** saat itu:
  - **1 ritase per awak** bila trip punya rute kirim (ritase tetap penuh walau ada yang tidak terkirim).
  - **1 belanja per awak per supplier yang Selesai.** Trip belanja saja = upah belanja saja, tanpa ritase.
  - Contoh: trip Garut + belanja Aina PS dengan driver A dan kenek B → A: ritase Garut + belanja Aina PS; B: ritase Garut + belanja Aina PS. Nominal di L7 (kenek di rute belanja saat ini Rp0, DRV-10).
- **Berkenek** = ada kenek tercatat saat Selesai (dasar tarif "dengan/tanpa kenek" L7, DRV-09).
- **Tidak bisa dobel** (kunci unik). **Tidak dihapus**: hanya **Pemilik/GM membatalkan**, wajib alasan (DRV-15). Koreksi slip yang sudah ditutup diurus L7.
- **Ritase tangan** (LOG-102, §9 butir 5): Pemilik/GM, wajib alasan, paling jauh 14 hari ke belakang, pilih orang + tanggal + mobil + rute + peran (+ supplier untuk belanja). Bila orang itu sudah punya ritase sama di tanggal/mobil/rute itu, ditampilkan dan butuh konfirmasi kedua "Memang dua kali jalan".

### 3.8 Status hari orang lewat trip (KEH-81, 97)

- Untuk orang ber-`attendance_mode` `TRIP`: hari dengan trip = **Jalan** (jam masuk/pulang dari `v_absen_trip`); hari tanpa trip = **Tidak jalan**, tanpa akibat apa pun. Dihitung saat dibaca, tidak perlu mesin harian.
- Orang QR (bergaji bulanan) yang ikut trip tetap absen QR seperti biasa; trip-nya hanya melahirkan ritase (DRV-16 diurus L7).

### 3.9 Pengaturan (bertanggal, hanya Pemilik/GM mengubah)

| Kunci | Bawaan | Arti |
|---|---|---|
| `logistics.garage_branch` | cabang **Gudang** | Titik Sampai Garasi |
| `logistics.hanging_hour` | 12.00 | Trip belum ditutup sampai jam ini hari berikutnya = menggantung (LOG-31) |
| `logistics.manual_wage_days` | 14 | Batas mundur ritase tangan |

## 4. Layar

Kelompok menu baru **"Logistik"** di app HRIS (bisa dipindah ke app Logistik kelak tanpa memindah data).

| Layar | Alamat | Dipakai | Isi |
|---|---|---|---|
| **Trip** (PC & HP) | `/logistik/trip` | Kepala Gudang, Pemilik, GM | Tab **Hari ini** (Draft + Berjalan + Selesai hari ini), **Menggantung** (lewat batas LOG-31), **Riwayat** (cari tanggal, mobil, orang). Tombol **Buat trip** |
| Rincian trip | `/logistik/trip/[id]` | sama | Mobil, rute, awak (dengan tanda), supplier + foto nota, foto awak, jam & jarak Sampai Garasi, ritase yang lahir. Tombol sesuai status: Ubah, Batalkan, Tutup atas nama driver, Batalkan ritase |
| **Trip Saya** (HP) | `/trip-saya` (bilah bawah, ganti "Absen" untuk orang TRIP) | Driver, kenek | Kalimat besar keadaan hari ini (KEH-L18), kartu trip yang menugaskan dirinya: **Berangkat** (kamera), daftar supplier → **Belanja selesai** (foto nota), **Sampai Garasi** (minta lokasi). Trip selesai hari ini di bawahnya |
| **Absen Trip Hari Ini** (KEH-L19) | `/kehadiran/absen-trip` | Kepala Gudang, HR, Pemilik, GM; Admin HR & Finance tanpa foto | Pilih tanggal. **Trip** (kartu per trip + foto awak), **Perlu perhatian** (belum Sampai Garasi, menggantung), **Tidak jalan** (orang TRIP tanpa trip) |
| **Mobil & Rute** | `/logistik/mobil-rute` | Pemilik, GM, Kepala Gudang | Dua tabel, tambah/ubah/nonaktifkan |
| **Ritase** | `/logistik/ritase` | Pemilik, GM, Kepala Gudang (lihat), HR (lihat) | Daftar per minggu (Jumat–Kamis, DRV-19) per orang: ritase + belanja, filter orang/mobil/rute; tombol **Ritase tangan** & **Batalkan** (Pemilik/GM) |
| Pagar uji | di Mobil & Rute (bagian bawah) | Pemilik, GM | Matikan pemeriksaan titik Gudang ≤ 24 jam + alasan; selama mati tampil peringatan di Trip dan Beranda Pemilik |

Tambahan di layar lama: **Rekap Kehadiran** menampilkan orang TRIP dengan Jalan / Tidak jalan dan sumber "Lewat trip" (tanpa telat). **Beranda** Kepala Gudang/Pemilik: kartu "trip menggantung" dan "pagar uji mati". Foto awak & nota: tertutup, tanpa tombol unduh, setiap buka dicatat; foto awak dihapus 60 hari (KEH-15, ikut mesin hapus foto absen).

## 5. Hak

| Hak | Bawaan |
|---|---|
| `logistics.fleet.manage` (Mobil & Rute) | Kepala Gudang, Pemilik, GM |
| `logistics.trip.manage` (buat/ubah/batal/tutup trip) | Kepala Gudang, Pemilik, GM |
| `logistics.trip.view` | + HR |
| `logistics.wage.view` (Ritase) | Kepala Gudang, HR, Pemilik, GM |
| `logistics.wage.manage` (batalkan, ritase tangan), `logistics.fence.manage` | Pemilik, GM (ownerOnly) |
| `attendance.trip.view` (Absen Trip Hari Ini), `.photo` | Kepala Gudang, HR, Pemilik, GM; Admin HR & Finance tanpa `.photo` |
| Trip Saya | tanpa hak khusus: hanya trip yang menugaskan dirinya, dicek server |

Semua aksi lewat **pintu server** di `packages/logistics` (LOG-24); app HRIS hanya memanggilnya. Modul HRIS lain (Kehadiran, Gaji) **tidak mengimpor tabel `logistics`**, hanya view (dijaga tes batas modul, §8).

## 6. Mesin terjadwal

| Mesin | Jam | Isi |
|---|---|---|
| `logistics-hanging` | 12.05 | Trip Berjalan dari kemarin atau sebelumnya → pemberitahuan ke Kepala Gudang + Pemilik/GM (sekali per trip) |
| `fence-restore` | tiap 15 menit | Nyalakan lagi pagar uji yang lewat waktunya |
| `attendance-photo-purge` (sudah ada) | — | diperluas ke foto awak trip > 60 hari |

## 7. Pemberitahuan

| Kejadian | Ke | Isi |
|---|---|---|
| Ditugaskan ke trip / dicopot | Orang itu | "Kamu ditugaskan sebagai driver di trip TR-… (L300, Garut)" |
| Trip ditutup kantor | Awak | Alasan + jam |
| Ritase dibatalkan / ritase tangan | Orang itu | Alasan |
| Trip menggantung | Kepala Gudang, Pemilik, GM | Nomor trip, mobil, awak |
| Pagar uji dimatikan | Pemilik, GM lainnya | Oleh siapa, sampai jam berapa |

## 8. Tes

- **Aturan (unit):** syarat buat trip (rute atau supplier, driver wajib, peran sah), satu trip berjalan per mobil/orang, kelahiran ritase (kirim saja / kirim + 2 supplier / belanja saja / kenek dicopot / ditambahkan sesudah berangkat), berkenek, absen masuk-pulang dua trip sehari, Sampai Garasi dalam/luar radius, pagar mati.
- **Integrasi (DB):** alur PRD 08 §5 (buat → Berangkat → Sampai Garasi → ritase sekali per awak → terbaca `v_ritase`); dua trip sehari → dua ritase, pulang = trip terakhir di `v_absen_trip`; kunci unik menolak dobel; ritase tangan dobel butuh konfirmasi; batal tanpa hapus.
- **Batas:** modul HRIS di luar layar Logistik tidak mengimpor tabel `logistics` (tes impor, seperti batas modul L4/L5); `bo_app` tidak punya akses `logistics` (tes db-roles yang sudah ada).
- Tes integrasi memakai tanggal lampau (pelajaran tes L3b).

## 9. Keputusan owner (2026-11-03: "ok", semua sesuai saran)

| # | Pertanyaan | Saran |
|---|---|---|
| 1 | Upah trip gabungan dicatat sebagai **1 ritase kirim + 1 belanja per supplier**, per awak (§3.7)? | **Ya**, sesuai penjelasan owner dan LOG-34 |
| 2 | Yang boleh menekan **Sampai Garasi**: driver saja, atau driver **dan** kenek? | **Driver dan kenek** (v3 hanya driver, tetapi kenek kadang yang pegang HP; pagar titik Gudang tetap sama) |
| 3 | Supplier belanja yang masih Open saat trip ditutup? | **Otomatis "tidak jadi"** (tanpa upah belanja); kantor bisa memberi ritase tangan bila ternyata jadi |
| 4 | Laporan Pulang driver (serah terima, keadaan mobil, bensin) di L6? | **Tidak**, Sampai Garasi langsung menutup trip. PRD 08 §4 sudah mengeluarkan bensin & keadaan mobil; serah terima menyusul bersama Logistik penuh |
| 5 | **Ritase tangan** (darurat, Pemilik/GM, ≤ 14 hari) ikut L6? | **Ya**, kecil, dan dibutuhkan untuk memperbaiki salah awak sebelum L7 |
| 6 | Mobil & rute kirim bisa diganti sesudah Berangkat? | **Tidak** (v3: hanya awak & tugas belanja). Salah mobil/rute → tutup + ritase tangan |
| 7 | Bentuk **foto nota supplier** wajib saat Belanja selesai? | **Wajib** (LOG-100), bukti upah belanja |
| 8 | L6 dikerjakan **sekali tayang** staging (bukan dipecah)? | **Sekali tayang**, ukurannya sedang |

## 10. Catatan untuk tahap berikutnya

- L7 membaca `v_ritase` untuk slip mingguan, menambah tarif bertanggal per pasangan mobil + rute (DRV-08), syarat Berangkat "sudah bertarif" (LOG-21), dan nominal Rp0 DRV-16/17.
- 23 tarif lama (DRV-08) masih perlu dari owner untuk data awal L7.

## 11. Catatan implementasi L6 (2026-11-03)

- **Letak kode:** tabel + view + trigger di `packages/logistics` (migrasi logistics `0001`); pintu server (aturan, layanan, layar) di modul `apps/hris/modules/logistics`, satu-satunya modul HRIS yang boleh mengimpor `@petshop/logistics` (dijaga `scripts/check-module-boundaries.mjs` aturan 4 + eslint). Beda dari §5 "pintu di packages/logistics": layanan butuh akses, berkas, dan pemberitahuan HRIS, jadi ditaruh di modul; pindah ke app Logistik kelak = pindah modul ini.
- **Titik garasi** disimpan di `logistics.config` (satu baris, cabang dipilih Pemilik/GM di Mobil & Rute), bukan pengaturan bertanggal `logistics.garage_branch` (§3.9): jenis pengaturan "cabang" belum ada. Isi awal = cabang bernama Gudang lewat hris `0031` (dilewati bila schema logistics belum ada, misalnya DB uji yang hanya memuat migrasi hris). `logistics.hanging_hour` dan `logistics.manual_wage_days` tetap pengaturan bertanggal.
- **Pagar uji menyala lagi sendiri** dihitung dari `until_at` saat dibaca, tanpa mesin `fence-restore` (§6). Satu mesin `logistics-daily` 12.05 WIB: pemberitahuan trip menggantung (sekali per trip) + buang isi foto awak/tutup kantor lewat `attendance.photo_retention_days`. Foto nota supplier tidak dibuang (bukti upah belanja).
- **Absen lewat trip** tidak ditulis ke `attendance_records`; dibaca dari `logistics.v_absen_trip`. Layar Absen Trip (KEH-L19) dan Trip Saya (KEH-L18) ada di modul logistics. **Belum:** baris "Lewat trip" / Jalan–Tidak jalan di Rekap Kehadiran (§4 tambahan layar lama) — menyusul bersama L7 bila owner butuh; status Tidak jalan tampil di Absen Trip.
- Menu **Trip Saya** tampil untuk jabatan ber-cara absen Lewat trip, atau siapa pun yang sedang ditugaskan di trip Draft/Berjalan (mis. staf bergaji bulanan yang ikut jadi kenek).
- Satu kunci (`pg_advisory_xact_lock`) untuk Buat/Ubah awak/Berangkat menjaga "satu trip berjalan per orang"; "per mobil" juga dijaga indeks unik sebagian.
- Ritase tidak bisa dihapus (trigger) dan isinya tidak bisa diubah, hanya diberi tanda batal (trigger `trip_wages_guard`).
- Tes: unit 8 (aturan) + integrasi 7 (alur PRD 08 §5, dua trip sehari, kunci dobel, satu trip berjalan per orang, ditambahkan/dicopot, tutup kantor, batal + ritase tangan). Kunci jawaban `hris-access` ditambah hak L6; tes itu (dan H18 `hris-settings`) sudah gagal sebelum L6 karena kuncinya belum memuat hak/pengaturan L3c s.d. L5.
