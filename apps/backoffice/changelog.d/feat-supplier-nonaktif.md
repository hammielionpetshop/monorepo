### Added
- **Supplier aktif/nonaktif** (Master Data → Supplier): kolom Status dan tombol **Nonaktifkan / Aktifkan** dengan jendela konfirmasi wajib pilih; setiap perubahan tercatat di audit (`SUPPLIER_DEACTIVATE` / `SUPPLIER_ACTIVATE`). Supplier nonaktif tidak muncul di pilihan **PO baru** dan **Retur ke Supplier**, dan server menolak dokumen baru dengan supplier nonaktif. PO, hutang, dan riwayat lama tetap utuh dan tetap menampilkan nama supplier tersebut.

### Changed
- Supplier bawaan sistem lama **Gudang**, **Repack**, dan **Return** dinonaktifkan (keputusan owner): pasokan dari Gudang lewat PO Internal, Repack dulu dipakai untuk memecah SAK → PCS, Return dulu dipakai untuk mengumpulkan barang retur.
