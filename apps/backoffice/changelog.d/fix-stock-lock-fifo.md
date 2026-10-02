### Fixed

- Pengurangan FIFO membaca saldo batch dan agregat terbaru sesudah lock, sehingga checkout bersamaan dan item produk berulang tidak menggunakan cache stok basi.
- Penjualan, koreksi, void, retur, penerimaan PO, adjustment, dan opname memakai urutan lock produk/cabang yang sama, termasuk produk yang belum memiliki row stok.
- Konversi satuan hilang/tidak valid, qty dasar pecahan, dan konflik pengurangan batch membatalkan transaksi serta memberi pesan konflik; FIFO dengan waktu penerimaan sama diurutkan menurut ID batch.
