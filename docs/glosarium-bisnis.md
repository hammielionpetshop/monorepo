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
| **Transfer Internal / IBT** | Perpindahan barang antar cabang (`inter_branch_transfers`). Hampir selalu satu arah: Gudang → toko, dan toko → toko (mis. Toko Pusat → Toko Depan / Toko Markas). Sejak 18 Agustus 2026 **semua** kiriman (termasuk toko → toko) lewat PO Internal → Bulk Sale cabang pengirim; transfer polos tanpa Bulk Sale tidak dipakai lagi. |
| **PO Internal** | Permintaan barang dari toko ke Gudang; diproses Gudang menjadi IBT. |
| **Bulk Sale** | Nota penjualan grosir. Untuk pasokan internal, cabang pengirim (Gudang atau toko) memproses IBT sebagai Bulk Sale ke "customer internal" cabang tujuan → omzet pengirim + **hutang internal** penerima. |
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
| **Barang tidak datang / kurang kirim** | Kasir sudah mengonfirmasi barang lengkap sehingga stok masuk sistem, tetapi belakangan (cek laporan kirim) ternyata sebagian barang tidak datang. Dulu tidak ada jalan keluar — inilah alasan utama owner membuat fitur retur. Supplier luar → Retur ke Supplier (stok kurang). Internal → Retur Internal (barang dianggap kembali ke cabang pengirim). |
| **Salah kirim** | Barang yang datang tidak sesuai pesanan. Barang yang tercatat tapi tidak datang dibereskan lewat retur; barang yang datang tapi tidak dipesan dicatat lewat **PO baru** (owner, 2026-10-11). |
| **Salah harga** | Nota memakai harga yang salah (mis. Gudang memakai harga retail, seharusnya grosir). Tidak ada barang yang bergerak — yang salah hanya harganya. |
| **Retur Internal** *(direncanakan)* | Retur ke **cabang pengirim** (Gudang atau toko lain), **wajib menyebut kode transaksi** (nota/transfer asal). Hanya **stok bagus** yang dikembalikan (yang rusak lewat Barang Rusak). Barang **dianggap kembali** ke stok cabang pengirim, nota Bulk Sale & hutang internal dikurangi; kalau hutangnya sudah lunas → **Saldo Internal**. |
| **Revisi Harga Beli** *(direncanakan, nama kerja)* | Dokumen untuk kasus salah harga pada barang internal: **stok tidak bergeser**, hanya harga nota/modal & hutang internal yang dibetulkan. Bukan edit — tercatat sebagai dokumen dengan persetujuan. |
| **Penyesuaian Modal (Revisi Harga Beli)** *(direncanakan)* | Koreksi modal untuk barang kiriman internal yang **sudah terjual/terpakai** sebelum harga nota dibetulkan. Nota lama tidak diubah; selisihnya tampil sebagai baris tersendiri di Laba Rugi toko. Owner: "harga jual tidak pernah salah, yang sering salah itu modal". |
| **Saldo Internal** *(direncanakan)* | Kelebihan nilai Retur Internal / Revisi Harga Beli ketika hutang internal sudah lunas; **otomatis** memotong tagihan internal terbuka yang paling lama untuk pasangan cabang yang sama (penerima → pengirim), atau tagihan berikutnya bila belum ada. Tercatat sebagai pembayaran "SALDO INTERNAL" — **bukan uang kas**, tidak masuk Pendapatan & Pengeluaran. Keterangannya otomatis menyebut nomor Retur Internal, nomor IBT, dan nomor nota Bulk Sale asal saldo. |
| **Batalkan (dokumen disetujui)** *(Retur Supplier Luar: dibuat RI3b; Barang Dikembalikan & Revisi Harga Beli: direncanakan)* | Jalan keluar bila dokumen retur/revisi yang sudah disetujui ternyata salah: Owner/GM menekan **Batalkan** dengan alasan; dokumen tetap ada berstatus Dibatalkan dan semua efeknya dibalik berjejak. Ditolak bila efeknya tidak bisa dibalik bersih (mis. saldonya sudah terpakai) — perbaiki dengan dokumen baru. Pengajuan yang masih menunggu boleh **ditarik** pengajunya (owner, 2026-10-11). |
| **Barang internal vs supplier luar saat retur** | Barang **internal** yang diretur dianggap **kembali** (stok cabang pengirim bertambah). Barang **supplier luar** yang diretur dianggap **stok kurang** (keluar dari sistem). |

## Kasir & shift

| Istilah | Arti |
|---|---|
| **Shift / Estafet** | Satu hari bisa 2 shift: shift 1 ditutup & uangnya dibawa, shift 2 melanjutkan. Struk shift 2 memuat rekap hari itu; uang tetap per shift. |
| **Serah terima** | Kasir shift 1 keluar dan kasir berikutnya membuka shift baru; modal shift sebelumnya jadi saran modal awal. |
| **Modal awal** | Uang kembalian di laci saat shift dibuka; terpisah dari setoran. |
| **Setoran** | Uang penjualan tunai (di luar modal) yang diserahkan kasir; diverifikasi finance per shift. |
| **Utang stok (oversell / shortfall)** | Barang terjual saat stok sistem 0; tercatat sebagai utang stok yang dilunasi oleh barang masuk berikutnya. |

## Jasa, promo & sistem luar

| Istilah | Arti |
|---|---|
| **Jasa** *(sedang dikerjakan bertahap)* | Grooming adalah **jasa, bukan barang**: tidak punya stok dan tidak punya modal/upah; harganya tetap mengikuti tingkatan pelanggan. Owner bisa menambah produk jasa baru dari data produk. Jasa hanya dijual lewat **tab Grooming** di kasir dan boleh satu nota dengan barang. Rancangan: `docs/work/specs/2026-10-11-jasa-grooming-design.md`. Owner, 2026-10-11. |
| **Hotel Cat** *(pending)* | Penitipan kucing — juga jasa, **tanpa bonus**, dibayar saat keluar menurut jumlah hari; butuh data seperti grooming ditambah tanggal masuk/keluar, makanan, dan "mau di-grooming atau tidak". **Ditunda owner**; di tab Grooming hanya tampil "Segera hadir". |
| **Groomer** *(direncanakan)* | Orang yang mengerjakan grooming. Namanya didaftarkan Owner/GM di pengaturan dan bisa dipilih di cabang mana pun. **Satu jasa = satu groomer**; nota berisi beberapa ekor → groomer dipilih satu per satu. Salah pilih diubah **Owner di Back Office** dengan alasan. |
| **Bonus jasa** *(tayang 1.107.69 — menunggu uji coba owner)* | Bonus groomer: **10% dari harga jual jasa itu sesudah diskon, dihitung per 1 jasa** — bukan dari total nota. Contoh owner: jasa 100 ribu → bonus 10 ribu; didiskon jadi 80 ribu → bonus 8 ribu. Tampil di laporan kasir; pembayarannya kelak diurus HRIS. |
| **Data kucing** *(direncanakan)* | Wajib diisi saat kucing diterima: nama pemilik, nomor telepon, nama kucing, jenis, warna, umur, dan **kondisi kucing** (ditulis manual tiap kunjungan, tidak ditampilkan otomatis). Pemilik otomatis menjadi pelanggan; mengetik nama/nomor yang terdaftar menampilkan kucingnya. Kelak dipakai percakapan otomatis. |
| **Karcis grooming** *(direncanakan)* | Bukti serah terima, **dua lembar per ekor**: satu untuk konsumen (bukti ambil), satu untuk groomer (bukti bonus). |
| **Bayar saat ambil** *(direncanakan)* | Grooming boleh dibayar saat kucing diambil. Dicatat sebagai **piutang** biasa (bukan DP, bukan nota yang ditahan) dan dilunasi kasir saat kucing diambil. Piutang = penjualan yang sudah jadi (kode TRX, masuk omzet hari itu) tetapi uangnya belum diterima; uangnya masuk shift saat dilunasi. |
| **Delivery (antar-jemput)** *(direncanakan)* | Pilihan di tab Grooming: kucing dijemput dan diantar. Tarifnya **flat** dan dihitung **sekali per nota**. Alamat **wajib** diisi (tersimpan di data pelanggan, boleh dilengkapi di kunjungan berikutnya) dan **nama pengantar** wajib dicatat. Owner, 2026-10-12. |
| **Ongkos kirim (ongkir)** | Juga **jasa** (tanpa stok). Harga per satuan **Rp 1.000**; besar ongkir diisi lewat **qty** (15 × 1.000 = Rp 15.000) karena toko punya hitungan ongkir sendiri. Dipakai untuk delivery grooming maupun antar barang dari tab Kasir. **Setiap nota berisi ongkir wajib mencatat pengantar internal** (keputusan owner 2026-10-12); antar barang cukup pengantarnya saja — tanpa alamat & status. Kiriman lewat ojol/kurir luar tidak memakai produk ongkir. |
| **Gratis ongkir** | Ongkir ditanggung toko — **kasir yang menentukan** (centang "Gratis ongkir" / "Gratis antar-jemput"). Qty ongkir tetap diisi supaya nilainya tercatat sebagai biaya toko, tetapi tidak ditagih ke pelanggan. Pengantar tetap dicatat, **tanpa bonus**. Berlaku di tab Kasir dan tab Grooming (keputusan owner 2026-10-12). **Nilainya selalu ongkir standar** (bawaan Rp 10.000, diatur di Pengaturan), berapa pun jaraknya. Di struk: "Ongkos kirim 10.000 / GRATIS ONGKIR -10.000 / Anda hemat Rp 10.000". |
| **Ongkir standar** | Patokan ongkir toko, **Rp 10.000** (keputusan owner 2026-10-12). Ongkir sebenarnya bisa 8 rb atau 15 rb (diisi lewat qty × Rp 1.000); ongkir standar dipakai sebagai nilai gratis ongkir. |
| **Bonus delivery** *(tayang 1.107.69 — menunggu uji coba owner)* | **50% ongkir untuk pengantar, 50% untuk toko.** |
| **Promo otomatis** *(dirancang 2026-10-12, belum ada kode)* | Promo yang dibuat **kantor (Owner/GM)** dan berlaku sendiri di cabang yang dipilih tanpa diketik kasir. Hanya untuk golongan **Retail** — pelanggan **Reseller dan Grosir tidak kena promo**; jasa boleh kena promo. **Tidak digabung** dengan diskon manual kasir. Bentuknya: potongan per barang (dengan jumlah pcs), beli X gratis Y, bundling, grooming gratis makanan pilihan, flash sale per jam. Dua barang yang masing-masing punya promo → dua-duanya tetap promo; **satu barang yang cocok dengan dua promo hanya kena satu**, yaitu yang paling murah untuk pelanggan. **Barang gratis otomatis masuk keranjang.** Kelipatan dan maksimal per nota diatur di tiap promo. Promo paket hanya bisa diretur **satu paket utuh**. Setiap promo wajib punya laporan. Rancangan: `docs/work/specs/2026-10-12-promo-otomatis-design.md`. |
| **Diskon per barang** *(dirancang 2026-10-12)* | Diskon ketikan kasir dicatat **per barang**, bukan lagi untuk total nota (keputusan owner 2026-10-12): kasir memilih barangnya, mengisi potongan, dan memilih **alasan** dari pilihan singkat. Tujuannya supaya ada riwayat produk apa yang didiskon, kapan, dan oleh siapa. **Batas diskon kasir** belum ditentukan — dibahas owner nanti. Alasan **tidak dicetak di struk** (hanya untuk laporan); barang yang sudah didiskon **dikunci di Koreksi nota** — salah diskon diselesaikan dengan batal nota atau retur (owner 2026-10-13). |
| **Riwayat Diskon** *(dikoding 2026-10-13, belum tayang)* | Laporan barang apa saja yang dipotong harganya: berapa kali, total, kapan, oleh siapa, alasannya; diklik muncul nota-notanya. Memisahkan empat jenis: **diskon kasir** (beralasan), **promo**, **potongan tanpa alasan** (potongan per barang Penjualan Grosir dan nota lama), dan **diskon nota (tidak per barang)** — diskon total nota cara lama yang tidak menempel ke barang tertentu. **Gratis ongkir bukan diskon** dan nota batal tidak dihitung. |
| **HRIS** *(ditunda)* | Sistem kepegawaian + laporan milik owner, **terpisah** dari aplikasi kasir (masih disusun). Rencananya mengambil data semua transaksi dari aplikasi kasir; transaksi tanpa nama pelanggan ditulis **RETAIL** di sana; bonus jasa diurus di sana. |

## Keuangan

| Istilah | Arti |
|---|---|
| **Pendapatan & Pengeluaran** | Menu catatan kas di Back Office. **Keputusan owner 2026-10-11: belum jadi acuan.** Pencatatan uang fisik toko masih dilakukan **manual di sistem lain**; aplikasi ini untuk sementara difokuskan pada **transaksi dan stok** dulu. Karena itu pembahasan/perubahan apa pun pada Pendapatan & Pengeluaran (termasuk catatan otomatis pembayaran hutang internal antar cabang, dan mencatat pembayaran supplier ke sana) **ditunda** sampai owner membukanya lagi — "sangat kompleks, nanti saja". Jangan menjadikan angka di menu ini sebagai dasar keputusan, dan jangan menambah catatan kas otomatis baru tanpa keputusan owner. |
| **Foto bukti transfer** | Lampiran opsional saat mencatat pembayaran non-tunai di Back Office (pelunasan piutang pelanggan, bayar hutang supplier). Nomor referensi tidak diwajibkan. |
