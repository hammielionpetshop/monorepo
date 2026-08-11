### Added

- **Kasir bisa MENGAJUKAN void & koreksi, tidak harus meminta PIN atasan di tempat.** Sebelumnya keduanya hanya punya satu jalur: orang yang berwenang harus hadir di mesin kasir dan mengetikkan PIN-nya. Kalau ia sedang tidak di toko, kasir tidak punya pilihan — notanya dibiarkan salah, atau PIN-nya dipinjam lewat telepon, yang membuat jejak audit mencatat persetujuan dari orang yang tidak ada di sana.
  - Dialog void dan dialog koreksi di POS kini punya **dua pilihan**: `Input PIN` (langsung, seperti sebelumnya) atau `Ajukan persetujuan`.
  - Yang diajukan masuk ke satu daftar bersama di **Pengaturan → Permintaan Persetujuan** (sebelumnya "Persetujuan Void"), dengan penanda jenis `VOID` / `KOREKSI` di tiap baris.
  - Setelah mengajukan, layar POS menyatakan terang-terangan bahwa **notanya belum berubah** — tidak menutup diri seolah pembatalan/koreksinya sudah jadi.
  - Migrasi `0015` menambah `void_requests.kind` (VOID | KOREKSI) dan `void_requests.payload` (muatan koreksi). Baris lama semuanya VOID lewat DEFAULT, tanpa backfill.

### Changed

- **Menyetujui KOREKSI menerapkan muatan yang diajukan, dengan validasi ulang.** Muatan disimpan saat pengajuan dan bisa sudah basi ketika disetujui: nota telanjur di-void, dikoreksi lewat PIN, atau bentuk datanya berubah. Persetujuan memeriksa ulang schema muatan **dan** status transaksi sebelum menerapkan, lalu menolak dengan alasan yang jelas ("minta kasir mengajukan ulang") alih-alih diam-diam menerapkan sesuatu yang berbeda dari yang dilihat kasir.
  - Urutannya klaim → terapkan → kembalikan klaim bila gagal, karena `TransactionEditService.editTransaction` membuka transaksi DB sendiri dan tidak bisa ditumpuk. Klaim memakai `UPDATE ... WHERE status = 'PENDING'` sehingga dua penyetuju yang menekan tombol bersamaan tidak bisa dua-duanya menang — tanpa itu koreksi yang sama bisa diterapkan dua kali dan stok terpotong dobel.
  - Kalau penerapannya gagal, permintaan **dikembalikan ke PENDING**. Kalau tidak, ia tercatat disetujui padahal notanya tidak berubah sama sekali, dan tak seorang pun akan tahu.
- **Peringatan "shift sudah settle" hanya muncul untuk VOID.** Koreksi tidak mengembalikan uang ke pelanggan, jadi tidak ada refund yang perlu dicatat manual — menampilkannya di koreksi hanya menakut-nakuti tanpa sebab.
- **Bentuk data koreksi disatukan di `lib/transaction-edit-schema.ts`**, dipakai bersama oleh koreksi-dengan-PIN, pengajuan, dan penerapan saat disetujui. Pengajuan dan penerapan terpisah waktu; kalau masing-masing punya salinan schema sendiri, keduanya akan menyimpang dan yang lolos saat diajukan bisa ditolak saat diterapkan — atau lebih buruk, sebaliknya.

### Fixed

- **Satu transaksi tidak bisa lagi punya dua permintaan menggantung sekaligus.** Route sudah memeriksanya, tapi cek di aplikasi kalah balapan. Index unik parsial (`status = 'PENDING'`) yang kini menjaminnya — tanpa itu, permintaan void dan koreksi atas nota yang sama bisa sama-sama menunggu, lalu dua orang memutuskan hal yang bertabrakan tanpa saling tahu.
