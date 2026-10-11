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
  (`BARANG` | `JASA_GROOMING`; `JASA_PENITIPAN` dicadangkan untuk Hotel). Hanya menambah kolom.
  Empat produk grooming ditandai lewat migrasi (dicocokkan dari nama persisnya); produk lain tidak
  disentuh.
- **Satu pintu pengaman stok**: penjaga di `StockService` — pengurangan/penambahan stok untuk
  produk jasa dilewati (tanpa mutasi stok, tanpa batch, tanpa utang stok, modal 0). Karena semua
  jalur (jual, batal nota, retur pelanggan, koreksi nota) lewat layanan ini, jalur mana pun aman.
- **Data produk (Back Office)**: pilihan "Jenis" pada form produk (Owner/GM).
- **Disaring dari dokumen stok**: produk jasa tidak bisa masuk stock opname, PO, PO Internal /
  transfer, Bulk Sale, barang rusak, retur supplier, dan katalog portal pesanan; server menolak
  bila tetap dikirim.
- Di J1 grooming **masih dijual dari tab Kasir** (tab Grooming baru ada di J3).

### J2 — pengaturan groomer + data pemilik & kucing

- Tabel `groomers` (nama, aktif) dan `pets` (pemilik = `customers.id`, nama, jenis, warna, tahun
  lahir/umur, aktif). Tidak ada hapus — hanya nonaktif.
- Layar Back Office: Pengaturan → Groomer; Data Kucing (di detail pelanggan + daftar).
- Peringatan bila nomor telepon pemilik sudah terdaftar (mencegah pemilik kembar).
- Izin baru ikut dipasang oleh migrasi (izin tidak ter-seed otomatis di server).

### J3 — tab Grooming di POS

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
