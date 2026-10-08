### Fixed

- PO Internal: saat cabang tujuan menerima lebih sedikit dari yang dikirim, selisihnya kini dikembalikan ke stok cabang pengirim — sebelumnya dianggap kerugian pengiriman sehingga stok pengirim minus (kasus IBT-20261006-0004, kanban #56).
  - PO Internal yang sudah jadi nota Bulk Sale: selisih diretur otomatis dari nota itu (nomor RTN, alasan "Selisih terima IBT-…"), jadi stok kembali dengan modal aslinya dan penjualan cabang pengirim sama dengan hutang cabang penerima.
  - PO Internal biasa (tanpa nota): selisih langsung ditambahkan balik ke stok pengirim memakai modal cabang pengirim.
  - Kalau selisih tidak bisa dinyatakan dalam satuan nota (mis. kurang 1 PCS padahal nota per DUS), penerimaan ditolak dengan pesan agar diselesaikan Owner/GM.
