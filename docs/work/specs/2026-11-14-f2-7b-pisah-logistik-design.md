# F2-7b — Logistik dipisah dari HRIS

Status: **disetujui owner 2026-11-14** ("ok lanjutkan"; disusun agent sesudah F2-7a lolos uji owner).
Tanda: ✅ keputusan owner/PRD, 💡 usul agent yang perlu disetujui, ❓ pertanyaan.

Sumber: PRD Fase 2 `01-susunan-web.md` §1–§3, §7; spec F2-7a `2026-11-14-f2-7a-halaman-awal-pindah-web-design.md`
§0 dan §3.

## 1. Tujuan

✅ Empat web dengan satu akun: POS, Finance, **Logistik**, HRIS Karyawan, supaya pekerjaan tidak tercampur (PRD §1).
Sesudah F2-7b, layar Logistik tidak lagi berada di HRIS. Di HRIS hanya tersisa layar milik gaji dan absen (PRD §7).

## 2. Keadaan sekarang (dari kode `dev_hris`)

- Logistik adalah bagian dari aplikasi HRIS: 26 halaman `/logistik/*`, `/trip-saya`, 17 pintu `/api/logistics/*`, modul
  `apps/hris/modules/logistics`, menu kelompok **Logistik** (20 menu, hak `logistics.*`).
- Modul gaji dan absen **membaca modul Logistik langsung** (14 berkas modul: upah ritase, slip mingguan, denda driver, absen
  lewat trip, kasbon, bonus, potongan lain, beranda). Beranda HRIS memuat 13 jenis pemberitahuan Logistik.
- Foto trip/bensin/toko disimpan lewat modul berkas HRIS; database memakai schema `logistics` dengan role HRIS.
- Finance sudah membaca schema `logistics` langsung, bukan lewat HRIS (PRD §5), jadi tidak terdampak.

## 3. Cara pemisahan

💡 **Satu aplikasi, dua alamat.** Logistik menjadi web sendiri di **`logistik.staginghml.my.id`** (staging) dan
**`logistik.hammielion.com`** (produksi). Untuk sekarang web itu dijalankan oleh kode dan container HRIS yang sama.
Alamat yang dibuka menentukan isi:

| Dibuka di | Isi | Menu |
|---|---|---|
| `hris.*` | Absen, gaji, kasbon, bongkaran, dana, minus kas, karyawan, pengaturan | Kelompok Logistik dan Trip Saya **tidak ada** |
| `logistik.*` | Semua layar Logistik + Trip Saya | Hanya Beranda Logistik, Trip Saya, Pemberitahuan, dan kelompok Logistik |

Alasan:
- Bagi pemakai, hasilnya sudah web terpisah: alamat sendiri, menu sendiri, kotak sendiri di Halaman Awal.
- Gaji dan absen tetap membaca data trip seperti sekarang (PRD §3), tanpa memecah 14 sambungan dan tanpa pindah
  database, berkas foto, atau role. Risikonya kecil menjelang hari pindah 26 Des 2026.
- Memecah kode menjadi aplikasi terpisah (`apps/logistics` + paket bersama) tetap bisa dilakukan belakangan bila
  perlu; alamat dan hak web tidak berubah.

Aturan alamat:
- `hris.*` membuka `/logistik/...` atau `/trip-saya` → **dialihkan** ke `logistik.*` dengan alamat yang sama. Tautan lama,
  pemberitahuan, dan tautan dari Finance tetap jalan.
- `logistik.*` membuka layar HRIS (mis. `/gaji`, `/absen`) → dialihkan ke `hris.*`.
- Login, lupa password, profil, dan Pemberitahuan tersedia di kedua alamat. Sesi tetap satu (cookie bersama),
  jadi pindah antara HRIS dan Logistik **tanpa login ulang**.

## 4. Yang pindah dan yang tetap

| Layar | Ke | Catatan |
|---|---|---|
| Semua menu kelompok Logistik (Dashboard, Trip, Ritase, Surat Jalan, Data Toko, Uang dari Toko, Titipan, Terima Uang, Laporan Toko/Muat, Antar Sendiri, Catat Kasir, Jemput Retur, Barang Kembali, Bensin & Mobil, Di Luar Titik, Laporan, Sewa Mobil, Mobil & Rute) | **Logistik** | Isi dan hak tidak berubah |
| Trip Saya (driver/kenek) | **Logistik** | ✅ PRD §3 |
| Pemberitahuan Beranda tentang trip, surat jalan, uang toko, bensin, titik toko, barang kembali, antar sendiri, setoran | **Beranda Logistik** | 💡 Beranda HRIS tidak lagi memuatnya |
| Absen Trip (Kehadiran), Upah Ritase, Denda Driver, Tarif Ritase, slip driver | **HRIS** | ✅ milik gaji/absen (PRD §3, §7) |
| Pemberitahuan upah ritase (belum bertarif, perlu dilihat) | **HRIS** | Milik gaji |

- 💡 Beranda HRIS driver/kenek mendapat **kotak pintas "Trip Saya hari ini"** yang membuka web Logistik (PRD §3).
- Tombol **"Jadikan Potongan Lain"** di Terima Uang (B3) tetap ada di Logistik; potongannya tetap tercatat dan
  disetujui di HRIS.

## 5. Hak web Logistik

💡 **Dihitung otomatis dari hak jabatan HRIS**, tanpa pengaturan baru:

- Kotak **Logistik** tampil bila akun punya tautan `hris` aktif **dan** (punya minimal satu hak `logistics.*` **atau**
  menu Trip Saya tampil untuknya, yaitu driver/kenek).
- Kotak **HRIS** tetap tampil bila tautan `hris` aktif.
- Hak dihitung oleh HRIS (pemilik hak jabatan). Gateway di Back Office menanyakannya lewat pintu internal HRIS yang
  tidak bisa dibuka dari luar (`/api/internal/*`, sudah ditolak Caddy).
- Hanya sesi password (sama dengan HRIS).

❓ PRD §2 menyebut tautan app baru `logistik` di `auth.account_links` yang diatur Owner/GM di Akun & Tautan. Usul agent:
**tidak perlu**, karena hak jabatan sudah menentukan siapa memegang Logistik, dan tautan tambahan berarti setiap
driver/admin gudang harus ditautkan satu per satu. Tanpa migrasi.

Contoh hasil di Halaman Awal:
- Owner/GM: POS · HRIS · Finance · Logistik.
- Driver/kenek: HRIS · Logistik (2 kotak, pilih).
- Admin gudang yang punya Back Office + HRIS + hak Logistik: POS · HRIS · Logistik.
- Karyawan toko tanpa hak Logistik: HRIS saja → langsung masuk.

## 6. Tombol Pindah web dan Halaman Awal

- Gateway (`apps/gateway`) dan aturan hak (`apps/backoffice/lib/web-access.ts`) mendapat web keempat `logistik`
  (nama **Logistik**, keterangan "Trip, uang toko, bensin, dan sewa mobil"); keterangan HRIS menjadi "Absen, gaji, dan
  kasbon".
- Tombol Pindah web tampil di Logistik seperti di HRIS (membuka gateway `?dari=logistik`).
- Driver yang membuka `hris.*` langsung (mis. lewat QR absen) tetap bisa absen seperti sekarang.

## 7. Yang tidak berubah

- Isi, aturan, dan hak setiap layar Logistik; data dan foto; laporan; Finance.
- Login kasir PIN, POS, Back Office.
- Gaji driver, ritase, slip mingguan, denda, dan absen lewat trip (PRD §3).
- Tanpa migrasi DB.

## 8. Tayang

- **Staging dulu**: DNS `logistik.staginghml.my.id`, situs Caddy yang meneruskan ke `hris-staging:3000` (tanpa Basic
  Auth, `noindex`, `/api/jobs` dan `/api/internal` ditolak), env `DOMAIN_STAGING_LOGISTICS` dan
  `STAGING_LOGISTICS_ORIGIN` (cadangan `.env` sebelum diubah).
- **Produksi (`logistik.hammielion.com`) bersama rilis HRIS/Finance** sesudah cutover akun pusat.
- Rencana branch: `feat/logistics-web` (dasar `origin/dev_hris`: pembagian alamat HRIS/Logistik, menu, beranda, kotak
  pintas, infra staging, fragment changelog HRIS + tanda Baru) dan `feat/gateway-logistics` (dasar `origin/main`: web
  `logistik` di aturan hak, gateway API, Pindah web Back Office). Klaim dipublikasikan sebelum implementasi.
- Tes non-UI terarah: aturan alamat (mana yang dialihkan), aturan hak web Logistik, daftar web gateway.

## 9. Uji owner (staging)

1. Masuk di `app.staginghml.my.id` sebagai Owner → 4 kotak: POS, HRIS, Finance, Logistik.
2. Klik Logistik → masuk tanpa login ulang, menu hanya Logistik. Pindah web → HRIS → menu Logistik tidak ada.
3. Di HRIS buka alamat lama `/logistik/trip` → pindah sendiri ke `logistik.staginghml.my.id/logistik/trip`.
4. Masuk sebagai driver → 2 kotak (HRIS, Logistik). Di Logistik: Trip Saya jalan seperti biasa. Di HRIS: absen dan
   slip ada, kotak pintas "Trip Saya hari ini" membuka Logistik.
5. Masuk sebagai karyawan toko tanpa hak Logistik → langsung ke HRIS, tanpa kotak Logistik.
6. Tautan Bensin dari Finance membuka layar Bensin & Mobil di Logistik.

## 10. Keputusan owner

1. ✅ Satu aplikasi dua alamat (§3) — owner 2026-11-14.
2. ✅ Hak web Logistik otomatis dari hak jabatan, tanpa tautan app baru (§5) — owner 2026-11-14.
3. ✅ Pemberitahuan Logistik pindah ke Beranda Logistik, HRIS driver dapat kotak pintas (§4) — owner 2026-11-14.
4. ✅ Alamat `logistik.hammielion.com` / `logistik.staginghml.my.id` (§3) — owner 2026-11-14.
