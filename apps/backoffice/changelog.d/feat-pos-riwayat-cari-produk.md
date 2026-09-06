### Added

- Kotak pencarian di Riwayat Transaksi POS kini juga mencari nama produk, bukan cuma nomor struk. Kasir mengetik "bolt" lalu semua nota yang memuat produk itu muncul, tanpa perlu tahu nomor struknya. Cocok sebagian dan tidak peduli huruf besar/kecil, berlaku di mode Shift Aktif maupun Pilih Tanggal, dan tetap terbatas pada cabang (serta kasir, di mode tanggal) seperti sebelumnya.

### Changed

- Aturan pencocokan nama produk dipindahkan ke `lib/transaction-search.ts` dan dipakai bersama oleh Riwayat Transaksi back office dan POS, supaya kata kunci yang sama menghasilkan daftar nota yang sama di kedua layar.

### Fixed

- Penyaringan instan di sisi kasir tidak lagi membuang nota yang sudah dicocokkan server lewat nama produk di master — dulu daftar bisa tampak kosong padahal servernya menemukan hasil.
