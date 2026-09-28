### Added

- Ringkasan Stok per Produk: tab baru **Ringkasan Mutasi** di drill-down produk — stok awal, pembelian, transfer masuk/keluar, retur, penjualan bersih (setelah void & koreksi), rusak, opname, penyesuaian, dan stok akhir per cabang untuk periode pilihan (bawaan: awal bulan s.d. hari ini), dalam satuan dasar. Stok awal/akhir dihitung mundur dari stok sistem saat ini.

### Fixed

- Mutasi Stok: item SO Besar yang ditolak tidak lagi ikut tercatat sebagai mutasi opname, item yang dihitung ulang memakai selisih hitung ulang (bukan hitungan pertama), dan jam/pelakunya mengikuti keputusan per item.
- Mutasi Stok: filter tanggal kini benar-benar mengikuti hari WIB. Sebelumnya rentang harinya bergeser ke 07:00–06:59 WIB, sehingga mutasi dini hari (00:00–07:00 WIB) masuk ke tanggal sebelumnya, dan tanggal bawaan halaman masih menunjuk kemarin sebelum pukul 07:00 WIB.
- Mutasi Stok: PO Internal yang diproses lewat Bulk Sale tidak lagi tercatat keluar dua kali (sebagai penjualan sekaligus transfer keluar). Transaksinya kini dicatat sebagai Transfer Keluar, sehingga kolom Penjualan hanya berisi penjualan ke pelanggan dan stok awal di Ringkasan Mutasi tidak lagi menggelembung.
