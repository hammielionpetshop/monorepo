# Spec HRIS L2b — Hak Akses, Cabang, Jabatan

Tanggal: 2026-11-01 · Status: **draf, menunggu persetujuan owner**
Cakupan: bagian L2b di [plan L2](../plans/2026-11-01-hris-l2.md). Sumber: PRD
[04](../../hris_planning/PRD/fase_1/04-karyawan-dan-akses.md) §4, v3 `hak-akses-desain` (KAR-58, 63, 67, 71–74),
`karyawan-dan-akses-spec` §3 (KAR-L30, L33), §4–5. Aturan v3 berlaku kecuali disebut lain.
Aliran migrasi: `hris` (kunci dipegang `feat/hris-l2b-access`). Tanpa migrasi `auth`/`petshop`.

## 1. Batas

**Dikerjakan:** cabang, departemen, jabatan; daftar tindakan bernama di kode; pemberian hak per
jabatan sebagai data; fungsi tunggal `can()`; batas keras KAR-72; layar KAR-L30 (Cabang &
Jabatan) dan KAR-L33 (Hak Akses Jabatan); jejak perubahan (`hris.audit_events`); data awal jabatan
dan hak; menu HRIS dibaca dari `can()`.

**Tidak dikerjakan (ditunda ke bagian lain):**

| Hal | Di mana |
|---|---|
| Data orang, riwayat penempatan, status kerja (sumber jabatan/cabang seseorang) | L2c |
| Pengaturan Jabatan (KAR-L31), Pengecualian (L32) — butuh pengaturan bertanggal dan persetujuan | L2e / L2f |
| Hak tambahan, "gantikan sementara", izin tugas lapangan (L29, L24) | L2c / L2f |
| Pemberitahuan ke pemilik lain saat hak berubah (KAR-73) | L2f; jejaknya tercatat sejak L2b |
| Bandingkan dua jabatan, Lihat sebagai (L41), Pedoman Lapor | Menyusul |
| Tempat uji per jabatan | Backlog tempat uji |

## 2. Data (schema `hris`, migrasi `0001`)

Nama teknis Inggris. Tidak ada hapus; yang berhenti dipakai ditandai `active = false` (PRI-02).
Tanpa foreign key lintas schema (01 §2). Semua tabel: `created_at`, `updated_at`.

| Tabel | Kolom penting |
|---|---|
| `departments` | `id`, `name` (unik tanpa beda huruf), `active` |
| `branches` | `id`, `name` (unik), `address`, `latitude`, `longitude` (boleh kosong), `kasir_branch_id` (id cabang `petshop`, boleh kosong, tanpa FK), `merged_into_branch_id` (boleh kosong), `active` |
| `positions` | `id`, `name` (unik), `department_id`, `high_rights` (berhak tinggi), `full_access` (Pemilik, GM), `active` |
| `position_grants` | `position_id`, `action` (teks, nama tindakan), `scope` (`SELF`/`BRANCH`/`DEPARTMENT`/`ALL`); unik (`position_id`,`action`); tidak ada baris = tidak ada hak |
| `audit_events` | `id`, `actor_account_id`, `entity` (mis. `position_grant`), `entity_id`, `action`, `before` jsonb, `after` jsonb, `reason`, `created_at`. Hanya tambah baris; dipakai ulang modul lain dan layar Jejak Perubahan (L2e) |
| `interim_actor_positions` | `person_id` (= `local_user_id` pada tautan HRIS), `position_id`, `branch_id`, `department_id`. **Sementara** — lihat §6; diganti riwayat penempatan di L2c |

Batasan DB: `action` pada `position_grants` tidak boleh untuk jabatan `full_access` (jabatan itu tidak
punya baris; hak penuhnya berasal dari bendera, jadi tidak ada salinan yang bisa menyimpang, KAR-67/71).
Trigger/CHECK menolak `UPDATE`/`DELETE` pada `audit_events`.

### Data awal (di migrasi, idempoten)

- Departemen: Office, Team Gudang, Team Toko.
- Jabatan (H7/H7a v3): Pemilik* dan GM* (`full_access`, `high_rights`), HR (`high_rights`, kosong),
  Admin HR, Finance (`high_rights`), Marketing; Kepala Gudang, Driver, Kenek; Kepala Toko, Kasir,
  Pramuniaga, Groomer. Admin Supervisor tidak dibawa. Nama jabatan hanya data: tidak ada nama
  jabatan di kode (WAJ-05); migrasi mengisinya sebagai data awal, seperti jabatan lain.
- Hak awal `position_grants` mengikuti tabel §5 v3 (HR, Admin HR, Finance, Kepala Gudang, semua
  karyawan). "Semua karyawan" = baris hak untuk tiap jabatan operasional (bukan kode khusus).
- Cabang tidak diisi di sini; muat data awal (L2g).

## 3. Tindakan bernama dan `can()`

`apps/hris/modules/access/actions.ts`: daftar tindakan (kode Inggris, label Indonesia) per modul,
berisi seluruh tindakan §5 v3 (mis. `employee.view`, `employee.update`, `placement.record`,
`position.grants.update`, `branch.manage`, …). Setiap tindakan punya:
`ownerOnly` (hanya `full_access`), `selfOnly` (hanya SELF yang boleh diberikan), dan `highRightsOnly`.
Pintu server tanpa tindakan bernama tidak ada: layar/route memanggil `requireAction()`.

`can(actor, action, target?)` — fungsi murni, satu tempat:
1. Tanpa sesi atau tanpa tautan → tolak (bawaan tertutup).
2. `full_access` → boleh, lingkup ALL (kecuali batas keras §4).
3. Selain itu cari baris `position_grants`; lingkup dicocokkan dengan target: SELF = target orang
   yang sama; BRANCH = cabang aktor sama dengan cabang target; DEPARTMENT; ALL. Tanpa target hanya
   lingkup ALL (atau pengecekan menu) yang lolos untuk tindakan bertarget.
4. Cabang/departemen aktor dibaca dari penempatan **pada tanggal data** (KAR-56) — di L2b dari
   `interim_actor_positions`, setelah L2c dari riwayat penempatan. `can()` menerima resolver,
   jadi pergantian tidak mengubah pemanggil.

`actorFromSession()` memetakan `localUserId` tautan HRIS → penempatan → jabatan. Jabatan/cabang
berubah → langsung berlaku (tidak ada cache lintas permintaan).

## 4. Batas keras (KAR-72) — dijaga server dan dites

1. Tidak ada yang mengubah hak, jabatan, atau status aktif dirinya sendiri: layar L33 menolak
   mengubah hak jabatan yang sedang dipegang aktor.
2. Tindakan `ownerOnly` tidak bisa diberikan ke jabatan non-`full_access` (menyimpan ditolak dengan
   pesan menyebut batasnya).
3. Tindakan `highRightsOnly` hanya bisa diberikan ke jabatan `high_rights`.
4. Jabatan `full_access` tidak bisa diubah haknya lewat layar mana pun (KAR-71).
5. Tanda `high_rights` dan `full_access` hanya diubah `full_access`; `full_access` tidak bisa diubah
   lewat layar sama sekali (hanya migrasi).
6. Tanpa login → tidak ada yang terbuka kecuali halaman masuk.

## 5. Layar

Semua memakai komponen L2a; mobile-first walau pemakai utamanya PC.

- **KAR-L30 Cabang & Jabatan** (`/pengaturan/organisasi`, tindakan `org.manage` — HR, Admin HR,
  Pemilik, GM): tiga daftar (Cabang, Departemen, Jabatan) dengan tambah/ubah/nonaktifkan.
  Menonaktifkan yang masih dipakai ditolak dengan pesan menyebut pemakainya (KAR-27) — di L2b
  "dipakai" dihitung dari `interim_actor_positions` dan jabatan di departemen; L2c menambah orang.
  Titik lokasi cabang: isian lintang/bujur (peta menyusul). Tanda `high_rights` hanya terlihat
  bisa diubah oleh Pemilik/GM. Setiap perubahan → `audit_events`.
- **KAR-L33 Hak Akses Jabatan** (`/pengaturan/hak-akses`, tindakan `position.grants.update` —
  Pemilik, GM): pilih jabatan → tindakan dikelompokkan per modul dengan pilihan lingkup
  (tidak ada · diri sendiri · cabangnya · departemennya · semua) → periksa (daftar sebelum→sesudah
  + jumlah orang bila tersedia) → simpan (tombol tertahan 3 detik). Jabatan `full_access` tampil
  "mengikuti Pemilik", tidak bisa diubah. Pilihan yang menabrak §4 tidak ditawarkan, dan server
  tetap menolak bila dipaksa. Menyimpan satu jabatan = satu transaksi + satu baris `audit_events`.
- **Menu**: `lib/nav.ts` memakai `can()` untuk menu ber-`action`; grup "Pengaturan" ditambahkan.
  Menu tanpa hak tidak tampil, tapi penjaganya tetap `requireAction()` di server (SIS-36).

Route handler mutasi memakai pola L1d: `checkMutation` (Origin + CSRF) lalu `requireAction`.

## 6. Keputusan rancangan yang perlu disetujui

1. **Pemetaan aktor sementara (`interim_actor_positions`).** Sebelum data karyawan (L2c) ada, tidak
   ada sumber "siapa memegang jabatan apa". Usulan: tabel sementara kecil yang diisi lewat skrip
   fixture (seperti `link-hris-fixture`, hanya local/staging) untuk `sundus` = Pemilik dan
   `fauzan` = jabatan non-penuh untuk menguji batas hak. Di produksi tabel kosong → semua layar
   L2b tertutup sampai L2c. L2c memigrasikan tabel ini dan menghapusnya. Alternatif: menarik
   `riwayat_penempatan` minimal ke L2b — ditolak karena melebar ke L2c.
2. **Pemilik dan GM lewat bendera `full_access`, bukan baris hak.** Tidak ada duplikasi (KAR-67),
   tidak bisa dikurangi lewat layar (KAR-71). Konsekuensi: tindakan baru otomatis dimiliki mereka.
3. **Tindakan didaftarkan sekaligus (seluruh §5 v3)**, walau pintunya baru dibangun belakangan,
   agar isi awal hak lengkap dan konsisten dari satu migrasi/seed. Tindakan modul Fase 1 lain
   (Kehadiran, Gaji) menambah daftarnya sendiri saat modul itu dibangun, dengan hak awalnya di
   migrasinya (satu pemegang kunci `hris` per waktu).
4. **Nama jabatan di data awal migrasi** dipakai sebagai kunci seed idempoten; kode tidak pernah
   membandingkan nama jabatan.

## 7. Tes (non-UI, sesuai AGENTS.md)

- **Kunci jawaban hak awal:** tes menyusun tabel jabatan × tindakan × lingkup dari §5 v3 dan
  membandingkannya dengan hasil seed + `can()` untuk tiga jenis target (diri sendiri, orang di
  cabang sama, orang di cabang lain). Selisih apa pun = gagal (KAR-63, WAJ-06).
- Batas keras: tiap butir §4 dites (menaikkan hak sendiri, memberi tindakan `ownerOnly`,
  mengubah jabatan `full_access`, tanpa login/tautan, tombol tersembunyi tetap ditolak server).
- Seed idempoten (jalan dua kali tidak menggandakan/mengubah), `audit_events` tidak bisa diubah,
  nama unik tanpa beda huruf, penonaktifan yang masih dipakai ditolak.
- Integrasi DB melalui `packages/db-roles/tests` (pola L1a/L1b), `pnpm migrations:check`,
  `pnpm check:candidate` sekali pada kandidat akhir. Uji UI oleh owner di staging.

## 8. Selesai bila

- Migrasi `hris` `0001` + seed terpasang di DB kosong dan di salinan staging.
- `sundus` (Pemilik fixture) membuka KAR-L30 dan KAR-L33 di staging; `fauzan` (non-penuh) tidak
  melihat menu itu dan permintaan langsung ke route-nya ditolak.
- Mengubah hak satu jabatan tercatat di `audit_events` (siapa, kapan, sebelum, sesudah).
- WIP, klaim (dilepas), plan, dan fragmen changelog diperbarui.
