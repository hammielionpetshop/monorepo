### Added
- **Revisi Harga Beli** (mesin di belakang layar, layarnya menyusul di RI9): dokumen untuk kiriman internal yang harga notanya salah. Pemohon mengisi harga yang benar, Owner/GM menyetujui dan boleh mengubah harga final. Saat disetujui **stok tidak bergerak**; modal sisa stok kiriman itu di toko dibetulkan, hutang internal kiriman itu dipotong sebesar selisih (kelebihannya jadi Saldo Internal yang langsung memotong tagihan lain; bila harga direvisi **naik**, tagihannya bertambah), dan modal terbaru toko ikut dibetulkan (RI8).
- Laporan Laba Rugi: kolom **Penyesuaian Modal (Revisi Harga Beli)** — modal barang kiriman yang sudah terjual/terpakai sebelum harganya dibetulkan (nota penjualan lama tidak diubah) — dan koreksi pendapatan cabang pengirim sebesar selisih harga. Hanya tampil bila ada revisi di periode itu; ikut di Export CSV (RI8).
- **Batalkan** Revisi Harga Beli yang sudah disetujui (Owner/GM, alasan wajib) dan **tarik** pengajuan yang masih menunggu. Pembatalan ditolak bila tidak bisa dibalik bersih (stok kiriman sudah terjual sejak revisi, saldonya sudah terpakai, atau sudah ada dokumen lain sesudahnya) — jalan keluarnya Revisi Harga Beli baru (RI8).

### Changed
- Barang Dikembalikan atas kiriman yang harganya sudah direvisi memakai **harga hasil revisi**; pembatalannya ditolak bila harga kiriman direvisi sesudah retur itu disetujui (RI8).
- Batch stok dari terima transfer internal kini mencatat baris kiriman asalnya (dipakai Revisi Harga Beli; data lama tidak diubah) (RI8).
