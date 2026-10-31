# Staging Hammielion

Project Docker `hammielion-staging` memakai database `petshop_staging` dan jaringan
`hammielion_default` yang sudah ada. Tidak membuat Postgres/Caddy kedua dan tidak membuka port
aplikasi ke host. Gerbang Caddy bersama memakai Basic Auth serta menolak pintu job dari luar.

## Berkas server

Di `/srv/hammielion-staging`, siapkan `.env`, `backoffice.env`, `order-web.env`, `hris.env`, dan
`migrator.env` dari contoh masing-masing. Folder mode 700, semua berkas env mode 600.
Password URL aplikasi harus sama dengan `STG_*_DB_PASSWORD` yang bersesuaian di `migrator.env`.
Gunakan rahasia staging tersendiri; portal memakai OTP console agar tidak mengirim WhatsApp toko.

Pipeline menyalin berkas staging ke folder ini dan cron bersama ke `cron/`.
`STAGING_CRON_DIR=./cron` dipakai di VPS; bila menjalankan compose langsung dari repo, gunakan
`STAGING_CRON_DIR=../apps/cron`.

## Auth pusat (HRIS L1)

Bawaan staging adalah `legacy`: deploy tidak mengubah login. Mode `central` diaktifkan lewat
`STAGING_BO_AUTH_MODE=central` di `.env` bersama `STAGING_AUTH_COOKIE_DOMAIN`, `STAGING_BO_ORIGIN`,
`STAGING_HRIS_ORIGIN`, `STAGING_BO_CSRF_SECRET`, `STAGING_HRIS_CSRF_SECRET`, dan
`STAGING_HRIS_INTERNAL_KEY` (rahasia baru khusus staging, masing-masing berbeda). `check-env.mjs`
menolak konfigurasi central yang tidak terkunci ke `staginghml.my.id`. Langkah lengkap, uji owner,
dan rollback: [spec L1e](../../docs/work/specs/2026-11-01-hris-l1e-rollout-design.md) dan
[runbook](../../docs/ops/auth-pusat.md).

## Aktivasi pertama

Urutan ini dikerjakan setelah owner menyetujui aktivasi/push perubahan staging:

1. Cadangkan database produksi dengan prosedur backup server yang sudah ada.
2. Periksa pemilik dan pengguna database produksi. Bila akses `CONNECT` masih diwariskan dari
   `PUBLIC`, atas izin owner jalankan `REVOKE CONNECT ON DATABASE petshop_db FROM PUBLIC` dan
   pastikan admin/pengguna produksi yang sah tetap bisa masuk. Jangan mengubah password atau
   menjalankan migrasi skema produksi hanya untuk menutup akses tersebut.
3. Pasang berkas staging dan isi env dengan password role, kunci sesi/job, serta Basic Auth baru.
   Jangan menyalin berkas env produksi. Pastikan semua nama target tetap `petshop_staging`.
4. Dari `/srv/hammielion-staging`, jalankan `bash refresh-db.sh --bootstrap`. Ini hanya boleh
   saat database staging **belum ada**: dump sumber divalidasi, database staging dibuat dan diisi,
   `PUBLIC CONNECT` staging dicabut. Belum ada migrasi, role staging, atau aplikasi yang dijalankan;
   image staging belum dibutuhkan. Mode ini menolak staging yang sudah ada tanpa menimpanya.
5. Siapkan prasyarat gateway produksi: import opsional `/data/staging-sites*.caddy` dan mount volume
   upload staging. Terapkan konfigurasi dengan membuat ulang **hanya Caddy**; aplikasi toko tidak
   dimulai ulang. Konfigurasi gateway staging baru dipasang sesudah health gate deployment.
6. Setelah izin push owner, dorong branch `staging` untuk membangun image dan menjalankan workflow.
   Migrator memeriksa URL, menerapkan migrasi/role staging, lalu aplikasi dan cron dinyalakan.
   Gerbang Basic Auth dipasang terakhir. Verifikasi role `stg_*` ditolak saat mencoba database produksi.

Bootstrap yang gagal setelah membuat database meninggalkan staging belum siap; jangan menimpa
database tersebut secara otomatis. Periksa error dan selesaikan pemulihannya sebelum deploy.
Sesudah aktivasi pertama, gunakan refresh biasa di bawah ini; `--check` memerlukan image migrator
staging yang sudah dibangun/ditarik.

## Deploy

Push ke branch `staging` membangun empat image bertanda `staging-<SHA>` lalu menjalankan
`deploy.sh`. Workflow manual hanya berlaku bila dipanggil pada branch `staging`.
Target database/role diperiksa sebelum migrasi. Deploy menunggu ketiga aplikasi sehat sebelum
memasang gerbang lewat `configure-gateway.py`, kemudian menyimpan tag dalam `.env`.
Sisa image hanya dibersihkan pada tag `staging-*`, menyimpan enam image terbaru per aplikasi.

## Salin ulang database secara manual

Jalankan sebagai root di folder server:

```bash
bash refresh-db.sh --check
bash refresh-db.sh
```

`--check` memeriksa konfigurasi dan identitas container tanpa menyalin/mengganti database.
Perintah kedua mengganti **seluruh** database staging dari snapshot produksi, termasuk menimpa
data percobaan HRIS. Aplikasi staging dihentikan hanya setelah dump sumber tersedia dan daftar
isinya valid. Kegagalan restore/migrasi membuat staging tetap berhenti; dump disimpan privat
di `backups/` untuk pemeriksaan/pemulihan. Produksi tidak dihentikan atau ditulis.
Refresh tidak dipanggil otomatis oleh pipeline deploy.

Nama sumber `petshop_db` dan target `petshop_staging` ditetapkan di skrip; argumen nama database
ditolak. Dump dipulihkan tanpa ownership/ACL produksi, lalu migrator menerapkan hak staging.
Wrapper workflow memegang lock sebelum menyalin konfigurasi dan mewariskannya ke `deploy.sh`.
Deploy manual dan refresh memperoleh lock yang sama agar tidak berjalan bersamaan.

## Pemeriksaan terarah

```bash
node --test infra/staging/check-env.test.mjs infra/staging/refresh-db.test.mjs
python -m unittest discover -s infra/staging -p 'test_*.py'
bash -n infra/staging/deploy.sh infra/staging/refresh-db.sh
```

Tes refresh memakai Docker palsu di folder sementara: tidak menyambung ke server atau database.
