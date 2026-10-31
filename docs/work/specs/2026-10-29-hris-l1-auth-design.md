# Spec HRIS L1 — Auth Terpusat

Tanggal: 2026-10-29 · Status: **L1a terintegrasi development; L1b terverifikasi lokal — menunggu review; sesi pusat belum diaktifkan**
Sumber: [PRD auth](../../hris_planning/PRD/fase_1/02-auth-terpusat.md),
[PRD karyawan](../../hris_planning/PRD/fase_1/04-karyawan-dan-akses.md).
Plan: [L1](../plans/2026-10-29-hris-l1-auth.md).

## 1. Keputusan dan batas

Keputusan owner sesi 2026-10-29:
- PIN tetap khusus backoffice/POS. Membuka HRIS memerlukan autentikasi password.
- Sesi HRIS diperpanjang saat digunakan; habis setelah **30 hari tanpa penggunaan HRIS**.

Keputusan PRD tetap berlaku: satu akun pusat, tautan manual, hak akses milik app;
logout mencabut sesi perangkat di semua app; pengambilalihan perangkat hanya
mencabut akses backoffice, kecuali OWNER. Portal pelanggan tetap memakai OTP sendiri.

L1 menyediakan mesin akun/sesi, login bersama, integrasi backoffice, pintu provisioning,
dan halaman HRIS minimum untuk membuktikan sesi. Data karyawan, jabatan, pengelolaan
tautan oleh owner, serta pemulihan berbasis data karyawan merupakan integrasi L2.
Nomor HP/tanggal lahir tidak boleh ditebak atau diganti pemeriksaan palsu di L1.

## 2. Temuan kode

Baseline dibaca dari origin/dev_hris e26f17bc71d5573942d24ea2efa1ada2b05082c9.
- packages/auth baru memiliki deklarasi schema; belum ada tabel akun atau sesi.
- lib/auth.ts backoffice memverifikasi JWT, lalu sesi petshop.user_sessions.
  Token tanpa sessionId masih diterima; pengecualian historis ini harus dibatasi saat transisi.
- Login memiliki mode staff_pin, email_password, dan bo; mode bo menerima password/PIN.
- JWT akses berumur satu hari; cookie akses/refresh hanya berlaku pada host backoffice.
- Middleware Edge hanya memeriksa tanda tangan JWT. Bootstrap dari cookie pusat harus
  memiliki jalur sendiri agar pengguna dari HRIS tidak dipantulkan ke login berulang.
- users.password_hash nullable; migrasi tidak boleh menganggap setiap kasir memiliki password.
- Pencabutan/pembuatan sesi sekarang memakai transaksi, tetapi transaksi saja belum menjamin
  dua login serentak selalu menyisakan satu akses. Perlu penguncian per akun di jalur baru.

Aturan repo terbaru diberikan owner dan tersedia di origin/staging; entry point lama
di dev_hris harus disinkronkan lewat PR aturan tersendiri sebelum implementasi.
Catatan PRD lama yang membolehkan push main langsung tidak berlaku.

## 3. Model data usulan

Semua nama teknis Inggris. Tidak ada foreign key lintas schema.

| Tabel auth | Isi dan batas |
|---|---|
| accounts | username/email ternormalisasi, password_hash nullable untuk akun PIN lama, is_active, must_change_password, penghitung kegagalan, locked_until, waktu perubahan kredensial |
| account_links | account_id, app_code, local_user_id; unik (account_id, app_code) dan (app_code, local_user_id) |
| sessions | account_id, hash token acak, metode autentikasi, perangkat, created_at, revoked_at/reason; token mentah hanya pada cookie |
| session_app_access | session_id, app_code, last_active_at, expires_at, revoked_at/reason; unik (session_id, app_code) |
| login_events | hasil login, akun bila diketahui, app/metode, waktu dan ringkasan perangkat; tanpa password/PIN/token |
| audit_events | tindakan akun/tautan/reset/pencabutan, pelaku, waktu, sebelum/sesudah dengan rahasia disaring |

Tabel session_app_access memisahkan pencabutan backoffice dari sesi perangkat:
TAKEN_OVER menutup akses backoffice saja; LOGOUT menutup sessions sehingga semua aksesnya mati.
Kedaluwarsa HRIS dihitung dari aktivitas HRIS, bukan aktivitas backoffice.
Akun dan sesi tidak dihapus untuk memperbaiki kesalahan.

## 4. Alur autentikasi

### Password dan sesi bersama

1. Validasi identifier/password pusat; salah lima kali berturut-turut memberi jeda lima menit.
   Penghitung dan jeda berada di DB, aman untuk banyak instance dan login serentak.
   Respons gagal tidak membocorkan keberadaan akun.
2. Buat/rotasi token acak; simpan hash token. Cookie pusat HttpOnly, Secure, SameSite=Lax,
   Path=/ dengan Domain induk sesuai lingkungan. Password awal wajib diganti sebelum akses app.
3. App memvalidasi sesi pusat dan tautan lokal. Sesi sah tanpa tautan tetap mendapat penolakan
   jelas; jangan otomatis mencocokkan karyawan lewat nama/email.
4. Backoffice menerbitkan JWT lokal dari role, izin, dan cabang miliknya.
   verifyAccessToken mempertahankan antarmuka pemanggil dan memeriksa sesi pusat,
   akses backoffice, akun aktif, dan tautan yang masih sesuai.
5. HRIS memvalidasi sesi serta akses HRIS di server. Login password saja tidak
   menciptakan hak jabatan HRIS. L1 menguji akses dengan fixture lokal/staging
   terkontrol; jalur pengguna normal tanpa tautan ditolak sampai L2 tersedia.

### PIN dan pengambilalihan perangkat

PIN diverifikasi oleh backoffice. Sesi hasil PIN ditandai dan hanya diberi akses backoffice.
Cookie dari login PIN tidak dapat dipakai bootstrap HRIS; HRIS meminta password.
Pergantian kasir pada PC bersama harus mengakhiri konteks akun sebelumnya pada browser
agar sesi HRIS milik kasir lama tidak tertinggal. Password yang berhasil memulai konteks baru.
Detail cookie konteks PIN dan password harus dibuktikan lewat tes dua akun pada browser yang sama.

Memasuki backoffice, termasuk lewat bootstrap sesi HRIS, mengambil akses backoffice bagi
non-OWNER dalam transaksi dengan penguncian akun. Akses lama yang terkena TAKEN_OVER
tidak boleh otomatis hidup lagi melalui bootstrap cookie pusat: perlu login eksplisit.
Membuka HRIS di HP tidak mengambil akses backoffice.

### Logout, perubahan akun, dan rute server

Logout adalah mutasi server yang mencabut sessions lalu membersihkan cookie yang tersedia
di host pemanggil. Cookie JWT di host lain boleh masih tersimpan, tetapi server menolaknya
pada permintaan berikutnya. Akun nonaktif, password direset, atau tautan dicabut juga harus
menutup akses terkait segera; aturan pergantian password normal dirinci pada L1a.

Mutasi cookie memakai validasi Origin terhadap daftar host tepercaya dan perlindungan
CSRF yang sesuai; SameSite saja tidak cukup untuk subdomain bersaudara.
Middleware tetap tanpa DB; halaman/endpoint server memutuskan akses akhir.
Jalur bootstrap, sesi tercabut, onboarding, dan PIN wajib bebas loop redirect.
JWT yang kedaluwarsa tidak boleh membangkitkan akses dari sesi pusat yang telah dicabut.

## 5. Migrasi dan provisioning

- Preflight hanya baca: hitung akun, akun PIN tanpa password, identifier kosong/ambigu,
  benturan lintas username/email, status aktif, dan kewajiban onboarding.
  Bila ambigu, hentikan dan laporkan tanpa mengubah akun.
- Migrasi schema baru bersifat aditif pada aliran auth, menggunakan nomor berikutnya setelah
  fetch dan klaim kunci. Jangan mengedit migrasi 0000 yang sudah diterapkan.
- Backfill terpisah dan aman diulang berdasarkan tautan petshop user id:
  salin hash argon2 apa adanya, identifier dan status; jangan memaksa password baru
  kepada pengguna lama yang onboarding-nya sudah selesai.
- Akun PIN-only tetap bisa masuk backoffice lewat PIN, tetapi HRIS membutuhkan
  penetapan password oleh jalur resmi. Jangan membuat password bawaan diam-diam.
- Pintu server backoffice mengelola users, role/cabang, PIN dan audit backoffice.
  HRIS tidak diberi hak tulis petshop. Provisioning memerlukan kunci internal,
  pembatasan jaringan/rute publik, identitas pelaku, validasi hak Owner/GM,
  dan idempotency key. Kunci layanan saja bukan bukti hak pelaku.
- Bila provisioning dan tautan gagal di tengah, retry harus menemukan pengguna yang sama
  dan melengkapi tautan; dilarang membuat duplikat. Konflik tautan menjadi 409.
- Sampai L2, UI Pengguna lama memakai layanan provisioning yang sama dan menjaga akun auth
  tetap konsisten. Penyimpanan password lama untuk rollback mengikuti masa transisi,
  tidak menjadi dua sumber kebenaran tanpa mekanisme sinkronisasi.

## 6. Peralihan, lingkungan, dan jalan kembali

Mode konfigurasi usulan legacy/central, dipasang serentak dan konsisten per lingkungan.
Legacy tetap memakai sesi lama; central menolak token lama atau memakai jembatan transisi
terbatas waktu yang selalu memeriksa sesi lama. Rekomendasi awal: login ulang satu kali saat
cutover, tanpa mengubah kredensial atau langkah login kasir; konfirmasi dampaknya dengan owner
sebelum cutover. Jangan menafsirkan token lama sebagai id sesi auth baru.

Staging memakai domain .staginghml.my.id. Domain produksi dan hostname HRIS produksi harus
diperiksa dari konfigurasi aktual sebelum disahkan; jangan menebak dari nama staging.
Nama cookie/domain lingkungan harus mencegah pertukaran staging dan produksi.
Lokal memakai hostname yang mendukung uji cookie lintas app; cookie tidak dibatasi port.

Rollback tidak cukup hanya membalik env: cabut sesi pusat dan sesi legacy yang dapat
menghidupkan kembali akses yang telah dicabut, lalu minta login ulang.
Sebelum cutover, buktikan bahwa password/akun baru selama central tetap dapat dipakai
pada mode fallback. Jika tidak, rollback membutuhkan prosedur reset terkontrol.
Pertahankan tabel lama sampai periode stabil dan persetujuan penghapusan terpisah.

Tidak ada refresh DB staging, migrasi/seed produksi dari laptop, atau aktivasi HRIS
produksi sebagai bagian planning. Backup, hasil uji staging dan izin rilis berlaku
pada kandidat tepat yang nanti dirilis.

## 7. Bukti penerimaan

| Skenario | Hasil wajib |
|---|---|
| Password backoffice → HRIS, dan sebaliknya | Sesi diterima jika tertaut; hak tiap app tetap diperiksa |
| PIN backoffice → HRIS | Meminta password |
| PC POS + HP HRIS | Keduanya tetap aktif |
| PC kedua membuka backoffice | PC pertama ditolak pada request berikut; HP HRIS tetap aktif |
| OWNER dua PC | Kedua akses backoffice tetap aktif |
| Cookie pusat PC pertama setelah TAKEN_OVER | Tidak dapat mengambil akses kembali tanpa login eksplisit |
| Logout HRIS atau backoffice | Seluruh akses pada sesi perangkat itu ditolak berikutnya |
| Nonaktif akun/reset/putus tautan | Sesi/akses terkait segera ditolak |
| HRIS tidak dipakai 30 hari | Minta password lagi; aktivitas BO tidak memperpanjang HRIS |
| Dua login/provisioning bersamaan | Tidak ada akses backoffice ganda non-OWNER atau akun duplikat |
| Akun tanpa tautan/izin | 403 dengan pesan jelas |
| JWT kadaluarsa/sesi dicabut/token legacy | Tidak dapat melewati pemeriksaan pusat |
| Kasir lama, onboarding, reset PIN, pilih cabang | Perilaku bisnis tetap bekerja |
| Pergantian akun di PC bersama | Tidak meninggalkan akses HRIS akun sebelumnya |
| POST dari origin tak dipercaya | Ditolak; tidak ada kredensial pada log/respons |
| Rollback setelah perubahan password/logout | Password konsisten; sesi tercabut tidak hidup kembali |

## 8. Hal yang masih perlu dipastikan

- Owner belum tercatat meluluskan uji L0; planning boleh berjalan, cutover menunggu gerbang tersebut.
- Persetujuan login ulang sekali saat cutover; alternatif jembatan terbatas waktu jika diperlukan.
- Host produksi, kebijakan sesi backoffice sesudah JWT satu hari habis, masa stabil sebelum
  fallback dilepas, dan kebijakan sesi lain saat ganti password normal.
- Pemulihan mandiri AUT-13 menunggu sumber data karyawan L2; L1 menyediakan reset Owner/GM
  serta kontrak integrasinya. Layar penuh riwayat masuk/perangkat juga berada di L2.

Rincian pelaksanaan L1a: [akun pusat dan backfill](2026-10-29-hris-l1a-accounts-design.md).
Rincian pelaksanaan L1b: [mesin sesi dan kredensial](2026-10-29-hris-l1b-sessions-design.md).
