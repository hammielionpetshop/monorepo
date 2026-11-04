<!-- tayang: 2026-11-04 22:40 -->
### Added

- **Logistik › Trip: surat jalan masuk trip.** Di form Buat/Ubah trip ada langkah **Surat jalan**: centang nota dan PO Internal yang menunggu dikirim (bisa disaring ke rute trip, dicari, atau dicentang semua sekaligus). Satu toko = satu kunjungan. Nota dari cabang selain Gudang (mis. Toko Pusat) otomatis membuat langkah **Ambil barang di [cabang]**. Trip yang membawa surat jalan wajib punya rute kirim; trip tanpa surat jalan tetap boleh selama masa peralihan.
- **Rincian trip: bagian Surat jalan.** Menampilkan langkah ambil barang dan kunjungan per tujuan beserta nomor nota/PO, nominal, dan tanda **Berubah di kasir** / **Dibatalkan di kasir** bila nota dikoreksi atau dibatalkan sesudah masuk trip. Kantor bisa menekan **Lepas** (wajib alasan) untuk mengeluarkan satu tujuan; surat jalannya kembali ke Menunggu dikirim.
- **Trip Saya: Ambil barang.** Driver atau kenek menandai **Barang sudah diambil** di cabang asal dengan satu foto barang yang diterima. Daftar tujuan dan nota trip ikut tampil di HP.
- **Surat Jalan: tab Dalam perjalanan** berisi surat jalan yang sedang di trip beserta nomor trip-nya. Surat jalan yang pernah kembali dari trip bertanda **Pernah tertunda ×n**.
- **Rekap Kehadiran: tabel Lewat trip** untuk driver dan kenek: jumlah hari Jalan, jumlah trip, dan hari Tidak jalan dalam periode.

### Changed

- Trip yang ditutup (Sampai Garasi atau ditutup kantor) sebelum kunjungannya diproses mengembalikan surat jalannya ke **Menunggu dikirim** bertanda tertunda. Batal trip Draft juga mengembalikan semua surat jalannya. (Tombol Terkirim / Kirim Besok / Gagal di HP driver menyusul di LT1b-2.)
