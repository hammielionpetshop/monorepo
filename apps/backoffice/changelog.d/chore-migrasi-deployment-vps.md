### Added

- Deployment backoffice & order-web sebagai container Docker di VPS sendiri: `infra/apps/` (Dockerfile, docker-compose, Caddyfile, contoh env) dan workflow `deploy-vps.yml` yang membangun image di GitHub Actions lalu mendorongnya ke GHCR. Caddy mengurus sertifikat HTTPS otomatis.
- Endpoint `/api/health` di order-web, dipakai gerbang sehat saat deploy — sebelumnya hanya backoffice yang punya.
- `DB_POOL_MAX` untuk menyetel batas koneksi pool tanpa membangun ulang image.

### Changed

- Halaman portal pelanggan (katalog, keranjang, checkout, pesanan) kini dirender per permintaan, bukan dibekukan saat build. Nama toko yang berubah langsung terlihat tanpa deploy ulang.
- Batas koneksi DB tiap app naik dari 3 ke 10. Angka lama dipilih karena serverless membuat tiap instance punya pool sendiri; di server sendiri jumlah prosesnya tetap, jadi 10 + 10 benar-benar 20 koneksi.
- Deploy otomatis ke Vercel dimatikan (workflow-nya disisakan untuk dijalankan manual sebagai jalur rollback selama masa peralihan).

### Fixed

- Lampiran yang diunggah dari POS kini benar-benar tersimpan. Di Vercel berkasnya hilang begitu instance-nya berganti; sekarang ditulis ke penyimpanan tetap dan disajikan langsung oleh web server.
