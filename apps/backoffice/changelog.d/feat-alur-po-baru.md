### Added
- **Tahap PO baru di daftar Purchase Orders: Rencana · Disetujui · Diterima · Belum Ada Harga · Selesai · Semua.** Tab Transit (tidak pernah dipakai) digabung ke Disetujui. "Belum Ada Harga" = stok sudah masuk tapi harga faktur belum diisi; PO lama otomatis Selesai.
- **Kolom Status Bayar di daftar PO**: Belum Bayar / Sebagian / Lunas / Terlambat N hari / Menunggu Faktur.
- **Form Terima Barang: Qty Datang dan Harga Beli diisi saat barang datang**, keduanya mulai kosong (dulu qty otomatis = qty pesan dan tidak pernah dihitung ulang).
  - Pengingat "rencana Rp X · terakhir Rp Y" di samping kolom harga, plus tombol "Samakan harga kosong dengan harga rencana".
  - Harga yang diketik langsung menjadi harga faktur (modal stok & hutang). Harga dikosongkan → PO masuk "Belum Ada Harga"; stok tetap masuk dengan harga perkiraan.
  - Peringatan berupa jendela wajib klik sebelum disimpan: barang diisi 0 (tidak datang), barang tanpa harga, dan harga beda ≥ 30% dari harga terakhir.
- **Tombol "Batalkan Input Penerimaan"** sebelum Setujui Penerimaan (alasan wajib, tercatat di audit `PO_RECEIVING_CANCELLED`): qty input dihapus, PO kembali ke Disetujui. Stok belum berubah sehingga tidak ada yang dibalik.
- **Jendela wajib pilih setelah Setujui Penerimaan dan setelah harga faktur diisi**: "Apakah PO ini dibayar sekarang?" [Nanti (Tempo)] / [Catat Bayar] — Catat Bayar membuka form pembayaran yang sama dengan halaman Hutang Supplier. Bila masih ada harga menyusul: tagihan sementara (perkiraan) + [Mengerti].
- **Hutang Supplier: tab "Menunggu Faktur"** untuk PO yang harga fakturnya belum lengkap — tagihan ditampilkan sebagai perkiraan (harga rencana, atau modal terakhir bila rencana kosong), dipisah dari hutang pasti, tanpa tombol bayar.
- **Pengingat "terakhir Rp X" di samping kolom harga** pada form Buat PO dan Isi Harga Beli / Cocokkan Faktur.

### Changed
- Setujui Penerimaan kini memakai jendela konfirmasi wajib pilih (bukan konfirmasi bawaan browser).
- Isi Harga Beli: barang yang menunggu faktur dimulai kosong, tidak lagi otomatis memakai harga rencana.
- Barang menunggu faktur tidak lagi menimpa modal di Manajemen Harga dengan harga rencana saat penerimaan disetujui; modal baru diperbarui setelah harga faktur diisi.
