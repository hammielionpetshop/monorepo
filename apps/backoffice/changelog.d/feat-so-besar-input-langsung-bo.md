### Added
- **SO Besar kini bisa dihitung/diinput penuh langsung dari backoffice, tanpa harus lewat POS.** Dialog Review pada SO Besar berstatus Dihitung/Menunggu menampilkan daftar produk kandidat: produk dengan histori penjualan 30 hari terakhir atau stok sistem tidak nol di cabang tersebut, ditambah produk yang sudah pernah dihitung dari POS.
  - Daftar kandidat punya pencarian nama/SKU, paginasi dengan pilihan jumlah data per halaman, dan filter "Hanya yang belum diisi".
  - Qty fisik & alasan yang belum disimpan otomatis tersimpan ke penyimpanan lokal browser, jadi reload halaman tidak menghapus input yang belum di-"Simpan Koreksi".
  - Stok sistem tetap realtime — tombol "Refresh Stok Terkini" menyegarkan angka stok terkini per baris.
  - POS tetap bisa dipakai sebagai jalur hitung SO Besar seperti biasa; keduanya menulis ke SO yang sama.
