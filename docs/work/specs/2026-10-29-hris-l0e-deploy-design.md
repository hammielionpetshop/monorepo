---
title: 'HRIS L0e — deploy dan staging'
type: feature
created: '2026-10-29'
status: done
baseline_commit: 4c1360cfe735ddb19a1b03013f7496b44e957675
context:
  - docs/work/specs/2026-10-29-hris-l0-foundation-design.md
  - docs/work/plans/2026-10-29-hris-l0-foundation.md
---

<frozen-after-approval reason="L0 disetujui 2026-10-29; domain dan kelanjutan L0e disetujui owner di sesi ini">

## Intent

Sediakan staging di `bo.staginghml.my.id`, `hris.staginghml.my.id`, dan
`order.staginghml.my.id`. DNS wildcard sudah disiapkan owner dan ketiga nama sudah terbukti
menunjuk ke VPS yang sama. Staging memakai salinan data produksi dalam database terpisah,
gerbang kata sandi, dan deployment tersendiri agar HRIS dapat dicoba sebelum produksi.

## Batasan

- Produksi tetap memakai domain, data, dan kredensialnya sendiri; HRIS produksi dipagari profil.
- Refresh hanya membaca produksi dan hanya boleh mengganti `petshop_staging`.
- Aplikasi staging memakai role `stg_*`, kunci sesi berbeda, OTP console dan tanpa kredensial WA/QZ produksi.
- Foto/unggahan staging terpisah; foto HRIS tidak disajikan langsung ke internet.
- Caddy bersama menolak endpoint job dari luar; hanya cron internal yang memanggilnya.
- Push ke main yang mengubah aplikasi/infra memicu deploy toko dan memerlukan izin per perubahan
  sesuai aturan proyek. Persiapan dilakukan sampai konfigurasi dan verifikasi dapat ditinjau.

## Skenario

| Kondisi | Hasil yang diharapkan |
|---|---|
| Compose produksi biasa | HRIS dan cron tidak menyala |
| Staging dimulai | ketiga aplikasi memakai petshop_staging dan volume tersendiri |
| URL/role staging salah | preflight gagal sebelum migrasi atau reset database |
| Dump produksi gagal | database staging lama tidak dihapus |
| Role staging mencoba produksi | koneksi ditolak |
| Pengunjung tanpa akses gerbang | HTTP 401, termasuk berkas upload |
| Endpoint jobs publik | HTTP 404, dengan atau tanpa akses gerbang |
| Konfigurasi Caddy baru tidak valid | konfigurasi sebelumnya dikembalikan |
| Push staging | hanya tag staging-SHA dibangun; project produksi tidak dimulai ulang |

</frozen-after-approval>

## Code Map

- `infra/staging/docker-compose.yml`: project, volume, role dan batas sumber daya staging.
- `infra/staging/check-env.mjs`: batas kepercayaan URL/role sebelum migrasi.
- `infra/staging/refresh-db.sh`: salinan database manual dengan validasi sebelum reset.
- `infra/staging/deploy.sh`: serialisasi, migrasi staging, gerbang sehat, tag deployment.
- `infra/staging/configure-gateway.py`: fragment Caddy opsional dengan basic auth dan rollback.
- `.github/workflows/deploy-staging.yml`: build dan kirim ke project staging.
- `infra/apps/{docker-compose.yml,Caddyfile,Dockerfile}`: layanan HRIS opt-in dan koneksi gateway.
- `.github/workflows/deploy-vps.yml`: bangun image HRIS, salin cron, tanpa aktivasi HRIS otomatis.
- `apps/order-web/lib/db.ts`: pool portal enam koneksi.

## Tasks

- [x] Konfigurasi compose/pipeline, pool koneksi, HRIS produksi opt-in.
- [x] Guard refresh, pemisahan role dan kata sandi staging.
- [x] Gateway staging tertutup, upload terlindungi, job publik ditolak.
- [x] Verifikasi lokal: typecheck, konfigurasi Caddy/compose, build image, tes guard.
- [x] Persiapan server, branch staging, salinan DB dan uji role setelah owner mengizinkan aktivasi.
- [x] Catatan WIP, plan, panduan operasional dan changelog sesuai hasil aktual.

## Catatan Desain

Fragment Caddy disimpan pada volume `/data` yang sudah ada dan diimpor dengan glob opsional.
Domain kosong tidak menghasilkan blok situs rusak. Kredensial tidak diperlukan dalam env
container produksi. Volume unggahan staging di-mount read-only pada Caddy bersama; pemasangan
pertama memerlukan pembuatan ulang Caddy, tanpa memulai ulang aplikasi atau Postgres produksi.

Pool: produksi BO 10, order 6, HRIS 8; staging masing-masing 3 untuk BO/order/HRIS. Total 33,
menyisakan 7 dari max_connections 40 bila seluruh layanan aktif.

## Verifikasi

`pnpm typecheck`, tes guard terarah, Python unittest gateway, validasi compose dengan env dummy,
`caddy validate`, `bash -n`, build Docker HRIS/migrator, changelog, dan pemeriksaan diff.
Suite luas dilewati sesuai aturan proyek.

## Spec Change Log

- Review menemukan konfigurasi staging dapat tertimpa sebelum lock diambil saat refresh berjalan.
  Instalasi konfigurasi dan deploy kini harus berada dalam satu lock yang sama dengan refresh.

## Bukti Verifikasi Lokal

- Typecheck root: 6 task sukses. Guard/refresh: 17 tes lulus; gateway: 3 tes lulus.
- Docker HRIS standalone dan migrator berhasil dibangun. Migrator berjalan sukses pada
  dua database uji terisolasi, termasuk pemisahan role `stg_*`.
- HRIS sebagai `stg_hris_app`: `/api/health` 200. Koneksi role itu ke `petshop_db`: ditolak.
- Caddy runtime: health anonim 401, autentikasi sah 200; upload anonim 401/sah 200;
  job publik 404 dengan maupun tanpa autentikasi. Caddy tanpa fragment staging juga valid.
- Volume upload dibuktikan: setelah Caddy membuat volume kosong, app mengisinya dengan
  owner UID 1001 dan dapat menulis. Tidak perlu tambahan init service.
- Server diperiksa read-only: belum ada staging; schema HRIS produksi belum ada;
  ACL CONNECT produksi masih bawaan. Perubahan aktivasi harus dinyatakan terpisah.
- Tidak ada perubahan server, push, migrasi produksi, atau suite luas pada tahap persiapan.
- Bootstrap awal hanya menerima database staging yang belum ada, memvalidasi dump sebelum
  membuatnya, tanpa image/migrasi/app start. Tes membuktikan DB yang sudah ada ditolak.
- Race deploy/refresh diperbaiki: lock diambil sebelum copy dan FD diwariskan sampai deploy
  selesai. Reakuisisi inherited lock serta penolakan lock pesaing dibuktikan di Docker Debian.

## Suggested Review Order

- Aliran deploy dengan lock, validasi target dan pemeriksaan sehat.
  [deploy.sh:1](../../../infra/staging/deploy.sh#L1)
- Batas database dan role aplikasi staging.
  [check-env.mjs:1](../../../infra/staging/check-env.mjs#L1)
- Dump tervalidasi sebelum database staging diganti.
  [refresh-db.sh:1](../../../infra/staging/refresh-db.sh#L1)
- Gerbang akses dan rollback konfigurasi Caddy.
  [configure-gateway.py:1](../../../infra/staging/configure-gateway.py#L1)
- Layanan serta volume staging terpisah dari produksi.
  [docker-compose.yml:1](../../../infra/staging/docker-compose.yml#L1)

## Hasil Aktivasi 2026-10-29

Owner memberi izin aktivasi sesudah meninjau persiapan. Push branch `staging` menjalankan
[workflow 40829443028](https://github.com/hammielionpetshop/monorepo/actions/runs/40829443028):
empat image dibangun dan deploy sukses, tag `staging-08f81aa589c94e75089c389525aec7899081b730`.

- Backup produksi dibuat dan tervalidasi sebelum snapshot `petshop_staging`.
- Rahasia sesi/job, role dan gerbang staging dibuat baru. Tidak ada kredensial di repo.
- Ketiga role aplikasi dapat membuka staging dan ditolak membuka `petshop_db`.
- Ketiga domain HTTPS terbuka sesudah gerbang Basic Auth; health 200. Tanpa autentikasi 401.
- Upload uji ditulis sebagai pengguna app, anonim 401 dan akses sah 200; berkas uji dibersihkan.
- Job publik ditolak 404 dengan maupun tanpa autentikasi; cron internal mencatat SUCCEEDED.
- Caddy diperbarui dengan image server yang sama, hanya menambah import dan mount staging.
  ID container aplikasi dan Postgres produksi tidak berubah; health publik keduanya tetap 200.
- ACL CONNECT produksi menolak PUBLIC; akun admin tetap sama. Tidak ada migrasi skema produksi
  dan service HRIS produksi tetap tidak aktif.

Staging **aktif — menunggu uji coba owner**. HRIS L0 hanya halaman fondasi; modul pengguna dimulai L1.
