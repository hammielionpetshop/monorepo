### Added

- **Staf bisa ditugaskan di lebih dari satu cabang, dan memilih cabang aktifnya sendiri.** Sebelumnya `users.branch_id` tunggal: staf yang hari ini di cabang A dan besok di cabang B harus diubah datanya setiap kali pindah. Tabel baru `user_branch_assignments` (migrasi `0013`) menentukan cabang mana saja yang boleh dijadikan cabang aktif; yang aktif tetap **satu** pada satu waktu.
  - Penugasan diatur di **Pengaturan → Pengguna**: pilihan "Cabang" kini bernama **"Cabang utama"**, ditambah daftar centang **"Cabang tugas lain"**. Cabang utama selalu ikut tanpa perlu dicentang. Daftar pengguna menampilkan penanda `+N cabang` (nama lengkapnya di tooltip) supaya dua staf dengan cabang utama sama tidak terlihat identik padahal cakupannya berbeda.
  - **Backoffice** mendapat pemilih cabang di header, muncul hanya bagi yang punya lebih dari satu cabang.
  - JWT membawa `branchIds` (daftar cabang yang boleh). Bersifat additif — sesi lama tanpa field ini diperlakukan sebagai cabang utamanya saja, persis perilaku sebelumnya. **Semua user perlu login ulang** agar penugasannya masuk ke token.
  - Migrasi mem-backfill satu baris per user dari `users.branch_id`, sehingga tidak ada yang kehilangan akses ke cabangnya sendiri. `users.branch_id` sengaja **dipertahankan** sebagai cabang utama: ±470 pemakaian `branchId` sudah benar artinya ("cabang yang sedang dikerjakan"), dan membongkarnya tidak membuat satu pun jadi lebih benar.

### Fixed

- **Celah otorisasi: pemilihan cabang POS menerima cabang mana pun.** `POST /api/pos/set-branch` hanya memeriksa `role ∈ (OWNER, GM, MANAGER)` lalu menyetel cookie `posBranchId` ke cabang apa pun yang dikirim, tanpa memeriksa hubungan orang itu dengan cabang tujuannya. MANAGER cabang A bisa menyetel cookie ke cabang B, dan sejak itu **seluruh** POS-nya — transaksi, stock opname, penerimaan barang — tercatat di cabang yang bukan wewenangnya. Gerbangnya kini penugasan cabang, bukan role, dan cookie diperiksa ulang di setiap pembacaan (`lib/active-branch.ts`): cookie yang menunjuk cabang bukan haknya jatuh ke cabang utama, bukan diterima.

### Changed

- **Ganti cabang aktif ditolak selama masih ada shift terbuka atas nama orang itu** (409, di POS maupun backoffice). Tanpa ini satu shift bisa berisi transaksi dua cabang: kas yang masuk di cabang A disettle bersama penjualan cabang B, dan selisihnya tidak bisa ditelusuri ke mana pun.
- **Cabang aktif backoffice disimpan di token, bukan cookie terpisah.** Hanya 31 berkas backoffice yang membaca cabang lewat `getAuth()`; 42 lainnya memanggil `verifyAccessToken` sendiri (32 di antaranya memakai `branchId`). Cookie terpisah berarti hanya sebagian layar ikut berpindah dan sisanya diam-diam tetap di cabang asal — tanpa error apa pun. Menaruh cabang aktif di token membuat semua pembaca ikut tanpa kecuali; berpindah cabang menandatangani ulang token, dan `permissions`/`role` tidak ikut berubah.
- **Layar pilih cabang POS menampilkan alasan penolakan yang sebenarnya** (mis. "Masih ada shift terbuka…"), bukan lagi "Terjadi kesalahan" yang menelan pesan server.
- **`apps/backoffice` kini menjalankan test-nya.** Paket itu punya `vitest.config.ts` tapi tidak punya script `test`, sehingga 424 test yang sudah ada di dalamnya tidak pernah dijalankan `pnpm test` maupun CI. Ditambahkan; seluruhnya lulus.
