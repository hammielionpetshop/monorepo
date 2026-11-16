# F3-3 Papan Perubahan Aturan — rancangan

Status: **disetujui owner 2026-11-15** ("ok saya setuju kerjakan"; kedelapan keputusan §9 mengikuti saran
agent). Koding F3-3a dimulai sesudah klaim path + kunci `hris` terpublikasi di `origin/staging`.

Sumber: PRD Fase 3 `03-papan-perubahan-aturan.md`, spec F3-1 §0 (kartu "Pengumuman belum dibaca" pindah ke
sini), spec F3-2 (tabel pengumuman, sasaran, siapa sudah/belum baca); v3 PRI-29, PRI-35, PRI-40 butir 2, WAJ-07;
spec v3 Perlengkapan Bersama BER-L01, L08, L09, L22, L23, L25, §4, §6, §10 (kejadian 18–23, 35), §11.

## 0. Pembagian 💡

Lingkupnya besar (papan, tulis, persetujuan, dan kaitan ke layar pengaturan), jadi dipecah dua langkah
berurutan, masing-masing satu branch dan satu uji owner:

| Langkah | Isi | Branch |
|---|---|---|
| **F3-3a** | Papan untuk karyawan (Berlaku/Riwayat, termasuk darurat), rincian + "Sudah saya baca", kartu Beranda + antrean, tulis perubahan aturan **tangan** (konsep → terbit/jadwal/kirim persetujuan), ralat, tarik, persetujuan Pemilik/GM | `feat/hris-f3-3a-rule-board`, migrasi hris `0060` |
| **F3-3b** | **Wajib umumkan** saat pengaturan bertanda `mustAnnounce` atau tarif ritase disimpan: pengumuman terisi otomatis, tanggal berlaku dikunci, tarik ikut membatalkan; daftar `mustAnnounce` diperbarui | `feat/hris-f3-3b-must-announce`, migrasi hris `0061` (hanya isi/kolom kaitan) |

## 1. Keadaan sekarang (dari kode `origin/dev_hris` 5fd15a5e)

- **Pengumuman darurat F3-2** sudah ada: `hris.announcements` (`kind` hanya `EMERGENCY`, tidak diubah/dihapus
  lewat pemicu DB), `announcement_targets` (cabang/jabatan, irisan), `announcement_reads`. Sasaran dihitung
  saat dibaca. Layar Kantor › Pengumuman (`/announcements`), Kirim darurat, Siapa sudah dan belum baca.
- **Antrean F3-1** (`modules/attention`): kelompok `EMERGENCY → RULE → TASK`; kelompok `RULE` sudah disiapkan,
  belum ada isinya.
- **Pengaturan** (`modules/settings`): daftar di kode `rules/registry.ts`, tiap kunci sudah punya `affectsMoney`
  dan `mustAnnounce` (yang terakhir belum dipakai). Nilai bertanggal di `hris.setting_values` (`PROPOSED`,
  `ACTIVE`, `CANCELLED`); Pemilik/GM langsung berlaku (`setSetting`), usulan HR untuk pengaturan jabatan lewat
  Mesin Pengajuan (`position_setting_change`); nilai yang belum berlaku bisa dibatalkan (`cancelSetting`).
- **Tarif ritase** (`logistics.trip_rates`, modul Logistik di app HRIS): bertanggal, `Terjadwal` boleh
  dibatalkan, perubahan sudah dikenali `NEW_PAIR` / `UP_OR_SAME` / `DOWN`.
- **Mesin Pengajuan** (`modules/requests`): jenis baru = satu baris `REQUEST_TYPES` + handler di
  `lib/request-handlers.ts`.
- Belum ada menu **Panduan**.

## 2. Gagasan utama 💡

1. **Satu tabel pengumuman** untuk darurat dan aturan. F3-3a menambah jenis `RULE` dan kolom khasnya ke
   `hris.announcements`. Yang sudah terbit tetap **tidak diubah, tidak dihapus**: ralat = baris baru yang
   menunjuk baris lama; tarik = mengisi `ended_*` sekali (sama dengan "Akhiri sekarang" darurat).
2. **Konsep disimpan terpisah** (`hris.announcement_drafts`), karena konsep boleh diubah berkali-kali. Baris
   pengumuman baru dibuat saat **Terbitkan / Jadwalkan**, atau saat **disetujui** untuk pengumuman uang.
   Dengan begitu "pengumuman uang yang telat disetujui bergeser jadwalnya" (v3 kejadian 19) cukup dihitung
   saat disetujui, tanpa mengubah baris yang sudah terbit.
3. **Tanpa mesin terjadwal** (seperti F3-2): "sudah terbit" = jadwal terbit ≤ sekarang, dihitung saat dibaca.
   Tidak ada Penerbit tiap 5 menit; pengumuman terjadwal tampil sendiri begitu waktunya tiba, paling lambat
   pada pemeriksaan antrean berikutnya.
4. **Sasaran dihitung saat dibaca** (seperti F3-2): orang yang pindah cabang/jabatan ke sasaran ikut menerima.
   Orang yang **sudah pernah membaca** tetap melihat pengumuman itu di Riwayat walaupun sudah bukan sasaran.

## 3. F3-3a — susunan kode

### 3.1 Data (migrasi HRIS `0060`)

**`hris.announcements`** — `kind` ditambah `RULE`; kolom baru (kosong untuk darurat, wajib untuk aturan lewat
CHECK):

| Kolom | Arti |
|---|---|
| `before_text`, `after_text` | "Sebelumnya" dan "Sekarang" (bahasa sehari-hari) |
| `ask_whom` | "Kalau ada pertanyaan, tanya ke …" |
| `effective_on` (date) | Tanggal berlaku (hari WIB) |
| `change_kind` | `UNFAVORABLE` (merugikan / mengubah cara hitung) atau `FAVORABLE` (murni menguntungkan) |
| `affects_money` | Menyangkut uang (gaji, denda, potongan, tarif, bonus, kasbon) |
| `corrects_announcement_id` | Ralat: pengumuman yang dikoreksi (yang lama tampil "Diralat") |
| `supersedes_announcement_id` | Aturan lama yang digantikan perubahan ini (yang lama pindah ke Riwayat, "berlaku s.d. …") |
| `approved_by_account_id`, `request_id` | Pengumuman uang: siapa menyetujui, nomor pengajuannya |

Untuk `RULE`: `shows_from` = jadwal terbit; `shows_until` dibuat **boleh kosong** (aturan tidak punya masa
tayang); CHECK `kind = 'EMERGENCY'` ⇒ `shows_until` wajib. Pemicu DB yang ada tetap: selain mengisi `ended_*`
sekali, baris tidak bisa diubah/dihapus.

**`hris.announcement_drafts`** (baru): `id`, `kind` (`RULE`), isi yang sama (judul, sebelumnya, sekarang, tanya
ke, jenis perubahan, uang, sasaran dalam JSON, jadwal terbit, tanggal berlaku, `corrects_*`, `supersedes_*`),
`status` (`DRAFT`, `SUBMITTED`, `PUBLISHED`, `REJECTED`, `DISCARDED`), `request_id`, `announcement_id`,
`created_by_account_id`, `updated_by_account_id`, `updated_at`. Hanya `DRAFT` yang boleh diubah; tidak dihapus,
"Buang konsep" = `DISCARDED`.

**Status pengumuman aturan** dihitung, tidak disimpan: Konsep / Menunggu persetujuan (dari draft) → Terjadwal
(`shows_from` > sekarang) → Terbit → Berlaku (`effective_on` ≤ hari ini) → Diralat / Digantikan / Ditarik.

Semua tindakan dicatat di `hris.audit_events` (v3 §10 kejadian 18–23).

### 3.2 Aturan

- **Dua tanggal wajib.** `effective_on` ≥ tanggal terbit (WIB) + jarak; jarak = pengaturan
  `announcements.rule_gap_unfavorable_days` (7) untuk `UNFAVORABLE`, `announcements.rule_gap_favorable_days` (1)
  untuk `FAVORABLE`. Paling sedikit 1 hari, jadi **tidak pernah berlaku di hari terbit**. Jadwal terbit tidak
  boleh lampau (Terbitkan sekarang = waktu simpan).
- **Uang perlu persetujuan.** `affects_money` dari penulis yang bukan Pemilik/GM → **Kirim untuk disetujui**
  (pengajuan jenis baru). Pemilik dan GM langsung terbit/jadwal (keputusan §9 butir 2). Tidak uang → HR langsung.
- **Disetujui sesudah jadwal lewat**: terbit saat disetujui, dan tanggal berlaku digeser bila jaraknya tidak lagi
  cukup (`effective_on` = terbit + jarak). Penyetuju melihat tanggal baru sebelum menekan Setujui. Ditolak →
  konsep `REJECTED`, penulis diberi tahu lewat lonceng dan bisa "Salin jadi konsep baru".
- **Ralat** (sebelum atau sesudah berlaku): konsep baru terisi dari yang lama, `corrects_announcement_id` diisi;
  mengikuti aturan terbit yang sama (uang → persetujuan). Saat ralat terbit, yang lama bertanda **Diralat** dan
  semua sasaran **membaca lagi** (baris baru = belum ada catatan baca). Tanggal berlaku ralat boleh sama dengan
  yang lama asalkan lolos jarak dihitung dari terbit ralat; bila tidak, ikut aturan jarak.
- **Tarik**: hanya sebelum `effective_on`, alasan wajib, ditahan 3 detik; sasaran yang sudah membaca tidak
  diganggu, pengumuman pindah ke Riwayat bertanda **Ditarik**. Sudah berlaku → "Buat perubahan aturan baru"
  (pilihan *menggantikan* terisi).
- **Pengumuman belum disetujui yang dibuang** penulisnya: pengajuan dibatalkan bersamaan.

### 3.3 Tindakan bernama (isi awal hak di migrasi)

| Tindakan | Arti | Isi awal |
|---|---|---|
| `announcement.view` (ada) | Kantor › Pengumuman, siapa sudah/belum baca — kini juga aturan | HR, Admin HR |
| `announcement.rule.draft` | Tulis dan ubah konsep perubahan aturan | HR, Admin HR |
| `announcement.rule.publish` | Terbitkan/jadwalkan, kirim untuk disetujui, ralat, tarik | HR |
| `announcement.rule.approve` | Memutuskan pengumuman uang | — (hanya Pemilik/GM lewat `full_access`) |

Membaca Papan dan "Sudah saya baca" tidak memerlukan tindakan (semua akun HRIS yang termasuk sasaran).
Penyetuju tidak bisa memutuskan tulisannya sendiri (KAR-72; Pemilik/GM memang tidak perlu karena langsung terbit).

### 3.4 Pengajuan jenis baru

`rule_announcement` di `REQUEST_TYPES`: modul `announcements`, `requestAction: announcement.rule.publish`,
`decideAction: announcement.rule.approve`, `hiddenFromChooser` (dibuat dari layar Tulis), `hiddenForFullAccess`,
tidak bisa dicabut sesudah disetujui (ralat/tarik untuk itu). Rinciannya menampilkan isi pengumuman, sasaran,
jumlah penerima, kedua tanggal, dan tanggal baru bila bergeser. Handler di modul `announcements`, dirangkai
di `lib/request-handlers.ts`.

### 3.5 Pintu API

- `GET /api/rule-board?tab=current|history` — Papan untuk akun yang masuk: aturan terbit yang mengenai dirinya
  (+ darurat yang masih tayang di tab Berlaku, darurat yang selesai dan pernah dibacanya di Riwayat).
- `GET /api/rule-board/{id}` — rincian; hanya sasaran atau yang pernah membaca.
- `POST /api/announcements/{id}/read` (ada) — kini juga untuk aturan yang sudah terbit dan belum ditarik.
- `GET/POST /api/announcements/rules/drafts`, `GET/PATCH /api/announcements/rules/drafts/{id}`,
  `POST …/drafts/{id}/discard` — konsep. Hak `announcement.rule.draft`.
- `POST /api/announcements/rules/drafts/{id}/publish` `{ mode: 'now' | 'schedule' | 'submit' }` — Hak
  `announcement.rule.publish`; server memeriksa ulang semua aturan §3.2.
- `POST /api/announcements/rules/preview` — jumlah penerima + tanggal berlaku paling cepat untuk isian langkah 2–3.
- `POST /api/announcements/{id}/withdraw` `{ reason }` — Tarik. `POST /api/announcements/{id}/correct` — buat
  konsep ralat.
- `GET /api/announcements` (ada) — ditambah `kind=RULE` dan tab Konsep/Menunggu/Terjadwal/Terbit/Ditarik.
- `GET /api/announcements/{id}/readers` (ada) — juga untuk aturan.

### 3.6 Antrean dan Beranda

- **Antrean kelompok `RULE`**: satu butir "Ada N perubahan aturan belum dibaca" (jenis `rule_unread`), tampil
  sekali sehari seperti butir tugas F3-1 sampai semuanya dibaca, tombol **Buka** → Papan. Absen dan pekerjaan
  lain **tidak dikunci** (PRD §2).
- **Beranda**: kartu **"Pengumuman belum dibaca"** paling atas (BER-L01 butir 1) berisi daftar judul + "berlaku
  mulai …"; hilang sendiri saat semuanya dibaca. Darurat yang masih tayang dan belum dibaca ikut di kartu ini.
- Lonceng tidak dipakai untuk terbit (antrean + kartu sudah cukup; hindari kabar ganda, WAJ-03).

### 3.7 Layar

| Layar | Alamat | Isi |
|---|---|---|
| Papan Perubahan Aturan (BER-L08) | `/rule-board`, menu baru **Panduan › Papan Perubahan Aturan** (semua akun) | Tab **Berlaku** (belum dibaca di atas; darurat bertanda "Darurat"; "akan berlaku …" untuk yang belum berlaku) dan **Riwayat** (diralat, digantikan "berlaku s.d. …", ditarik, darurat selesai). HP dan PC |
| Rincian (BER-L09) | `/rule-board/{id}` | Judul, Sebelumnya → Sekarang, mulai berlaku, tanya ke siapa, penulis & tanggal terbit. Tombol **Sudah saya baca** (sekali, tercatat kapan; aktif setelah jeda `shared.hold_seconds_reminder`). Tanda "Diralat — lihat yang baru" + tautan |
| Pengumuman (BER-L22) | `/announcements` (ada) | Pilihan **Perubahan aturan / Darurat**. Aturan: tab Konsep, Menunggu persetujuan, Terjadwal, Terbit, Ditarik; tombol **Tulis perubahan aturan** (hak draft) |
| Tulis perubahan aturan (BER-L23) | `/announcements/rules/new`, `/announcements/rules/drafts/{id}` | 4 langkah: **Isi** (judul ≤ 80, sebelumnya, sekarang, tanya ke siapa, jenis perubahan, menyangkut uang, menggantikan aturan lama — tidak wajib) → **Sasaran** (seperti darurat; jumlah penerima tampil) → **Dua tanggal** (terbit sekarang / jadwal; tanggal berlaku paling cepat ditunjukkan) → **Periksa** (pratinjau seperti dilihat karyawan). Tombol **Simpan sebagai konsep**, lalu **Terbitkan** / **Jadwalkan** / **Kirim untuk disetujui** sesuai hak dan uang (ditahan 3 detik). Memakai `useQueueHold()` |
| Siapa sudah dan belum baca (BER-L25) | `/announcements/{id}` (ada) | Untuk aturan: + tombol **Ralat** dan **Tarik** (sebelum berlaku) |
| Putuskan pengumuman uang | Persetujuan (ada) | Rincian jenis `rule_announcement` |

Tanda Baru (`lib/new-features.ts`): `fitur/papan-perubahan-aturan` pada menu Papan dan tab Perubahan aturan.

### 3.8 Pengaturan baru

| Kunci | Isi awal | Ubah | Sumber |
|---|---|---|---|
| `announcements.rule_gap_unfavorable_days` | 7 hari (1–60) | Pemilik, GM, langsung berlaku | PRD §2 "kedua angka adalah pengaturan" |
| `announcements.rule_gap_favorable_days` | 1 hari (1–30) | Pemilik, GM, langsung berlaku | idem |

Keduanya `mustAnnounce: false` (mengatur cara mengumumkan, bukan aturan karyawan).

## 4. F3-3b — wajib umumkan saat pengaturan diubah

### 4.1 Alur

- Saat pengaturan bertanda `mustAnnounce` disimpan (Pengaturan Umum, Pengaturan Jabatan, usulan HR), layar
  **tidak langsung menyimpan**: membuka langkah **Pengumuman** dengan judul (= nama pengaturan), sebelumnya,
  sekarang (dari nilai lama/baru dengan satuan), tanggal berlaku **terkunci** = tanggal berlaku pengaturan, dan
  sasaran usulan: `ALL` → semua; `POSITION` → jabatan itu; `BRANCH` → cabang itu. Penulis merapikan bahasa
  dan boleh menyesuaikan sasaran.
- **Satu transaksi**: nilai pengaturan + pengumuman tersimpan bersama, **atau** pengaturan + tanda "tidak perlu
  diumumkan" dengan alasan (masuk audit `setting.set`). Pengumuman otomatis *menggantikan* pengumuman
  sebelumnya untuk kunci + sasaran yang sama.
- Jenis perubahan dipilih penulis (bawaan `UNFAVORABLE`); bila jarak dari terbit ke tanggal berlaku kurang,
  penyimpanan ditolak dengan pesan "Pilih tanggal berlaku paling cepat …" atau tandai tidak perlu diumumkan.
- **Pemilik/GM** menyimpan langsung → pengumuman terbit/terjadwal saat itu (uang pun langsung, §9 butir 2).
- **Usulan HR** (`position_setting_change`): konsep pengumuman ikut pengajuan; disetujui = pengaturan aktif
  **dan** pengumuman terbit. Bila saat disetujui jaraknya sudah tidak cukup, persetujuan ditolak sistem dengan
  pesan jelas (tanggal berlaku pengaturan tidak digeser diam-diam); HR mengajukan ulang.
- **Tarik** pengumuman yang lahir dari pengaturan → `cancelSetting` dalam transaksi yang sama (hanya sebelum
  berlaku, sama dengan aturan batal pengaturan). Sebaliknya, membatalkan nilai pengaturan yang punya pengumuman
  ikut menarik pengumumannya. **Ralat** hanya mengubah tulisan, bukan nilai.
- **Tarif ritase**: simpan tarif baru untuk pasangan yang sudah ada membuka langkah Pengumuman yang sama;
  `DOWN` → `UNFAVORABLE`, `UP_OR_SAME` → `FAVORABLE`, `NEW_PAIR` tidak wajib diumumkan. Sasaran usulan: jabatan
  yang tugas lapangannya menyetir/kenek. Betulkan salah ketik (`FIXED`) tidak wajib diumumkan. Tarik ikut
  membatalkan tarif yang `Terjadwal`.

### 4.2 Kaitan data (migrasi `0061`)

`hris.announcements` + `setting_value_id` dan `trip_rate_id` (tanpa FK lintas skema untuk tarif; tanpa migrasi
`logistics`). `hris.setting_values` tidak berubah; tanda "tidak perlu diumumkan" disimpan di audit.

### 4.4 Catatan implementasi (2026-11-16)

- Kolomnya `setting_value_ids integer[]` (bukan satu `setting_value_id`), di `announcements` dan `announcement_drafts`:
  satu simpanan layar Potongan & Lembur atau Jenis Bonus bisa mengubah beberapa kunci sekaligus dan diumumkan dalam
  satu pengumuman. Membatalkan salah satu nilainya ikut membatalkan nilai lain yang diumumkan bersamanya dan menarik
  pengumumannya, supaya tidak ada nilai yang berlaku tanpa pengumuman.
- "Menggantikan pengumuman sebelumnya" hanya bila seluruh kunci + sasaran pengumuman lama tercakup perubahan baru dan
  tanggal berlakunya lebih awal; untuk tarif, pasangan mobil + rute yang sama.
- Tarik pengumuman terkait memakai layanan pemilik nilainya (`cancelSetting` / `cancelRate`), jadi penariknya harus
  berhak mengubah pengaturan/tarif itu; HR yang hanya berhak menerbitkan tidak bisa menarik pengumuman pengaturan
  Pemilik/GM.
- Ralat pengumuman terkait tetap membawa kaitannya; tanggal berlaku terkunci. Ralat uang dari HR yang disetujui
  terlambat (jarak tidak lagi cukup) ditolak, bukan digeser.
- Isi pertama persen kantor yang berlaku mulai awal periode berjalan bertanggal lampau, sehingga tidak bisa
  diumumkan; pilih "Tidak perlu diumumkan" dengan alasan.
- Usulan pengaturan jabatan yang diajukan sebelum F3-3b (tanpa konsep pengumuman dan tanpa alasan) ditolak sistem saat
  disetujui; HR mengajukan ulang.
- Langkah Pengumuman dipasang di Pengaturan Umum, Pengaturan Jabatan (langsung dan usulan), Lokasi absen (radius),
  Potongan & Lembur, Jenis Bonus (persen), persen kantor Kehilangan Barang, dan Tarif Ritase.

### 4.3 Usulan isi `mustAnnounce` 💡

Patokan: **ya** bila mengubah uang yang diterima/dipotong karyawan, atau kewajiban, jam, dan batas waktu yang
harus dipatuhi karyawan; **tidak** bila hanya mengatur kerja admin, tampilan, atau deteksi internal.

| Ubah ke **ya** | Alasan |
|---|---|
| Toleransi telat, Absen masuk paling awal, Jeda paling cepat absen pulang, Batas absen pulang hari sebelumnya, Radius absen | Langsung mengubah kapan/di mana karyawan boleh absen dan kapan dihitung telat |
| Batas mengajukan cuti; Batas mengajukan sakit, duka, dan izin mendadak; Sakit tanpa surat paling lama; Batas menyusulkan surat dokter; Pulang cepat yang wajib dijelaskan | Batas waktu/kewajiban karyawan (PRD: "batas waktu") |
| Jendela pilih libur dibuka/ditutup, Libur akhir pekan per periode, Jarak antar libur, Libur bersamaan per cabang, Batas tukar, Batas pilih libur pengganti | Aturan pilih libur yang dirasakan langsung |
| Dasar gaji, Dapat kompensasi libur | Cara hitung gaji jabatan |

| Ubah ke **tidak** | Alasan |
|---|---|
| Tombol Tutup slip aktif mulai tanggal; Tombol Tutup slip mingguan aktif mulai jam; Jam pengingat slip mingguan belum ditutup | Kerja admin gaji, bukan aturan karyawan |

Sisanya tetap seperti sekarang (60 kunci sudah **ya**; jeda tombol, pola deteksi, foto disimpan, tanggal mulai
fitur Logistik, dan sejenisnya tetap **tidak**). Pengaturan Back Office tidak termasuk (§9 butir 1).

## 5. Yang tidak berubah

- Pengumuman darurat F3-2 (kirim, akhiri, jendela tiap 1 menit). Antrean tugas F3-1.
- Lonceng dan pemberitahuan modul; POS dan Back Office tidak menampilkan Papan.
- "Apa yang baru" tetap untuk perubahan **sistem**; Papan untuk perubahan **aturan perusahaan**.
- Tidak ada pengumuman awal massal saat HRIS rilis (§9 butir 3).

## 6. Penyesuaian monorepo

- Tanggal memakai hari WIB (`todayWib`); jadwal terbit menit WIB.
- Batas huruf judul memakai 80 seperti darurat; isi "sebelumnya/sekarang" ≤ 500 huruf (tidak dijadikan
  pengaturan, cukup batas kode).
- Fragment changelog HRIS `apps/hris/changelog.d/feat-hris-f3-3a-rule-board.md` dan
  `feat-hris-f3-3b-must-announce.md` + tanda Baru.

## 7. Tes

- **Aturan (tanpa DB)**: jarak 7/1 hari ditolak bila kurang; tidak pernah berlaku di hari terbit; jadwal lampau
  ditolak; status terhitung (Terjadwal/Terbit/Berlaku/Diralat/Digantikan/Ditarik); geser tanggal saat disetujui
  terlambat; uang oleh HR → harus persetujuan, oleh Pemilik/GM → langsung.
- **Integrasi (DB)**: sasaran hanya melihat yang mengenai dirinya; orang pindah cabang ikut jadi sasaran, yang
  sudah membaca tetap melihat di Riwayat; ralat → semua sasaran mendapat butir belum dibaca lagi, yang lama
  "Diralat"; tarik sesudah berlaku ditolak; konsep `DRAFT` bisa diubah, yang lain tidak; pemicu DB menolak ubah
  isi pengumuman terbit; persetujuan/penolakan lewat Mesin Pengajuan.
- **F3-3b**: simpan pengaturan `mustAnnounce` tanpa pengumuman/alasan ditolak; dengan pengumuman → keduanya
  tersimpan satu transaksi; tarik → nilai pengaturan `CANCELLED`; batal pengaturan → pengumuman ditarik; usulan
  HR disetujui → pengaturan aktif + pengumuman terbit; tarif turun → `UNFAVORABLE` 7 hari.
- **Hak**: Admin HR hanya konsep; HR terbit non-uang, uang dikirim persetujuan; karyawan biasa hanya membaca;
  akses terbatas tidak mendapat Papan/antrean.
- `pnpm typecheck`; `pnpm migrations:check`; `pnpm changelog:check`.

## 8. Uji owner (staging)

**F3-3a**
1. Sebagai HR: Kantor › Pengumuman › **Tulis perubahan aturan** — isi contoh "Tarif lembur", tandai menyangkut
   uang, jenis merugikan, sasaran satu cabang; coba tanggal berlaku 3 hari lagi → ditolak (paling cepat 7 hari);
   pilih yang sah → tombol berubah jadi **Kirim untuk disetujui**.
2. Sebagai Pemilik/GM: Persetujuan → setujui → pengumuman terbit.
3. Akun karyawan cabang itu: jendela antrean "Ada 1 perubahan aturan belum dibaca" + kartu paling atas Beranda;
   Panduan › Papan → buka → **Sudah saya baca** → kartu hilang. Akun cabang lain tidak melihatnya.
4. Kantor › Pengumuman › siapa sudah/belum baca: angka "sudah baca" bertambah.
5. **Ralat** pengumuman itu → akun karyawan mendapat butir belum dibaca lagi; yang lama di Riwayat bertanda
   Diralat. Buat satu lagi lalu **Tarik** sebelum berlaku → pindah ke Riwayat bertanda Ditarik.
6. Sebagai Admin HR: hanya bisa menyimpan konsep.

**F3-3b**
1. Sebagai Pemilik/GM: ubah **Tarif lembur** di staging → langkah Pengumuman muncul terisi (sebelumnya/sekarang,
   tanggal berlaku terkunci) → terbitkan. Akun karyawan mendapat jendela.
2. Ubah satu pengaturan wajib umumkan lalu pilih "tidak perlu diumumkan" tanpa alasan → tertahan; dengan alasan →
   tersimpan.
3. Tarik pengumuman dari langkah 1 (sebelum berlaku) → nilai pengaturan ikut batal di Pengaturan.
4. Turunkan satu tarif ritase → pengumuman terisi, jenis merugikan, tanggal paling cepat 7 hari.

## 9. Keputusan owner (2026-11-15: semua sesuai saran)

1. **Wajib umumkan hanya pengaturan HRIS** (termasuk tarif ritase di Logistik HRIS), tidak termasuk pengaturan
   Back Office. Saran: ya (PRD ❓ 1).
2. **Pengumuman uang buatan Pemilik/GM langsung terbit** tanpa persetujuan lagi. Saran: ya, GM penyetuju sah
   (PRD ❓ 2).
3. **Tanpa pengumuman awal massal** saat HRIS rilis; cukup Panduan Karyawan (F3-5). Saran: ya (PRD ❓ 3).
4. **Dipecah F3-3a lalu F3-3b**, masing-masing diuji terpisah. Saran: ya (§0).
5. **Daftar `mustAnnounce`** diubah sesuai tabel §4.3. Saran: setuju.
6. **Persetujuan terlambat**: pengumuman tangan bergeser otomatis; usulan pengaturan HR yang jaraknya sudah tidak
   cukup ditolak sistem dan diajukan ulang (tanggal pengaturan tidak digeser diam-diam). Saran: ya.
7. **Tanpa mesin terjadwal**; pengumuman terjadwal tampil sendiri saat waktunya tiba (paling lambat pemeriksaan
   antrean berikutnya, ≤ 15 menit, atau saat Papan/Beranda dibuka). Saran: ya.
8. **Admin HR hanya menyiapkan konsep**; menerbitkan, ralat, dan tarik oleh HR/Pemilik/GM. Saran: ya (PRD §2).
