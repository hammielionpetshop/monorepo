# F3-1 Antrean Berantai — rancangan

Status: **disetujui owner 2026-11-15** ("ok setuju"; keempat keputusan §9 mengikuti saran agent). Koding dimulai di sesi baru. Owner menyetujui PRD Fase 3 dan
meminta Fase 3 dikerjakan lebih dulu dari Fase 4 ("ok. setuju, tapi kita kerjakan fase 3 dulu").

Sumber: PRD Fase 3 `01-antrean-berantai.md`, `00-ringkasan-fase-3.md` §6–§8; v3 TAM-16, 22, 24, 25;
PRI-37, 43; spec v3 Perlengkapan Bersama BER-L01, BER-L03, §8 (pengaturan), §10 (kejadian 26, 27);
`daftar-lintas-modul` bab 2 Tabel B (B1, B2).

## 0. Pembagian Fase 3

| Langkah | Isi | Spec |
|---|---|---|
| **F3-1** | Mesin antrean + jendela + dua jenis pertama (pengajuan menunggu) | ini |
| F3-2 | Pengumuman darurat (jenis antrean paling depan) | menyusul |
| F3-3 | Papan Perubahan Aturan + kartu "Pengumuman belum dibaca" di Beranda | menyusul |
| F3-4 | Pindahan pengingat modul lain ke antrean (tabel pemetaan) | menyusul |
| F3-5 | Panduan Karyawan + Pedoman Lapor | menyusul |

Kartu "Pengumuman belum dibaca" di Beranda (BER-L01 butir 1) **dipindah ke F3-3**, karena di F3-1 belum
ada pengumuman. F3-1 cukup menyiapkan urutan kelompok supaya darurat dan aturan nanti langsung masuk.

## 1. Keadaan sekarang (dari kode `origin/dev_hris` 013edd88)

- **Beranda** (`app/(app)/page.tsx`) merangkai kartu "Perlu perhatian" dari ±30 fungsi modul
  (`waitingSummary`, `overtimeAttention`, `clarificationAttention`, `advanceAttention`, …). Kartu dihitung
  saat dibuka dan hilang sendiri saat urusannya beres (TAM-25 butir 2). Bentuk kartu:
  `{ key, title, detail?, href, tone? }`.
- **Lonceng** (`modules/notifications`, `notify()`) untuk kabar sekali baca, disimpan 90 hari.
- Pengingat modul dikirim **sekali per tanda** ke lonceng oleh mesin harian tiap modul.
- **Belum ada** jendela antrean, catatan "sudah tampil hari ini", atau jeda tombol 1 detik.
- Komponen `Dialog` (`components/ui/dialog.tsx`, `<dialog>` bawaan, klik di luar tidak menutup) dan
  pengaturan `shared.hold_seconds_consequential` (3 detik) sudah ada.

## 2. Gagasan utama 💡

**Antrean berantai tidak menyimpan butir sendiri.** Setiap jenis antrean adalah **kartu "Perlu perhatian"
yang sudah ada** dan ditandai lolos pegangan TAM-24. Akibatnya:

- "Berhenti saat beres" gratis: kartu tidak lagi dikembalikan modulnya → jendelanya tidak muncul lagi.
- Butir antrean **otomatis juga tampil di Perlu perhatian** (syarat TAM-25 butir 1), karena asalnya sama.
- Tidak ada data ganda (WAJ-03, WAJ-04): angka "6 klaim menunggu, paling lama 2 hari" dihitung satu kali,
  oleh fungsi modul yang sama dengan Beranda.

Yang disimpan hanya **"jenis ini sudah tampil ke akun ini hari ini"**, supaya tiap jenis muncul **sekali
sehari** sampai beres (TAM-22 butir 4).

## 3. Susunan kode

### 3.1 Satu perangkai "Perlu perhatian"

Isi `HomePage` yang merangkai kartu dipindah ke satu fungsi server, misalnya
`modules/attention` → `attentionCards(actor, session, web)` yang mengembalikan
`{ mine: AttentionCard[]; system: AttentionCard[] }`. **Beranda dan antrean memanggil fungsi yang sama**;
isi dan urutan kartu Beranda tidak berubah.

`AttentionCard` ditambah satu bidang tidak wajib:

```ts
queue?: { group: 'EMERGENCY' | 'RULE' | 'TASK'; oldestAt?: string }
```

Kartu tanpa `queue` hanya tampil di Beranda seperti sekarang. Kartu ber-`queue` juga menjadi jendela.

### 3.2 Daftar jenis antrean (di kode, bukan tabel)

Seperti daftar tindakan (KAR-71), jenis antrean ditulis di kode: `QUEUE_KINDS` berisi kunci kartu, kelompok,
dan alasan TAM-24-nya. Uji memeriksa setiap kunci di daftar memang dihasilkan perangkai.

**Jenis di F3-1** (Tabel B):

| Kunci | Jenis | Kepada | Muncul saat | Berhenti | Sumber |
|---|---|---|---|---|---|
| `requests-waiting` (B1) | "n pengajuan menunggu keputusan Anda. Yang paling lama sudah x hari." | Penyetuju/pemeriksa jenisnya | Ada yang menunggu **lebih dari 1 hari** (pengaturan baru §6) | Diputuskan | PRI-37, TAM-24 butir 2 |
| `overdue` (B2) | "n pengajuan menunggu lebih dari 2 hari" | Pemilik, GM | Hari ke-3 (pengaturan `requests.overdue_days` yang sudah ada) | Diputuskan | PRI-37 |

Kartu Beranda "n pengajuan menunggu keputusan" tetap muncul sejak hari pertama; **jendelanya** baru
muncul bila yang paling lama sudah lebih dari 1 hari.

### 3.3 Catatan tampil

Tabel baru `hris.queue_shown` (migrasi HRIS berikutnya): `account_id`, `kind`, `shown_on` (tanggal WIB),
`acknowledged_at`. Unik `(account_id, kind, shown_on)`. Hanya tambah; dibuang mesin pembersih sesudah
90 hari (sama dengan lonceng).

Pengumuman (F3-2, F3-3) **tidak** memakai tabel ini; "sudah baca"-nya disimpan per pengumuman karena
dibaca sekali selamanya dan dilihat di "Siapa sudah baca".

### 3.4 Pintu API

- `GET /api/queue` → daftar jendela untuk akun yang masuk, sudah berurutan: kelompok
  (darurat → aturan → tugas, TAM-22 butir 1), lalu yang terlama dulu. Jenis tugas yang sudah ada barisnya
  di `queue_shown` hari ini **tidak** dikembalikan.
- `POST /api/queue/ack { kind }` → menulis `acknowledged_at` hari ini. Ulang dua kali tetap satu baris.
- Akses: akun HRIS yang masuk; isi mengikuti hak tiap kartu (fungsi modul sudah memeriksa hak).
  Akses terbatas mantan karyawan tidak mendapat antrean.

### 3.5 Jendela (BER-L03)

`QueueProvider` (client) dipasang di `AppShell`, sehingga ada di semua layar HRIS dan web Logistik.

- **Kapan memeriksa:** saat layar HRIS dibuka atau dimuat ulang, dan sesudah pindah halaman bila
  pemeriksaan terakhir lebih dari 15 menit lalu. (Pemeriksaan tiap 1 menit untuk pengumuman darurat
  ditambahkan di F3-2.)
- **Satu jendela pada satu waktu**, memakai `Dialog` yang ada tetapi **tanpa tombol ×** dan Esc tidak
  menutup (TAM-02: hanya tombolnya). Isi: judul, rincian, tombol **Buka** (ke layar urusannya, juga
  menandai tampil) dan **OK, sudah baca** yang **aktif setelah 1 detik**.
- Sesudah satu ditutup, berikutnya muncul. **Tidak ada jendela ringkasan** (TAM-22 butir 3).
- **Tidak menghapus isian** (TAM-16): jendela di atas halaman; halaman di bawahnya tidak dimuat ulang.
- **Layar Absen tidak pernah terhalang** (TAM-22 butir 2): selama di `/clock-in`, antrean ditunda;
  begitu absen terkirim (atau layar ditinggalkan), antrean langsung muncul.
- **Langkah bertahap** (BER-L03): layar bertahap memanggil `useQueueHold()` selama langkahnya berjalan;
  antrean menunggu sampai langkah selesai atau ditinggalkan. Di F3-1 dipasang di layar Absen dan kerangka
  isian pengajuan (`form-frame`); layar bertahap lain menyusul di F3-4.
- **HRIS ditutup di tengah antrean:** jenis yang belum di-OK belum tercatat, jadi muncul lagi saat dibuka.

## 4. Yang tidak berubah

- Kartu dan urutan "Perlu perhatian" di Beranda, lonceng, dan semua pemberitahuan modul yang sudah ada.
- Hak akses tiap kartu.
- Pengingat modul selain B1/B2 tetap "sekali per tanda" ke lonceng sampai F3-4.

## 5. Penyesuaian monorepo

- Jeda 1 detik dibaca dari pengaturan baru (§6), bukan ditulis di kode (WAJ-07).
- Tanggal "hari ini" memakai fungsi tanggal WIB yang sudah ada (`todayWib`).
- Fragment changelog HRIS + tanda Baru untuk "Pengingat berantai".

## 6. Pengaturan baru

| Kunci | Isi awal | Ubah | Sumber |
|---|---|---|---|
| `shared.hold_seconds_reminder` | 1 detik | Pemilik, GM, langsung berlaku | v3 §8 "jeda tombol: pengingat" |
| `requests.remind_after_days` | 1 hari | Pemilik, GM, langsung berlaku | v3 §8 "pengajuan mulai diingatkan ke penyetuju" |

## 7. Tes

- Aturan: urutan kelompok dan terlama dulu; jenis yang sudah tampil hari ini tidak kembali; hari WIB
  berganti → tampil lagi bila belum beres; kartu yang hilang (beres) tidak menjadi jendela; B1 tidak muncul
  sebelum lewat 1 hari; setiap kunci `QUEUE_KINDS` dihasilkan perangkai.
- Hak: akun yang bukan penyetuju tidak mendapat B1; selain Pemilik/GM tidak mendapat B2; akses terbatas
  tidak mendapat antrean.
- `pnpm typecheck`; `pnpm migrations:check` (tabel baru).

## 8. Uji owner (staging)

1. Ajukan satu izin dari akun karyawan uji; ubah tanggal ajunya lewat data uji (atau tunggu 1 hari).
2. Masuk sebagai penyetuju → jendela "1 pengajuan menunggu keputusan Anda" muncul; tombol OK baru aktif
   setelah 1 detik; tidak bisa ditutup dengan klik di luar atau Esc.
3. Tekan OK → buka halaman lain → jendela tidak muncul lagi hari itu. Kartu di Beranda tetap ada.
4. Putuskan pengajuannya → besok jendela tidak muncul lagi.
5. Buka layar Absen di HP saat ada antrean → layar Absen bersih; sesudah absen terkirim, jendela muncul.
6. Sedang mengisi pengajuan izin (langkah 2) → jendela tidak memotong; muncul sesudah selesai.

## 9. Keputusan owner (2026-11-15: semua sesuai saran)

1. **Antrean dibangun di atas kartu "Perlu perhatian" yang sudah ada** (§2), bukan daftar baru. Saran 💡: ya.
2. **Jendela juga di web Logistik**, karena memakai kerangka yang sama dan penyetujunya orang yang sama.
   Saran 💡: ya.
3. **Kapan memeriksa** (§3.5): saat dibuka + tiap pindah halaman bila lebih dari 15 menit. Saran 💡: ya
   (tidak memeriksa tiap menit untuk pengingat tugas, supaya server tidak terbebani).
4. **Penerima kosong/nonaktif/cuti > 2 hari naik ke Pemilik/GM** (PRI-43 butir 4): di F3-1 sudah tertutup
   oleh B2 (semua pengajuan > 2 hari ke Pemilik/GM). Aturan umum untuk jenis lain dibahas di F3-4.
   Saran 💡: setuju.
