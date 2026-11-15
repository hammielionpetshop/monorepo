# Spec HRIS L2e — Pengaturan bertanggal & jejak perubahan

Tanggal: 2026-11-01 · Status: **disetujui owner 2026-11-01 (§8 seluruhnya, termasuk kolom "Tugas lapangan otomatis" di butir 7); terintegrasi ke dev_hris dan staging; lolos uji owner di staging 2026-11-01 (deployment `b4e46b7f`)**
Cakupan: bagian L2e di [plan L2](../plans/2026-11-01-hris-l2.md). Sumber: PRD
[03](../../hris_planning/PRD/fase_1/03-perlengkapan-bersama.md) §1, §4, §5; v3 `00-aturan-wajib` WAJ-07;
`00-prinsip-rancangan` PRI-32, PRI-44; `perlengkapan-bersama-spec` BER-L34, L40, L41, §4, §5, §8, §12 (W6,
H13, H14, H18); `karyawan-dan-akses-spec` KAR-L31, §8; `01-karyawan` KAR-73. Dasar kode: L2b (`can()`,
`hris.audit_events`, `recordAudit`), L2c (tanggal WIB di `employees/rules/dates.ts`), L2d (kartu Akses kasir).
Aliran migrasi: **`hris` 0003** (satu pemegang kunci).

## 1. Batas

**Dikerjakan:**
- Kerangka pengaturan bertanggal berlaku (WAJ-07, PRI-32, PRI-44 butir 1): satu tabel nilai, satu **daftar
  pengaturan di kode**, satu fungsi baca "nilai yang berlaku pada tanggal X", sasaran (umum / per jabatan /
  per cabang).
- Layar **Pengaturan** (BER-L40), **Ubah satu pengaturan** (BER-L41) dengan langkah baku, **Riwayat** tiap
  pengaturan, **Batalkan** nilai yang belum berlaku.
- **Pengaturan Jabatan** (KAR-L31) versi awal: tabel jabatan × tanda, hanya tanda yang sudah punya pemakai
  (§8 butir 7: Saran role kasir + Tugas lapangan otomatis).
- Saran role kasir per jabatan (ditunda dari L2d): kartu Akses kasir terisi otomatis dari jabatan orang,
  role tetap dipilih eksplisit.
- Jejak perubahan (BER-L34) **sisi data**: `hris.audit_events` dikunci (tidak bisa diubah/dihapus, H13) dan
  bisa mencatat perubahan oleh mesin. Semua perubahan pengaturan tercatat.
- Angka yang sekarang ditulis di kode HRIS dan termasuk daftar v3 dipindah ke pengaturan (§3.3).

**Tidak dikerjakan (usulan, lihat §8):**

| Hal | Di mana |
|---|---|
| Usulan oleh HR/Admin HR → disetujui Pemilik/GM di kotak Persetujuan (KAR-73). Datanya sudah disiapkan (status `PROPOSED`) | L2f (Mesin Pengajuan) |
| "Pemilik lain diberi tahu" saat Pemilik/GM mengubah langsung | L2f (Pemberitahuan) |
| Langkah 3 "Pengumuman" (BER-L23, Papan Perubahan Aturan) | Menyusul (PRD 03: Papan tidak masuk Fase 1) |
| Layar Jejak Perubahan dari menu Sistem + tombol "Riwayat" di tiap baris data (BER-L34) | Menyusul (PRD 03: "datanya masuk, layarnya menyusul") |
| Pengecualian per orang (KAR-L32, PRI-44 butir 4) | L3 Kehadiran (ketujuh aturan yang boleh dikecualikan milik Kehadiran) |
| Tanda Pengaturan Jabatan lain (kena telat, dapat lembur, slip utama, menanggung kehilangan, dst.) | Ditambah oleh modul pemiliknya (PRI-44 butir 5): L3 Kehadiran, L4+ Gaji |
| Angka masuk & sesi (panjang password, salah password sebelum jeda, lama jeda, tetap masuk 30 hari) | Tetap di `packages/auth` sampai cutover L1 (§8 butir 5) |

## 2. Data (migrasi `hris` 0003)

### 2.1 `hris.setting_values` — nilai bertanggal

| Kolom | Isi |
|---|---|
| `id` | serial |
| `key` | kunci pengaturan, harus ada di daftar kode (§3.1) |
| `target_kind` | enum `ALL`, `POSITION`, `BRANCH` |
| `target_id` | null bila `ALL`; `positions.id` / `branches.id` sesuai jenis (CHECK pasangan) |
| `value` | jsonb, bentuknya diperiksa daftar kode menurut jenis nilai |
| `effective_from` | **date** (tanggal WIB), mulai berlaku pukul 00.00 WIB |
| `status` | enum `PROPOSED`, `ACTIVE`, `CANCELLED` |
| `reason` | alasan perubahan (wajib, panjang menurut §3.3 butir 1) |
| `created_by_account_id`, `created_at` | pengubah / pengusul |
| `approved_by_account_id`, `approved_at` | penyetuju; untuk Pemilik/GM = dirinya sendiri, langsung `ACTIVE` |
| `cancelled_by_account_id`, `cancelled_at`, `cancel_reason` | hanya untuk nilai yang belum berlaku |

- Indeks unik: satu baris `ACTIVE` per (`key`, `target_kind`, `target_id`, `effective_from`). Indeks cari:
  (`key`, `target_kind`, `target_id`, `effective_from desc`) where `status = 'ACTIVE'`.
- Baris **tidak pernah dihapus dan nilainya tidak pernah ditimpa** (PRI-32 butir 2). Trigger menolak `DELETE`
  dan menolak `UPDATE` selain perpindahan status yang sah: `PROPOSED → ACTIVE`, `PROPOSED → CANCELLED`,
  `ACTIVE → CANCELLED` hanya bila `effective_from` > hari ini (WIB).
- **Isi awal** ditanam oleh migrasi: satu baris `ACTIVE`, `target_kind = ALL`, `effective_from = 2026-01-01`,
  alasan "Isi awal buku aturan v3", pelaku akun sistem. Modul berikutnya menanam isi awal pengaturannya di
  migrasinya sendiri (sama dengan pola hak awal di `actions.ts`).

### 2.2 `hris.audit_events` — jejak perubahan (dipakai sejak L2b)

- Tambah kolom `source` (`USER` / `JOB`, bawaan `USER`) dan `job_name` (nama mesin bila `JOB`, KEU-17);
  `actor_account_id` boleh null **hanya** bila `source = JOB` (CHECK).
- Trigger menolak `UPDATE` dan `DELETE` untuk siapa pun, termasuk Pemilik (H13, PRI-40 butir 4). Baris lama
  dari L2b–L2d tetap utuh.
- Setiap perubahan `setting_values` menulis satu baris jejak di transaksi yang sama: `entity = 'setting'`,
  `entity_id` = id baris nilai, `action` = `setting.set` / `setting.propose` / `setting.approve` /
  `setting.cancel`, `before`/`after` = nilai yang berlaku sebelumnya → nilai baru + tanggal + sasaran.

## 3. Kode

### 3.1 Daftar pengaturan — `apps/hris/modules/settings/rules/registry.ts`

Daftar di kode, bukan tabel (BER spec §4, sama alasannya dengan daftar tindakan KAR-71). Tiap baris:

| Medan | Isi |
|---|---|
| `key`, `label`, `module`, `explain` | nama bahasa sederhana + satu kalimat "apa yang dipengaruhi" (dipakai L41 langkah 1) |
| `type` | `integer` (dengan `min`/`max`), `rupiah`, `duration` (satuan menit/hari/bulan), `choice` (daftar pilihan), `boolean`, `role` |
| `unit` | satuan yang ditampilkan |
| `targets` | sasaran yang diizinkan: `ALL` dan/atau `POSITION` / `BRANCH` |
| `affectsMoney` | menyangkut uang atau hitungan → aturan tanggal ketat (§3.2) + tombol ditahan 3 detik |
| `startDay` | opsional: hanya boleh berlaku mulai tanggal tertentu (mis. 26 untuk angka gaji, PRI-44 butir 1) |
| `mustAnnounce`, `exemptible` | disimpan sekarang; dipakai Papan (menyusul) dan Pengecualian (L3) |
| `viewAction`, `editAction` | tindakan bernama (§4) |
| `review` | `OWNER_DIRECT` (Pemilik/GM langsung berlaku) atau `PROPOSE_APPROVE` (HR mengusulkan, L2f) |

**Mesin pengaman (H18):** tes membandingkan daftar kode dengan isi awal di database. Kunci di daftar tanpa
isi awal, atau kunci di database yang tidak ada di daftar = tes gagal. Isi awal juga harus lolos pemeriksa
jenis nilainya.

### 3.2 Fungsi baca dan tulis — `apps/hris/modules/settings/`

- **`rules/resolve.ts`** (murni, dites tanpa DB): `resolveSetting(rows, { on, target })` → baris `ACTIVE`
  dengan `effective_from` ≤ `on` paling akhir; urutan sasaran: jabatan/cabang orang itu dulu, lalu `ALL`.
  `PROPOSED` dan `CANCELLED` tidak pernah dipakai.
- **`server/read.ts`**: `settingOn(tx, key, on, target?)` dan `settingsOn(tx, keys[], on, target?)` (satu
  kueri untuk mesin yang butuh banyak angka). **Inilah satu-satunya jalan membaca angka aturan**; rumus tidak
  memakai angka di kode (PRD 03 §4). Tanggal yang dipakai selalu **tanggal kejadian/hitungan**, bukan hari ini,
  sehingga hitungan lama memberi hasil sama walau pengaturannya berubah (W6, WAJ-07).
- **`server/write.ts`**: `setSetting(tx, { key, target, value, effectiveFrom, reason, actor, expectedCurrentId })`,
  `cancelSetting(...)`. Pemeriksaan:
  - jenis nilai cocok dengan daftar; sasaran diizinkan; jabatan/cabang aktif;
  - **tanggal**: `affectsMoney` → paling cepat **besok** (WIB); lainnya → paling cepat **hari ini** (§8 butir 4).
    Tidak pernah mundur. `startDay` dipatuhi;
  - nilai sama dengan yang berlaku pada tanggal itu → ditolak ("tidak ada yang berubah");
  - sudah ada nilai `ACTIVE` lain di tanggal yang sama → ditolak; batalkan dulu yang itu;
  - `expectedCurrentId` beda dengan yang sekarang → "Pengaturan ini baru diubah orang lain, muat ulang";
  - pelaku punya `editAction`; KAR-72: tidak menyetujui usulannya sendiri (berlaku sejak L2f).
- `recordAudit` dipindah ke `modules/shared/server/audit.ts` (dipakai semua modul), terima `source`/`jobName`.

### 3.3 Angka yang dipindah ke pengaturan di L2e

Hanya angka dari daftar v3 yang **sudah dipakai kode HRIS sekarang**:

| Kunci | Nama | Isi awal | Uang/hitungan | Pemakai sekarang |
|---|---|---|---|---|
| `shared.reason_min_length` | Panjang alasan paling sedikit | 15 huruf | tidak | semua isian alasan HRIS (PRI-44 butir 2) — lihat §8 butir 6 |
| `shared.hold_seconds_consequential` | Jeda tombol konfirmasi berakibat | 3 detik | tidak | `HOLD_SECONDS` di 3 layar (BER §8) |
| `employees.training_review_months` | Masa training sebelum dinilai | 3 bulan | ya | antrean Promosi Training (KAR-20, `dates.ts`) |
| `position.backoffice_role_suggestion` | Saran role kasir (per jabatan) | tanpa saran | tidak | kartu Akses kasir (L2d) |
| `position.field_duty_auto` | Tugas lapangan otomatis (per jabatan) | tidak | tidak | penanda "Otomatis (jabatan …)" di Izin tugas lapangan (L2c, KAR-L24) |

Masa training dibaca menurut **tanggal genap masa training orang itu**: mengubah 3 → 4 bulan mulai 1 Desember
tidak mengubah orang yang sudah masuk antrean sebelum 1 Desember.

## 4. Hak dan pelaku

Tindakan baru di `modules/access/rules/actions.ts`, grup "Pengaturan & organisasi":

| Tindakan | Bendera | Isi awal |
|---|---|---|
| `settings.view` — buka layar Pengaturan; baris disaring per `viewAction` tiap pengaturan (PRI-32 butir 5) | — | Pemilik/GM saja |
| `settings.manage` — ubah & batalkan pengaturan bertanda `OWNER_DIRECT` | `ownerOnly` | Pemilik/GM |

Pengaturan Jabatan memakai tindakan yang sudah ada: `position_settings.approve` (ownerOnly, langsung berlaku)
dan `position_settings.propose` (HR/Admin HR; di L2e layarnya hanya-lihat dengan catatan "usulan bisa dibuat
setelah kotak Persetujuan tersedia"). Semua pengaturan di §3.3 = `OWNER_DIRECT` (BER §8 dan KAR §8: "hanya
diubah Pemilik dan GM, langsung berlaku").

## 5. Layar

Komponen L2a; layar pengelolaan nyaman di PC, tetap terbaca di HP. Menu grup "Pengaturan": **Pengaturan**
(`/pengaturan`) dan **Pengaturan Jabatan** (`/pengaturan/jabatan`), di samping Cabang & Jabatan dan Hak Akses
Jabatan.

- **Pengaturan (BER-L40)** — dikelompokkan per modul (Bersama, Karyawan). Tiap baris: nama, nilai sekarang +
  satuan, "berlaku sejak", dan bila ada: nilai berikutnya + tanggal berlakunya. Kotak cari. Tombol **Ubah**,
  **Riwayat**.
- **Ubah satu pengaturan (BER-L41)** — langkah baku:
  1. **Nilai baru** — nilai sekarang, satuan, kalimat `explain`.
  2. **Tanggal berlaku dan alasan** — pemilih tanggal yang menolak tanggal di luar aturan §3.2 dengan
     kalimat sebabnya.
  3. ~~Pengumuman~~ — dilewati di Fase 1; pengaturan bertanda `mustAnnounce` menampilkan catatan
     "Perubahan ini perlu diumumkan ke karyawan. Papan pengumuman belum tersedia; sampaikan langsung."
  4. **Periksa** — sebelum → sesudah, mulai kapan, siapa terkena (mis. "berlaku untuk semua karyawan" /
     "8 orang berjabatan Kasir"). Tombol simpan ditahan 3 detik bila menyangkut uang.
  Jalan keluar: Kembali, Ulangi dari awal sebelum simpan.
- **Riwayat** satu pengaturan — semua nilai: dari kapan sampai kapan, sasaran, siapa, alasan, status. Nilai
  yang belum berlaku punya tombol **Batalkan** (alasan wajib); yang sudah berlaku tidak bisa dibatalkan, hanya
  diganti nilai baru bertanggal.
- **Pengaturan Jabatan (KAR-L31)** — tabel: baris = jabatan aktif, kolom = tanda. L2e dua kolom:
  **Saran role kasir** (pilihan: tanpa saran / KASIR / GUDANG / MANAGER / FINANCE; OWNER/GM tidak bisa disarankan)
  dan **Tugas lapangan otomatis** (tidak / menyetir / kenek / menyetir dan kenek).
  Klik sel → langkah baku yang sama; periksa menyebut jumlah orang berjabatan itu. Riwayat per sel.
- **Izin tugas lapangan** (L2c, KAR-L24) — orang yang jabatannya bertanda tugas lapangan otomatis tampil
  "Otomatis (jabatan …)" pada sakelar yang sesuai; izin per orang yang sudah dicatat tetap berlaku.
- **Kartu Akses kasir** (L2d, Halaman orang) — saat memberi akses baru, role terisi dari saran jabatan orang
  pada hari ini dengan tulisan "saran dari jabatan Kasir"; tetap bisa diganti. Tanpa saran = kosong seperti
  sekarang.

Route mutasi `app/api/settings/**` memakai pola L2b–L2d: `checkMutation` → `requireMutationAction` → fungsi
§3.2 → `recordAudit`, dalam satu transaksi.

## 6. Jejak perubahan (BER-L34) — yang ada setelah L2e

- Tercatat sejak L2b: hak jabatan, organisasi, karyawan, penempatan, izin, akun & akses kasir. L2e menambah
  pengaturan dan mengunci tabelnya (§2.2).
- Layar menu Sistem dan tombol "Riwayat" tiap baris menyusul. Riwayat per pengaturan (§5) adalah layar jejak
  pertama.

## 7. Tes (non-UI)

- **Aturan murni** (`resolve`): nilai lama untuk tanggal lama, nilai baru mulai tanggal berlakunya (W6);
  nilai yang dibatalkan dan usulan tidak pernah dipakai; sasaran jabatan mengalahkan `ALL`; tanpa nilai sasaran
  jatuh ke `ALL`.
- **Tulis** (integrasi DB): uang/hitungan menolak hari ini dan kemarin, menerima besok; bukan uang menerima
  hari ini, menolak kemarin; `startDay`; nilai kembar di tanggal sama ditolak; `expectedCurrentId` basi
  ditolak; batalkan nilai yang sudah berlaku ditolak; jenis nilai salah ditolak.
- **Database**: `DELETE`/`UPDATE` di `audit_events` ditolak; `UPDATE` nilai/tanggal di `setting_values`
  ditolak; perpindahan status tak sah ditolak.
- **Mesin pengaman (H18)**: daftar kode ↔ isi awal database cocok dan lolos pemeriksa jenis.
- **Hak (H14)**: `settings.manage` sebagai tiap jabatan awal; HR tidak bisa mengubah pengaturan `OWNER_DIRECT`;
  pengaturan yang `viewAction`-nya tidak dimiliki tidak tampil di daftar.
- **Pemakai**: Promosi Training memakai masa training yang berlaku pada tanggal genapnya; batas alasan dibaca
  dari pengaturan.
- `pnpm check:candidate` sekali pada kandidat akhir. Uji UI owner di staging: ubah "Masa training" mulai besok
  → lihat "nilai berikutnya" → batalkan; ubah "Saran role kasir" jabatan Kasir → buat akses kasir karyawan
  Kasir dan lihat role terisi.

## 8. Keputusan yang diminta dari owner

1. **Usulan HR → persetujuan Pemilik/GM ditunda ke L2f.** Di L2e hanya Pemilik/GM yang mengubah (langsung
   berlaku). Datanya sudah siap untuk usulan. *Saran: setuju* — kotak Persetujuan baru ada di L2f, dan v3
   melarang layar persetujuan tersendiri.
2. **"Pemilik lain diberi tahu" ditunda ke L2f** (Pemberitahuan belum ada); sementara cukup tercatat di jejak.
   *Saran: setuju.*
3. **Langkah Pengumuman dilewati**, diganti catatan "sampaikan langsung" untuk pengaturan wajib diumumkan.
   *Saran: setuju* (Papan tidak masuk Fase 1).
4. **Aturan tanggal berlaku:** menyangkut uang/hitungan → paling cepat besok; lainnya → boleh hari ini;
   tidak pernah mundur. *Saran: setuju.* (Jarak 7 hari dari pengumuman ke berlaku menunggu Papan.)
5. **Angka masuk & sesi tetap di `packages/auth`** sampai cutover L1, karena dipakai juga backoffice dan bukan
   angka uang. Didaftarkan sebagai pengaturan sesudah cutover. *Saran: setuju.*
6. **Panjang alasan 15 huruf** berlaku untuk semua isian alasan HRIS yang sudah ada (lepas tautan, nonaktifkan,
   cabut izin, batalkan catatan, dsb.). Sekarang batasnya 3 huruf (`employees/server/changes.ts`,
   `employee-detail.tsx`). *Saran: setuju* — sesuai PRI-44
   butir 2; dampaknya hanya orang harus menulis alasan sedikit lebih jelas.
7. **Pengaturan Jabatan versi awal hanya kolom "Saran role kasir".** Tanda lain ditambah modul pemiliknya.
   Pilihan tambahan: kolom **"Tugas lapangan otomatis"** (menyetir / kenek / tidak) supaya penanda "Otomatis
   (jabatan Driver)" di Izin tugas lapangan (L2c) bisa jalan sekarang. *Saran: tambahkan juga*, karena
   kecil dan sudah dijanjikan di spec L2c — kalau setuju, masuk tabel §3.3 dengan isi awal "tidak".
8. **Jejak perubahan dikunci** (tidak bisa diubah/dihapus siapa pun, termasuk Pemilik) dan bisa mencatat
   pelaku mesin. *Saran: setuju* (H13).
9. **Layar Jejak Perubahan (menu Sistem) menyusul**; di L2e hanya Riwayat per pengaturan. *Saran: setuju*
   (PRD 03).

### Catatan implementasi (2026-11-01, tanpa keputusan baru)

- Modul `apps/hris/modules/settings` (`rules/registry.ts`, `rules/resolve.ts`, `server/read.ts`, `server/write.ts`,
  `server/screens.ts`, `ui/*`); route `POST /api/settings` (`kind: set | cancel`).
- Layar Pengaturan ada di `/pengaturan/umum`, bukan `/pengaturan`, supaya menu tidak ikut menyala di sub-halaman
  Pengaturan lain. Pengaturan Jabatan di `/pengaturan/jabatan`.
- `recordAudit` tetap di modul `access` (tabel `audit_events` milik schema access; memindahkannya ke `shared`
  melanggar pagar batas modul) dan kini menerima `jobName` untuk pelaku mesin.
- Isian alasan memakai `checkReason` dari modul settings; layar hanya memeriksa "tidak kosong", panjangnya dari
  server.
- Masa training: tanggal genap = hari pertama D dengan D ≥ bergabung + masa yang berlaku pada D
  (`employees/rules/dates.ts` `trainingDueOn`); versi pertama dianggap berlaku sejak dulu.
- Jeda tombol: satu `HoldButton` bersama di `components/ui/hold-button.tsx`, nilainya diberikan kerangka aplikasi
  lewat `HoldSecondsProvider`. Tiga salinan lama diganti.
- `audit_events` sudah append-only sejak L2b; 0003 hanya menambah `source`/`job_name` dan CHECK pelaku.
- Tes: unit 12 (pengaturan) + 3 (masa training); integrasi DB 7 (`packages/db-roles/tests/hris-settings…`);
  layanan 6 (`modules/settings/server/settings.integration.test.ts`, jalan bila `ROLES_TEST_ADMIN_URL` diisi).
