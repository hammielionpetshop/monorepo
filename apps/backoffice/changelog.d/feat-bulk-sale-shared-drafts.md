### Changed

- Bulk Sale → **Daftar Tunggu kini terlihat oleh semua admin di cabang yang sama** (seperti Daftar Tunggu POS), tidak lagi hanya oleh ID yang menahan. Tiap draf menampilkan **"Ditahan oleh …"**, dan admin lain secabang bisa melanjutkan atau menghapusnya supaya stok yang ditahan lepas. Sebelumnya draf satu ID menahan stok (stok tampak kosong) tanpa bisa dilihat admin lain. OWNER/GM melihat draf semua cabang.
- Daftar Tunggu Bulk Sale dimuat ulang setiap kali dibuka, supaya draf yang baru ditahan atau dilanjutkan admin lain langsung terlihat.

### Fixed

- Bulk Sale → **Lanjutkan** draf tidak lagi memunculkan "Stok kurang … ditahan Daftar Tunggu" untuk barang draf itu sendiri: draf dihapus dari daftar tunggu dulu, baru stok dimuat.
- Dua admin yang menekan **Lanjutkan** pada draf yang sama tidak bisa membuat nota ganda — yang kedua mendapat pesan "sudah dilanjutkan atau dihapus admin lain".
