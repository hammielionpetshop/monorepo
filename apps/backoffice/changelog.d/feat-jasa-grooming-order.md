### Added
- **Mesin pencatatan grooming (belum ada layarnya).** Nota yang dibuat dari tab Grooming nanti membawa data per ekor: kucing, groomer, dan kondisi kucing saat diterima. Tiap ekor tercatat sendiri dengan nomor karcis (nomor nota / urutan) dan status Dikerjakan → Diambil.
  - Data yang tidak sah (kucing bukan milik pelanggan di nota, groomer atau kucing nonaktif, lebih dari satu ekor per baris, tanpa pelanggan) membatalkan seluruh nota — tidak ada nota grooming setengah jadi.
  - Nota dibatalkan → semua grooming di nota itu ikut batal. Baris jasa diretur → grooming itu batal; bila returnya dibatalkan, grooming pulih.
  - Daftar grooming per cabang menampilkan LUNAS / BELUM LUNAS dari piutang nota; kucing boleh ditandai diambil walau belum lunas.
  - Cetak karcis dihitung, supaya cetak ulang bisa diberi tanda.
- **Izin baru** "Terima & Serahkan Kucing Grooming" (Owner, GM, Manager, Kasir).
