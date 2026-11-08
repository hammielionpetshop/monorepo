### Added

- **Pendapatan & Pengeluaran (Arus Kas) dirapikan**: setiap catatan kini punya **Tanggal uang** (paling jauh 7 hari ke belakang; lebih dari itu hanya Owner), **Untuk bulan** (mis. sewa Oktober dibayar 1 November), **Cabang yang menanggung** (termasuk "Bersama"), **Dibayar dari / Masuk ke** (Tempat Uang, wajib; laci kasir tidak ditawarkan), dan **Foto bukti** (dianjurkan). Catatan lama bertanda Tempat Uang "belum diketahui".
- Daftar Arus Kas untuk Owner/GM/Finance memuat semua cabang dengan saringan tanggal, cabang, Tempat Uang, dan "tampilkan yang batal".
- **Batalkan catatan** dengan alasan wajib: catatan tetap terlihat bertanda Batal dan tidak dihitung. Pencatat bisa membatalkan catatannya sendiri pada hari yang sama; sesudahnya hanya Owner/GM. Catatan tidak bisa diubah atau dihapus (dijaga database).
- **Jenis laporan kategori**: Biaya / Bukan biaya (pengeluaran), Pendapatan lain / Bukan pendapatan (pemasukan); kategori lama bertanda "Belum dipilih" untuk diisi Owner. Kategori bisa ditambah, diganti nama, dan dinonaktifkan; tipe & jenis hanya bisa diganti selama belum dipakai. Pilihan "Hanya Owner" dan "Catatan wajib" per kategori.
- **Daftar kategori bawaan** (Listrik, Air/PDAM, Internet & pulsa, Perbaikan & perawatan, …, Sewa (sementara), Diambil Owner / pribadi, Modal masuk dari Owner, Pinjaman masuk, dll.).
- **Sambungan kategori Pengeluaran Kasir** ke kategori Arus Kas di layar Kategori (tampilan kasir tidak berubah).

### Changed

- Mencatat Arus Kas kini hanya untuk Owner, GM, dan Finance (hak baru `cashflow.record`); yang lain tetap bisa melihat catatan cabangnya. Staf perlu keluar-masuk lagi agar hak baru terbaca.
