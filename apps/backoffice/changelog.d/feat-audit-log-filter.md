### Changed

- **Audit Log — filter aksi lengkap.** Dropdown Aksi kini memuat semua aksi yang dicatat sistem (transaksi, void, retur, stok, stock opname, PO, harga, pengeluaran shift, hutang, pengguna), dikelompokkan dan berlabel Bahasa Indonesia. Aksi lama yang masih ada di data tapi tidak lagi ditulis sistem muncul di grup "Lainnya". Kolom Aksi di tabel ikut memakai label yang sama; kode aslinya tetap terlihat di detail.

### Added

- **Audit Log — filter cabang.** Pengguna dengan cakupan semua cabang bisa memfilter log per cabang. Pengguna lain otomatis hanya melihat log cabangnya sendiri (sebelumnya API audit log tidak memeriksa sesi maupun cakupan cabang).
