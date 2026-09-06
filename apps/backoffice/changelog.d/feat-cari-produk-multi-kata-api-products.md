### Changed

- `GET /api/products` memakai aturan pencarian yang sama dengan POS: kata kunci dipecah per spasi dan semua potongan harus cocok, jadi urutan kata tidak lagi menentukan. Berlaku untuk pemilih produk di modal Salin Harga, dialog Buat PO, dan halaman Barang Rusak POS — "crystal tuna" kini menemukan CRYSTAL PC TUNA MACKAREL yang sebelumnya tidak ketemu. Filter kategori, SKU, dan barcode berperilaku seperti sebelumnya.
