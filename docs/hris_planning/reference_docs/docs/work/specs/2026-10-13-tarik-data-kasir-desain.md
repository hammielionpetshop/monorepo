# Tarik Data Kasir (Tahap 3F)

Tanggal: 13 Oktober 2026
Status: **ditetapkan 13 Oktober 2026.** K1–K6 sesuai saran; K7 diganti pemilik:
tidak ada arah sebaliknya sama sekali. Hasilnya: PRI-39, LOG-89.

Bahan: SIS-05, 07, 09; PRI-01, 02, 32, 33; LOG-01, 08, 14, 38, 65, 66, 67
s.d. 74; DRV-38, 39; KEU-46, 47, 52, 57, 58, 60, 65, 69, 72, 94, 97, 111;
KIN-02; titipan "Untuk modul Tarik Data Kasir" di bagian 7 buku LOG, DRV,
KEU, KIN; `../backlog/2026-10-11-tarik-data-kasir.md`; catatan project kasir
`D:\Kasir\monorepo\docs\work\backlog\2026-10-11-daftar-tunda-owner.md`
(butir 3, jawaban owner 11 Oktober 2026) dan spec Jasa Grooming kasir
(`.../specs/2026-10-11-jasa-grooming-design.md`, tayang 1.107.69).

Gunanya: satu tempat yang mengambil data dari sistem kasir, supaya modul
lain tidak menarik sendiri-sendiri dan tidak ada angka yang diketik dua kali.

## 1. Rancangan (tanpa keputusan baru)

Diturunkan dari aturan yang sudah ditetapkan.

1. **Satu pintu, satu arah** (SIS-05, 07). Hanya modul ini yang berhubungan
   dengan sistem kasir. HRIS tidak pernah menulis ke kasir. Modul lain
   membaca hasil tarikan dari modul ini.
2. **Tiap jenis data punya tiga cara masuk**, dengan tanda sumber di setiap
   baris: **diketik** (tahap awal, di modul pemakainya), **file diunggah**,
   dan **sambungan**. Cara masuk dinyalakan per jenis data; tempatnya dibuat
   sejak modul pemakainya dibangun (SIS-09, LOG-08, KEU-58).
3. **Setiap tarikan tercatat:** kapan, dari mana (sambungan atau file),
   oleh siapa atau oleh mesin, berapa baris baru, berubah, dan batal
   (KEU-58, PRI-33).
4. **Tidak ada yang berubah diam-diam.** Baris yang berubah atau hilang di
   antara dua tarikan ditandai dengan nilai sebelum dan sesudahnya (KEU-58).
   Transaksi yang dibatalkan di kasir **ditandai batal** di HRIS, tidak
   dihapus (PRI-02).
5. **Pemasangan kode:** cabang dengan cabang kasir, toko dengan pelanggan
   kasir lewat kode kasir (LOG-01), supplier lewat nama lain (KEU-57),
   produk lewat kode produk (DRV-38). Yang tidak bisa dipasangkan tampil di
   daftar "belum dipasangkan" untuk diperbaiki, tidak dibuang.
6. **Penarik data adalah mesin otomatis** dan tunduk pada PRI-33: tiap
   jalan tercatat, gagal atau tidak jalan masuk "perlu perhatian" GM, yang
   terlewat dikejar tanpa dobel, jadwal adalah pengaturan, tampil di layar
   Kesehatan Mesin.
7. **Data yang belum masuk tidak dianggap nol.** Layar yang memakai data
   kasir menampilkan "data kasir terakhir masuk: jam …" dan bulan yang belum
   lengkap ditandai (KEU-111).

### Daftar jenis data (gabungan titipan keempat buku)

| Jenis data | Dipakai oleh | Cara masuk tahap awal |
|---|---|---|
| Transaksi per struk (nomor, barang, jumlah, harga, pelanggan, cabang, total) | Logistik (surat jalan LOG-08, nota cabang LOG-38), Kinerja (promo KIN-23), Keuangan (penjualan Gudang ke cabang KEU-69) | Diketik |
| Omzet dan harga pokok per cabang per hari | Keuangan (KEU-72), Kinerja (target omzet) | Diketik / belum ada |
| Settlement per shift (cash, non-tunai per metode, piutang) dan uraian QRIS per transaksi | Keuangan (KEU-47, 52) | Diketik dari struk |
| Pelanggan / toko (kode, nama) | Logistik (LOG-01) | Diketik dengan kode kasir |
| Piutang toko: umur dan jatuh tempo | Logistik (daftar tagih LOG-66), Keuangan (KEU-94) | Belum ada / diketik di titik awal |
| Daftar produk (kode, nama, satuan) | Gaji Driver (DRV-38), Kinerja (produk promo) | File diunggah |
| Purchase order | Gaji Driver (DRV-39) | Belum ada |
| Nota belanja supplier, nama supplier di kasir, sisa utang supplier versi kasir, pembayaran supplier yang tercatat di kasir | Keuangan (KEU-58, 60) | File diunggah |
| Nilai stok (harga beli), barang tidak terjual lebih dari 90 hari, nilai barang reject, tanggal stok opname terakhir | Keuangan (KEU-65, 89, 97) | Diketik di titik awal |
| Jasa grooming yang sudah diambil (groomer, harga sesudah diskon, nomor nota, cabang, tanggal diambil, batal atau retur) | Gaji (bonus grooming, GAJ-61) | File diunggah dari laporan kasir (ditambah 3G) |
| Baris ongkir (nilai sesudah diskon, gratis ongkir atau tidak, pengantar, nomor nota, cabang) | Logistik (antar sendiri LOG-42; bonus ongkir LOG-76) | File diunggah dari laporan kasir (ditambah 3G) |

**Arah sebaliknya** (LOG-65, KEU-46, 69: uang terperiksa per nota, potong
nota, retur, titipan toko, titipan pelunasan, pembayaran toko ke Gudang,
koreksi): HRIS tidak menulis ke kasir, jadi tetap daftar di HRIS yang
dicatat orang kantor di kasir lalu ditandai "sudah tercatat di kasir".

### Keputusan yang sudah ada di project kasir (dicek, tidak ditanya ulang)

Jawaban owner di project kasir, 11 Oktober 2026:

- Ditarik **sekali di awal**, lalu **otomatis tiap 1 menit**, ditambah
  tombol **"Tarik sekarang"** di HRIS.
- Yang ditarik: **semua yang ada di tab Transaksi**, apa pun asalnya
  (termasuk Bulk Sale dan kiriman internal).
- Transaksi yang belakangan dibatalkan atau dikoreksi **diberitahukan
  otomatis** ke HRIS pada tarikan berikutnya.
- Transaksi tanpa nama pelanggan ditulis **RETAIL**.
- Bonus jasa (grooming) kelak diurus HRIS.

Semuanya sejalan dengan rancangan di atas, **kecuali Grooming** (K6).

## 2. Pertanyaan

Diajukan di percakapan 13 Oktober 2026.

- **K1.** Seberapa sering tiap jenis data ditarik.
- **K2.** Kalau sistem kasir mati atau sambungan putus.
- **K3.** Transaksi yang berubah setelah datanya sudah dipakai di HRIS.
- **K4.** Data lama ditarik sejak kapan.
- **K5.** Siapa yang boleh "Tarik sekarang", mengunggah file, dan melihat
  layar modul ini.
- **K6.** Pertentangan: order grooming ada di kasir (sudah tayang) dan di
  buku Logistik v3.
- **K7.** Arah sebaliknya (HRIS ke kasir).

## 3. Saran Claude

1. **K1:** jadwal per jenis data sebagai pengaturan; tiap 1 menit (transaksi,
   settlement, QRIS, pelanggan), tiap 1 jam (nota supplier, utang supplier
   versi kasir, piutang, PO), tiap malam (omzet dan harga pokok), akhir bulan
   dan setelah stok opname (nilai stok, tidak laku, reject); plus "Tarik sekarang".
2. **K2:** HRIS jalan dengan data terakhir; boleh ketik manual bertanda, lalu
   dicocokkan; gagal lebih dari 15 menit di jam buka masuk "perlu perhatian" GM.
3. **K3:** data terkunci tidak diubah sendiri, masuk daftar periksa
   pemegangnya; yang belum terkunci diperbarui bertanda.
4. **K4:** sejak hari mulai v3 plus potret keadaan awal; masa uji sejak awal
   masa uji; riwayat lama tidak ditarik.
5. **K5:** Tarik sekarang: Kepala Gudang, finance, GM, Owner. Unggah file:
   finance, GM, Owner. Layar status: GM dan Owner (Kesehatan Mesin).
6. **K6:** order grooming milik kasir; HRIS menarik jasa selesai untuk bonus
   grooming; Logistik hanya jemput-antar kucing.
7. **K7:** tetap catat tangan; kelak kasir yang mengambil dari pintu baca HRIS.

## 4. Jawaban pemilik

Dijawab pemilik di percakapan 13 Oktober 2026:

- **K1–K6: sesuai saran.**
- **K7: "jangan dulu, arah sebaliknya tidak ada, cukup tarik dari kasir saja
  ke HRIS, biar tak pusing."** Bacaan Claude: tidak ada sambungan HRIS ke
  kasir dalam bentuk apa pun, termasuk kasir mengambil dari HRIS; tidak dicatat
  di backlog. Daftar "kiriman ke kasir" di HRIS (LOG-65) tetap ada dan dicatat
  tangan oleh finance, karena tanpa itu piutang toko di kasir tidak pernah
  berkurang oleh pembayaran yang diterima driver.

## 5. Dicatat ke

- PRI-39 (cara kerja Tarik Data Kasir) di `../../aturan/00-prinsip-rancangan.md`.
- LOG-89 (order grooming milik kasir, pengganti LOG-67 s.d. 73); LOG-65 dan
  bagian 7 butir 5 buku Logistik dirapikan.
- Bagian 7 butir 9 buku Keuangan dicoret.
- Titipan ke 3G: perapian semua yang menyebut order grooming di HRIS (lihat WIP).
  **Dikerjakan 13 Oktober 2026**, lihat bagian 6.

## 6. Tambahan dari 3G

Saat merapikan titipan, ternyata tab Grooming kasir juga mencatat delivery
kucing dan ongkir antar barang dari tab Kasir, lengkap dengan pengantar dan
bonus 50% ongkir. Ditanyakan di percakapan 13 Oktober 2026:

- **G1. Ongkir dan pengantar bersumber dari nota kasir saja** (saran,
  disetujui). Perintah antar barang tetap muncul di HRIS: staf memilih nota
  kasirnya saat Tandai Selesai, ongkir dan pengantar terisi dari sana.
  LOG-42, 76, 77.
- **G2. Antar-jemput kucing cukup di kasir** (disetujui "ya"); HRIS tidak
  membuat perjalanan kucing. LOG-74.
- **G3–G7 disetujui:** bonus grooming dihitung di HRIS dari data kasir,
  tanggal kucing diambil, belum lunas tetap berbonus, nama groomer dan
  pengantar dipasangkan sekali, perubahan di kasir mengikuti PRI-39 butir 4.
  GAJ-61 (pengganti LOG-75, 78, 79); LOG-02, 67 s.d. 73 dicabut.
