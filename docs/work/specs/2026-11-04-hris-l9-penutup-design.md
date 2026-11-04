# Spec HRIS L9 — Penutup: Uji Banding, Data Awal Final, Latihan Pindah

Tanggal: 2026-11-04 · Status: **DISETUJUI owner 2026-11-04 ("ok", §9 semua sesuai saran)** · **L9a LOLOS uji owner 2026-11-04** ("ok sudah saya uji", staging ce2f0e8d; skenario tidak dirinci); L9b menunggu ekspor dari owner
Cakupan: langkah **L9** di [PRD 00 §7](../../hris_planning/PRD/fase_1/00-ringkasan-fase-1.md) ("uji banding satu periode penuh, muat data awal final (gaji, sisa kasbon, saldo dana), latihan pindah"), ditambah dua sisa yang bersinggungan: pemuatan data karyawan L2g (ditunda 2026-11-01) dan cutover auth terpusat L1 di produksi ([runbook](../../ops/auth-pusat.md)).
Sumber: PRD fase_1 00 §3, §8, §10; 04 §3.5; 07 §3–4; aturan v3 `00-gambaran-sistem.md` SIS-12 s.d. 20, 23, 25 s.d. 28, 30, 33, 39 s.d. 42. Data sistem lama hanya dipakai sebagai **bahan ekspor yang diserahkan owner** (SIS-14: sistem lama hanya dibaca); kode dan database sistem lama tidak dibuka.
Dasar kode: semua L1–L8 (staging a91a75d2). Yang sudah ada dan dipakai ulang: skrip muat karyawan `apps/hris/scripts/legacy-load.ts` (L2g), jenis kasbon `LEGACY` di `hris.advances` (disiapkan L5a, belum ada layarnya), saldo awal Dana Disiplin & Dana Tidak Hadir (`fund_entries` kind `OPENING`, layar `/dana/ubah`, L4d), ubah gaji langsung (L4a), unduhan CSV total gaji (`/api/payroll/totals`), Persetujuan (L2f).

**Pokoknya (v3):** pindah **satu kali** untuk semua modul (SIS-12), pada sebuah **tanggal 26** (SIS-13), sesudah uji banding dinyatakan cocok oleh GM/Owner (SIS-15). Yang dibawa **hanya yang masih hidup**: orang, gaji, sisa kasbon, saldo awal dua dana (SIS-23, 28, 33). Riwayat tetap di sistem lama. Sampai hari pindah **yang resmi sistem lama**; HRIS baru hanya pembanding (SIS-17). Tidak ada kerja dobel karyawan (SIS-14).

---

## 1. Batas

L9 dipecah tiga, masing-masing diuji owner sendiri:

| Bagian | Isi | Kode? |
|---|---|---|
| **L9a** Data awal final | Layar **Sisa Kasbon Bawaan** (SIS-28): Finance ketik, Pemilik/GM sahkan, jadwal 1–3 kali potong, tanpa serah uang. Tanda "bawaan sistem lama" + tanggal hari pindah pada saldo awal dua dana (SIS-33). Pemeriksaan **Siap Pindah** (daftar yang belum lengkap: karyawan tanpa gaji, tanpa jadwal, tanpa akun, tanpa titik cabang, dana belum diberi saldo awal) | Ya (migrasi hris 0038) |
| **L9b** Uji banding | Skrip salin data satu periode yang sudah tutup dari ekspor owner ke **staging** (tanda `COMPARISON`), HRIS menghitung, **Lembar Banding** CSV per orang (angka HRIS baru di samping angka lama), daftar beda disengaja | Ya (skrip + CSV) |
| **L9c** Latihan pindah | Runbook `docs/ops/hris-pindah.md` (urutan §5), gladi bersih di staging dengan urutan persis hari pindah, uji cadangan & pulihkan, lalu jalan mundur dicoba sekali | Runbook + skrip kecil |

| Tidak dikerjakan | Sebab |
|---|---|
| Memindah riwayat (absen, slip, trip, bongkaran, buku kas lama) | SIS-23 |
| Tunggakan ritase/kenek/bongkaran lama | SIS-25: dinyatakan sudah dibayar semua |
| Fitur import Excel umum | PRD 00 §5: data awal lewat skrip sekali jalan |
| Cuti tahunan lama | SIS-30: mulai jatah penuh |
| Foto lama, arsip PDF slip lama (SIS-32) | Dikerjakan di sistem lama oleh owner; HRIS baru tidak menampilkan riwayat lama |
| Menutup / mengunci sistem lama | SIS-20, 27: dikerjakan owner di sistem lama dengan izin saat itu; L9 hanya menuliskan urutannya di runbook |
| Pindah PR ke main (rilis produksi) | Bagian dari hari pindah, dengan izin owner terpisah (AGENTS.md) |

---

## 2. Data

- **Kasbon bawaan** memakai baris `hris.advances` kind `LEGACY` yang sudah ada: `requested_amount = final_amount = sisa`, `final_installments` 1–3, `request_id` kosong, langsung dianggap **sudah diserahkan** (tidak ada uang keluar, tidak memakai Sumber Uang). Migrasi 0038 menambah: kolom `legacy_on` (tanggal hari pindah), pengecualian di pemeriksaan serah uang untuk `LEGACY`, dan jenis pengajuan `legacy_advance` untuk pengesahan. Satu orang paling banyak satu kasbon bawaan (indeks unik sebagian).
- **Saldo awal dana**: baris `OPENING` yang sudah ada diberi `note` "Bawaan sistem lama" dan tanggal hari pindah (kolom tanggal berlaku, migrasi 0038 bila belum ada). Tetap hanya sekali; koreksi lewat Sesuaikan (SIS-33).
- **Data uji banding** (L9b) hanya masuk **staging**: setiap baris salinan bertanda `source = 'COMPARISON'` (absen, trip, laporan bongkaran, kasbon) supaya bisa dihapus bersih sesudah uji; skrip menolak berjalan bila `HRIS_ENV=production`.
- **Lembar Banding** dan **daftar beda** berisi gaji orang → tidak disimpan di repo; diunduh owner dari HRIS staging, dihapus dari mesin pengembang sesudah dipakai.

---

## 3. L9a — layar dan aturan

### 3.1 Sisa Kasbon Bawaan (`/gaji/kasbon/bawaan`)
- **Finance** mengetik per orang: sisa (rupiah, > 0), jumlah kali potong (1–3), Dana (mengikuti slip utama orangnya: bulanan/mingguan), catatan. Tombol "Ajukan pengesahan".
- **Pemilik/GM** mengesahkan di kotak Persetujuan (KAR-72: tidak bisa mengesahkan kasbon dirinya sendiri). Sebelum disahkan bisa ditarik Finance.
- Sesudah disahkan: jadwal potong dibuat mulai **slip pertama sesudah hari pindah**, ikut aturan cicilan L5 (tunda, terima pelunasan, ubah jadwal, hapus utang berlaku sama).
- **Tidak ditolak** walau melebihi batas per orang Rp250.000; orangnya hanya belum bisa mengajukan kasbon baru sampai sisanya di bawah batas (SIS-28). Sisa **mengurangi Dana Kasbon** lewat `usedOf` yang sudah ada.
- Di Rincian dan Kasbon Saya tampil tanda **"Bawaan sistem lama"**.

### 3.2 Saldo awal Dana Disiplin & Dana Tidak Hadir
Layar `/dana/ubah` yang ada dipakai; ditambah isian tanggal (bawaan: hari pindah) dan tanda bawaan. Cara menghitung angkanya (SIS-33) ditulis di layar sebagai petunjuk; angkanya dihitung owner/Finance dari slip periode terakhir sistem lama.

### 3.3 Gaji per orang
Tidak ada kode baru: diketik HR/Pemilik di layar ubah gaji yang ada (SIS-24 "gaji diisi HR atau pemilik"), sesudah data karyawan dimuat.

### 3.4 Siap Pindah (`/pengaturan/siap-pindah`, Pemilik/GM)
Daftar periksa yang dibaca dari data, bukan dicentang tangan: karyawan aktif tanpa gaji, tanpa jabatan, tanpa jadwal kerja, tanpa akun tertaut, tanpa slip utama (DRV-04); cabang tanpa titik lokasi/QR; Dana Disiplin/Tidak Hadir belum ada saldo awal; kasbon bawaan belum disahkan; pengaturan wajib yang belum punya nilai berlaku. Tiap baris ada tautan ke layar perbaikannya.

---

## 4. L9b — uji banding

1. Owner menyerahkan **ekspor satu periode yang sudah tutup** (bentuk di §9 butir 2): absen masuk/pulang per orang per hari + izin/sakit/cuti/libur, trip + ritase per minggu upah, laporan bongkaran, kasbon & potongannya, dan **hasil slip lama per orang** (total + komponen).
2. Skrip `apps/hris/scripts/comparison-load.ts` memeriksa seluruh berkas dulu (tolak semua bila satu baris salah, sebutkan baris & sebab, seperti L2g), lalu memuat ke staging bertanda `COMPARISON`.
3. HRIS menghitung slip periode itu dengan mesin yang sama (tanpa tutup/bayar sungguhan).
4. **Lembar Banding** (`/gaji/uji-banding`, hanya Pemilik/GM; SIS-15, 41): per orang angka HRIS baru, angka lama, selisih, dan kolom "sebab" yang diisi GM/Owner: **beda disengaja** (pilih nomor aturan) atau **perlu diperbaiki**. Unduh CSV.
5. Yang "perlu diperbaiki" diperbaiki lewat branch fix biasa, lalu dihitung ulang **paling banyak sekali** (SIS-16); sesudahnya owner memutuskan.
6. Ukuran (SIS-16): Kehadiran + Gaji Bulanan satu periode 26–25; Gaji Driver, Bongkaran, Kasbon **dua minggu upah** di dalam periode yang sama.
7. Selesai uji: skrip `--purge` menghapus semua baris `COMPARISON` dari staging.

Selama data salinan ada di staging, **hanya Pemilik/GM** yang bisa masuk HRIS staging (SIS-41): saklar `HRIS_STAGING_RESTRICT=1` di env staging.

---

## 5. L9c — urutan pindah (isi runbook `docs/ops/hris-pindah.md`)

Mengikuti SIS-39 disesuaikan dengan VPS yang sudah ada:

| # | Langkah | Kapan | Izin owner |
|---|---|---|---|
| 1 | Domain HRIS produksi diarahkan + https (SIS-40) | ≥ 2 minggu sebelum | — |
| 2 | Cadangan harian DB produksi termasuk schema `hris`/`auth`/`logistics` + foto, **sekali dicoba pulihkan** ke staging (SIS-42) | ≥ 2 minggu sebelum | — |
| 3 | **Gladi bersih** di staging: jalankan langkah 4–9 persis berurutan pada salinan, catat waktu tiap langkah | ≥ 10 hari sebelum | — |
| 4 | Rilis dev_hris → main lewat PR (HRIS L2–L9 + migrasi) dan nyalakan profil hris produksi | ≥ 10 hari sebelum | **Ya** |
| 5 | **Cutover auth terpusat L1** (runbook auth-pusat.md) — kasir tidak merasakan perubahan | ≥ 7 hari sebelum | **Ya** |
| 6 | Muat data karyawan (skrip L2g dengan Excel terbaru dari owner), tautkan akun backoffice, beri akun HRIS | ≥ 7 hari sebelum | **Ya** |
| 7 | Pengumuman aturan uang baru ke karyawan (SIS-18) | ≥ 7 hari sebelum | owner |
| 8 | Isi gaji, jadwal kerja, titik & QR cabang; karyawan masuk dan mencoba absen (belum dihitung) | minggu terakhir | — |
| 9 | Hari pindah (tanggal 26): sistem lama berhenti menerima kejadian baru (SIS-27); kasbon bawaan + saldo awal dana diketik & disahkan **hari itu**; Siap Pindah harus kosong | tanggal 26 | **Ya** |
| 10 | Upah mingguan pindah pada Jumat terdekat (SIS-13) | Jumat sesudahnya | — |

**Jalan mundur** (SIS-20): selama periode pertama, owner boleh memutuskan kembali ke sistem lama. Runbook menulis caranya: sistem lama dibuka lagi untuk kejadian baru, HRIS baru disetel hanya-lihat (saklar `HRIS_READONLY=1`), auth terpusat tetap jalan atau dikembalikan dengan rollback L1 (terpisah). Gladi bersih mencoba jalan mundur ini sekali di staging.

---

## 6. Hak akses

| Tindakan baru | Pemberian awal |
|---|---|
| `advance.legacy.enter` (ketik kasbon bawaan) | Finance, Pemilik, GM |
| `advance.legacy.approve` (sahkan) | Pemilik, GM (ownerOnly) |
| `migration.readiness.view` (Siap Pindah) | Pemilik, GM |
| `payroll.comparison.view` (Lembar Banding + isi sebab) | Pemilik, GM (ownerOnly) |

Kunci jawaban tes hak (`hris-access`) diperbarui.

---

## 7. Tes

- Unit: aturan kasbon bawaan (batas tidak menolak, blokir kasbon baru, jadwal 1–3, tidak bisa sahkan milik sendiri), pemeriksa Siap Pindah, pembaca ekspor uji banding (baris salah → ditolak semua), perbandingan per orang.
- Integrasi: kasbon bawaan dari diketik → disahkan → terpotong di slip bulanan pertama dan di slip mingguan pertama; satu orang dua kasbon bawaan ditolak DB; muat `COMPARISON` lalu `--purge` meninggalkan DB bersih; skrip menolak `HRIS_ENV=production`.
- Hak: 4 tindakan baru dicoba sebagai tiap jabatan.

---

## 8. Changelog & tanda Baru

Fragment `apps/hris/changelog.d/feat-hris-l9a-*.md` dan `feat-hris-l9b-*.md`; tanda Baru untuk `/gaji/kasbon/bawaan`, `/pengaturan/siap-pindah`, `/gaji/uji-banding` di `lib/new-features.ts`.

---

## 9. Keputusan owner (disetujui 2026-11-04: semua sesuai saran)

| # | Pertanyaan | Saran |
|---|---|---|
| 1 | L9 dipecah L9a (data awal) → L9b (uji banding) → L9c (latihan pindah), diuji satu per satu? | **Ya.** L9a bisa dikerjakan sekarang; L9b menunggu ekspor dari owner |
| 2 | Periode uji banding dan bentuk ekspornya? | Periode **26 Okt – 25 Nov 2026** (tutup 25 Nov, slip lama dibayar 1 Des) + dua minggu upah di dalamnya. Owner kirim **Excel/CSV** per jenis (absen, trip/ritase, bongkaran, kasbon, hasil slip per orang); saya kirim dulu contoh kolom yang dibutuhkan. Saya tidak membuka sistem lama sendiri |
| 3 | Selama data salinan di staging, HRIS staging dikunci hanya Pemilik/GM (SIS-41)? | **Ya**, kira-kira 1–2 minggu; uji layar lain ditunda selama itu |
| 4 | Sisa kasbon bawaan: diketik Finance di layar, disahkan Pemilik/GM, dipotong 1–3 kali mulai slip pertama sesudah pindah? | **Ya** (SIS-28 apa adanya) |
| 5 | Gaji per orang diketik tangan di layar ubah gaji (bukan skrip)? | **Ya** (SIS-24; 24 orang, sekaligus pemeriksaan) |
| 6 | Data karyawan L2g dimuat kapan? | **Staging dulu saat gladi bersih (§5 no.3), produksi di langkah 6** memakai Excel terbaru (orang keluar/masuk sejak 1 Nov ikut diperbarui). Aturan muat sama: 24 orang, EMP-001 tidak dimuat, Elan & Irma Yanti sebagai Pemilik |
| 7 | Cutover auth terpusat L1 di produksi: digabung dengan hari pindah atau lebih dulu? | **Lebih dulu, ≥ 7 hari sebelum hari pindah** (langkah 5), supaya masalah login tidak bertumpuk dengan masalah gaji; kasir login ulang sekali (rekomendasi runbook L1) |
| 8 | Domain HRIS produksi dan target hari pindah? | Domain **hris.hammielion.com** (backoffice `admin.hammielion.com`). Target hari pindah **26 Desember 2026** bila uji banding cocok sebelum 15 Desember; kalau belum, tanggal 26 berikutnya (SIS-13: bulannya tidak dikejar) |

---

## 10. Urutan kerja sesudah "ok"

1. Tandai §9, merge status L8 + spec ini ke dev_hris lalu staging.
2. Klaim `docs/claim-hris-l9a` (modules/advances, modules/payroll funds, modules/access, app/(app)/{gaji/kasbon/bawaan,dana,pengaturan/siap-pindah,persetujuan}, nav, new-features, changelog.d; kunci hris **0038**), push staging sekali.
3. `feat/hris-l9a-data-awal` → tes → dev_hris → staging → lepas klaim → uji owner.
4. Kirim contoh kolom ekspor (§9 butir 2) ke owner; L9b dimulai saat berkas diterima (kunci hris 0039 bila perlu kolom `source`).
5. L9c: runbook + gladi bersih sesudah L9b cocok.

---

## 11. Catatan implementasi L9a (2026-11-04)

- **Hari pindah** = pengaturan baru `migration.cutover_on` (jenis nilai baru `date`, wajib tanggal 26), isi awal 2026-12-26 lewat migrasi hris 0038; diubah Pemilik/GM di Pengaturan › Pindah sistem. Tidak memakai kolom `legacy_on` di `advances` seperti §2: tanggal serah LEGACY = hari pindah.
- **Kasbon bawaan** = jenis pengajuan `advance_legacy` (diketik pemegang `advance.legacy_enter` = Finance, disahkan `advance.decide`). Disahkan → `advance_handovers` ber-method `LEGACY` tanpa sumber uang (kolom `source_id` boleh kosong hanya untuk LEGACY), jadwal dipasang dari hari pindah memakai `placeSchedule`. Tidak tampil di tab Uang Kasbon; Batal serah dan "Uang belum diterima" ditolak untuk LEGACY. Indeks unik `advances_one_legacy`: satu bawaan berlaku (Menunggu/Disetujui) per orang. Sisa dan jumlah kali potong bebas kelipatan (angka lama), 1–3 kali.
- **Saldo awal dana**: tidak perlu migrasi; tanggal hari pindah disimpan di `fund_entries.period_start` baris `OPENING` dan tampil "Saldo awal · bawaan sistem lama per …".
- **Siap Pindah** (`lib/readiness.ts`, dirangkai di app/ lewat pintu modul): hari pindah, akun HRIS, dasar gaji jabatan, gaji, titik lokasi, QR, saldo awal dua dana, kasbon bawaan menunggu. Butir **jadwal kerja** dari §3.4 belum dimasukkan (jadwal per cabang/kelompok tidak punya pintu baca "orang tanpa jadwal"); dicek owner di layar Jadwal.
- Tes: unit 3 (`rules/legacy.test.ts`) + integrasi 4 (`server/legacy.integration.test.ts`); suite advances, requests, settings, access, funds, lib lulus. Batas modul tetap 16 temuan (sama dasar).

## 12. Catatan implementasi L9b-1 (2026-11-04)

Owner "ok" (2026-11-04) atas rencana L9b, contoh kolom ekspor, dan dua saran: (1) data karyawan L2g dimuat ke staging di awal L9b (perlu izin masuk VPS staging), (2) dikoding sekarang dengan data contoh, Excel asli sesudah slip lama dibayar 1 Des. Pemeriksaan kode menunjukkan absen, trip, bongkaran, dan kasbon bergantung pada jadwal, hari libur, izin, dan bukti GPS/foto, jadi L9b dipecah:

- **L9b-1 (bagian ini):** kerangka uji banding. Migrasi hris **0039**: `comparison_runs` (satu periode 26–25; `computed_count` maks 2), `comparison_slips` (angka + komponen slip lama per orang per slip, hitungan HRIS 1 dan hitung ulang, sebab INTENDED/FIX + nomor aturan + catatan), `comparison_rows` (tanda COMPARISON: tabel + id baris operasional yang dimuat dari data salinan, dihapus urut terbalik oleh `--purge`). Tabel ada di `schema/payroll.ts` karena batas modul.
- **Skrip** `apps/hris/scripts/comparison-load.ts`: Excel lembar `Slip` (kolom Kode, Nama, Jenis slip, Mulai, Bagian, Komponen, Jumlah; satu baris per komponen + satu baris Total per slip) → SQL satu transaksi untuk psql di `petshop_staging`. Seluruh berkas ditolak bila satu baris salah. Orang dicocokkan dengan **nama** (kode EMP lama tidak tersimpan di HRIS; nama bisa dibetulkan `--rename KODE=Nama`). Selisih komponen vs Total hanya peringatan (angka Total yang dipakai). `--purge` menulis SQL penghapus.
- **Lembar Banding** `/gaji/uji-banding` (hak `migration.comparison`, ownerOnly): Hitung = `computeSlip` / `computeWeeklySlip` yang sama dengan layar slip, disimpan; hitung ulang sekali (SIS-16). Potongan dibandingkan sebesar yang benar-benar diambil slip. Orang tanpa gaji di rentang itu dicatat 0 dengan keterangan. CSV titik koma.
- **Saklar** `HRIS_STAGING_RESTRICT=1` (env compose `STAGING_HRIS_RESTRICT` di `.env` VPS staging; hanya berlaku bila `AUTH_COOKIE_ENV=staging`): selain jabatan berhak penuh, pelaku dikosongkan di `actorForSession` (semua route) dan kerangka halaman menampilkan "HRIS staging sedang dikunci".
- Tes: unit 6 (`rules/comparison.test.ts`) + integrasi 4 (`server/comparison.integration.test.ts`: muat/tolak nama, hanya Pemilik/GM, angka = mesin slip, hitung ulang sekali, sebab, CSV, purge).
- **L9b-2 (berikutnya):** pemuat data operasional dari Excel owner (absen + izin/libur, trip/ritase, bongkaran, kasbon) yang mencatat tiap baris di `comparison_rows`. Bentuk akhirnya menunggu contoh berkas asli.

## 13. Catatan implementasi L9c Kode lama (2026-11-04)

Keputusan owner 2026-11-04 sesudah memeriksa Excel Database Karyawan: simpan **NIK**, **hubungan kontak darurat**, dan
**kode EMP lama**; aturan per orang di Excel (kena denda telat, dapat lembur, gaji flat, bisa driver, kompensasi libur)
**tidak dimuat** — mengikuti aturan HRIS baru; Helper tetap "Belum ditentukan" untuk sementara.

- Migrasi hris `0040`: kolom `national_id` (16 angka, unik), `emergency_contact_relation`, `legacy_code` (bentuk
  `EMP-001`, unik, diisi sekali lalu dikunci trigger `guard_employee_update`). Kode resmi tetap `HML-xxxx`.
- `legacy-load.ts` mengisi ketiganya saat memuat; NIK yang bukan 16 angka dikosongkan dengan peringatan (bukan menolak
  berkas); NIK kembar menolak berkas. Mode `--enrich` melengkapi karyawan bawaan yang dimuat sebelum L9c (UPDATE,
  cocok lewat nama di antara karyawan LEGACY, tidak menimpa isian HRIS).
- Uji Banding mencocokkan `Kode` berkas slip lama ke Kode lama; cocok-nama hanya cadangan untuk karyawan tanpa Kode lama.
