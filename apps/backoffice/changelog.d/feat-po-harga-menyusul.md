### Added
- **PO bisa dibuat dengan harga beli menyusul (kanban #49).** Untuk supplier yang mengirim barang lebih dulu dan invoice belakangan, kolom Harga Satuan di form Buat PO boleh dikosongkan (ada tombol "Kosongkan semua harga"). Barang tetap bisa diterima dan disetujui seperti biasa.
  - Selama harga belum diisi, batch stok dari PO itu memakai modal terakhir produk sebagai perkiraan (bukan Rp 0), supaya HPP penjualan sementara tidak nol. Hutang supplier untuk item tersebut tercatat Rp 0 sampai harganya diisi.
  - Tab baru **Harga Belum Diisi** di daftar Purchase Order, plus badge "Harga belum diisi (N item)" di kolom status dan banner di halaman detail PO.
  - Tombol **Isi Harga Beli** di detail PO (form Cocokkan Harga Faktur yang sudah ada) mengisi harga sebenarnya.

### Changed
- **Jendela pilih produk di Bulk Sale dan Purchase Order tidak menutup sendiri.** Setelah produk dipilih, jendela tetap terbuka untuk produk berikutnya dan baru tertutup lewat tombol **Selesai** atau Esc; klik di luar jendela tidak lagi menutupnya. Produk yang barusan dimasukkan ditampilkan di jendela, dan di Bulk Sale baris yang sudah ada di daftar ditandai.
- **Harga faktur kini ikut mengganti modal batch stok dari PO itu.** Sebelumnya mengisi/mengubah harga faktur setelah penerimaan disetujui hanya memperbarui modal di Manajemen Harga dan hutang supplier, sementara batch stok tetap bermodal harga PO. Perubahan modal batch dicatat di audit log (`PO_INVOICE_BATCH_COST`). Porsi stok yang sudah terjual sebelum harga faktur diisi tetap ber-HPP perkiraan.
