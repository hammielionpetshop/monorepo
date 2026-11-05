### Changed

- **Kiriman antar cabang (PO Internal) yang diterima kini melunasi utang stok cabang penerima**, sama seperti penerimaan PO supplier — Gudang adalah pemasok toko. Barang yang terjual saat stok sistem kosong (oversale) tidak lagi menumpuk di menu Utang Stok setiap kali kiriman Gudang diterima; HPP nota oversale dikoreksi memakai harga kiriman.

### Fixed

- **Pembersihan utang stok lama (sampai 31 Oktober 2026)** yang menumpuk karena kiriman Gudang dulu tidak melunasinya. Tidak ada data yang dihapus dan angka stok kasir tidak berubah: utang yang tertutup oleh stok yang sudah masuk dilunasi (tercatat sebagai pelunasan "Pembersihan"), sisanya — barang yang stok sistemnya memang minus — ditandai write-off dengan alasan pembersihan dan tetap tampil sebagai defisit sampai Stock Opname berikutnya. HPP nota bulan lalu tidak diubah. Utang sejak 1 November tetap terbuka dan lunas lewat kiriman/PO berikutnya.
