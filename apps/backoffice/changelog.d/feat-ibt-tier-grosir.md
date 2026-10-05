### Changed

- PO Internal yang diproses jadi Bulk Sale (backoffice) maupun dimasukkan ke keranjang kasir kini otomatis memakai harga termurah: **GROSIR**, kalau tidak ada **RESELLER**, dan RETAIL hanya bila keduanya belum diisi. Sebelumnya sering jatuh ke RETAIL (paling mahal). Tier per baris tetap bisa diganti manual.
- Produk yang ditambahkan manual ke Bulk Sale PO Internal, atau satuannya diganti, juga otomatis memakai tier termurah.

### Added

- Bulk Sale PO Internal: baris yang memakai harga RETAIL ditandai kuning ("GROSIR/RESELLER kosong" atau "ada GROSIR lebih murah"), dan banner atas menampilkan berapa item yang memakai RETAIL.
