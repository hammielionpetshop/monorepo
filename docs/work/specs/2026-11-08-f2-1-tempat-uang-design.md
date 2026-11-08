# F2-1 Tempat Uang

Tanggal: 2026-11-08 · Status: **draf — 5 dari 7 keputusan owner masuk (2026-11-08), 2 usul agent menunggu ok (§9 no.5–6)** · PRD: [`fase_2/02-tempat-uang.md`](../../hris_planning/PRD/fase_2/02-tempat-uang.md)

Dua bagian, dua branch:

| Bagian | Branch (dasar) | Migrasi | Isi |
|---|---|---|---|
| **F2-1a** Back Office | `feat/money-places` (`origin/main`) | petshop `0055` | Daftar Tempat Uang + tautan metode bayar per cabang |
| **F2-1b** HRIS | `feat/hris-money-places` (`origin/dev_hris`, sesudah F2-1a masuk `dev_hris`) | hris `0056` | Layar bayar HRIS memilih dari Tempat Uang |

F2-1a tidak mengubah perilaku kasir atau laporan mana pun: ia hanya pengaturan yang dipakai F2-2
(verifikasi non-tunai), F2-3 (pelunasan otomatis), F2-4 (bayar supplier "dibayar dari").

## 1. Keadaan sekarang (diperiksa di kode 2026-11-08)

- `petshop.payment_methods` (id, name, type `CASH|BANK_TRANSFER|E-WALLET|QRIS|DEBT`) **berlaku
  untuk semua cabang**, tanpa tahu rekening mana. Dikelola di Master Data › Metode Pembayaran
  (`master.payment_method.manage`, OWNER/GM).
- `hris.payment_sources` (name, method `CASH|TRANSFER`, active) dipakai lewat `source_id` di
  `pay_batches`, `payslip_payments`, `unloading_payments`, lebih bayar bongkaran, serah kasbon
  (`advance_handovers`) dan pelunasan kasbon. Hanya ada di staging (HRIS belum produksi).
- HRIS tidak boleh membaca schema `petshop` langsung (`hris_app`); polanya **view `hris.pos_*`**
  milik pemilik migrasi (contoh `hris.kasir_branches`, `hris.pos_suppliers`). Tidak ada FK lintas
  schema; id kasir disimpan sebagai angka biasa.

## 2. Data (F2-1a, migrasi petshop `0055`)

### 2.1 `petshop.money_places`

| Kolom | Isi |
|---|---|
| `id` | serial |
| `name` | wajib, unik (tanpa beda huruf besar/kecil), contoh "Rekening BCA Toko B" |
| `kind` | `DRAWER` laci kasir · `CASH` tunai lain (kas Finance, brankas, uang pegangan) · `BANK` rekening/e-wallet penampung 💡 |
| `branch_id` | cabang pemilik, wajib (Brankas/kas kantor = cabang Gudang) |
| `bank_name`, `account_number`, `account_holder` | wajib untuk `BANK`, kosong untuk yang lain |
| `held_by` | `FINANCE` · `STORE` · `OTHER` — "dipegang oleh" |
| `holder_note` | opsional, nama orang (mis. "Driver Andi") |
| `active` | bawaan true; **tidak pernah dihapus** |
| `sort_order` | urutan tampil |
| `created_at/by`, `updated_at/by` | jejak |

Aturan di database: `kind` dalam 3 nilai; `BANK` ⇔ nomor rekening terisi; `DRAWER` hanya satu per
cabang (unique parsial) dan `held_by = STORE`.

**Laci kasir dibuat otomatis** 💡: migrasi membuat satu `DRAWER` "Laci Kasir <nama cabang>" untuk
tiap cabang; membuat cabang baru di Pengaturan › Cabang ikut membuatnya. Laci tidak bisa diubah
jenisnya atau dinonaktifkan selama cabangnya aktif. Gerak uangnya tetap dari shift POS — ia ada
supaya catatan "dari Laci Toko B → Rekening Toko B" punya alamat.

Tempat uang lain **tidak diisi migrasi**; owner mengisinya sendiri ✅ ("bisa saya isi nanti").

### 2.2 `petshop.payment_method_money_places` — tautan metode bayar per cabang

| Kolom | Isi |
|---|---|
| `payment_method_id`, `branch_id` | kunci gabungan (satu metode di satu cabang → satu tempat) |
| `money_place_id` | harus `BANK` dan aktif |
| `updated_at/by` | jejak |

- Hanya untuk metode `BANK_TRANSFER`, `E-WALLET`, `QRIS`. `CASH` selalu masuk Laci cabangnya
  (tidak perlu ditautkan); `DEBT` bukan uang.
- Boleh menunjuk rekening milik cabang lain (mis. QRIS Toko D masuk rekening utama Gudang);
  layar mengusulkan rekening cabang yang sama lebih dulu.
- Mengganti tautan = menimpa baris (pengaturan, bukan data uang) + tercatat di Audit Log. F2-2
  menyimpan salinan tempat uang di tiap baris verifikasi, jadi verifikasi lama tidak ikut berubah.

### 2.3 "Dipegang oleh" tidak bertanggal ✅

v3 (KEU-124) memakai pemegang bertanggal. Keputusan: cukup satu kolom `held_by` + jejak di Audit
Log. Owner 2026-11-08: **"sebaiknya tercatat di verifikasi siapa"** ✅ — maka tiap baris verifikasi
(F2-2) dan pelunasan (F2-3) menyimpan **siapa yang memverifikasi** (akun) **dan salinan `held_by`**
tempat uang tujuan saat itu. Pergantian pemegang kemudian tidak mengubah verifikasi/pelunasan yang
sudah terjadi. Bila nanti Finance perlu "dipegang siapa pada tanggal X", tabel riwayat ditambah
tanpa mengubah yang ini.

## 3. Aturan (F2-1a)

1. **Tidak dihapus**, hanya nonaktif. Tempat nonaktif tidak muncul di pilihan baru, tetap tampil
   di catatan lama.
2. **Nonaktif ditolak** bila masih ditautkan ke metode bayar cabang mana pun — pesan menyebut
   metode & cabangnya. (Syarat "saldo Rp0" v3 KEU-126 menyusul di F2-6, saat saldo sudah dihitung.)
3. Jenis tidak bisa diubah setelah tempat itu dipakai (ditautkan atau disebut di catatan uang).
4. Cabang pemilik bisa diubah selama belum dipakai.
5. Semua tambah/ubah/nonaktif/tautan tercatat di Audit Log Back Office.
6. Saldo awal **tidak** di F2-1 (🗣️ dibahas di F2-6, PRD 00 §10 no.5).

## 4. Hak akses

| Hak | Kode | Peran |
|---|---|---|
| Lihat daftar | `money_place.read` | OWNER, GM, FINANCE |
| Tambah/ubah/nonaktif + tautan metode bayar | `money_place.manage` | OWNER, GM, FINANCE ✅ (owner 2026-11-08: "tambahkan finance juga") |

Ditambahkan ke `packages/db/src/seed/permissions.ts` dan peta peran lewat migrasi (pola yang sama
dengan hak baru sebelumnya).

## 5. Layar (F2-1a) — Back Office › Pengaturan › **Tempat Uang**

Rute `/settings/money-places`, menu baru di grup Pengaturan + tanda Baru.

**Tab 1 — Daftar**
- Dikelompokkan per cabang; tiap baris: nama, jenis, bank & nomor rekening (4 angka terakhir
  dibuka penuh saat diklik), dipegang oleh, status. Saringan: cabang, jenis, tampilkan nonaktif.
- Tombol **Tambah Tempat Uang** → dialog: nama, jenis (Tunai / Rekening; Laci tidak bisa dibuat
  manual), cabang, isian rekening (muncul bila Rekening), dipegang oleh, catatan pemegang.
- Aksi per baris: Ubah, Nonaktifkan / Aktifkan kembali.

**Tab 2 — Metode Bayar per Cabang**
- Tabel: baris = cabang, kolom = metode non-tunai aktif (QRIS, Transfer, EDC, e-wallet…), sel =
  pilihan tempat uang (hanya Rekening aktif). Sel kosong ditandai "belum ditautkan" (jingga);
  F2-2 nanti menolak verifikasi non-tunai yang metodenya belum ditautkan.

## 6. HRIS (F2-1b, migrasi hris `0056`)

1. View baru **`hris.pos_money_places`** (id, name, kind, branch_id, held_by, holder_note,
   active, 4 angka terakhir rekening) — HRIS hanya membaca.
2. Kolom baru `money_place_id` (angka, tanpa FK lintas schema) di semua tabel yang kini punya
   `source_id`. Cara bayar `CASH/TRANSFER` diturunkan dari jenis: `DRAWER/CASH` → tunai,
   `BANK` → transfer. Pengecekan "sumber wajib ada" pindah ke `money_place_id`.
3. Semua layar bayar HRIS (bayar slip, luar slip, bongkaran, lebih bayar, serah & lunasi kasbon)
   memilih dari Tempat Uang aktif; **Laci kasir tidak ditawarkan** 💡 (usul agent, menunggu ok):
   isi laci dihitung oleh shift POS — kalau HRIS juga boleh mengambil dari laci, hitungan tutup
   shift tidak cocok (kas kurang tanpa sebab) atau uangnya tercatat dua kali. Uang laci yang
   dipakai membayar (mis. kasbon karyawan toko) tetap dicatat kasir sebagai pengeluaran shift
   di POS seperti sekarang.
4. **Pengaturan › Sumber Uang** di HRIS menjadi daftar baca + tautan "Atur di Back Office".
5. **Data staging dipetakan sekali** di migrasi: tiap `payment_sources` dicocokkan ke Tempat Uang
   yang namanya sama; bila tidak ada, dibuatkan Tempat Uang (Tunai/"Rekening — perlu dilengkapi",
   cabang Gudang, dipegang Finance) — lalu `money_place_id` diisi. `source_id` dan tabel
   `payment_sources` dibiarkan (tidak dipakai lagi), dibuang di langkah pembersihan sesudah HRIS
   rilis. Di produksi tabel itu kosong, jadi pemetaannya tidak berbuat apa-apa.
6. Fragment `apps/hris/changelog.d/` + tanda Baru di Sumber Uang.

## 7. Tes (non-UI)

- Layanan Tempat Uang: nama unik, rekening wajib untuk `BANK`, satu Laci per cabang, tolak
  nonaktif bila masih ditautkan, tolak ubah jenis bila sudah dipakai.
- Tautan: hanya metode non-tunai, hanya `BANK` aktif.
- Buat cabang → Laci ikut terbuat.
- HRIS: bayar slip/bongkaran/kasbon menyimpan `money_place_id` + cara bayar turunan; menolak
  tempat nonaktif; pemetaan staging (nama cocok / dibuatkan).
- `pnpm migrations:check`, `pnpm typecheck`. UI diuji owner di staging.

## 8. Langkah uji owner (staging)

1. Pengaturan › Tempat Uang: Laci tiap cabang sudah ada.
2. Tambah "Rekening Toko B" (BCA, nomor, dipegang Finance) dan "Kas Tunai Finance" (Tunai, cabang
   Gudang).
3. Tab Metode Bayar per Cabang: QRIS Toko B → Rekening Toko B.
4. Coba nonaktifkan Rekening Toko B → ditolak karena masih dipakai QRIS Toko B.
5. (F2-1b) HRIS › bayar satu slip uji → pilihan sumber uang = daftar Back Office.

## 9. Keputusan owner (2026-11-08)

1. ✅ **Pengubah daftar Tempat Uang: Owner, GM, dan Finance** ("gunakan usul anda tambahkan
   finance juga") — §4.
2. ✅ **Tiga jenis** (Laci / Tunai / Rekening) — "ikuti saran anda saja".
3. ✅ **Laci kasir dibuat otomatis** per cabang — "ikuti saran anda".
4. ✅ **"Dipegang oleh" tanpa riwayat bertanggal; verifikasi mencatat siapa yang memverifikasi**
   ("sebaiknya tercatat di verifikasi siapa") — §2.3, dipakai F2-2/F2-3.
5. 💡 Owner bertanya "sebaiknya gimana?" — usul agent: **Laci tidak ditawarkan di HRIS** (§6 no.3).
   Menunggu ok.
6. 💡 Owner bertanya saran — usul agent: **Pindah Dana tidak di F2-1**, dibuat di **F2-4** (Arus
   Kas) karena butuh layar catat uang; F2-1 hanya pengaturan. Menunggu ok.
7. ✅ **Finance libur**: verifikasi setoran **biasanya menunggu** Finance masuk, **atau dilakukan
   GM/Owner** ("biasanya tidak dikerjakan, atau oleh gm atau owner"). Sudah sejalan dengan hak
   `shift.deposit.verify` sekarang (OWNER, GM, FINANCE); dicatat untuk F2-2 — verifikasi yang
   menunggu tidak mengunci shift.
