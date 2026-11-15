# F3-2 Pengumuman Darurat — rancangan

Status: **disetujui owner 2026-11-15** ("kerjakan, saya setuju dengan usul anda"; keenam keputusan §9 mengikuti
saran agent). Koding dimulai sesudah klaim path + kunci `hris` terpublikasi di `origin/staging`.

Sumber: PRD Fase 3 `02-pengumuman-darurat.md` (keputusan owner 2026-11-15: hanya web HRIS, tanpa push HP),
spec F3-1 §0, §3.3, §3.5; v3 PRI-36, TAM-16, TAM-22; spec v3 Perlengkapan Bersama BER-L03, BER-L22,
BER-L24, BER-L25, §4 (tabel pengumuman), §5 (hak), §8 (pengaturan).

## 1. Keadaan sekarang (dari kode `origin/dev_hris` e9cd47b1)

- **Antrean F3-1** sudah ada: `GET /api/queue` (`modules/attention/server/queue.ts`) merangkai jendela dari
  kartu "Perlu perhatian" bertanda `queue`, urut kelompok `EMERGENCY → RULE → TASK`. Kelompok `EMERGENCY`
  sudah disiapkan tetapi belum ada isinya.
- `QueueProvider` (`components/queue.tsx`) di `AppShell` (web HRIS dan Logistik) memeriksa saat dibuka dan
  sesudah pindah halaman bila lebih dari 15 menit; menahan antrean di layar Absen dan selama `useQueueHold()`.
- Hak per jabatan disimpan di `hris.position_grants` (isi awal lewat migrasi); Pemilik/GM `full_access`.
- Belum ada tabel, layar, atau tindakan pengumuman.

## 2. Gagasan utama 💡

Pengumuman darurat **disimpan sebagai data sendiri** (bukan kartu "Perlu perhatian"), karena dibaca sekali
selamanya dan pengirim perlu melihat siapa sudah/belum baca (spec F3-1 §3.3). Antrean F3-1 menempatkannya
di depan: `listQueue` menggabungkan pengumuman darurat yang belum dibaca orang itu sebagai butir
kelompok `EMERGENCY`, lalu butir tugas yang sudah ada.

**Sasaran dihitung saat dibaca, bukan disalin saat dikirim.** Pengumuman menyimpan aturan sasarannya
(semua / cabang / jabatan); penerima = karyawan aktif yang penempatannya **hari ini** cocok. Dengan begitu
orang yang pindah cabang/jabatan sesudah terkirim ikut menerima selama masih tayang (BER-L25) tanpa
mesin tambahan.

Tabel dibuat umum (`kind`) supaya Papan Perubahan Aturan (F3-3) menambah jenis `RULE` dan kolomnya sendiri
tanpa tabel baru.

## 3. Susunan kode

### 3.1 Data (migrasi HRIS `0059`)

| Tabel | Kolom | Catatan |
|---|---|---|
| `hris.announcements` | `id`, `kind` (`EMERGENCY`; F3-3 menambah `RULE`), `title`, `message`, `target_all`, `shows_from`, `shows_until`, `ended_at`, `ended_by_account_id`, `end_reason`, `created_by_account_id`, `created_by_employee_id`, `created_at` | Tidak diubah, tidak dihapus (PRI-36). Pemicu DB menolak DELETE dan UPDATE selain mengisi `ended_*` sekali |
| `hris.announcement_targets` | `announcement_id`, `branch_id` *atau* `position_id` | Hanya tambah, ditulis bersama pengumumannya |
| `hris.announcement_reads` | `announcement_id`, `employee_id`, `account_id`, `read_at` | Unik `(announcement_id, employee_id)`; hanya tambah |

**Arti sasaran:** `target_all`, atau — bila dipilih — orang yang cabangnya termasuk cabang terpilih **dan**
jabatannya termasuk jabatan terpilih. Hanya cabang dipilih = semua jabatan di cabang itu; hanya jabatan
dipilih = jabatan itu di semua cabang. Contoh: cabang Singaparna + jabatan Kasir = kasir Singaparna saja.

**Masih tayang** = `shows_from ≤ sekarang < shows_until` dan `ended_at` kosong. Status (Tayang / Berakhir /
Diakhiri) dihitung dari kolom itu, tidak disimpan.

Pengirim dan pengakhiran juga dicatat di `hris.audit_events` (kejadian v3 §10 nomor 24, 25).

### 3.2 Tindakan bernama (isi awal hak di migrasi)

| Tindakan | Arti | Isi awal |
|---|---|---|
| `announcement.view` | Buka Kantor › Pengumuman dan "Siapa sudah dan belum baca" | HR, Admin HR (lingkup semua) |
| `announcement.emergency.send` | Kirim dan akhiri pengumuman darurat | HR (lingkup semua) |

Pemilik dan GM otomatis punya keduanya (`full_access`). Admin HR **hanya melihat** sesuai tabel layar PRD
(v3 §5 menyamakan Admin HR dengan HR; PRD yang disetujui owner lebih kuat). Membaca dan menandai "sudah
baca" tidak memerlukan tindakan: setiap akun HRIS yang masuk dan termasuk sasaran.

### 3.3 Pintu API

- `GET /api/announcements` — daftar pengumuman darurat untuk layar Kantor › Pengumuman, beserta
  "sudah baca x dari y". Hak `announcement.view`.
- `POST /api/announcements/emergency` `{ title, message, target: { all } | { branchIds, positionIds }, showsUntil }`
  — kirim. Hak `announcement.emergency.send`. Server memeriksa batas huruf, masa tayang, dan sasaran tidak
  kosong (jumlah penerima > 0).
- `POST /api/announcements/emergency/preview` — jumlah penerima untuk sasaran yang sedang dipilih (langkah 2–3).
- `POST /api/announcements/{id}/end` `{ reason }` — Akhiri sekarang. Hak `announcement.emergency.send`.
  Yang sudah diakhiri/berakhir ditolak dengan pesan jelas.
- `GET /api/announcements/{id}/readers` — Siapa sudah dan belum baca. Hak `announcement.view`.
- `POST /api/announcements/{id}/read` — "Sudah saya baca". Hanya bila orang itu sasaran dan pengumuman masih
  tayang; diulang tetap satu baris.
- `GET /api/queue` (F3-1) ikut mengembalikan butir darurat paling depan; ditambah `GET /api/queue?only=emergency`
  yang **hanya** membaca pengumuman darurat (satu query ringan) untuk pemeriksaan tiap menit.

Akses terbatas mantan karyawan tidak menerima dan tidak bisa membuka layar ini (sama seperti antrean F3-1).

### 3.4 Jendela darurat (BER-L03, tambahan pada `QueueProvider`)

- **Pemeriksaan tiap 1 menit** hanya untuk darurat (`only=emergency`), selama tab browser terlihat; saat tab
  kembali terlihat langsung diperiksa. Pemeriksaan antrean tugas tetap seperti F3-1 (15 menit).
- **Paling depan, dan tidak ditahan langkah bertahap** (`useQueueHold`): darurat muncul di atas isian yang
  sedang diketik; halaman di bawahnya tidak dimuat ulang sehingga isian tidak hilang (TAM-16).
- **Layar Absen tetap tidak terhalang** (TAM-22 butir 2) 💡: di `/clock-in` darurat menunggu sampai absen
  terkirim atau layar ditinggalkan, sama seperti pengingat F3-1.
- Isi: tanda **Darurat**, judul, pesan, pengirim dan jam kirim. **Tanpa** tombol Buka; satu tombol
  **Sudah saya baca** yang aktif setelah **5 detik** (pengaturan §6). Tanpa ×, Esc dan klik di luar tidak menutup.
- Bila pengumuman **diakhiri** atau masa tayangnya habis saat jendela terbuka dan belum dibaca, pemeriksaan
  berikutnya menutup jendelanya.
- Dibaca di satu perangkat → perangkat lain tidak menampilkannya lagi sejak pemeriksaan berikutnya.
- Beberapa darurat sekaligus: satu per satu, **yang terbaru dulu** 💡 (kabar terakhir biasanya yang berlaku).

### 3.5 Layar

| Layar | Alamat | Isi |
|---|---|---|
| Pengumuman (BER-L22) | `/announcements`, menu Kantor › Pengumuman | Tombol **Kirim pengumuman darurat** (warna bahaya, hanya pemegang hak kirim). Daftar darurat: judul, sasaran, pengirim & jam kirim, tayang sampai, status, "sudah baca x dari y" → BER-L25. Tab "Tayang" dan "Selesai". Tab perubahan aturan menyusul di F3-3 |
| Kirim pengumuman darurat (BER-L24) | `/announcements/emergency/new` | 3 langkah: **Isi** (judul ≤ 80 huruf, pesan ≤ 300 huruf dengan penghitung) → **Sasaran & masa tayang** (Semua orang, atau pilih cabang dan/atau jabatan; jumlah penerima tampil langsung; tayang sampai akhir hari ini atau sampai tanggal tertentu) → **Periksa & Kirim** (ringkasan + jumlah penerima, tombol ditahan 3 detik). HP dan PC. Kembali di tiap langkah. Layar memakai `useQueueHold()` untuk pengingat tugas |
| Siapa sudah dan belum baca (BER-L25) | `/announcements/{id}` | Isi pengumuman, status, nama/cabang/jabatan, sudah baca (kapan) / belum; saring "belum baca". Tombol **Akhiri sekarang** (alasan wajib, ditahan 3 detik) bila masih tayang dan punya hak kirim |

Menu Pengumuman didaftarkan di `lib/nav.ts` dengan `action: ['announcement.view', 'announcement.emergency.send']`
dan tanda Baru (`lib/new-features.ts`, `fitur/pengumuman-darurat`).

**Daftar pengumuman untuk karyawan** (Papan tab Berlaku bertanda "Darurat", lalu Riwayat) dibangun bersama
Papan di **F3-3**. Di F3-2, sesudah "Sudah saya baca" isinya belum bisa dibuka ulang oleh karyawan 💡.

## 4. Yang tidak berubah

- Antrean pengingat tugas F3-1 (jenis, urutan, catatan tampil harian, pemeriksaan 15 menit).
- Lonceng dan semua pemberitahuan modul. POS dan Back Office tidak menampilkan darurat (keputusan owner).
- Tidak ada push HP (keputusan owner); pengirim memakai daftar "belum baca" lalu menghubungi lewat WA.

## 5. Penyesuaian monorepo

- Batas huruf, jeda tombol, dan masa tayang paling lama dibaca dari pengaturan (§6), bukan ditulis di kode.
- "Akhir hari ini" dan tanggal tayang memakai hari WIB (`todayWib`); tayang sampai = 23.59.59 WIB tanggal itu.
- **Tanpa mesin terjadwal** 💡: v3 memakai "Penerbit pengumuman" tiap 5 menit untuk mengakhiri darurat yang
  habis masa tayangnya. Di sini "masih tayang" dihitung dari `shows_until` saat dibaca, jadi tidak ada yang
  perlu diakhiri mesin. Penerbit untuk pengumuman aturan terjadwal dibuat di F3-3 bila diperlukan.
- Fragment changelog HRIS `apps/hris/changelog.d/feat-hris-f3-2-emergency.md` + tanda Baru.

## 6. Pengaturan baru

| Kunci | Isi awal | Ubah | Sumber |
|---|---|---|---|
| `shared.hold_seconds_emergency` | 5 detik | Pemilik, GM, langsung berlaku | v3 §8 "jeda tombol: pengumuman darurat" |
| `announcements.emergency_max_chars` | 300 huruf | Pemilik, GM, langsung berlaku | v3 §8 "panjang pesan pengumuman darurat" |
| `announcements.emergency_max_days` | 7 hari | Pemilik, GM, langsung berlaku | PRD ❓ masa tayang paling lama (saran 💡 7 hari) |

## 7. Tes

- Aturan (tanpa DB): arti sasaran (semua; cabang saja; jabatan saja; cabang **dan** jabatan); batas 300 huruf
  dan judul 80; masa tayang (akhir hari ini WIB, paling lama 7 hari, tanggal lampau ditolak); status
  Tayang/Berakhir/Diakhiri; urutan darurat di depan tugas dan yang terbaru dulu.
- Integrasi (DB): kirim → sasaran mendapat butir di antrean, bukan sasaran tidak; pengirim yang termasuk
  sasaran ikut menerima; "sudah baca" diulang tetap satu baris; Akhiri sekarang → yang belum baca tidak lagi
  mendapat butir, yang sudah diakhiri tidak bisa diakhiri lagi; orang pindah cabang ke sasaran sesudah
  terkirim ikut menerima; pemicu DB menolak ubah isi dan hapus.
- Hak: HR bisa kirim/akhiri; Admin HR hanya lihat; karyawan biasa ditolak di semua pintu kecuali baca;
  akses terbatas tidak mendapat butir.
- `pnpm typecheck`; `pnpm migrations:check`; `pnpm changelog:check`.

## 8. Uji owner (staging)

1. Masuk sebagai HR/Pemilik di PC → Kantor › Pengumuman → **Kirim pengumuman darurat**: isi judul dan pesan
   (coba lebih dari 300 huruf → tertahan), pilih satu cabang, lihat jumlah penerima, kirim (tombol ditahan 3 detik).
2. Di HP akun karyawan cabang itu, buka layar isian (misalnya Ajukan Izin langkah 2) dan ketik sesuatu →
   paling lambat 1 menit jendela **Darurat** muncul di atasnya; tombol baru aktif setelah 5 detik; isian
   tidak hilang sesudah ditutup.
3. Akun karyawan cabang lain → tidak mendapat jendela.
4. Kembali ke PC → "sudah baca 1 dari y" bertambah; buka Siapa sudah dan belum baca, saring "belum baca".
5. Kirim satu lagi → **Akhiri sekarang** dengan alasan → akun sasaran yang belum membaca tidak lagi mendapat
   jendelanya (paling lambat 1 menit).
6. Masuk sebagai Admin HR → bisa melihat daftar dan siapa sudah baca, tidak ada tombol Kirim/Akhiri.

## 9. Keputusan owner (2026-11-15: semua sesuai saran)

1. **Masa tayang paling lama 7 hari** (PRD ❓), bisa diubah Pemilik/GM di pengaturan. Saran: ya.
2. **Arti sasaran cabang + jabatan = irisan** ("Kasir di Singaparna"), bukan gabungan. Saran: ya.
3. **Layar Absen tetap tidak terhalang** oleh darurat; jendela muncul begitu absen terkirim. Saran: ya
   (absen tidak boleh tertunda; kabarnya tetap sampai beberapa detik kemudian).
4. **Tanpa mesin terjadwal** untuk mengakhiri darurat (§5). Saran: ya.
5. **Admin HR hanya melihat**, tidak mengirim (mengikuti tabel PRD). Saran: ya.
6. **Karyawan belum bisa membuka ulang darurat yang sudah dibaca sampai F3-3 (Papan) jadi.** Saran: ya,
   karena masa tayangnya pendek dan Papan langkah berikutnya.
