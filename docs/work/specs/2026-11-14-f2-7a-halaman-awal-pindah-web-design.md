# F2-7a Halaman Awal + Pindah web — rancangan

Status: **draf agent 2026-11-14, menunggu persetujuan owner** ("lanjutkan fase 2"). Butir 💡 adalah usul agent
yang perlu disetujui atau diganti owner.

Sumber: PRD Fase 2 `01-susunan-web.md` §2, §4, §5, §7; `00-ringkasan-fase-2.md` §6–§7 ("Belakangan: Halaman Awal +
tombol Pindah web, Logistik dipisah"); spec L1 auth `2026-10-29-hris-l1-auth-design.md`; runbook `docs/ops/auth-pusat.md`.

## 0. Pembagian "Belakangan"

PRD menggabungkan dua pekerjaan besar. Usul agent 💡 dipecah:

- **F2-7a (spec ini): Halaman Awal + Pindah web** untuk web yang sudah ada — **POS** (Back Office + kasir),
  **HRIS**, dan **Finance**.
- **F2-7b (spec terpisah, sesudah F2-7a lolos uji): Logistik dipisah dari HRIS** menjadi web sendiri. Saat F2-7b
  tayang, kotak **Logistik** ditambahkan ke Halaman Awal dan Pindah web. Sampai saat itu Logistik tetap di HRIS.

## 1. Keadaan sekarang (dari kode)

- Satu akun pusat (`auth.accounts`) dengan **tautan per app** (`auth.account_links`, kode `backoffice` / `hris`).
  Satu cookie sesi bersama per lingkungan (`hml_<env>_session`, domain induk). Akses per app dibuka per sesi
  (`auth.session_app_access`).
- Back Office sudah bisa masuk otomatis dari sesi pusat yang ada (`/api/auth/bootstrap`). HRIS hanya membuka
  aksesnya saat login di HRIS atau ganti password — orang yang sudah login password di Back Office tetap diminta
  login lagi di HRIS.
- HRIS menuntut sesi **password**; sesi **PIN** (kasir) hanya untuk POS/Back Office.
- Web Finance (khusus staging) membaca sesi Back Office dan hanya terbuka untuk role **Owner/GM**; tombol masuknya
  mengarah ke login Back Office.
- **Produksi masih login lama (`legacy`)**: cutover akun pusat produksi belum dilakukan dan HRIS/Finance belum
  tayang produksi. Halaman Awal hanya berguna bila akun pusat aktif.

## 2. Halaman Awal

1. 💡 **Web kecil sendiri** (`apps/home`, staging `masuk.staginghml.my.id`) — bukan menumpang di HRIS atau Back
   Office, sesuai tujuan "tidak tercampur" dan supaya F2-7b tinggal menambah satu kotak. Alamat produksi
   diputuskan saat rilis (PRD §6: domain diputuskan dev asli). Isinya hanya: Masuk, halaman pilihan, Keluar,
   dan ganti password awal (alur yang sudah ada di paket auth).
2. **Masuk dengan username/email + password** (akun pusat). PIN tidak tersedia di Halaman Awal; kasir tetap masuk
   lewat layar POS seperti hari ini (PRD §4).
3. Sesudah masuk:
   - **Hak satu web** → langsung diarahkan ke web itu, tanpa halaman pilihan.
   - **Dua web atau lebih** → halaman pilihan berisi kotak web yang boleh dibuka (nama, satu baris keterangan).
   - **Tidak punya hak web mana pun** → pesan "Akun belum punya akses web. Hubungi Owner/GM." + tombol Keluar.
4. Bila sudah punya sesi aktif (mis. baru dari Back Office), membuka Halaman Awal langsung menampilkan pilihan
   tanpa login ulang.
5. Kotak **POS** membuka Back Office; Back Office tetap menentukan sendiri masuk Back Office atau dialihkan ke layar
   kasir seperti hari ini (PRD §4). Pilih cabang tetap di POS.

## 3. Hak per web

| Web | Tampil bila | Catatan |
|---|---|---|
| **POS** | Tautan `backoffice` aktif dan pengguna Back Office aktif | Sama dengan aturan masuk Back Office sekarang |
| **HRIS** | Tautan `hris` aktif | Sesi PIN: kotak tampil dengan keterangan "Masuk dengan password untuk membuka HRIS" dan mengarah ke Halaman Awal |
| **Finance** | 💡 Tautan `backoffice` aktif **dan** role Back Office **Owner/GM** | Aturan sama dengan web Finance sekarang (keputusan 2026-11-12). Tanpa migrasi dan tanpa tautan app baru |

💡 Tautan app baru `finance` (diatur di Akun & Tautan HRIS, PRD §2) **ditunda** sampai owner ingin memberi akses
Finance ke orang di luar Owner/GM (PRD §8 🗣️). Tautan `logistik` dibuat di F2-7b.

Aturan hak dihitung di satu tempat (paket bersama), dipakai Halaman Awal dan tombol Pindah web, supaya daftar web
selalu sama di semua tempat.

## 4. Tombol "Pindah web"

- Di pojok atas **Back Office**, **HRIS**, dan **Finance**. Isinya hanya web yang menjadi hak orang itu (§3); web yang
  sedang dibuka diberi tanda. Bila haknya hanya satu web, tombol tidak ditampilkan.
- 💡 **Tidak dipasang di layar kasir POS** (sesi PIN dan layar kasir tidak diubah, PRD §4). Owner/GM yang membuka POS
  dari Back Office kembali lewat Back Office.
- Pindah ke web lain **tanpa login ulang**: web tujuan membuka aksesnya dari sesi pusat yang sama (Back Office sudah
  begitu; HRIS ditambah jalur yang sama — tetap hanya untuk sesi password, tetap memeriksa tautan aktif dan ganti
  password awal).
- **Keluar** di web mana pun mengakhiri sesi di semua web (sudah begitu karena sesinya satu) dan kembali ke Halaman
  Awal.
- Tombol Masuk di Finance dan halaman "belum masuk" HRIS 💡 mengarah ke Halaman Awal. Login Back Office/POS tidak
  diubah.

## 5. Yang tidak berubah

- Login kasir PIN, pilih cabang, aturan Back Office vs layar kasir.
- Isi dan hak dalam tiap web; Finance tetap hanya membaca.
- Logistik tetap di HRIS (sampai F2-7b).
- Tanpa migrasi DB.

## 6. Tayang

- **Staging dulu**, seperti Finance. Perlu: layanan `home-staging` di compose staging, alamat
  `masuk.staginghml.my.id` di Caddy, origin tepercaya & rahasia CSRF sendiri di `.env` staging (cadangan `.env`
  sebelum diubah, seperti Finance).
- **Produksi bersama rilis HRIS/Finance**, karena butuh cutover akun pusat produksi (langkah terpisah dengan
  persetujuan owner, runbook `auth-pusat.md`). Tombol Pindah web di Back Office produksi baru tampil bila mode
  `central` aktif; selama `legacy` Back Office produksi tidak berubah.
- Pembagian branch (rencana): `feat/home-web` (Halaman Awal + aturan hak bersama, dasar `origin/dev_hris` karena
  memakai paket auth & web Finance yang baru ada di sana) lalu Pindah web di Back Office ikut branch yang sama atau
  `feat/bo-web-switcher` dari `origin/main` bila perlu rilis Back Office terpisah. Klaim path dipublikasikan
  sebelum implementasi.

## 7. Uji owner (staging)

1. Buka `masuk.staginghml.my.id`, masuk sebagai Owner → tampil 3 kotak (POS, HRIS, Finance).
2. Klik HRIS → masuk tanpa login ulang. Pindah web → Finance → masuk tanpa login ulang. Pindah web → POS → Back
   Office.
3. Masuk sebagai karyawan yang hanya punya HRIS (mis. driver) → langsung ke HRIS, tombol Pindah web tidak tampil.
4. Masuk sebagai admin yang punya Back Office + HRIS tapi bukan Owner/GM → 2 kotak, Finance tidak ada.
5. Kasir masuk PIN di POS seperti biasa → tidak ada perubahan.
6. Keluar dari HRIS → membuka Back Office/Finance meminta masuk lagi.

## 8. Pertanyaan untuk owner

1. 💡 Halaman Awal sebagai web kecil sendiri (`masuk.staginghml.my.id`) — setuju, atau ditumpangkan di HRIS?
2. 💡 Finance tetap untuk Owner/GM saja (tanpa tautan baru) — setuju?
3. 💡 F2-7a dulu (Halaman Awal + Pindah web), pemisahan Logistik di F2-7b — setuju?
