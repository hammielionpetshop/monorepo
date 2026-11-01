# Spec HRIS L2f-1 — Mesin Pengajuan, Pemberitahuan, Beranda dasar

Tanggal: 2026-11-01 · Status: **disetujui owner 2026-11-01 (§9 seluruhnya sesuai saran, jawaban "ok"); terintegrasi ke dev_hris dan staging; lolos uji owner di staging 2026-11-01 (deployment `3c6341c0`, run `41315011709`)**
Cakupan: bagian L2f di [plan L2](../plans/2026-11-01-hris-l2.md), dipecah atas persetujuan owner 2026-11-01:
**L2f-1** (spec ini) = fondasi Mesin Pengajuan + Pemberitahuan + Beranda dengan satu jenis contoh nyata;
**L2f-2** (spec sendiri, sesudah L2f-1 lolos uji) = usulan HR atas Pengaturan Jabatan (KAR-73), "pemilik lain
diberi tahu", lupa password mandiri + kode GM.
Sumber: PRD [03](../../hris_planning/PRD/fase_1/03-perlengkapan-bersama.md) §1–§3, §5; v3 `00-prinsip-rancangan`
PRI-23, PRI-37, PRI-42, PRI-43; `pengajuan-dan-laporan-desain` §1 + F1–F4; `perlengkapan-bersama-spec`
TAM-25, BER-L01, L02, L04–L07, L20, L21, L42; `daftar-lintas-modul` bab 1 baris 1 dan §1.7; `01-karyawan`
KAR-66, KAR-72, KAR-79, KAR-80; `karyawan-dan-akses-spec` KAR-L10, L12, §5, §11.
Dasar kode: L2b (`can()`, tindakan bernama, `recordAudit`), L2c (data karyawan, `employees/server/changes.ts`),
L2e (pengaturan bertanggal, `checkReason`, `HoldButton`), L0 (volume berkas HRIS tertutup `UPLOAD_DIR`).
Aliran migrasi: **`hris` 0005** (satu pemegang kunci).

## 1. Batas

**Dikerjakan:**
- **Mesin Pengajuan** (PRI-23, PRI-37): satu catatan per pengajuan, status sama untuk semua jenis, riwayat
  setiap perpindahan status, satu penyetuju cukup, tidak memutuskan milik sendiri (KAR-72), tolak wajib alasan,
  **Ajukan ulang** sebagai pengganti "dikembalikan".
- **Daftar jenis di kode** (sama alasannya dengan daftar tindakan dan daftar pengaturan) + layar **Jenis
  Pengajuan** (BER-L42) hanya-lihat.
- Layar **Pengajuan Saya**, **Ajukan: pilih jenis**, **Isian**, **Rincian** (BER-L04–L07), **Persetujuan** dan
  **Putuskan** (BER-L20, L21).
- Jenis contoh nyata: **Ubah data diri** (KAR-66, KAR-L12) — dari pengajuan sampai data berubah, tercatat.
- **Lampiran terlindungi**: unggah foto ke volume tertutup HRIS, dibuka hanya oleh yang berhak (PRI-23).
- **Pemberitahuan** di dalam aplikasi (BER-L02): daftar, tanda belum dibaca, Tandai semua terbaca, dibuang
  mesin setelah 90 hari.
- **Beranda dasar** (BER-L01): kartu "Perlu perhatian saya", kelompok "Perlu perhatian sistem" untuk
  Pemilik/GM, tiga kabar terbaru.

**Tidak dikerjakan:**

| Hal | Di mana |
|---|---|
| Usulan HR atas Pengaturan Jabatan → kotak Persetujuan; "pemilik lain diberi tahu"; lupa password mandiri + kode GM | **L2f-2** |
| Tahap **Diperiksa**, **Dicabut**, **Hangus**, **Minta dibatalkan** | Statusnya sudah ada di data dan aturan perpindahan (§2.2); tombol dan mesinnya dibangun bersama jenis pertama yang memakainya (kasbon, izin di L3+) — §9 butir 3 |
| Pengingat berantai & jendela antrean (BER-L03) | Menyusul (PRD 03 §1) |
| Notifikasi HP (push) | Menyusul (PRD 03 §2) |
| Mengubah penyetuju / batas waktu dari layar Jenis Pengajuan | Penyetuju diatur lewat Hak Akses Jabatan (§4); batas waktu ditambah jenis yang punya batas — §9 butir 2 |
| Mengubah baris pedoman lapor (KAR-L35) | Menyusul; L2f-1 memakai isi awal dari `daftar-lintas-modul` §1.7 |
| Ubah foto profil (KAR-L11) | Tetap di luar L2f-1; pintu unggahnya sudah siap untuk dipakai nanti |

## 2. Data (migrasi `hris` 0005)

### 2.1 `hris.files` — berkas terlindungi

| Kolom | Isi |
|---|---|
| `id` | uuid (acak, juga nama berkas di volume) |
| `mime`, `size_bytes`, `sha256` | diperiksa server; hanya `image/jpeg`, `image/png`, `image/webp`, paling besar 10 MB |
| `uploaded_by_account_id`, `created_at` | pengunggah |

- Berkas ditulis ke `UPLOAD_DIR` (staging: volume `hammielion-staging_hris_photos`; produksi: `hris_photos`).
  Volume ini **tidak** dipasang di Caddy, jadi tidak ada alamat publik; berkas hanya keluar lewat route HRIS yang
  memeriksa hak (§3.4).
- Tidak ada hapus. Berkas yang diunggah tetapi tidak jadi dilampirkan dibiarkan (kecil, jarang); pembersihan
  menyusul bila perlu.

### 2.2 `hris.requests` — satu catatan per pengajuan

| Kolom | Isi |
|---|---|
| `id` | serial; nomor tampil `PJ-<id>` |
| `type_key` | kunci jenis, harus ada di daftar kode (§3.1) |
| `subject_employee_id` | untuk siapa |
| `submitted_by_account_id` | pengaju (atau pengisi atas nama, kelak) |
| `status` | enum `PENDING`, `REVIEWED`, `APPROVED`, `REJECTED`, `CANCELLED`, `REVOKED`, `EXPIRED` (7 status PRI-37) |
| `summary` | ringkasan satu baris untuk kartu ("Ganti rekening dan nama") |
| `branch_id` | cabang orangnya saat diajukan (untuk saring dan lingkup cabang) |
| `resubmitted_from_id` | pengajuan lama bila lewat **Ajukan ulang** |
| `submitted_at` | jam server (PRI-01) |
| `decided_by_account_id`, `decided_at`, `decision_reason` | keputusan terakhir |
| `version` | angka naik tiap perpindahan status; dipakai penjaga "sudah diputuskan orang lain" |

- **Perpindahan status yang sah** dijaga trigger dan fungsi murni yang sama (§3.2):
  `PENDING → REVIEWED | APPROVED | REJECTED | CANCELLED | EXPIRED`, `REVIEWED → APPROVED | REJECTED | CANCELLED |
  EXPIRED`, `APPROVED → REVOKED | CANCELLED` (pembatalan yang disahkan). Lainnya akhir. Trigger menolak `DELETE`
  dan menolak perubahan kolom selain status/keputusan/`version`.
- CHECK: `REJECTED` dan `REVOKED` wajib `decision_reason`.

### 2.3 `hris.request_events` — riwayat keputusan

`id`, `request_id`, `from_status` (null untuk diajukan), `to_status`, `actor_account_id`, `reason`, `created_at`.
Satu baris per perpindahan, ditulis di transaksi yang sama. Trigger menolak `UPDATE`/`DELETE` (PRI-02).

### 2.4 `hris.request_attachments`

`request_id`, `file_id`, `label` (mis. "Foto buku tabungan"), `created_at`. Unik (`request_id`, `file_id`).
Tanpa hapus.

### 2.5 `hris.identity_changes` — isi khas Ubah data diri (milik modul karyawan)

| Kolom | Isi |
|---|---|
| `request_id` | PK, ke `requests` |
| `employee_id` | orangnya |
| `before` | jsonb: nilai saat diajukan, hanya kolom yang diubah |
| `after` | jsonb: nilai yang diminta |
| `applied_at` | diisi saat disetujui dan data karyawan sudah diganti |

Kolom yang boleh diubah lewat jenis ini (KAR-66): `name`, `birthDate`, `gender`, `bankName`,
`bankAccountNumber`, `bankAccountHolder`. Indeks unik sebagian: paling banyak **satu pengajuan menunggu** per
orang (kembar ditolak, BER-L06).

### 2.6 `hris.notifications` — Pemberitahuan (BER-L02)

`id`, `recipient_account_id`, `kind` (kunci, mis. `request.submitted`, `request.approved`), `title`, `body`,
`link` (alamat layar urusannya), `entity`, `entity_id`, `created_at`, `read_at`.
- Indeks (`recipient_account_id`, `created_at desc`) dan sebagian `where read_at is null` untuk angka belum dibaca.
- Hanya `read_at` yang boleh berubah (null → waktu). Hapus hanya oleh job `notifications-purge` untuk baris
  lebih dari 90 hari (BER-L02; pemberitahuan bukan data transaksi). Job tercatat di `hris.job_runs`.

### 2.7 Pengaturan baru (daftar L2e)

| Kunci | Nama | Isi awal | Pemakai |
|---|---|---|---|
| `requests.overdue_days` | Pengajuan dianggap lama menunggu | 2 hari | tanda merah di Persetujuan + "Perlu perhatian sistem" Pemilik/GM (PRI-37 butir 4) |

`OWNER_DIRECT`, bukan uang/hitungan. Isi awal ditanam migrasi 0005 seperti pola L2e.

## 3. Kode

### 3.1 Modul dan daftar jenis

Modul baru mengikuti pagar `apps/hris/modules/README.md`:

| Modul | Isi |
|---|---|
| `modules/requests` | mesin (aturan status, simpan, putuskan, daftar jenis, layar L04–L07, L20, L21, L42) |
| `modules/notifications` | kirim/baca/tandai pemberitahuan, job purge, layar L02, lonceng |
| `modules/files` | unggah + baca berkas terlindungi |
| `modules/employees` | **isi khas** Ubah data diri: isian, pemeriksaan, keterangan pembantu, akibat setelah disetujui |

Daftar jenis — `modules/requests/rules/types.ts` (kode, bukan tabel). Tiap jenis:

| Medan | Isi |
|---|---|
| `key`, `label`, `module` | `identity_change`, "Ubah data diri", Karyawan |
| `requestAction`, `decideAction` | tindakan bernama: `identity_change.request`, `identity_change.decide` (sudah ada sejak L2b) |
| `reviewAction` | opsional (pemeriksa); kosong untuk Ubah data diri |
| `extraViewers` | tindakan "ikut melihat" (kosong) |
| `deadline` | `NONE` → "Tidak berbatas" |
| `attachments` | aturan lampiran; Ubah data diri: wajib bila rekening berubah (KAR-80), kamera + galeri |
| `confidential` | `true` (lampiran hanya pengaju, penyetuju, HR, Pemilik/GM) |
| `cancelAfterApproval` | `false` |
| `guideLine` | "Ganti rekening wajib foto buku tabungan. HR memeriksa." (§1.7 isi awal) |
| `handler` | fungsi milik modul jenisnya: `validate`, `summary`, `helperInfo` (keterangan pembantu), `apply` (akibat saat disetujui, di transaksi yang sama) |

Modul jenis mendaftarkan handler lewat `index.ts`-nya; app/ merangkai (modul `requests` tidak mengimpor modul
karyawan).

### 3.2 Mesin — `modules/requests`

- **`rules/status.ts`** (murni, dites tanpa DB): tabel perpindahan sah (§2.2), `canDecide(actor, request, type)`:
  punya `decideAction` dengan lingkup yang mencakup orangnya, **bukan** pengaju dan **bukan** orang yang
  diajukan (KAR-72 butir 2). Pemilik/GM selalu bisa, kecuali untuk miliknya sendiri; milik Pemilik/GM diputuskan
  Pemilik/GM yang lain.
- **`server/submit.ts`** `submitRequest(actor, typeKey, input)`: hak `requestAction`; handler `validate`; lampiran
  wajib; tolak kembar; satu transaksi: `requests` + isi khas + lampiran + event `PENDING` + jejak
  (`recordAudit`, `entity = 'request'`) + pemberitahuan ke penyetuju (§6). Pesan berhasil menyebut siapa
  bertindak berikutnya (TAM-17).
- **`server/decide.ts`** `approveRequest`, `rejectRequest(reason)`, `cancelRequest(reason)` dengan
  `expectedVersion`: baris dikunci (`for update`), versi beda → "Sudah diputuskan <nama> pukul <jam>:
  <status>" (BER-L21). Setujui menjalankan handler `apply` di transaksi yang sama; gagal `apply` = seluruh
  keputusan batal. Alasan memakai `checkReason` (panjang dari pengaturan L2e, 15 huruf).
- **`server/queries.ts`**: Pengajuan Saya (milik/atas nama orang itu), Persetujuan (Menunggu saya / Sudah saya
  putuskan / Semua yang berhak dilihat), rincian + riwayat + lampiran, angka penanda.

### 3.3 Ubah data diri — `modules/employees`

- Isian: nilai lama di samping nilai baru; hanya kolom yang benar-benar berubah yang disimpan.
- `validate`: format sama dengan ubah data oleh HR (`rules/fields.ts`); nama tidak kosong; rekening berubah →
  lampiran wajib.
- `apply`: mengganti data karyawan di transaksi keputusan dan menulis jejak `employee.identity_change.apply` sebelum/sesudah. Bila salah satu kolom sudah
  diubah orang lain sejak diajukan (nilai sekarang ≠ `before`), persetujuan **ditolak** dengan pesan "Data
  sudah berubah sejak diajukan. Tolak pengajuan ini dan minta diajukan ulang." Data lama tetap berlaku sampai
  disetujui (KAR-66).
- Keterangan pembantu untuk penyetuju: nilai sekarang ↔ diminta per kolom; rekening lama ditampilkan utuh
  hanya kepada penyetuju.

### 3.4 Berkas — `modules/files`

- `POST /api/files`: masuk + `checkMutation`; periksa jenis dari isi berkas (bukan nama), ukuran; simpan
  `<UPLOAD_DIR>/<uuid>`; balas `id`.
- `GET /api/requests/[id]/attachments/[fileId]`: berkas hanya keluar bila pelaku boleh melihat pengajuan itu
  **dan** (bila jenisnya tertutup) termasuk pengaju, penyetuju, HR, atau Pemilik/GM (PRI-23). Header
  `Cache-Control: private, no-store`, `Content-Disposition: inline`.

## 4. Hak

- Penyetuju jenis = jabatan yang punya `decideAction` di **Hak Akses Jabatan** (L2b). Mengubah penyetuju =
  mengubah hak itu, tercatat seperti hak lain. Isi awal sudah ada: `identity_change.request` diri sendiri untuk
  semua jabatan bukan Pemilik/GM; `identity_change.decide` lingkup semua untuk HR dan Admin HR; Pemilik/GM
  memiliki semua (KAR-67). Tanpa migrasi hak baru.
- Tindakan baru: **`request_types.view`** — buka layar Jenis Pengajuan, isi awal Pemilik/GM saja.
- Tidak ada tindakan untuk Pemberitahuan dan Beranda: tiap orang yang punya akses HRIS melihat miliknya sendiri.
- Layar Persetujuan tampil bagi yang punya sedikitnya satu `decideAction`/`reviewAction` jenis terdaftar.

## 5. Layar

Komponen L2a. Menu (`lib/nav.ts`):

| Kelompok | Menu | Alamat | HP bilah bawah |
|---|---|---|---|
| (utama) | Beranda | `/` | ya |
| (utama) | Pemberitahuan | `/pemberitahuan` (+ lonceng berangka di bilah atas PC) | ya |
| Saya | Pengajuan Saya | `/pengajuan` | ya |
| Saya | Profil saya | `/profil` | lewat Menu |
| Kantor (baru) | Persetujuan (angka penanda = menunggu saya) | `/persetujuan` | lewat Menu |
| Pengaturan | Jenis Pengajuan | `/pengaturan/jenis-pengajuan` | — |

- **Pengajuan Saya (L04)** — kartu: jenis, ringkasan, label status, tanggal diajukan; saring status & jenis; tombol
  besar **Ajukan**. Kosong: "Belum ada pengajuan."
- **Ajukan: pilih jenis (L05)** — satu tombol per jenis yang menjadi haknya; jenis berhak tetapi syarat belum
  terpenuhi tampil redup dengan alasannya ("Ubah data diri: masih ada pengajuan yang menunggu HR"). Di bawahnya
  batas waktu satu kalimat ("Tidak berbatas").
- **Isian (L06)** — kepala: nama jenis + baris pedoman; isi khas dari modul jenisnya; lampiran (kamera atau
  galeri); Kirim. Ditolak server menyebut sebab dan jalan berikutnya. Berhasil: "Perubahan data terkirim. Data
  lama tetap dipakai sampai HR menyetujui." Kembali tanpa kehilangan isian; Ulangi dari awal.
- **Rincian (L07)** — isi, lampiran, label status, riwayat (siapa, kapan, alasan). Menunggu → **Batalkan**
  (alasan wajib). Ditolak → alasan tampil besar + **Ajukan ulang** (isian lama terisi).
- **Profil saya (KAR-L10)** — kartu Data identitas dapat tombol **Ajukan perubahan** (membuka isian yang sama);
  bila ada yang menunggu, kartunya bertanda "Menunggu HR" dengan tautan ke rinciannya.
- **Persetujuan (L20)** — tab **Menunggu saya**, **Sudah saya putuskan**, **Semua**. Kartu: jenis, pengaju,
  ringkasan, lama menunggu; lebih dari 1 hari kuning, lebih dari `requests.overdue_days` merah. Urutan terlama di
  atas; saring jenis, cabang, pengaju. Milik sendiri redup di Semua: "diputuskan penyetuju lain". Pengaju
  nonaktif bertanda "orangnya nonaktif sejak …". **Tidak ada "Setujui semua".**
- **Putuskan (L21)** — isi lengkap, lampiran, riwayat, keterangan pembantu. **Setujui** (ditahan sesuai
  pengaturan jeda tombol; jendela menyebut akibatnya: "Nama Budi diganti menjadi …, rekening diganti …") atau
  **Tolak** (alasan wajib, akan dibaca pengaju). Setelah memutuskan: **Berikutnya** dan **Kembali ke
  Persetujuan**. Dua penyetuju bersamaan: yang kedua mendapat jendela "Sudah diputuskan …".
- **Pemberitahuan (L02)** — daftar terbaru di atas, titik untuk yang belum dibuka; menekan satu kabar membuka
  layar urusannya dan menandai terbaca; **Tandai semua terbaca**. Tidak ada tombol hapus.
- **Beranda (L01)** — urutan tetap: (1) pengumuman — dilewati, Papan belum ada; (2) **Perlu perhatian saya**:
  satu kartu per jenis urusan, jumlah + paling lama menunggu, menuju layarnya; (3) **Perlu perhatian sistem**
  (Pemilik/GM saja): pengajuan yang lewat `requests.overdue_days`; (4) **Kabar terbaru**: tiga pemberitahuan
  belum dibuka + "Lihat semua". Kosong: "Tidak ada yang menunggu Anda."
- **Jenis Pengajuan (L42)** — tabel hanya-lihat dari daftar kode: nama, modul, penyetuju (nama jabatan dibaca
  dari hak), pemeriksa, ikut melihat, batas waktu, lampiran, tertutup, baris pedoman. Catatan: "Penyetuju
  diubah di Hak Akses Jabatan."

Route mutasi `app/api/requests/**`, `app/api/notifications/**`, `app/api/files` memakai pola L2b–L2e:
`checkMutation` → `requireMutationAction` → fungsi server → `recordAudit`, dalam satu transaksi.

## 6. Pemberitahuan dan Perlu perhatian

Tiga pintu TAM-25; L2f-1 membangun dua (antrean berantai menyusul).

**Pemberitahuan (kabar, disimpan 90 hari)** — dikirim lewat satu fungsi `notify(tx, recipients, …)` di
transaksi yang sama dengan kejadiannya. Pelaku tidak diberi tahu tindakannya sendiri (PRI-43 butir 5).

| Kejadian | Penerima | Isi |
|---|---|---|
| Pengajuan baru | Semua akun aktif yang boleh memutuskan pengajuan itu (§3.2 `canDecide`), kecuali pengaju | "Pengajuan baru: Ubah data diri — Budi Santoso" |
| Disetujui | Pengaju (dan orang yang diajukan bila berbeda) | "Perubahan data Anda disetujui oleh Nadia." |
| Ditolak | Pengaju | "Pengajuan Ubah data diri ditolak: <alasan>" |

Penerima kosong (tidak ada penyetuju aktif) → dikirim ke Pemilik dan GM (PRI-43 butir 4).

**Perlu perhatian (dihitung saat dibuka, tidak disimpan)** — hilang sendiri saat urusannya beres, tidak bisa
ditutup tangan. Tiap modul menyediakan fungsi kartu lewat `index.ts`-nya; Beranda merangkai. L2f-1:
- Pengajuan: "N pengajuan menunggu keputusan · paling lama X hari" → Persetujuan.
- Karyawan: "N karyawan training menunggu dinilai" → Promosi Training (antrean L2c yang sudah ada).
- Sistem (Pemilik/GM): "N pengajuan menunggu lebih dari 2 hari" → Persetujuan, tab Semua.

## 7. Tes (non-UI)

- **Aturan murni**: semua perpindahan status sah/tak sah; `canDecide` menolak pengaju, orang yang diajukan, dan
  yang tak punya hak/lingkup; Pemilik tidak memutuskan miliknya.
- **Integrasi DB (layanan)**: ajukan → setujui → data karyawan berubah + jejak + event + pemberitahuan pengaju;
  tolak tanpa alasan ditolak; tolak → Ajukan ulang membawa isian lama; kembar ditolak; rekening tanpa lampiran
  ditolak; batalkan oleh pengaju; dua keputusan bersamaan → yang kedua ditolak dengan nama pemutus; data sudah
  diubah HR sejak diajukan → setujui ditolak; penerima pemberitahuan = penyetuju yang berhak, tanpa pengaju.
- **Database**: `DELETE` di `requests`/`request_events`/`request_attachments`/`identity_changes`/`files` ditolak;
  `UPDATE` isi pengajuan ditolak; perpindahan status tak sah ditolak; `notifications` hanya `read_at` berubah.
- **Hak (H14, KAR-63)**: tiap jabatan awal: siapa boleh mengajukan, melihat, memutuskan Ubah data diri, termasuk
  percobaan menyetujui milik sendiri; berkas tertutup tidak keluar untuk yang tak berhak; daftar jenis ↔
  tindakan bernama cocok (jenis yang menunjuk tindakan tak terdaftar = gagal).
- **Job**: `notifications-purge` hanya membuang yang lebih dari 90 hari; tercatat di `job_runs`.
- `pnpm check:candidate` sekali pada kandidat akhir, `pnpm migrations:check`, `pnpm changelog:check`.

**Uji UI owner di staging** (langkah singkat, dikirim saat tayang): akun karyawan biasa ajukan ganti nama +
rekening dengan foto → akun HR lihat lonceng + kartu Beranda → buka Putuskan, lihat foto → Tolak dengan alasan →
karyawan lihat alasan, Ajukan ulang → HR Setujui → Profil berubah; coba HR mengajukan miliknya lalu memutuskan
sendiri (tidak bisa).

## 8. Klaim, changelog, tanda Baru

- **Klaim path** (lewat `docs/claim-hris-l2f1` ke staging sebelum koding): `apps/hris/modules/{requests,
  notifications,files}/**`, `apps/hris/app/(app)/{pengajuan,persetujuan,pemberitahuan}/**`,
  `apps/hris/app/(app)/pengaturan/jenis-pengajuan/**`, `apps/hris/app/api/{requests,notifications,files}/**`,
  `packages/hris-db/src/schema/{requests,notifications,files}.ts`, bagian Ubah data diri di
  `apps/hris/modules/employees/**`; berkas magnet seperlunya: `packages/hris-db/src/schema/index.ts`,
  `apps/hris/lib/nav.ts`, `apps/hris/modules/access/rules/actions.ts`, `apps/hris/modules/settings/rules/registry.ts`,
  `apps/hris/components/app-shell.tsx`, `apps/hris/app/(app)/page.tsx`, `apps/hris/modules/shared/server/jobs.ts`,
  `infra/apps/cron/` (jadwal purge). **Kunci `hris`** (migrasi 0005).
- **Changelog HRIS**: `apps/hris/changelog.d/feat-hris-l2f1-requests.md` (bahasa sederhana, `### Added`).
- **Tanda Baru** (`apps/hris/lib/new-features.ts`, tanggal tayang staging): `/pengajuan`, `/persetujuan`,
  `/pemberitahuan`, `/pengaturan/jenis-pengajuan`, `fitur/ajukan-ubah-data-diri` (tombol di Profil saya),
  `fitur/beranda-perlu-perhatian`.
- Branch `feat/hris-l2f1-requests` dari `origin/dev_hris`; merge lokal `dev_hris` → `staging`; satu push batch.
  Ikut rilis L2 sesudah cutover L1.

## 9. Keputusan yang diminta dari owner

1. **Pemecahan L2f-1 / L2f-2** seperti §1. *Sudah disetujui 2026-11-01.*
2. **Penyetuju diatur lewat Hak Akses Jabatan**, bukan dari layar Jenis Pengajuan (layar itu hanya-lihat).
   v3 BER-L42 mengizinkan memilih penyetuju per jabatan dari layar; hasilnya sama karena tiap jenis punya
   tindakan "putuskan" sendiri, dan cara ini tidak menambah satu pengaturan akses lagi. *Saran: setuju.*
3. **Diperiksa / Dicabut / Hangus / Minta dibatalkan** baru dibangun tombol dan mesinnya bersama jenis yang
   memakainya (Ubah data diri tidak memakai satu pun). Statusnya sudah ada di data sejak sekarang. *Saran:
   setuju* — menghindari kode yang belum bisa diuji nyata.
4. **Persetujuan Ubah data diri ditolak bila datanya sudah diubah orang lain sejak diajukan**; HR menolak dan
   orangnya mengajukan ulang. *Saran: setuju* — mencegah perubahan HR tertimpa diam-diam.
5. **Menu HP bilah bawah**: Beranda, Pemberitahuan, Pengajuan Saya + tombol Menu; Profil saya pindah ke dalam
   Menu. *Saran: setuju* (v3: Pemberitahuan di bilah bawah HP).
6. **Kartu Beranda "karyawan training menunggu dinilai"** ikut ditambahkan sekarang (antrean L2c sudah ada).
   *Saran: setuju* — kecil, membuat Beranda langsung berguna untuk HR.
7. **Lampiran**: foto saja (JPEG/PNG/WebP, paling besar 10 MB), kamera atau galeri. PDF menyusul bila ada jenis
   yang membutuhkannya. *Saran: setuju.*
8. **Pengaturan baru "Pengajuan dianggap lama menunggu" = 2 hari** (PRI-37 butir 4). *Saran: setuju.*

### Catatan implementasi (2026-11-01, tanpa keputusan baru)

- Koreksi §3.3: jalur ubah data HR yang ada tidak menyelaraskan nama ke akun pusat, jadi persetujuan Ubah data diri juga
  hanya mengganti data karyawan (nama akun pusat tidak ada yang berubah oleh L2f-1).
- Tabel `requests` menambah `submitted_by_employee_id`, `decided_by_employee_id`, `dedupe_key`; `request_events` menambah
  `actor_employee_id` (supaya pesan menyebut nama, dan kunci kembar umum untuk semua jenis). Satu pengajuan terbuka per
  (`type_key`, `dedupe_key`), bukan indeks di `identity_changes`.
- Handler isi khas dirangkai di `apps/hris/lib/request-handlers.ts`; arah impor `requests` → `employees`, `accounts`,
  `files`, `notifications`, `settings`, `access`. `lib/nav.ts` ikut ke browser, jadi `APPROVAL_ACTIONS` ditulis di sana dan
  dites sama dengan `deciderActions()`.
- Penerima pemberitahuan dihitung lewat `listEmployeesWithAnyAction` lalu `can()` per orang; kosong → Pemilik/GM.
- Gagal menerapkan akibat saat Setujui membatalkan seluruh transaksi keputusan. Tanpa `UPLOAD_DIR` (hanya lokal) berkas
  ke folder sementara sistem.
- Tes: unit 10, layanan 8 (`modules/requests/server/requests.integration.test.ts`, akun pusat dipetakan tiruan),
  integrasi DB 7 (`packages/db-roles/tests/hris-requests…`, termasuk trigger = aturan kode untuk semua pasangan status).
