### Added

- Bulk Sale: tombol **Clone ke Bulk Sale** di detail transaksi (Riwayat Transaksi, khusus Owner/GM/Manager) — isi nota lama (item, satuan, harga, tier, diskon, customer, metode bayar) disalin ke form Bulk Sale untuk dibetulkan lalu disimpan sebagai nota baru. Nota lama tidak otomatis batal; banner mengingatkan untuk mengajukan void-nya.
- Bulk Sale: peringatan stok — baris yang qty-nya melebihi stok cabang ditandai merah ("Stok kurang: sisa 1 PCS, diminta 2 PCS"), ada banner di atas tabel dan di layar tinjau. Kebutuhan dijumlah per produk lintas satuan (DUS + PCS). Hanya peringatan; transaksi tetap bisa disimpan.
- Bulk Sale: jendela pilih produk menggantikan dropdown kecil — kolom Nama Produk (huruf besar, kata yang dicari ditandai), Jenjang Harga per satuan, dan Stok (plus padanan di satuan terbesar). Navigasi ↑ ↓ / Enter / Esc, F2 membuka jendela.

- Bulk Sale: tombol **Ubah Tier Semua Item** (seperti tombol Tier di POS) — menghargai ulang semua baris ke tier terpilih; baris yang satuannya tidak punya harga di tier itu dibiarkan, baris yang jadi kembar digabung.

### Changed

- Bulk Sale: satuan bawaan baris baru kini satuan **terbesar** yang sudah berharga (DUS/BOX/SAK), bukan PCS. PCS hanya dipakai bila cuma satuan itu yang berharga.
- Pencarian produk Bulk Sale mencocokkan tiap kata secara terpisah, urutan bebas ("royal kitten" menemukan "ROYAL CANIN KITTEN 2KG"); hasil per pencarian dinaikkan ke 30.
- Urutan tier harga di Bulk Sale dikunci RETAIL → RESELLER → GROSIR (jendela pilih produk, dropdown tier per baris, dan tier bawaan), tidak lagi mengikuti urutan acak dari database.
- Layout Bulk Sale: kartu total & pembayaran dipindah ke sebelah kanan daftar item dan menempel (sticky) saat halaman di-scroll; halaman dilebarkan.
