# F2-7a Halaman Awal + Pindah web — rancangan

Status: **draf agent 2026-11-14, direvisi sesuai arahan owner 2026-11-14** ("user login di app.hammielion.com (prod)
dan app.staginghml.my.id (staging) ... hanya sebagai gateway ... react vite saja ... export saja logika login yang ada
di backoffice menjadi api"). Butir 💡 tersisa adalah usul agent yang menunggu persetujuan owner.

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

## 2. Halaman Awal (gateway)

1. ✅ **Web gateway kecil berbasis React + Vite** (`apps/gateway`, bukan Next.js), di **`app.staginghml.my.id`**
   (staging) dan **`app.hammielion.com`** (produksi). Isinya hanya: Masuk, daftar web, Keluar, dan ganti password
   awal. Hasil build berupa berkas statis.
2. ✅ **Logika login tetap di Back Office, dibuka sebagai API** untuk gateway (§2a). Gateway tidak terhubung ke
   database dan tidak menyimpan rahasia.
3. 💡 Gateway dan API-nya **satu alamat**: Caddy di `app.*` menyajikan berkas statis gateway dan meneruskan
   `/api/gateway/*` ke layanan Back Office. Dengan begitu cookie sesi, CSRF, dan origin tetap sama-alamat (tanpa
   CORS lintas domain).
4. **Masuk dengan username/email + password** (akun pusat). PIN tidak tersedia di gateway; kasir tetap masuk lewat
   layar POS seperti hari ini (PRD §4).
5. Sesudah masuk:
   - **Hak satu web** → langsung diarahkan ke web itu, tanpa daftar.
   - **Dua web atau lebih** → daftar kotak web yang boleh dibuka (nama, satu baris keterangan).
   - **Tidak punya hak web mana pun** → pesan "Akun belum punya akses web. Hubungi Owner/GM." + tombol Keluar.
6. Bila sudah punya sesi aktif (mis. baru dari Back Office), membuka gateway langsung menampilkan daftar tanpa login
   ulang.
7. Kotak **POS** membuka Back Office; Back Office tetap menentukan sendiri masuk Back Office atau dialihkan ke layar
   kasir seperti hari ini (PRD §4). Pilih cabang tetap di POS.

### 2a. API gateway di Back Office (`/api/gateway/*`)

| Pintu | Isi |
|---|---|
| `POST /api/gateway/login` | Username/email + password → sesi pusat **tanpa mengikat ke satu web**, cookie sesi bersama. Memakai pemeriksaan password, kunci percobaan, dan catatan login yang sudah ada di `@petshop/auth` |
| `GET /api/gateway/apps` | Daftar web yang menjadi hak sesi ini (§3) + nama orang |
| `POST /api/gateway/open` | `{ app }` → membuka akses web tujuan di sesi ini (aturan sama dengan bootstrap Back Office), lalu memberi alamat tujuan |
| `POST /api/gateway/change-password` | Ganti password awal (alur yang sudah ada) |
| `POST /api/gateway/logout` | Mengakhiri sesi di semua web |

- Alasan login baru tidak memakai `/api/auth/login` apa adanya: login Back Office mewajibkan tautan `backoffice`,
  sehingga karyawan yang hanya punya HRIS (mis. driver) akan ditolak. Login gateway membuat sesi akun saja; akses
  tiap web dibuka lewat `open` atau saat web itu dibuka.
- Login PIN dan `/api/auth/login` Back Office tidak berubah.
- Hanya aktif dalam mode `central`; dalam mode `legacy` semua pintu gateway menjawab 404.
- Origin tepercaya untuk pintu ini: alamat gateway. Tanpa migrasi DB (`login_events.app_code` mencatat `gateway`).

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
- Pindah ke web lain **tanpa login ulang**: tombol mengarah ke gateway (`/api/gateway/open`), yang membuka akses web
  tujuan dari sesi pusat yang sama. HRIS hanya untuk sesi password; tautan aktif dan ganti password awal tetap
  diperiksa. Daftar di tombol diambil dari `GET /api/gateway/apps`.
- **Keluar** di web mana pun mengakhiri sesi di semua web (sudah begitu karena sesinya satu) dan kembali ke gateway.
- Tombol Masuk di Finance dan halaman "belum masuk" HRIS 💡 mengarah ke gateway. Login Back Office/POS tidak diubah.

## 5. Yang tidak berubah

- Login kasir PIN, pilih cabang, aturan Back Office vs layar kasir.
- Isi dan hak dalam tiap web; Finance tetap hanya membaca.
- Logistik tetap di HRIS (sampai F2-7b).
- Tanpa migrasi DB.

## 6. Tayang

- **Staging dulu**, seperti Finance. Perlu: layanan statis `gateway-staging` (image kecil berisi hasil build Vite) di
  compose staging, situs `app.staginghml.my.id` di Caddy (berkas statis + teruskan `/api/gateway/*` ke Back Office
  staging), DNS `app.staginghml.my.id`, dan origin gateway di `.env` staging (cadangan `.env` sebelum diubah).
- **Produksi (`app.hammielion.com`) bersama rilis HRIS/Finance**, karena butuh cutover akun pusat produksi (langkah
  terpisah dengan persetujuan owner, runbook `auth-pusat.md`). API gateway dan tombol Pindah web di Back Office
  produksi hanya aktif dalam mode `central`; selama `legacy` Back Office produksi tidak berubah.
- `apps/gateway` ikut `pnpm typecheck` dari root; pemeriksaan non-UI terarah untuk API login gateway (sesi tanpa
  tautan web, hak per web, akun nonaktif, PIN ditolak).
- Pembagian branch (rencana): `feat/gateway-api` (API gateway + aturan hak + Pindah web Back Office, dasar
  `origin/main`, bisa ikut produksi dalam keadaan tidak aktif) lalu `feat/gateway-web` (`apps/gateway` + Pindah web
  HRIS/Finance + infra staging, dasar `origin/dev_hris`). Klaim path dipublikasikan sebelum implementasi.

## 7. Uji owner (staging)

1. Buka `app.staginghml.my.id`, masuk sebagai Owner → tampil 3 kotak (POS, HRIS, Finance).
2. Klik HRIS → masuk tanpa login ulang. Pindah web → Finance → masuk tanpa login ulang. Pindah web → POS → Back
   Office.
3. Masuk sebagai karyawan yang hanya punya HRIS (mis. driver) → langsung ke HRIS, tombol Pindah web tidak tampil.
4. Masuk sebagai admin yang punya Back Office + HRIS tapi bukan Owner/GM → 2 kotak, Finance tidak ada.
5. Kasir masuk PIN di POS seperti biasa → tidak ada perubahan.
6. Keluar dari HRIS → membuka Back Office/Finance meminta masuk lagi.

## 8. Pertanyaan untuk owner

1. ✅ Gateway React + Vite di `app.hammielion.com` / `app.staginghml.my.id`, login lewat API Back Office (owner
   2026-11-14).
2. 💡 Finance tetap untuk Owner/GM saja (tanpa tautan baru) — setuju?
3. 💡 F2-7a dulu (gateway + Pindah web), pemisahan Logistik di F2-7b — setuju?
