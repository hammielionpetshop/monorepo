### Added
- **Stok cabang pengirim tampil saat memilih produk di form "Buat PO Internal" kasir.** Ketika kasir mencari dan menambahkan produk ke permintaan PO Internal, stok yang tersedia di cabang pengirim langsung terlihat — di hasil pencarian maupun di kolom "Stok" pada daftar item — sehingga permintaan tidak melebihi stok yang ada.
  - Endpoint baru `GET /api/pos/branch-stock?branchId=&productIds=` — meringkas stok sebuah cabang untuk beberapa produk ke base UOM (agregasi `qty × rasio` lintas satuan, pola sama dengan stock-check transfer internal).
  - Angka stok ikut berubah kalau cabang pengirim diganti.
  - Kolom stok bertanda merah bila stok cabang pengirim lebih kecil dari qty yang diminta (dihitung dalam base UOM).
