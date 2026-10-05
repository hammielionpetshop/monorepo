### Added

- Purchase Order bisa disimpan sebagai **PDF** atau **foto (PNG)** dari halaman detail PO untuk dikirim ke supplier. Dokumen memuat supplier, cabang tujuan, target terima, catatan, dan daftar produk (SKU, qty, satuan) — **tanpa harga satuan dan subtotal**. Setelah PO dibuat, pengguna langsung diarahkan ke halaman detail PO tersebut.
- Tombol **Cocokkan Harga Faktur** di detail PO (OWNER/GM) setelah barang diterima: isi nomor faktur dan harga faktur per produk, lengkap dengan selisih terhadap harga PO. Harga faktur dipakai sebagai modal saat penerimaan disetujui; bila penerimaan sudah disetujui, modal diperbarui lewat sinkron modal seperti biasa.

### Changed

- Form Buat Purchase Order: pencarian produk kini memakai jendela pilih produk seperti Bulk Sale (cari beberapa kata dalam urutan bebas, ↑ ↓ + Enter, jendela tetap terbuka untuk produk berikutnya), menampilkan satuan beserta modal terakhir dan stok cabang tujuan. Cabang dipilih lebih dulu sebelum menambah produk.
- Satuan default tiap produk di PO = satuan terbesar (mis. SAK/DUS), dan harga satuan otomatis terisi modal terakhir satuan itu di cabang tujuan (diturunkan lewat rasio bila satuan itu belum bermodal). Mengganti satuan mengisi ulang harganya.

### Fixed

- Simpan harga faktur PO: cakupan cabang terbalik — OWNER/GM sebelumnya hanya bisa menyimpan faktur PO cabang yang sedang aktif di sesinya, sementara staf cabang bisa menyentuh PO cabang lain.
