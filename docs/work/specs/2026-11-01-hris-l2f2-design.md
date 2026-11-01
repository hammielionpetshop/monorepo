# Spec HRIS L2f-2 — Usulan Pengaturan Jabatan, pemilik lain diberi tahu, lupa password

Tanggal: 2026-11-01 · Status: **disetujui owner 2026-11-01 (§7 seluruhnya sesuai saran, jawaban "ok"); terintegrasi ke dev_hris dan staging; lolos uji owner di staging 2026-11-01 (deployment `37c3028f`, run `41318585667`)**
Cakupan: sisa L2f di [plan L2](../plans/2026-11-01-hris-l2.md), lanjutan
[spec L2f-1](2026-11-01-hris-l2f1-requests-design.md).
Sumber: v3 `01-karyawan` KAR-69, KAR-70, KAR-72, KAR-73; `karyawan-dan-akses-spec` KAR-L04, L05, L21, L31, §7, §8;
PRD [02](../../hris_planning/PRD/fase_1/02-auth-terpusat.md) AUT-13, AUT-14; spec L2e §8 butir 1, 2, 5; spec L2d §1.
Dasar kode: Mesin Pengajuan + `notify()` (L2f-1), `setSetting` + status `PROPOSED` (L2e),
`resetPasswordByTrustedCaller` + `createSession` (L1, L2d).
Aliran migrasi: **`hris` 0006** dan **`auth` 0004** (satu pemegang per aliran).

## 1. Batas

**Dikerjakan:**
- **A. Usulan Pengaturan Jabatan** (KAR-73): HR/Admin HR mengusulkan, Pemilik/GM memutuskan di kotak Persetujuan.
- **B. Pemilik lain diberi tahu** (KAR-73): saat Pemilik/GM mengubah langsung Hak Akses Jabatan atau pengaturan.
- **C. Lupa password mandiri + kode dari GM** (KAR-70, KAR-L04, L05, AUT-13).

**Tidak dikerjakan:**

| Hal | Di mana |
|---|---|
| Daftar Pengecualian per orang (KAR-L32) | L3 Kehadiran, memakai jalur usulan yang sama |
| Pemberitahuan lewat email (KAR-70 butir 6) | Menyusul; server belum punya pengirim email (§7 butir 2) |
| Kartu antrean "orang dijeda, minta kode" di Beranda | Cukup Pemberitahuan dulu (§7 butir 5) |
| Angka lupa password sebagai pengaturan yang bisa diubah | Tetap di `packages/auth` sampai cutover L1, sama dengan keputusan L2e §8 butir 5 |
| Lupa password di layar masuk kasir | Akun pusat sama, tetapi layarnya baru di HRIS; kasir dapat tautan menyusul sesudah cutover L1 |

## 2. A — Usulan Pengaturan Jabatan

**Jenis pengajuan baru** `position_setting_change` di `modules/requests/rules/types.ts`:
`requestAction = position_settings.propose`, `decideAction = position_settings.approve`, tidak tertutup, tanpa lampiran,
tanpa batas waktu. Orang yang diajukan = pengusulnya sendiri, jadi aturan "tidak memutuskan milik sendiri" tetap berlaku.

**Data (`hris` 0006):** `hris.position_setting_proposals`: `request_id` (PK), `setting_value_id` (unik, ke baris
`PROPOSED`), `before_value` (jsonb, nilai berlaku saat diusulkan pada tanggal itu), `before_row_id`. Tanpa hapus.

**Alur:**
1. HR membuka Pengaturan Jabatan → sel → **Usulkan** (langkah baku yang sama dengan Ubah: nilai, tanggal + alasan,
   periksa). Tersimpan satu baris `setting_values` berstatus `PROPOSED` + satu pengajuan `PENDING`. Nilai yang berlaku
   belum berubah. Pesan: "Usulan terkirim. Nilai lama tetap berlaku sampai Pemilik atau GM menyetujui."
2. Satu usulan terbuka per sel (`dedupeKey = position_setting:<key>:<kind>:<id>`). Sel yang punya usulan bertanda
   "Diusulkan: X mulai tanggal Y", dengan tautan ke rincian.
3. Pemilik/GM diberi tahu dan memutuskan di layar Putuskan. Rincian: jabatan, tanda, nilai sekarang → usulan, tanggal
   berlaku, alasan, jumlah orang terkena.
4. **Setujui:** baris `PROPOSED → ACTIVE`, `approved_by/at` terisi, jejak `setting.approve`, di transaksi keputusan.
5. **Tolak** atau **Batalkan** oleh pengusul: baris `PROPOSED → CANCELLED` di transaksi yang sama; pengusul bisa Ajukan
   ulang dengan isian lama.

**Persetujuan ditolak sistem** (penyetuju lalu menolak dengan alasan, pengusul mengajukan ulang) bila:
- tanggal berlakunya sudah lewat saat disetujui;
- nilai berlaku pada tanggal itu sudah berbeda dari `before_value` (mis. Pemilik sudah mengubah langsung);
- sudah ada nilai `ACTIVE` lain di tanggal itu.

Pemilik/GM tetap bisa mengubah sel yang sedang diusulkan; usulannya kemudian gugur lewat aturan kedua.

**Perubahan mesin:**
- `RequestHandler` mendapat `close(tx, actor, requestId, reason)` opsional, dipanggil saat Tolak dan Batalkan, di
  transaksi yang sama. `cancelRequest` ikut menerima daftar handler. Ubah data diri tidak memakainya.
- Definisi jenis mendapat `formHref` opsional: tombol jenis ini di layar Ajukan membuka Pengaturan Jabatan, karena
  isiannya perlu sel yang dipilih. Pemegang `position_settings.approve` tidak melihat jenis ini (mereka langsung Ubah).
- Fungsi `proposeSetting` / `approveProposedSetting` / `cancelProposedSetting` di `modules/settings`, memakai pemeriksa
  nilai + tanggal yang sama dengan `setSetting`. Handler dirangkai di `lib/request-handlers.ts`.
- `APPROVAL_ACTIONS` di `lib/nav.ts` ditambah `position_settings.approve`.

## 3. B — Pemilik lain diberi tahu

- Penerima: semua akun aktif berjabatan akses penuh (Pemilik/GM), kecuali pelakunya. Tampil di Pemberitahuan dan "Kabar
  terbaru" Beranda. Tidak bisa dimatikan dan tidak menghalangi perubahan.
- Kejadian (§7 butir 3):

| Kejadian | Isi kabar | Tautan |
|---|---|---|
| Hak Akses Jabatan disimpan | "Nadia mengubah Hak Akses jabatan Kasir: 3 tindakan" | `/pengaturan/hak-akses` |
| Pengaturan Jabatan diubah/dibatalkan langsung | "Nadia mengubah Saran role kasir jabatan Kasir: Tanpa saran → Kasir, mulai 5 Nov" | `/pengaturan/jabatan` |
| Pengaturan umum diubah/dibatalkan | "Nadia mengubah Jeda tombol konfirmasi: 3 → 5 detik, mulai 5 Nov" | `/pengaturan/umum` |
| Usulan HR disetujui | "Nadia menyetujui usulan Rina: …" | rincian pengajuan |

- Kabar ditulis di transaksi perubahannya. `savePositionGrants` ada di modul `access` yang tidak boleh mengimpor
  `notifications` (arah impornya sebaliknya), jadi fungsi itu menerima pemanggil-balik `afterSave(tx, ringkasan)` yang
  dirangkai route. Modul `settings` memanggil `notify` langsung.

## 4. C — Lupa password dan kode dari GM

### 4.1 Lupa password mandiri (`/lupa-password`, KAR-L04)

**Langkah 1, cocokkan data:** email/username, nomor HP, tanggal lahir → **Periksa**.
- Akun dicari lewat `auth.accounts`, lalu tautan `hris` yang belum dicabut ke karyawan. HP dan tanggal lahir dibandingkan
  dengan data karyawan (HP lewat `normalizePhone`).
- Tidak cocok: pesan menyebut datanya (KAR-70 butir 2), berurutan email → HP → tanggal lahir, satu per satu.
- Salah 3 kali berturut-turut: **jeda 5 menit** + hitungan mundur + "Hubungi GM untuk meminta kode" + tombol **Saya punya
  kode dari GM**. Bila akunnya ada, penerima laporan diberi tahu (§4.3).
- **Pengaman tambahan (§7 butir 1):** 3 kali jeda dalam 24 jam → jalur mandiri ditutup 24 jam untuk akun itu, tinggal jalur
  kode. Jadi penebak hanya punya sekitar 9 percobaan per hari, bukan sekitar 860.
- Hitungan jeda terpisah dari salah password saat masuk.
- **Tidak bisa lewat jalur ini**, dengan pesan "Hubungi GM untuk meminta kode": akun nonaktif, karyawan nonaktif, HP atau
  tanggal lahir karyawan masih kosong, serta akun berjabatan Pemilik/GM (§7 butir 1). Akun tanpa tautan karyawan: direset
  Owner/GM (AUT-13).

**Langkah 2, password baru:** muncul bila ketiganya cocok. Password baru dua kali, peringatan "Catat password ini di tempat
aman", tombol **Simpan dan masuk**. Tiket langkah ini sekali pakai, berlaku 10 menit, tersimpan sebagai hash.

### 4.2 Kode dari GM (`/lupa-password/kode`, KAR-L05)

- **Buat kode:** tombol **Buat kode lupa password** di kartu Akun halaman orang, untuk pemegang `account.reset_password`
  (Pemilik/GM, §7 butir 4), bukan untuk akun sendiri. Jendela mengingatkan: "Pastikan orangnya benar lewat telepon atau
  bertemu langsung." Kode 6 angka tampil sekali. Kode baru membatalkan kode lama akun itu.
- **Pakai kode:** email/username, kode, password baru dua kali. Kode berlaku 1 jam, sekali pakai. Pesan membedakan kode salah
  dan kode kedaluwarsa.
- **Salah 5 kali: kode hangus** dan harus minta yang baru, karena 6 angka mudah ditebak bila tanpa batas. Angka ini
  tambahan dari spec ini, belum ada di v3.

### 4.3 Sesudah password berhasil diganti (kedua jalur)

Dalam satu transaksi `auth`:
- password diganti, `must_change_password = false`, hitungan salah masuk + jeda dibersihkan;
- **semua sesi akun dicabut**, termasuk kasir, karena akun pusat sama;
- sesi baru dibuat ("langsung masuk") dan tercatat di riwayat masuk;
- jejak `auth`: `PASSWORD_RECOVERED`, dengan cara `SELF` atau `CODE` (AUT-14).

Sesudahnya, HRIS mengirim Pemberitahuan ke orangnya dan ke penerima laporan: "Password Budi diganti lewat lupa password."
Kegagalan mengirim kabar tidak membatalkan penggantian password, sebab transaksinya berbeda database-role (`auth` vs `hris`),
dan dicatat di log server.

**Penerima laporan:** pengaturan baru `accounts.recovery_contact_position` ("Penerima laporan lupa password", jenis nilai baru
`position`, isi awal jabatan GM, ditanam `hris` 0006, Pemilik/GM mengubah, boleh berlaku hari ini). Tidak ada orang aktif di
jabatan itu → dikirim ke Pemilik dan GM (PRI-43 butir 4).

### 4.4 Data (`auth` 0004)

| Tabel | Kolom | Catatan |
|---|---|---|
| `auth.recovery_throttles` | `identifier` (PK), `failed_count`, `locked_until`, `lock_count_24h`, `first_lock_at`, `closed_until`, `updated_at` | Dipakai juga untuk identifier yang tidak terdaftar. Dibuang job `recovery-purge` setelah 30 hari diam |
| `auth.recovery_tickets` | `id`, `account_id`, `token_hash`, `expires_at`, `used_at`, `created_at` | Tiket langkah 2 |
| `auth.recovery_codes` | `id`, `account_id`, `code_hash` (argon2), `created_by_account_id`, `expires_at`, `failed_count`, `used_at`, `voided_at`, `created_at` | Indeks unik sebagian: satu kode hidup per akun |

Fungsi baru di `packages/auth`: `recordRecoveryFailure`, `issueRecoveryTicket`, `completeRecoveryWithTicket`,
`createRecoveryCode`, `completeRecoveryWithCode`. Pencocokan HP dan tanggal lahir ada di HRIS (`modules/accounts`), sebab
datanya milik karyawan; `packages/auth` tidak membaca `hris`.

Route tanpa sesi (tetap `checkMutation`): `POST /api/auth/forgot/verify`, `/api/auth/forgot/complete`,
`/api/auth/forgot/code`. Dengan sesi: `POST /api/employees/[id]/account` bagian `recovery-code`, `requireMutationAction`
`account.reset_password`.

Layar: tautan "Lupa password" di layar Masuk; dua halaman publik di atas memakai kerangka layar Masuk; ada jalan Kembali ke
Masuk kapan saja.

## 5. Tes (non-UI)

- **Usulan (layanan + DB):** usulan → nilai berlaku tak berubah → setujui → berlaku + jejak; tolak dan batalkan → baris
  `CANCELLED`; pengusul tidak bisa memutuskan; usulan kembar di sel sama ditolak; tanggal lewat, nilai sudah berubah, dan
  tanggal bentrok → persetujuan ditolak dan seluruh transaksi batal; yang tak punya `propose` ditolak.
- **Hak per jabatan (H14):** tiap jabatan awal untuk usul, putus, dan buat kode.
- **Pemilik lain:** tiap kejadian §3 mengirim ke Pemilik/GM lain, tanpa pelaku, dalam transaksi yang sama.
- **Lupa password:** pesan menyebut data yang salah; 3 salah → jeda; 3 jeda → jalur ditutup 24 jam; jeda berakhir; tiket
  kedaluwarsa dan tiket dipakai ulang ditolak; sukses mencabut semua sesi, menulis jejak, membuat sesi baru, memberi tahu
  penerima; Pemilik/GM, akun nonaktif, data kosong ditolak jalur mandiri.
- **Kode:** salah, kedaluwarsa, dipakai ulang, kode lama sesudah dibuat kode baru, 5 salah → hangus; hash tidak sama dengan
  kode; buat kode untuk diri sendiri ditolak; kode tidak pernah tersimpan polos atau masuk log/jejak.
- `pnpm check:candidate` sekali pada kandidat akhir, `pnpm migrations:check`, `pnpm changelog:check`.

**Uji UI owner di staging** (langkah lengkap dikirim saat tayang): HR usulkan → Pemilik tolak → HR ajukan ulang → Pemilik
setujui → nilai berlaku; GM ubah hak jabatan → Pemilik lihat kabar; karyawan lupa password → salah 3 kali → jeda → GM
dapat kabar → buat kode → pakai kode → masuk; lalu jalur mandiri dengan data benar.

## 6. Klaim, changelog, tanda Baru

- **Klaim path** (`docs/claim-hris-l2f2` ke staging sebelum koding): `packages/auth/src/{recovery.ts,index.ts,schema/**,migrations/**}`,
  `apps/hris/modules/{settings,requests,accounts}/**`, `apps/hris/modules/access/server/grants.ts`,
  `apps/hris/app/login/**`, `apps/hris/app/lupa-password/**`, `apps/hris/app/api/auth/forgot/**`,
  `apps/hris/app/api/employees/**`, `apps/hris/app/api/settings/**`, `apps/hris/app/api/positions/**`,
  `apps/hris/lib/{nav.ts,request-handlers.ts,new-features.ts}`, `apps/hris/modules/shared/server/jobs.ts`,
  `infra/apps/cron/`, `packages/hris-db/src/{schema,migrations}/**`. **Kunci `hris` dan `auth`.**
- **Changelog HRIS:** `apps/hris/changelog.d/feat-hris-l2f2.md`.
- **Tanda Baru:** `fitur/usulan-pengaturan-jabatan`, `fitur/lupa-password`, `fitur/buat-kode-lupa-password`.
- Branch `feat/hris-l2f2` dari `origin/dev_hris`; merge lokal `dev_hris` → `staging`; satu push batch. Ikut rilis L2 sesudah
  cutover L1. Migrasi `auth` 0004 hanya menambah tabel, jadi aman bagi backoffice mode legacy.

## 7. Keputusan yang diminta dari owner

1. **Pengaman tambahan lupa password.** KAR-70 menerima risiko orang menebak tanggal lahir pelan-pelan, dan pesannya memang
   menyebut data yang salah. Dengan akun pusat, risikonya kini lebih besar karena satu password juga membuka kasir. *Saran:*
   (a) 3 kali jeda dalam 24 jam menutup jalur mandiri selama 24 jam; (b) akun **Pemilik/GM tidak boleh lewat jalur mandiri**,
   hanya kode atau reset dari Pemilik/GM lain, karena akun itu bisa mengakses segalanya.
   *Konsekuensi (b):* bila semua Pemilik/GM lupa password sekaligus, pemulihan harus lewat server oleh pengembang.
2. **Email belum ada di server.** KAR-70 meminta pemberitahuan ke email orangnya. *Saran:* Pemberitahuan di HRIS dulu, email
   menyusul. *Konsekuensi:* bila password dibajak, korban baru tahu saat tidak bisa masuk; GM tetap diberi tahu seketika.
3. **Lingkup "pemilik lain diberi tahu".** KAR-73 hanya menyebut Hak Akses Jabatan dan Pengaturan Jabatan. *Saran:* sertakan
   juga pengaturan umum, karena sama-sama berpengaruh ke semua orang.
4. **Siapa boleh membuat kode.** v3: hanya penerima laporan (isi awal GM). *Saran:* Pemilik dan GM, supaya tetap bisa jalan
   saat GM berhalangan; laporan tetap ke penerima laporan. Pemilik/GM memang sudah bisa Reset password.
5. **Antrean Beranda "orang dijeda, minta kode" ditunda.** *Saran:* cukup Pemberitahuan; orangnya toh menghubungi GM langsung.
6. **Persetujuan usulan ditolak sistem bila keadaan berubah** (§2), sama dengan Ubah data diri. *Saran:* setuju, supaya
   perubahan terbaru tidak tertimpa diam-diam.
7. **Kode hangus sesudah 5 kali salah** (§4.2, tambahan dari v3). *Saran:* setuju.
8. **Lupa password hanya dari layar Masuk HRIS dulu.** Orang yang memakai kasir tetap bisa mengganti password lewat alamat
   HRIS, walau tidak punya menu HRIS? *Saran:* ya untuk akun bertautan karyawan; sesudah diganti, orang tanpa akses HRIS diarahkan
   masuk dari aplikasinya. Tautan di layar kasir menyusul sesudah cutover L1.

### Catatan implementasi (2026-11-01, tanpa keputusan baru)

- `position_setting_proposals` hanya menyimpan `before_value`; `before_row_id` dari §2 tidak diperlukan karena penjaga membandingkan nilai.
- Kolom throttle bernama `lock_count`, bukan `lock_count_24h`; jendela 24 jam dihitung dari `first_lock_at`.
- Modul pengubah menerima `ChangeAnnounce` dari `lib/owner-notify.ts`, sebab `settings` tidak boleh mengimpor `accounts` (arah impornya sebaliknya). §3 semula hanya menyebut `access`.
- Route kode ada di `POST /api/accounts/employee/[id]` (`kind: recovery_code`), mengikuti route akun yang sudah ada, bukan `/api/employees/[id]/account` seperti tulisan §4.4. Hak Akses disimpan lewat `app/api/access/grants`.
- Kartu Beranda tidak berubah. Tanda Baru `fitur/lupa-password` dari §6 dilewati, sebab layar Masuk tampil tanpa sesi dan tanpa daftar tanda Baru; fitur ini tetap tercatat di changelog.
- Pengaman tiket: pemeriksaan Pemilik/GM dilakukan sesudah semua data cocok, supaya orang luar tidak bisa mengetahui akun mana yang berhak penuh tanpa datanya.
- Pemberitahuan lupa password dikirim sesudah transaksi `auth`; bila gagal hanya tercatat di log server (§4.3).
- Tes: `db-roles/tests/auth-recovery` 9, `modules/accounts/server/recovery.integration` 7, `requests.integration` tambah 5.
