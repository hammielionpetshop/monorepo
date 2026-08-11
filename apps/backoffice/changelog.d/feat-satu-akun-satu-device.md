### Added

- **Satu akun hanya bisa aktif di satu perangkat.** Login di perangkat baru mencabut sesi di perangkat lama, dan token lamanya mati **seketika** — bukan menunggu kedaluwarsa. Tabel baru `user_sessions` (migrasi `0014`) menyimpan sesi aktif per user; JWT membawa `sessionId`, dan `verifyAccessToken` memeriksa sesinya di setiap request.
  - Yang berhak merebut sesi adalah pemilik akun itu sendiri, tanpa persetujuan siapa pun — kasus lazimnya justru perangkat lama sudah tidak di tangannya.
  - **Perangkat yang terlempar keluar diberi tahu alasannya**: halaman login menampilkan "Akun Anda dipakai di perangkat lain", bukan sekadar mendarat di layar login tanpa penjelasan.
  - **Logout kini benar-benar mencabut sesi**, bukan cuma menghapus cookie. Sebelumnya token yang sama masih sah sampai kedaluwarsa, jadi siapa pun yang sempat menyalinnya tetap bisa masuk setelah pemiliknya "keluar".
  - Riwayat sesi tidak pernah dihapus — kapan sebuah akun berpindah perangkat ikut tercatat, lengkap dengan ringkasan perangkatnya (mis. `Chrome / Android`).

### Fixed

- **Token yang sudah terbit tidak bisa dibatalkan sama sekali.** Auth memakai JWT stateless di cookie tanpa tabel sesi mana pun, sehingga tidak ada satu tombol pun di sistem yang bisa memutus sesi — token tetap sah sepenuhnya selama 1 hari, termasuk di perangkat yang hilang, dipinjam, atau ditinggal login di rumah orang. Sekarang sesi bisa dicabut dan efeknya seketika.

### Changed

- **`middleware.ts` memakai verifikasi tanda tangan saja (`verifyAccessTokenSignatureOnly`).** Middleware berjalan di Edge runtime dan tidak bisa memanggil Postgres, jadi cek sesi mustahil dilakukan di sana. Middleware tetap hanya mengatur pengalihan (role guard, gerbang onboarding & ganti PIN); gerbang keamanan sesungguhnya ada di `verifyAccessToken` yang dilewati setiap halaman dan route handler.
  - Cek sesi sengaja ditaruh di `verifyAccessToken` — **97 berkas memanggilnya langsung**, di samping `getAuth()` dan `verifyAccessTokenCached`. Ditaruh di lapisan atas, sebagian jalur akan memeriksa sesi dan sebagian tidak, dan yang tidak memeriksa tetap melayani token yang sudah dicabut tanpa error yang kelihatan.
  - Ongkosnya satu `SELECT` ber-index per request, di-dedupe per render lewat `cache()` React, melalui PgBouncer yang sudah terpasang.
- **Sesi tercabut diantar lewat `GET /api/auth/session-ended`** yang membersihkan cookie lalu mengarahkan ke login. Tanpa langkah ini terjadi lingkaran: middleware (yang cuma melihat tanda tangan) menganggap orangnya masih login dan memantulkannya dari `/login` kembali ke aplikasi, sementara aplikasi memantulkannya lagi ke `/login`. Hanya route handler yang boleh menghapus cookie, jadi lingkarannya tidak bisa diputus dari server component.
- **Token lama tanpa `sessionId` tetap diterima sampai kedaluwarsa sendiri.** Disengaja: kalau ditolak, deploy migrasi ini akan melempar keluar semua orang yang sedang bekerja saat itu juga. Begitu mereka login ulang, sesinya terdaftar dan aturan satu-perangkat mulai berlaku.
