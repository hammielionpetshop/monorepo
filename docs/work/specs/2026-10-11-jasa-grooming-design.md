# Jasa (Grooming) — produk tanpa stok, tab Grooming di POS, bonus groomer

**Tanggal:** 2026-10-11
**Status:** rancangan disetujui owner 2026-10-11 (malam); dikerjakan **bertahap J1–J4**, satu tahap satu rilis
**Backlog:** [`../backlog/2026-10-11-jasa-grooming.md`](../backlog/2026-10-11-jasa-grooming.md)
**Istilah:** [`../../glosarium-bisnis.md`](../../glosarium-bisnis.md) bagian "Jasa, promo & sistem luar"

## Latar belakang

Owner: "grooming itu jasa, bukan produk". Aplikasi belum mengenal jasa — grooming terdaftar sebagai
barang biasa, sehingga setiap terjual stoknya menjadi minus dan menimbulkan catatan utang stok
bernilai nol. Owner juga membutuhkan data siapa yang mengerjakan (untuk bonus), data kucing dan
pemiliknya (kelak dipakai percakapan otomatis), dan riwayat grooming yang terkelompok.

## Keputusan owner (2026-10-11) — jangan ditanya ulang

**Ruang lingkup**

1. Yang dijadikan jasa sekarang: **empat produk grooming**. Owner harus bisa **menambah produk
   jasa baru sendiri** dari data produk.
2. **Hotel Cat di-pending** (dibahas nanti). Di tab Grooming tetap disiapkan bagian **Hotel** yang
   menampilkan "Segera hadir". Selama pending, produk Hotel Cat **tidak diubah** (tetap dijual dari
   tab Kasir seperti sekarang) — *saran Claude, menunggu penegasan owner*.
3. Stok minus dan utang stok lama milik produk grooming: **dibiarkan apa adanya**; owner
   membereskannya sendiri nanti. Tidak disembunyikan, tidak ditutup otomatis.

**Jasa & harga**

4. Jasa **tidak punya stok** dan **tidak punya modal/upah**.
5. Harga jasa **mengikuti tingkatan pelanggan** (Retail/Reseller/Grosir) seperti barang.
6. Jasa **hanya dijual lewat tab Grooming** (tidak muncul di daftar produk tab Kasir), supaya data
   kucing dan groomer tidak pernah terlewat. Jasa dan barang **boleh satu nota** (tombol "Tambah
   belanja" mengirim baris jasa ke keranjang Kasir → satu nota, satu kali bayar).

**Groomer & bonus**

7. Daftar groomer adalah **pengaturan tersendiri** (nama didaftarkan Owner/GM); groomer yang
   terdaftar bisa dipilih di cabang mana pun.
8. **Satu jasa = satu groomer.** Nota berisi lima ekor → kasir memilih groomer satu per satu.
9. **Bonus 10% dari harga jual jasa itu sesudah diskon, dihitung per satu jasa** (bukan dari total
   nota). Diskon nota dibagi sebanding ke tiap baris, sehingga bonus turun sebanding. Pecahan
   rupiah dibulatkan ke bawah.
10. Bonus **tampil di laporan kasir**; pembayarannya kelak diurus sistem HRIS (terpisah, ditunda).
11. Salah pilih groomer **diubah Owner di Back Office**, wajib beralasan, jejak lama tetap tersimpan.

**Data pemilik & kucing**

12. Wajib diisi **di awal** (saat kucing diterima): nama pemilik, nomor telepon, nama kucing,
    jenis, warna, umur, dan **kondisi kucing** (ditulis manual tiap kunjungan — tidak ditampilkan
    otomatis di kunjungan berikutnya).
13. Mengetik nama pemilik atau nomor telepon yang sudah terdaftar menampilkan data kucingnya.
14. Pemilik yang didaftarkan lewat grooming **otomatis menjadi pelanggan**.

**Serah terima & pembayaran**

15. **Karcis dua lembar per ekor**: satu untuk konsumen (bukti ambil), satu untuk groomer (bukti
    bonus). Memakai fitur cetak yang sudah terpasang.
16. Waktu bayar **dipilih kasir**: lunas sekarang, atau **bayar saat ambil**.
17. Bayar saat ambil memakai **piutang yang sudah ada** — bukan fitur DP, bukan "menahan" nota.
    Kasir melunasinya saat kucing diambil lewat satu tombol **Bayar & Ambil**.
18. Grooming yang sudah diambil tetapi belum lunas tetap pindah ke "Sudah Selesai" dengan tanda
    **BELUM LUNAS**; penagihannya lewat Laporan Piutang.
19. **Pengembalian uang jasa** memakai fitur Retur yang sudah ada dengan persetujuan Owner/GM:
    uang kembali, bonus batal, stok tidak bergerak.

**Riwayat**

20. Riwayat grooming **dikhususkan**: bagian "Sudah Selesai" di kasir dan halaman "Riwayat
    Grooming" di Back Office. Uangnya tetap satu buku — nota tetap tampil di Riwayat Transaksi,
    tagihan tetap di Laporan Piutang dengan tanda "Grooming".

**Tambahan owner 2026-10-12 — Delivery, ongkos kirim, diskon**

21. Tab Grooming punya **fitur diskon** (diskon nota, seperti di layar bayar kasir).
22. Di Terima Kucing ada pilihan **Delivery: Ya / Tidak**. Delivery = **antar-jemput**, tarifnya
    **flat** (tidak dobel), dan dihitung **satu kali per nota** (bukan per ekor).
23. **Ongkos kirim juga jasa** (tanpa stok). Produk ongkir yang sudah ada dipakai; harganya diubah
    menjadi **Rp 1.000 per satuan** dan besarnya ongkir diisi lewat **qty** (mis. 15 × 1.000),
    karena toko punya hitungan ongkirnya sendiri. Tiga tarif lama (lewat tingkat harga) tidak
    dipakai lagi.
24. **Alamat wajib diisi** bila delivery. Alamat disimpan di data pelanggan dan boleh dilengkapi
    di kunjungan berikutnya (mis. semula hanya nama jalan, lalu ditambah nomor rumah).
25. **Bonus delivery: 50% ongkir untuk pengantar, 50% untuk toko.** Karena itu **nama
    pengantar-jemput wajib dicatat** (satu orang per nota), dipilih dari daftar yang didaftarkan
    Owner/GM.
26. Ongkir **tetap bisa dijual dari tab Kasir** (dipakai juga untuk antar barang); hanya jasa
    grooming yang dikunci ke tab Grooming. Ongkir di Bulk Sale: **nanti saja** (tetap ditolak).
27. Stok minus dan utang stok lama produk ongkir: **dibiarkan**, sama seperti grooming.

**Tambahan owner 2026-10-12 (sesudah 1.107.69) — pengantaran barang biasa:**

28. Pengantaran barang dari **tab Kasir** juga mencatat pengantar dan mendapat **bonus 50% ongkir**,
    sama seperti delivery grooming.
29. **Satu jalur saja, otomatis:** begitu nota berisi ongkir, layar bayar meminta **pengantar**
    (wajib); tanpa centang "diantar / tidak". Tidak perlu alamat, pelanggan, atau status "sudah
    diantar" — pengantaran barang langsung tercatat selesai.
30. **Hanya orang internal** (yang terdaftar sebagai pengantar). Kurir luar / ojol tidak dicatat —
    kiriman lewat ojol tidak memakai produk ongkir.
31. Bulk Sale dan pesanan portal **tetap di luar** (ongkir tetap ditolak di sana).
32. **Gratis ongkir** (selama ini tidak tercatat): **kasir yang menentukan** lewat centang "Gratis
    ongkir" di kotak pengantar; tidak dicentang = ongkir tertagih. Kasir tetap mengisi qty ongkir
    sebenarnya supaya nilai yang ditanggung toko tercatat; baris ongkir dipotong penuh (Rp 0 di nota).
33. Gratis ongkir = **tanpa bonus** pengantar (pengantarnya tetap tercatat).
34. Berlaku sama di **tab Grooming** (centang "Gratis antar-jemput" di pilihan Delivery).

*Keputusan teknis Claude (dilaporkan ke owner):* daftar pengantar memakai daftar yang sama dengan
groomer — satu orang bisa ditandai **Groomer**, **Pengantar**, atau keduanya — supaya tidak ada dua
daftar nama. Bonus pengantar dihitung dari nilai baris ongkir sesudah diskon, dengan aturan
pembagian diskon yang sama seperti bonus groomer.

## Bentuk layar (disetujui owner)

Tab baru **Grooming** sejajar dengan tab Kasir di POS, berisi empat bagian:

```
[ Terima Kucing ] [ Sedang Dikerjakan ] [ Hotel · Segera hadir ] [ Sudah Selesai ]
```

- **Terima Kucing** — cari/isi pemilik → pilih/tambah kucing → per ekor: jasa, satu groomer,
  kondisi → daftar → pilih "Lunas sekarang" / "Tambah belanja" / "Bayar saat ambil" → karcis.
- **Sedang Dikerjakan** — kucing yang masih di toko; tombol **Diambil** atau **Bayar & Ambil**.
- **Hotel** — "Segera hadir".
- **Sudah Selesai** — riwayat, hanya untuk dilihat; cetak ulang karcis bertanda "CETAK ULANG".

## Rancangan teknis

### Prinsip

Tab Grooming hanyalah **cara baru mengisi nota**. Saat disimpan ia menjadi transaksi biasa (kode
TRX) lewat jalur bayar yang sama, sehingga Riwayat Transaksi, shift, setoran, piutang, dan laporan
penjualan ikut menghitungnya tanpa jalur uang kedua.

### J1 — tanda jasa di produk

- **Migrasi 0037** — kolom `products.product_kind varchar(20) NOT NULL DEFAULT 'BARANG'`
  (`BARANG` | `JASA_GROOMING`; `JASA_PENITIPAN` dicadangkan untuk Hotel) dan
  `transaction_items.is_service boolean NOT NULL DEFAULT false`. Hanya menambah kolom. Empat
  produk grooming ditandai lewat migrasi (dicocokkan dari nama persisnya); produk lain tidak
  disentuh.
- **Snapshot per baris nota (`is_service`)** — diisi saat nota terbit. Batal nota dan retur membaca
  kolom ini, **bukan** jenis produk saat ini: nota grooming lama dulu memotong stok, jadi
  pembalikannya tetap mengembalikan stok (cocok dengan baris Mutasi Stok-nya); baris jasa baru
  tidak pernah menyentuh stok.
- **Jual** (`transaction-service.ts`): baris jasa disimpan dengan modal 0, tanpa `deductStock`,
  tanpa utang stok. Jasa di Bulk Sale / PO Internal / pesanan portal ditolak (seluruh nota batal).
- **Satu pintu pengaman stok** (`assertStockProduct` di `StockService.deductStock`/`addStock`):
  dokumen stok apa pun untuk produk jasa ditolak (`ServiceProductStockError`, 409). Hanya
  pembalikan nota lama yang lewat, dengan `allowServiceProduct`.
- **Koreksi nota**: mengubah, menghapus, atau menambah baris jasa ditolak (`SERVICE_ITEM_LOCKED`);
  baris barang pada nota yang sama tetap bisa dikoreksi.
- **Mutasi Stok** (`stock-ledger.ts`): baris `is_service` disaring dari SALE_OUT, EDIT_*, SALE_VOID,
  RETURN_IN, RETURN_CANCEL_OUT.
- **Data produk (Back Office)**: pilihan "Jenis" pada form produk. Mengubah jenis hanya Owner/GM,
  tercatat di `audit_logs` (`PRODUCT_KIND_CHANGE`), dan barang yang masih punya sisa stok tidak
  bisa dijadikan jasa.
- **Disaring dari dokumen stok**: produk jasa tidak bisa masuk stock opname, PO, PO Internal /
  transfer, Bulk Sale, barang rusak, retur supplier, dan katalog portal pesanan; server menolak
  bila tetap dikirim.
- Di J1 grooming **masih dijual dari tab Kasir** (tab Grooming baru ada di J3).

### J2 — pengaturan groomer + data pemilik & kucing

- **Migrasi 0038** — tabel `groomers` (nama, aktif) dan `pets` (pemilik = `customers.id`, nama,
  jenis, warna, `birth_date`, aktif). Tidak ada hapus — hanya nonaktif. Groomer bukan akun
  pengguna, hanya nama.
- **Umur** diisi tahun + bulan, disimpan sebagai perkiraan tanggal lahir (`lib/pet-age.ts`) supaya
  bertambah sendiri.
- **Pemilik kembar dicegah**: nomor telepon dibandingkan dalam bentuk baku (`lib/phone.ts`: hanya
  angka, awalan 62 → 0). Nomor yang sudah dipakai pelanggan lain ditolak (409 `DUPLICATE_PHONE`)
  sambil mengembalikan pelanggan lamanya, dan layar menawarkan untuk memakainya.
- **Layanan** `lib/services/grooming-master-service.ts`; rute `api/bo/groomers/**`,
  `api/bo/pets/**`, `api/bo/pets/owners` (cari pemilik + kucingnya — dipakai tab Grooming di J3).
- **Layar Back Office**: Pengaturan → Groomer; Master Data → Data Kucing; daftar kucing di detail
  pelanggan.
- **Izin** dipasang oleh migrasi (izin tidak ter-seed otomatis di server):
  `grooming.groomer.manage` (Owner, GM) dan `grooming.pet.manage` (Owner, GM, Manager, Kasir —
  kasir mengisi data kucing saat menerima kucing). Perubahan groomer & kucing tercatat di
  `audit_logs` (`GROOMER_*`, `PET_*`).

### J3 — tab Grooming di POS (dipecah: J3a mesin, J3b layar, J3c Tambah belanja)

**J3a (mesin, sudah dikoding):** migrasi 0039 `grooming_orders` — `transaction_item_id` unik,
`sequence` (nomor karcis = nomor nota / urutan), status `DIKERJAKAN` / `DIAMBIL` / `DIBATALKAN`,
`cancel_source` (`VOID` / `RETUR`), `ticket_print_count`. `attachGroomingOrderInTx` dipanggil
`TransactionService` di dalam transaksi DB nota (data tidak sah = seluruh nota batal);
`void-service` dan `retur-service` memanggil pembatal/pemulihnya. Daftar & serah terima di
`lib/services/grooming-order-service.ts`, rute `api/pos/grooming/orders/**`, izin
`grooming.order.manage`. "Bayar & Ambil" memakai pelunasan piutang yang sudah ada + tandai
diambil — tidak ada jalur uang baru.

**J3a2 (mesin delivery, sudah dikoding):** migrasi 0040 — jenis `JASA_ONGKIR` (produk ongkir
ditandai lewat nama persis), harga ongkir Rp 1.000 di semua tingkat (jejak `PRICE_UPDATE` di
`audit_logs`), `groomers.is_groomer` / `is_courier`, tabel `service_deliveries` (unik per nota &
per baris nota; status `DIPROSES` / `SELESAI` / `DIBATALKAN`). Baris ongkir boleh membawa
`delivery { courierId, address }` → `attachDeliveryInTx`; hanya pada nota yang punya grooming;
alamat disalin ke `customers.address` (jejak `CUSTOMER_ADDRESS_UPDATE`). Ongkir tanpa data
pengantaran tetap sah (antar barang dari tab Kasir). Pembatal/pemulih delivery menumpang di
fungsi pembatal grooming, jadi `void-service` & `retur-service` tidak disentuh lagi.

**J3b (layar, sudah dikoding — belum dicoba di layar):** halaman `app/pos/(authenticated)/grooming`
(`grooming-client` = empat bagian; `intake-panel` = Terima Kucing; `order-list-panel` = Sedang
Dikerjakan & Sudah Selesai). Pembayaran memakai `components/pos/checkout-modal.tsx` yang sudah ada
(prop baru `initialPaymentType`, `onSaved`; baris membawa `grooming` / `delivery`). Baris nota
disusun `buildGroomingCartItems` (satu baris per ekor, qty 1, tidak digabung; satu baris ongkir).
Karcis: `lib/escpos-grooming-ticket.ts` + `lib/print-grooming-ticket.ts` (Bluetooth → QZ → browser).
"Bayar & Ambil" = `POST /api/pos/customers/[id]/debts/pay` dengan `transactionId` (pelunasan
diarahkan ke nota itu) lalu `pickup`. Daftar jasa & ongkir: `GET /api/pos/grooming/services`.

**J3c (Tambah belanja & kunci jalur lama, sudah dikoding — belum dicoba di layar):** tanpa
migrasi. `components/pos/cart-store.ts`: baris jasa = baris yang membawa `grooming` / `delivery`
(`isServiceLine`); tidak pernah digabung, dan `addItem` / `updateQty` / `removeItem` /
`setItemTier` hanya mengenai barang biasa. Aksi baru `addServiceLines(items, pemilik)` (mengganti
baris jasa lama, mempertahankan barang, pelanggan = pemilik) dan `removeServiceLines()`;
`setSelectedCustomer` diabaikan selama ada baris jasa. Tombol "Tambah belanja" di `intake-panel`
memanggilnya lalu membuka tab Kasir; `cart-panel` menampilkan baris jasa terkunci + "Lepas
grooming"; sesudah nota tersimpan `pos-client` membuka `/pos/grooming?cetak=<id nota>` dan
`grooming-client` mencetak karcisnya. Server: `TransactionService` menolak produk
`JASA_GROOMING` tanpa data kucing (`GROOMING_DATA_REQUIRED`; ongkir tetap boleh tanpa data);
`/api/pos/products` (tanpa `stockOnly`) dan `/api/pos/bootstrap` menyaring `JASA_GROOMING`;
`POST /api/pos/open-bills` menolak nota yang barisnya membawa data grooming/pengantaran atau
produknya berjenis jasa grooming.

Rancangan awal J3 (acuan J3b/J3c):

- Tabel `grooming_orders` (satu baris per ekor per kunjungan): cabang, pemilik, kucing, produk
  jasa, groomer, kondisi, waktu masuk, waktu diambil, status (`DIKERJAKAN` / `DIAMBIL` /
  `DIBATALKAN`), tautan ke `transaction_items.id`.
- Baris jasa di keranjang **tidak digabung** dengan baris kembar (satu baris = satu kucing + satu
  groomer). Barang biasa tetap seperti sekarang.
- Karcis dua lembar per ekor (nomor = nomor TRX / urutan baris), dicetak setelah nota tersimpan.
- "Bayar saat ambil" = nota dengan metode piutang; "Bayar & Ambil" = pelunasan piutang nota itu
  (izin `debt.pay` yang sudah dimiliki kasir) + status menjadi `DIAMBIL`.
- Nota berisi jasa tidak bisa ditahan (Tunggu) pada tahap ini; baris jasa dikunci dari Koreksi
  nota (baris barang pada nota campuran tetap bisa dikoreksi).
- Batal nota / retur baris jasa → status grooming `DIBATALKAN`, bonus batal.

### J4 — Riwayat Grooming, Ganti Groomer, laporan jasa & bonus

**Sudah dikoding (belum dicoba di layar):** migrasi 0041 — tabel `grooming_groomer_changes` + izin
`grooming.report.view` (Owner, GM, Manager) dan `grooming.order.change_groomer` (Owner, GM).
`lib/grooming-bonus.ts`: `netLineAmount(baris, dibayar, jumlahBaris)` = baris × dibayar ÷ jumlah
semua baris nota (dibulatkan ke bawah) dan `bonusOf(bersih, persen)`. `lib/services/
grooming-report-service.ts`: `listGroomingHistory`, `listDeliveryHistory`, `summarizeGrooming`
(per groomer / jasa / cabang / pengantar; yang dibatalkan tidak dihitung; belum lunas dihitung
tetapi dipisah), `changeGroomer`. Bonus **tidak disimpan** — dihitung dari nota setiap laporan
dibuka. Periode berdasarkan waktu kucing diterima. Halaman `(dashboard)/reports/grooming` (tiga
bagian: Laporan Jasa & Bonus, Riwayat Grooming, Delivery); rute `POST /api/bo/grooming/orders/
[id]/change-groomer`; tanda "Grooming" di `reports/receivables` (EXISTS ke `grooming_orders`).

- Halaman Back Office "Riwayat Grooming" (saring cabang, tanggal, groomer, pemilik, status bayar).
- **Ganti Groomer** (Owner/GM): alasan wajib, tercatat di tabel jejak + `audit_logs`.
- Laporan jasa: per cabang, per jasa, per groomer; kolom bonus (10% × harga bersih baris,
  dibulatkan ke bawah; baris yang dibatalkan/diretur tidak dihitung).
- Tanda "Grooming" pada tagihan di Laporan Piutang.

## Mesin pengaman

| Risiko | Pengaman |
|---|---|
| Jalur lain masih menggerakkan stok jasa (batal, retur, koreksi) | Penjaga di `StockService` (satu pintu) + tes DB untuk tiap jalur |
| Jasa masuk dokumen stok / portal | Disaring dari daftar pilih + ditolak server |
| Koreksi nota mengacaukan bonus & karcis | Baris jasa dikunci dari Koreksi |
| Karcis dicetak ulang untuk klaim bonus ganda | Bonus berpatokan data sistem; cetak ulang bertanda |
| Pemilik terdaftar ganda | Cari dengan nomor telepon lebih dulu + peringatan |
| Tagihan grooming hilang diam-diam | Memakai piutang resmi; batal hanya lewat pembatalan nota |
| Ubah groomer tanpa jejak | Hanya Owner/GM, alasan wajib, jejak lama disimpan |

## Tidak diubah

- Jalur bayar, shift/setoran, dan pelunasan piutang — dipakai apa adanya.
- Pendapatan & Pengeluaran — tidak disentuh (ditunda owner).
- Riwayat transaksi lama produk grooming, stok minus, dan utang stok lamanya.
- Produk Hotel Cat (pending).

## Di luar ruang lingkup (dicatat, belum dikerjakan)

- **Hotel Cat** — check-in/check-out, data makanan, "mau di-grooming atau tidak", tanpa bonus,
  dibayar saat keluar menurut jumlah hari. Dirancang terpisah.
- **Kirim data ke HRIS** dan **promo otomatis** — lihat
  [`../backlog/2026-10-11-daftar-tunda-owner.md`](../backlog/2026-10-11-daftar-tunda-owner.md) bagian B.

## Tes

Dicatat per tahap di backlog. Tes DB dijalankan pada salinan data toko (`petshop_wt_uji`).
