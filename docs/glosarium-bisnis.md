# Glosarium Bisnis Hammielion

Istilah dan aturan bisnis **menurut owner**. Baca ini sebelum menganalisa atau mengubah fitur:
kalau istilah di bawah muncul di permintaan owner, artinya seperti yang tertulis di sini.
Glosarium teknis dasar (UOM, FIFO, COGS, Void, Settlement, dll.) ada di
[`pos_prd_1/13-appendix.md`](pos_prd_1/13-appendix.md) bagian 13.1.

Terakhir diperbarui: 2026-10-11. Tambahkan istilah baru di sini setiap kali owner menjelaskan
istilah atau aturan yang belum tercatat; tulis tanggal & sumbernya.

---

## Prinsip dasar

| Prinsip | Arti |
|---|---|
| **Tidak ada edit & hapus — yang ada "batalkan" dan dokumen koreksi** | Sistem lama punya fitur edit & hapus tanpa jejak, sering jadi masalah di kemudian hari. Karena itu (keputusan developer, disetujui owner) data yang sudah tercatat **tidak diedit atau dihapus**; kesalahan diperbaiki dengan **membatalkan** atau membuat **dokumen baru** (retur, revisi, penyesuaian) yang punya alasan, pengaju, penyetuju, waktu, dan jejak audit. Jangan membuat fitur "edit langsung" atau "hapus" untuk data transaksi/stok/uang. |
| **Kesalahan staf jangan dipermudah jalan pintasnya** | Owner sengaja menghindari fitur instan (mis. koreksi bebas) yang membiasakan orang kantor memperbaiki tanpa jejak. Jalan keluar resmi = dokumen dengan persetujuan Owner/GM. |
| **Persetujuan Owner/GM** | Aksi yang mengubah stok/uang di luar transaksi biasa (void, koreksi, retur supplier, barang rusak, dst.) diajukan dulu lalu disetujui OWNER/GM di layar **Permintaan Persetujuan** atau layar persetujuan fiturnya. |
| **Peringatan = popup wajib pilih** | Semua peringatan/konfirmasi berupa jendela yang wajib dijawab dengan tombol (tidak tertutup klik di luar / Esc). Aksi penting jangan diletakkan di bagian paling bawah halaman. |
| **Kasir berpemahaman rendah** | Layar kasir harus memakai pilihan yang jelas (kotak besar, kata sehari-hari), bukan istilah teknis. |

## Cabang & arus barang

| Istilah | Arti |
|---|---|
| **Gudang** | Cabang pusat stok. Membeli dari supplier luar, lalu memasok toko-toko. Gudang **mencatat penjualan** ke toko (lewat Bulk Sale). |
| **Toko** (Toko Pusat, Toko Depan, Toko Markas, Toko Gudang) | Cabang penjualan ke pelanggan. Menerima barang dari Gudang atau dari supplier luar langsung. |
| **HQ / Hammielion Headquarter** | Cabang kantor pusat (akun Owner banyak terdaftar di sini). |
| **Transfer Internal / IBT** | Perpindahan barang antar cabang (`inter_branch_transfers`). Hampir selalu satu arah: Gudang → toko (dan Toko Pusat → Toko Depan). |
| **PO Internal** | Permintaan barang dari toko ke Gudang; diproses Gudang menjadi IBT. |
| **Bulk Sale** | Nota penjualan grosir. Untuk pasokan internal, Gudang memproses IBT sebagai Bulk Sale ke "customer internal" cabang tujuan → omzet Gudang + **hutang internal** toko. |
| **Hutang internal / Hutang Piutang Internal** | Tagihan toko ke Gudang dari Bulk Sale internal (`inter_branch_payables`). |
| **Modal terbaru dari internal** | Setiap barang masuk dari internal **otomatis menjadi modal terbaru** di toko penerima, memakai harga nota Gudang (aturan sejak awal). Akibatnya: harga nota Gudang yang salah ikut membuat modal & laba toko salah. |
| **Harga grosir vs retail** | Gudang seharusnya menjual ke toko dengan **harga grosir**. Admin Gudang kadang salah memakai harga retail → kasus **salah harga**. |

## Pembelian & supplier

| Istilah | Arti |
|---|---|
| **Supplier luar** | Pemasok di luar perusahaan. Barangnya masuk lewat PO (EXTERNAL) dan menimbulkan **Hutang Supplier**. |
| **Tahap PO** | Rencana · Disetujui · Diterima · Belum Ada Harga · Selesai (lihat spec alur PO baru). |
| **Menunggu faktur / harga menyusul** | Barang sudah diterima tapi harga faktur belum diisi (`invoice_unit_cost = 0`). |
| **Tempo / termin** | Lama waktu bayar ke supplier (hari), diatur per supplier. 0 = tunai. |
| **Saldo Supplier** | Kelebihan nilai retur ke supplier luar yang dipakai untuk membayar tagihan berikutnya supplier itu. |
| **Supplier "Repack"** | Data bawaan sistem lama: dulu dipakai untuk mencatat **pemecahan** SAK → PCS. Sistem sekarang sudah punya satuan SAK/PCS tanpa harus memecah, jadi **Repack tidak dipakai lagi**. |
| **Supplier "Return"** | Data bawaan sistem lama: dulu dipakai untuk **mengumpulkan barang retur**. Tidak dipakai lagi. |
| **Supplier "Gudang"** | Data bawaan sistem lama yang mencatat Gudang sebagai supplier. Gudang **bukan supplier luar** — pasokan Gudang seharusnya lewat PO Internal/IBT. |
| **Data konsumen & supplier** | Dibawa langsung dari database sistem lama, jadi bisa berisi entri lama yang tidak dipakai. |

## Retur & masalah barang

| Istilah | Arti |
|---|---|
| **Barang Rusak** | Barang rusak/expired/hilang di toko = **kerugian toko** (tidak ada uang kembali). Fitur Barang Rusak, disetujui Owner/GM. |
| **Retur ke Supplier (luar)** | Barang yang sudah diterima dikembalikan/diklaim ke supplier luar. Stok **berkurang** (dianggap stok kurang), tagihan supplier dipotong, kelebihannya jadi Saldo Supplier. |
| **Barang tidak datang / kurang kirim** | Kasir sudah mengonfirmasi barang lengkap sehingga stok masuk sistem, tetapi belakangan (cek laporan kirim) ternyata sebagian barang tidak datang. Dulu tidak ada jalan keluar — inilah alasan utama owner membuat fitur retur. Supplier luar → Retur ke Supplier (stok kurang). Internal → Retur Internal (barang dianggap kembali ke Gudang). |
| **Salah kirim** | Barang yang datang tidak sesuai pesanan. |
| **Salah harga** | Nota memakai harga yang salah (mis. Gudang memakai harga retail, seharusnya grosir). Tidak ada barang yang bergerak — yang salah hanya harganya. |
| **Retur Internal** *(direncanakan)* | Retur dari toko ke Gudang, **wajib menyebut kode transaksi** (nota/transfer asal). Barang **dianggap kembali** ke stok Gudang, nota Bulk Sale & hutang internal dikurangi; kalau hutangnya sudah lunas → **Saldo Internal**. |
| **Revisi Harga Beli** *(direncanakan, nama kerja)* | Dokumen untuk kasus salah harga pada barang internal: **stok tidak bergeser**, hanya harga nota/modal & hutang internal yang dibetulkan. Bukan edit — tercatat sebagai dokumen dengan persetujuan. |
| **Saldo Internal** *(direncanakan)* | Kelebihan nilai Retur Internal / Revisi Harga Beli ketika hutang internal sudah lunas; dipakai untuk tagihan internal berikutnya. |
| **Barang internal vs supplier luar saat retur** | Barang **internal** yang diretur dianggap **kembali** (stok Gudang bertambah). Barang **supplier luar** yang diretur dianggap **stok kurang** (keluar dari sistem). |

## Kasir & shift

| Istilah | Arti |
|---|---|
| **Shift / Estafet** | Satu hari bisa 2 shift: shift 1 ditutup & uangnya dibawa, shift 2 melanjutkan. Struk shift 2 memuat rekap hari itu; uang tetap per shift. |
| **Serah terima** | Kasir shift 1 keluar dan kasir berikutnya membuka shift baru; modal shift sebelumnya jadi saran modal awal. |
| **Modal awal** | Uang kembalian di laci saat shift dibuka; terpisah dari setoran. |
| **Setoran** | Uang penjualan tunai (di luar modal) yang diserahkan kasir; diverifikasi finance per shift. |
| **Utang stok (oversell / shortfall)** | Barang terjual saat stok sistem 0; tercatat sebagai utang stok yang dilunasi oleh barang masuk berikutnya. |
