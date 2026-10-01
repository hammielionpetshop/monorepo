### Fixed

- Hutang internal dan stok masuk cabang tujuan tidak lagi dobel ketika satu produk muncul di lebih dari satu baris PO Internal (IBT) yang diproses lewat Bulk Sale. Sebelumnya qty terjual disalin ke setiap baris produk yang sama, sehingga 1 DUS terjual tercatat terkirim 2 DUS (kasus IBT-20261001-0001, selisih Rp 160.000). Kini qty terjual dibagi ke baris-baris tersebut.
- Membuat atau mengedit PO Internal dengan produk + satuan yang sama dua kali kini otomatis digabung menjadi satu baris (qty dijumlah), tidak lagi tersimpan sebagai baris kembar.
