### Added
- **Halaman "Utang Stok (Oversell)"** (`/inventory/stock-shortfalls`, khusus Owner/GM) — daftar kekurangan stok akibat penjualan/koreksi nota yang melebihi stok tercatat dan masih belum lunas, dengan tanda "tinjau" untuk yang sudah terbuka 7 hari atau lebih. Bisa difilter per cabang & cari produk.
- Tombol **Tutup (Write-off)** di halaman itu untuk kasus barang terbukti hilang/rusak (bukan sekadar telat input PO) — wajib isi alasan, dicatat ke log audit. Angka stok tidak berubah; ini cuma menghentikan pengharapan pelunasan otomatis dari PO berikutnya.
- Badge jumlah utang stok terbuka di sidebar (menu Inventori → Utang Stok).
