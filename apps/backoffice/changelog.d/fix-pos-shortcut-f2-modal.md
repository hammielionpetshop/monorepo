### Fixed

- **Shortcut F2 tidak lagi menembus ke panel produk saat modal POS terbuka.** Panel produk
  memasang listener `keydown` di `window` untuk F2 (fokus kotak cari) dan buffer barcode
  scanner, tanpa tahu ada modal di atasnya — jadi saat modal pembayaran dibuka, F2 yang
  dimaksudkan sebagai pecahan tunai Rp 20.000 ikut memindahkan fokus ke kotak cari di
  belakang modal, dan kasir kehilangan tempat mengetik nominal. Sekarang ada kunci
  bersama (`components/pos/shortcut-lock.ts`): setiap modal yang butuh keyboard mengambil
  kunci selama terpasang, dan shortcut latar — F2 serta buffer scanner di panel produk,
  F8/F9/F10 di `pos-client` — berhenti diproses selama kunci dipegang. Kuncinya dihitung,
  bukan boolean, supaya modal bertumpuk (dialog UOM di atas panel produk) baru melepas
  setelah lapis terakhir tertutup. Efek sampingnya: F8/F9/F10 yang dulu masih menyala di
  balik dialog Expense (dialog itu terlewat dari daftar pengecualian manual) sekarang ikut
  terkunci. Setelah modal ditutup, semua shortcut kembali normal.
