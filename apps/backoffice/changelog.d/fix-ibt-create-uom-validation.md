### Fixed
- PO Internal dengan satuan yang tidak ada di master produk (misalnya VITACIK tercatat "Box") kini ditolak saat dibuat. Sebelumnya PO seperti ini lolos dan, saat diimpor ke Bulk Sale, barisnya berharga Rp0.
- Kasir POS › PO Internal: bila ada baris bersatuan tidak valid, muncul peringatan merah yang menyebut produk dan satuannya, dan barisnya ditandai merah dengan petunjuk "hapus lalu tambahkan ulang". Peringatan tidak hilang sendiri sampai baris itu diperbaiki.
