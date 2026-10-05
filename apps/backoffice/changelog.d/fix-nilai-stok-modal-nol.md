### Added

- Laporan Nilai & Stok Produk: panel "batch stok bermodal Rp 0" dengan tombol **Hitung modal otomatis** (OWNER/GM, izin Koreksi Modal Batch Stok). Pratinjau menampilkan usulan modal per satuan dasar beserta asal angkanya (modal satuan dasar → modal satuan besar ÷ rasio → modal default produk → modal cabang lain). Usulan yang wajar dicentang otomatis; yang mencurigakan (modal cabang lain, modal ≥ harga jual, atau jauh di atas batch lain) tidak dicentang supaya diperiksa dulu. Hanya batch yang modalnya masih 0 yang diubah, dan setiap perubahan tercatat di log audit.
- Filter **Status Stok → Stok habis (untuk order)** di Nilai & Stok Produk: menampilkan produk yang stok POS-nya 0 atau minus per cabang, untuk daftar pesanan ke supplier. Ikut ke Export CSV.

### Fixed

- Stock opname dan penyesuaian stok tidak lagi membuat batch bermodal Rp 0 hanya karena modal di Manajemen Harga diisi di satuan besar (SAK/DUS) dan bukan di satuan dasar. Modal batch baru kini diambil berurutan dari modal satuan dasar, modal satuan besar ÷ rasio, lalu modal default produk — sama dengan perhitungan HPP penjualan.
