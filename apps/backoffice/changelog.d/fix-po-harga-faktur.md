### Fixed

- Purchase Order: mengubah harga faktur kini ikut memperbarui **Total PO** di header detail PO (sebelumnya tetap angka lama). Total hutang supplier dihitung dari barang bagus saja (qty terima − rusak), sama seperti saat penerimaan disetujui.
- Purchase Order: koreksi harga faktur pada PO yang penerimaannya sudah disetujui kini benar-benar memperbarui modal di **Manajemen Harga**. Sebelumnya hampir selalu terlewat diam-diam karena catatan penerimaan PO itu sendiri dianggap "barang masuk yang lebih baru". Perubahan modal ≥30% tetap masuk antrean tinjauan modal.
- Purchase Order: harga faktur yang dibiarkan kosong tidak lagi tampil sebagai Rp 0 di daftar item dan form Cocokkan Harga Faktur; yang dipakai harga PO.
