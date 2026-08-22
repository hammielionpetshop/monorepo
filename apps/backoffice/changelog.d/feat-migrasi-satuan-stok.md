### Added
- **Halaman baru "Migrasi Satuan Stok" (Inventori) untuk membereskan stok yang menghalangi ganti satuan dasar produk.** Sebelumnya pesan error "Satuan dasar tidak bisa diubah — masih ada baris stok/batch pada satuan lama" tidak punya jalan penyelesaian di UI: Penyesuaian Stok hanya bisa menge-nol-kan qty tanpa menghapus barisnya, dan tidak ada fitur untuk memindahkan stok antar satuan.
  - Cari produk, lihat semua baris stok & batch per cabang/satuan sekaligus.
  - **Hapus baris kosong** (qty = 0 di stok maupun semua batch) — tidak pernah menghapus stok yang masih bermuatan.
  - **Pindahkan stok ke satuan lain** dengan rasio konversi manual: qty stok & batch dikalikan rasio, harga modal per batch dibagi rasio, baris dialihkan ke `uomId` baru dalam satu transaksi + tercatat di audit log.
  - Dibatasi role OWNER/GM (permission `master.product.manage`), sama seperti yang menjaga endpoint ganti satuan dasar produk.
