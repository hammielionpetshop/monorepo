### Changed

- Kotak cari produk di layar kasir POS tidak lagi menuntut kata kunci berurutan persis. Kata kunci dipecah per spasi dan semua potongan harus cocok, jadi "crystal tuna" kini menemukan CRYSTAL PC TUNA MACKAREL dan "salmon bolt" menemukan BOLT SALMON FRESHPACK — sebelumnya keduanya kosong karena dicocokkan sebagai satu blok utuh. Tiap potongan boleh cocok di nama produk atau SKU; barcode tetap dicocokkan utuh supaya hasil pindai tidak terpecah. Pencarian satu kata berperilaku sama seperti sebelumnya.
- Perbaikan ini ada di `GET /api/pos/products`, jadi dialog koreksi nota dan alat barcode di POS ikut mendapatkannya.

Catatan: ini memperbaiki urutan kata, bukan toleransi salah ketik — "blot" tetap tidak menemukan "bolt".
