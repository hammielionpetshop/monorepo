### Changed

- Database pindah ke server yang sama dengan aplikasi. Sebelumnya setiap query menyeberang internet ke server lama; sekarang tidak pernah meninggalkan mesin, sehingga lebih cepat sekaligus tidak lagi bisa disadap di jalur.

### Added

- Cadangan database harian otomatis, disimpan 14 hari terakhir. Sebelumnya tidak ada cadangan terjadwal di sisi aplikasi.

### Added

- Halaman **Pengaturan → WhatsApp** (khusus OWNER) untuk menautkan nomor WhatsApp toko yang mengirim kode OTP portal pelanggan. Menampilkan status sesi, kode QR, serta tombol mulai, nyalakan ulang, dan putuskan tautan — sebelumnya penautan hanya bisa lewat akses teknis ke server.

### Fixed

- **Onboarding pasca-reset kredensial menampilkan pesan error saat submit gagal.** Sebelumnya kegagalan `fetch`/parse JSON tertelan `catch` diam-diam dan respons non-OK tanpa `role` membuat halaman navigasi tanpa umpan balik apa pun.
  - Body respons di-parse defensif; pesan error dari backend (401/400/500) ditampilkan apa adanya, fallback `Gagal menyimpan kredensial (HTTP <status>)`.
  - Kegagalan jaringan menampilkan pesan `Gagal menghubungi server: ...` alih-alih pesan generik yang menyesatkan.
  - Banner error diberi `role="alert"` + `aria-live="assertive"` dan auto-scroll+focus agar terlihat di layar kecil dan terbaca screen reader.
