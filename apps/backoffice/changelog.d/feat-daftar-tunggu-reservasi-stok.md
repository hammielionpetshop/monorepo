### Added

- Daftar Tunggu kini menahan stok (reservasi, kanban #56): barang yang sedang ditahan di Daftar Tunggu POS maupun Bulk Sale cabang yang sama dihitung sebagai "ditahan".
  - Pencarian produk POS menampilkan "Stok · ditahan · tersedia", dan memperingatkan bila seluruh stok sudah ditahan.
  - Pencarian produk Bulk Sale menampilkan qty ditahan & tersedia; peringatan "Stok kurang" di baris Bulk Sale ikut memperhitungkan yang ditahan.
  - Stok fisik, FIFO, dan HPP tidak berubah — reservasi otomatis lepas begitu daftar tunggu dilanjutkan atau dihapus.
