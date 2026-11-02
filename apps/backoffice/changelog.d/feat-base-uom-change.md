### Added
- **Ganti satuan dasar barang dalam 1 klik di Inventori › Migrasi Satuan Stok.** Untuk barang yang satuan dasarnya keliru terpasang satuan besar (mis. SAK), padahal seharusnya satuan terkecil (mis. PCS). Admin cukup memilih barang, satuan dasar baru, dan isi "1 SAK = berapa PCS", melihat pratinjau, mengetik nama barang sebagai konfirmasi, lalu klik Jalankan. Semuanya dikerjakan dalam satu transaksi (semua berhasil atau tidak ada yang berubah):
  - stok semua cabang dikali isi; batch stok: sisa dikali, modal dibagi. Tanggal kedaluwarsa, urutan FIFO, dan tautan PO/transfer tetap utuh;
  - modal di Manajemen Harga untuk satuan baru diisi otomatis; harga jual satuan lama tetap;
  - konversi satuan ditata ulang (satuan lama jadi satuan besar, satuan besar lain ikut dikali);
  - riwayat yang tidak mencatat satuannya sendiri (penyesuaian stok, utang stok, jejak sinkron modal, revisi harga beli) ikut dikonversi supaya laporan lama tetap benar. Nota, PO, transfer, dan opname lama tidak diubah;
  - tercatat di audit log (`BASE_UOM_CHANGE`) lengkap dengan nilai sebelumnya.
  - Pratinjau menampilkan stok per cabang, batch, konversi, modal, nilai stok sebelum/sesudah (selisih pembulatan, bila ada), dan harga jual satuan baru yang perlu diisi. Harga jual satuan baru sengaja dikosongkan (keputusan owner). Setelah selesai, layar menampilkan daftar cabang dan kelas harga yang harus diisi, beserta tombol ke Manajemen Harga.
  - Ditolak dengan pesan jelas bila barang masih ada di Stock Opname yang belum selesai, ada modal yang menunggu ditinjau, data konversi/stok lama rusak, atau stok berubah sejak pratinjau.
  - Panduan langkah demi langkah tampil di halaman, dan versi lengkapnya ada di `docs/panduan/ganti-satuan-dasar.md`.

### Changed
- Pesan "Satuan dasar tidak bisa diubah" di Master Produk kini mengarahkan ke menu Inventori › Migrasi Satuan Stok.

### Removed
- Tombol "Pindahkan" (sudah lama dinonaktifkan karena hitungannya dobel) dan "Hapus baris kosong" di halaman Migrasi Satuan Stok, beserta endpoint lamanya. Keduanya diganti alur ganti satuan dasar di atas.
