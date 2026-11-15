# Galian Sistem Lama: Logistik

Status: **ditetapkan 12 Oktober 2026** menjadi `../04-logistik.md` (LOG-01 s.d. 88).
Digali dari sistem lama mulai: 12 Oktober 2026

Kata pemilik: Logistik adalah modul **paling penting**, dan berkaitan dengan
sistem kasir (tarik data transaksi, `../../work/backlog/2026-10-11-tarik-data-kasir.md`).

Bab 4 dipecah menjadi lima bagian (disetujui pemilik, 12 Oktober 2026):

| Bagian | Isi | Status |
|---|---|---|
| 4A | Toko pelanggan, titik lokasi toko, surat jalan, rencana kirim, kiriman tertunda | **Sudah digali** (12 Oktober 2026), database sudah dicek. LOG-A01 s.d. A36. **Dijawab pemilik** (4A.9), 16 aturan di 4A.10, AC1–AC10 disetujui. **Selesai dibahas** (dua pertentangan dijawab) |
| 4B | Perjalanan dan muat: trip, driver dan kenek, laporan muat, kirim dan jemput Toko Pusat, apa yang dihitung satu ritase (posisi driver di peta ditunda menjadi fitur tambahan setelah v3 jadi) | **Sudah digali** (12 Oktober 2026), database sudah dicek. LOG-B01 s.d. B42. **Dijawab pemilik** (4B.9), 14 aturan di 4B.10, AD1–AD8 disetujui. **Selesai dibahas** (dua pertentangan dijawab) |
| 4C | Nota, uang dari toko, dan retur: pembayaran gabungan, potong nota, gagal atau kirim besok, ambil retur, penerimaan retur, verifikasi finance, piutang, Kas Masuk | **Sudah digali** (12 Oktober 2026), database sudah dicek. LOG-C01 s.d. C46. **Dijawab pemilik** (4C.9), 16 aturan di 4C.10, AE1–AE10 disetujui. **Selesai dibahas** (pertentangan E dan pertanyaan ulang F dijawab) |
| 4D | Grooming dan laporan: order grooming, jemput dan antar kucing, bonus grooming dan ongkir ke Buku Bonus, dashboard, laporan | **Sudah digali** (12 Oktober 2026), database sudah dicek. LOG-D01 s.d. D32. **Dijawab pemilik** (4D.9), 14 aturan di 4D.10, AF1–AF7 disetujui. **Selesai dibahas** (pertentangan G dijawab: pemilik yang mengerjakan grooming menerima Bonus Grooming) |
| 4E | Penetapan menjadi `../04-logistik.md` | **Selesai** (12 Oktober 2026): LOG-01 s.d. 88 |

Catatan pembagian: halaman Surat Jalan dipindah dari 4B ke 4A, karena di sistem
lama toko **hanya** bisa masuk rencana lewat surat jalan. Nominal upah ritase
dibahas di Bab 5, bukan di Bab 4.

Batas penggalian: kode aplikasi dan struktur database yang berjalan. Isi data
(nama toko, nominal) tidak dibuka; yang dihitung hanya jumlah baris. Nama rute
dibaca karena itu nama wilayah, bukan data orang.

Nomor LOG di file ini adalah nomor **galian** (sementara). Nomor aturan v3
ditetapkan di 4E.

---

# Bagian 4A: Toko, surat jalan, rencana kirim, dan kiriman tertunda

Sumber: `hris-app/app/(dashboard)/logistik/toko/page.tsx` (643 baris),
`logistik/rencana/page.tsx` (266), `logistik/rencana/[id]/page.tsx` (741),
`logistik/surat-jalan/page.tsx` (441), `logistik/tertunda/page.tsx` (277);
migrasi `069`, `088`, `090`, `090b`, `090c`, `091` di `database/migrations/`;
kebijakan akses dan fungsi di database.

## 4A.1 Bagian ini mengurus apa

Daftar toko yang dikirimi barang (dan pelanggan grooming), surat jalan yang
mencatat barang gudang yang harus diantar ke sebuah toko beserta nilai notanya,
rencana kirim harian (mobil, rute, driver, kenek, dan surat jalan yang dibawa),
dan kiriman yang tertunda karena toko tutup.

## 4A.2 Data di sistem lama (dicek ke database, 12 Oktober 2026)

| Data | Isinya | Tabel | Jumlah baris |
|---|---|---|---|
| Toko dan pelanggan | Nama, alamat, nomor HP, jenis (toko atau pelanggan), aktif, kode kasir | `logistics_stores` | 276 (270 toko, 6 pelanggan) |
| Surat jalan | Toko, nominal nota, nomor (tidak wajib), tanggal, status, tunda, gagal, batal | `logistics_delivery_notes` | 34 (mulai 10 Oktober 2026) |
| Riwayat ubah nominal surat jalan | Nominal lama, baru, siapa | `logistics_delivery_note_changes` | 0 |
| Rencana kirim | Tanggal, mobil, rute, driver, kenek, status, foto bak dan garasi | `logistics_delivery_plans` | 49 (21 September s.d. 11 Oktober 2026) |
| Kunjungan toko dalam rencana | Toko, urutan, status, hasil, uang, potong nota (36 kolom) | `logistics_plan_stores` | 276 |
| Tugas belanja ke supplier | Rute belanja yang dikerjakan trip | `logistics_plan_supplier_tasks` | 4 |
| Mobil | Nama, plat | `vehicles` | 3 |
| Rute | Nama wilayah (Tasik Kota, Garut, ...), aktif | `delivery_routes` | 9 (3 berawalan "Belanja") |
| Tarif per mobil dan rute | Dipakai upah driver (Bab 5) | `driver_rate_configs` | 23 |

Keadaan data toko:

- 264 dari 270 toko **tidak punya alamat**, 174 tidak punya nomor HP.
- **Tidak ada kolom titik lokasi** untuk toko sama sekali.
- 0 toko punya kode kasir (kolomnya disiapkan migrasi 090, belum dipakai).
- 169 dari 270 toko belum pernah dikirimi sama sekali (kemungkinan daftar impor awal).
- Tidak ada nama toko kembar, dan tidak ada toko nonaktif.

Keadaan data rencana:

- 45 selesai, 4 dibatalkan. Paling banyak 2 rencana per driver per hari.
- 11 dari 49 rencana tanpa kenek.
- 8 kunjungan masih "menunggu" di dalam rencana yang sudah **dibatalkan** (sisa
  yang tidak dibereskan).
- Dari 34 surat jalan: 32 terkirim, 2 batal, **0 bernomor**, 0 pernah ditunda.

## 4A.3 Aturan yang ditemukan

### Toko dan pelanggan

| No | Aturan | Sumber |
|---|---|---|
| LOG-A01 | Satu daftar berisi dua jenis: **Toko** (tujuan kirim barang) dan **Pelanggan** (pelanggan grooming). Pelanggan tidak bisa dijadikan tujuan kirim barang. | `069`, trigger `guard_store_kind_toko` |
| LOG-A02 | Nomor HP disimpan seragam (08xx); +62 dan 62 diubah otomatis. Nomor dicek formatnya hanya saat diisi atau diubah. | `069` `normalize_phone_id`, `guard_logistics_store_phone` |
| LOG-A03 | Pelanggan wajib punya nomor HP dan nomornya tidak boleh dobel. Toko boleh berbagi nomor (satu pemilik beberapa toko). | `069` |
| LOG-A04 | Toko baru wajib punya alamat (minimal 5 huruf) dan nama minimal 3 huruf; nama yang sama dengan toko lain ditolak, termasuk dengan toko nonaktif. Aturan ini hanya berlaku di "tambah cepat"; form Master Toko tidak mewajibkan alamat. | `quick_create_logistics_store`, `toko/page.tsx` |
| LOG-A05 | Menambah dan mengubah toko di Master Toko: Kepala Gudang dan pemilik. "Tambah cepat" juga boleh oleh staf cabang dan Back Office (saat membuat surat jalan atau order grooming). | kebijakan `logistics_stores_write`, `quick_create_logistics_store` |
| LOG-A06 | Toko bisa **dihapus** permanen kalau belum pernah dipakai; kalau sudah dipakai, hanya bisa dinonaktifkan. | `toko/page.tsx` `handleDelete` |
| LOG-A07 | Semua orang yang login bisa membaca seluruh daftar toko. | kebijakan `logistics_stores_read_all` (`true`) |
| LOG-A08 | Tiap toko bisa diberi kode kasir (unik) untuk dicocokkan dengan sistem kasir. Belum dipakai. | `090` `kasir_code` |
| LOG-A09 | Halaman Master Toko juga memuat dua hal lain: tombol **Tandai Ada Retur** (bagian 4C) dan tab **Cabang Grooming** (bagian 4D). | `toko/page.tsx` |

### Surat jalan

| No | Aturan | Sumber |
|---|---|---|
| LOG-A10 | Surat jalan dicatat oleh Back Office, Kepala Gudang, atau pemilik: toko, nominal nota gudang (wajib lebih dari 0, dibulatkan ke bawah), nomor (tidak wajib), tanggal, catatan. | `create_delivery_note` |
| LOG-A11 | "Back Office" dikenali dari **nama cabang** "Back Office"; "Kepala Gudang" dari **nama jabatan**. | `can_manage_delivery_notes`, `is_kepala_gudang_or_owner` |
| LOG-A12 | Nomor surat jalan unik kalau diisi. Disiapkan untuk dicocokkan dengan data kasir (kolom sumber, nominal kasir, status cocok); belum dipakai. | `090` |
| LOG-A13 | Surat jalan punya lima status: Menunggu dijadwalkan, Dalam perjalanan, Terkirim, Perlu keputusan, Batal. | `090` |
| LOG-A14 | Satu toko boleh punya banyak surat jalan (pesanan pagi dan tambahan). Semuanya menjadi **satu kunjungan**, tetapi tiap surat jalan tetap satu nota. | `add_notes_to_plan` |
| LOG-A15 | Nota gudang sebuah kunjungan = jumlah surat jalan yang dibawanya. Driver tidak mengetik nominal nota. | `sync_visit_invoice_from_notes` |
| LOG-A16 | Mengubah surat jalan: sebelum truk berangkat oleh Back Office, Kepala Gudang, pemilik; setelah berangkat atau terkirim **hanya pemilik**. Perubahan nominal dicatat (lama, baru, siapa). Kalau kunjungan sudah terkirim, pembagian uangnya dihitung ulang. | `update_delivery_note` |
| LOG-A17 | Membatalkan surat jalan hanya selagi belum dijadwalkan (Menunggu atau Perlu keputusan), wajib alasan. | `cancel_delivery_note` |
| LOG-A18 | Kalau driver memilih **Kirim Besok**: surat jalan kembali Menunggu dan ditandai tertunda (kapan pertama ditunda, berapa kali, alasan terakhir). Kalau **Gagal**: Perlu keputusan kantor, lalu dijadwalkan ulang atau dibatalkan (wajib alasan). | `090c`, `decide_failed_note` |
| LOG-A19 | Barang cabang (Laporan Muat) yang gagal juga diputuskan di halaman Surat Jalan, oleh kantor atau cabang asal. | `decide_failed_loading` |

### Rencana kirim

| No | Aturan | Sumber |
|---|---|---|
| LOG-A20 | Rencana dibuat oleh Kepala Gudang atau pemilik: mobil, rute (di layar disebut **"Ritase"**), driver, kenek (tidak wajib). | `rencana/page.tsx`, kebijakan `logistics_plans_insert` |
| LOG-A21 | Tanggal rencana **selalu hari ini**, diambil dari jam handphone atau PC pembuat. Tidak bisa menyusun rencana untuk besok. | `todayLocalStr()` |
| LOG-A22 | Pilihan driver: karyawan berjenis driver atau yang ditandai bisa menyetir. Pilihan kenek: karyawan tetap di **departemen bernama "Team Gudang"** ditambah driver yang ditandai bisa membantu. Kalau tidak ada yang cocok, semua karyawan tetap muncul. Driver dan kenek tidak boleh orang yang sama. | `rencana/page.tsx` |
| LOG-A23 | Toko **hanya** masuk rencana lewat surat jalan yang dicentang, dan hanya sebelum truk berangkat. Surat jalan tambahan setelah berangkat masuk rencana berikutnya. | `add_notes_to_plan` |
| LOG-A24 | Surat jalan yang pernah tertunda tampil paling atas di daftar pilihan, diurutkan dari yang tertunda paling lama. | `rencana/[id]/page.tsx` |
| LOG-A25 | Urutan toko diatur manual dengan tombol naik dan turun. | `handleMove` |
| LOG-A26 | Rencana juga bisa berisi **tugas belanja** ke supplier (rute yang namanya berawalan "Belanja") dan **tugas ambil retur**. Rencana boleh berisi belanja atau retur saja, tanpa toko. | `rencana/[id]/page.tsx`, memory retur |
| LOG-A27 | Status rencana: Draft, Siap Kirim, Berjalan, Menuju Garasi, Selesai, Dibatalkan. | `rencana/page.tsx` |
| LOG-A28 | Syarat Siap Kirim: minimal satu toko, tugas belanja, atau tugas retur; dan tarif untuk pasangan mobil dan rute sudah diatur. Syarat ini **hanya dicek di layar**; database menerima perubahan status apa pun dari Kepala Gudang dan pemilik. | `handleSiapKirim`, kebijakan `logistics_plans_update_admin` |
| LOG-A29 | Membatalkan rencana hanya di Draft atau Siap Kirim (di layar). Surat jalannya kembali Menunggu otomatis; kunjungan kosongnya tidak dibereskan. | `handleCancel`, `release_notes_of_cancelled_plan` |
| LOG-A30 | Ganti driver atau kenek boleh sampai trip Menuju Garasi; setelah Selesai dikunci karena upah sudah dihitung. Dikunci **hanya di layar**. | komentar di `rencana/[id]/page.tsx` |
| LOG-A31 | Setelah berangkat, Kepala Gudang dan pemilik masih bisa menghapus toko yang belum diproses, dan menambah tugas belanja atau retur. Toko yang sudah Terkirim atau Gagal dikunci. | `rencana/[id]/page.tsx` |
| LOG-A32 | Mobil dan rute diatur HR, finance, dan pemilik (bukan Kepala Gudang), di halaman Penggajian Driver. | kebijakan `vehicles_write…`, `routes_write…` |

### Kiriman tertunda

| No | Aturan | Sumber |
|---|---|---|
| LOG-A33 | Halaman Tertunda mengumpulkan tiga jenis: surat jalan yang Kirim Besok, kunjungan gudang yang Kirim Besok, dan laporan muat cabang yang ditunda. | `tertunda/page.tsx` |
| LOG-A34 | Lewat 3 hari, kiriman tertunda berwarna merah dan pemilik mendapat angka peringatan di menu. | `088` bagian 5, `LIMIT_MS` |
| LOG-A35 | Kunjungan Kirim Besok tertutup otomatis saat toko itu menerima kiriman berikutnya, atau ditutup manual oleh Kepala Gudang atau pemilik dengan keterangan. Laporan muat yang ditunda bisa dibatalkan (dianggap Gagal) dengan alasan. | `088`, `close_postponed_visit`, `cancel_postponed_loading` |
| LOG-A36 | Halaman Tertunda dan Surat Jalan bisa dilihat HR dan finance, diubah oleh Kepala Gudang dan pemilik (Surat Jalan juga Back Office). | `tertunda/page.tsx`, `surat-jalan/page.tsx` |

## 4A.4 Menu di sistem lama

| Menu | Sub menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|---|
| Logistik › Master Toko | Daftar Toko & Pelanggan, Cabang Grooming | Data toko, tandai retur, pengaturan grooming | Tandai retur juga ada di Rencana; Cabang Grooming bukan urusan toko |
| Logistik › Surat Jalan | 5 tab per status | Catat dan putuskan surat jalan; juga memutuskan barang cabang yang gagal | "Perlu keputusan" barang cabang seharusnya di Laporan Muat |
| Logistik › Rencana | Daftar, Detail | Susun trip | |
| Logistik › Tertunda | — | Kiriman Kirim Besok | Surat jalan tertunda juga tampil di Surat Jalan tab Menunggu dan di Rencana |
| Penggajian › Driver › Setup | Mobil, Rute, Tarif | Data mobil dan rute | Mobil dan rute adalah data logistik tetapi diurus di menu gaji |

## 4A.5 Tumpang tindih

1. **Arti "ritase" bertabrakan.** Di kamus v3, ritase = satu perjalanan. Di layar
   rencana sistem lama, "Ritase" adalah nama **rute atau wilayah** (Tasik Kota,
   Garut, ...). Satu kata dua arti.
2. **Kiriman tertunda dicatat di tiga tempat** (surat jalan, kunjungan, laporan
   muat), masing-masing dengan kolom tunda sendiri, lalu dikumpulkan di satu layar.
3. **Toko dan pelanggan grooming** berbagi satu tabel, padahal aturannya berbeda
   (nomor HP wajib dan unik vs boleh kosong dan berbagi).
4. **Daftar toko kemungkinan juga ada di sistem kasir** sebagai pelanggan grosir.
   Kalau keduanya diketik terpisah, nama dan isinya akan berbeda (WAJ-03).
5. **Rute belanja dikenali dari nama** yang berawalan "Belanja", bukan dari jenis.
6. **Aturan tambah toko berbeda** antara form Master Toko (alamat tidak wajib) dan
   tambah cepat (alamat wajib). Itu sebabnya 264 toko tanpa alamat.
7. Hak akses ditulis memakai nama jabatan ("Kepala Gudang"), nama cabang
   ("Back Office"), dan nama departemen ("Team Gudang"), melanggar WAJ-05.

## 4A.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| Salah ketik nominal surat jalan | Diubah; setelah berangkat hanya pemilik; tercatat | Ya |
| Surat jalan dobel diketik | Nomor unik mencegah, tetapi nomor tidak pernah diisi (0 dari 34) | **Tidak** dalam praktik |
| Salah pilih driver atau kenek | Diganti sampai Menuju Garasi | Ya, tetapi kunci setelah Selesai hanya di layar |
| Rencana dibatalkan | Surat jalan kembali menunggu | Sebagian: 8 kunjungan tertinggal "menunggu" |
| Toko tutup saat diantar | Kirim Besok, kembali ke antrean, merah setelah 3 hari | Ya |
| Toko menolak barang | Gagal, kantor memutuskan jadwal ulang atau batal | Ya |
| Ingin menyiapkan rencana besok pagi dari malam ini | Tidak bisa, tanggal selalu hari ini | **Tidak** |
| Toko salah dibuat dobel | Tidak ada penggabungan; hapus hanya kalau belum dipakai | **Tidak** |
| Toko pindah alamat atau tutup | Ubah atau nonaktifkan | Ya |
| Tarif mobil dan rute belum diatur | Siap Kirim ditolak di layar | Ya, tetapi hanya di layar |
| Driver tidak tahu letak toko baru | Tidak ada alamat dan titik; driver menelepon | **Tidak** |

## 4A.7 Pertanyaan untuk pemilik (diajukan di percakapan, 12 Oktober 2026)

Butuh pandangan pemilik:

1. **Sumber surat jalan.** Apakah setiap penjualan grosir Gudang ke toko di sistem
   kasir adalah satu surat jalan, sehingga di v3 surat jalan ditarik otomatis dari
   kasir dan tidak diketik ulang?
2. **Pemilik data toko.** Apakah toko tujuan kirim sudah tercatat sebagai
   pelanggan di sistem kasir? Kalau ya, daftar toko diambil dari kasir; HRIS hanya
   menambah alamat, titik lokasi, dan nomor HP.
3. **Siapa memasang titik lokasi toko** (264 toko belum punya alamat).

Cukup ok/tidak:

4. Rencana boleh disusun untuk besok, bukan hanya hari ini.
5. Kata "Ritase" di rencana diganti **"Rute"**; ritase tetap berarti satu perjalanan.
6. Tiap toko boleh punya rute bawaan, supaya saat memilih rute, surat jalan toko
   di rute itu muncul paling atas.
7. Mobil dan rute diurus Kepala Gudang dan pemilik; tarifnya tetap di Bab 5.
8. Pelanggan grooming dipisah dari daftar toko.

## 4A.8 Usulan untuk v3 (belum disetujui)

| No | Usulan |
|---|---|
| AC1 | Perubahan status rencana (Siap Kirim, batal, ganti awak setelah selesai) hanya lewat pintu di server yang memeriksa syaratnya, bukan hanya tombol. |
| AC2 | Siapa boleh apa diatur lewat pengaturan hak per jabatan, bukan nama jabatan, cabang, atau departemen (WAJ-05). Rute belanja ditandai dengan jenis rute, bukan nama. |
| AC3 | Toko tidak pernah dihapus, hanya dinonaktifkan. Ada fitur **gabungkan dua toko** untuk yang terlanjur dobel; riwayat ikut pindah. |
| AC4 | Tanggal rencana dari server (PRI-01). |
| AC5 | Rencana dibatalkan: semua isinya (surat jalan, kunjungan, tugas) kembali ke antrean, tidak ada yang tertinggal. |
| AC6 | Status "tertunda" dicatat di satu tempat untuk semua jenis kiriman, bukan tiga. |
| AC7 | Titik lokasi toko memakai fitur yang sama dengan titik cabang (titipan Bab 2). Toko tanpa titik ditandai "belum ada titik". |
| AC8 | Surat jalan yang masih diketik tangan diberi tanda "manual" dan dicocokkan dengan data kasir setelah ditarik; yang tidak cocok muncul di daftar periksa. |
| AC9 | Ubah nominal surat jalan setelah berangkat: tetap hanya pemilik, tercatat (LOG-A16 dibawa). |
| AC10 | Satu aturan tambah toko untuk semua jalan masuk (alamat dan nama sama ketatnya). |

## 4A.9 Jawaban pemilik (12 Oktober 2026)

Arahan umum: tanggapan atas temuan **tidak dikerjakan di sistem lama**; semuanya
diperbaiki di v3.

Tanggapan atas temuan:

| Temuan | Jawaban |
|---|---|
| 1. Toko tanpa titik lokasi dan alamat | Benar |
| 2. Surat jalan tanpa nomor, kode kasir kosong | Sengaja: kolomnya disiapkan untuk menyambung dengan sistem kasir |
| 3. Tanggal rencana dari jam handphone | Rencana bermula saat diinput, sesuai jam server |
| 4. Pengaman hanya di tombol | Diperbaiki di v3 |
| 5. "Ritase" dua arti | Diperbaiki di v3 |
| 6. Tertunda di tiga tempat, 8 kunjungan tertinggal | Diperbaiki di v3 |

Jawaban pertanyaan 4A.7:

| No | Jawaban |
|---|---|
| 1 | Satu penjualan grosir Gudang ke toko di kasir = satu surat jalan. **Tahap awal diketik manual**; tarik otomatis dari kasir menyusul sebagai fitur tambahan |
| 2 | Data toko di HRIS diambil dari kasir, jadi seharusnya sama; ketidaksamaan harus diperbaiki |
| 3 | Ikut saran: driver memasang titik saat pertama mengantar, dengan foto, disetujui Kepala Gudang |
| 4–8 | Ok |
| AC1–AC10 | Ok semua |

Posisi driver di peta: dicatat dulu, dibahas sebagai **fitur tambahan setelah
v3 jadi**. Tidak digali di 4B.

## 4A.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 4E)

Toko:

1. Nama dan identitas toko milik sistem kasir. HRIS mengambilnya dari kasir dan
   hanya menambahkan data pengiriman: alamat, titik lokasi, nomor HP, dan rute
   bawaan. Toko yang tidak cocok dengan kasir ditampilkan untuk diperbaiki.
2. Pelanggan grooming dipisah dari daftar toko (aturannya berbeda).
3. Toko tidak pernah dihapus, hanya dinonaktifkan. Toko yang terlanjur dobel
   digabungkan; riwayatnya ikut pindah (AC3).
4. Satu aturan tambah toko untuk semua jalan masuk (AC10).
5. Titik lokasi toko dipasang driver saat pertama kali mengantar, dengan foto
   depan toko, lalu disetujui Kepala Gudang. Titik yang sudah disetujui hanya
   diubah Kepala Gudang atau pemilik. Fiturnya sama dengan titik cabang (AC7).
   Toko tanpa titik ditandai "belum ada titik".
6. Tiap toko boleh punya rute bawaan. Saat rute dipilih di rencana, surat jalan
   toko di rute itu tampil paling atas.

Surat jalan:

7. Satu penjualan grosir Gudang ke toko di kasir = satu surat jalan.
8. Tahap awal surat jalan diketik manual dan bertanda "manual". Modul tarik
   data kasir **disiapkan sejak awal** (kode kasir di toko, nomor surat jalan,
   tanda sumber), sehingga saat tarik otomatis dinyalakan tinggal berjalan.
   Setelah ada, surat jalan manual dicocokkan dengan kasir dan yang tidak cocok
   masuk daftar periksa (AC8). Jenis: **pengganti** jadwal di backlog tarik
   data kasir.
9. Mengubah nominal setelah truk berangkat hanya pemilik, dan tercatat (AC9).

Rencana kirim:

10. Tanggal kirim **dimulai saat surat jalan dimasukkan ke rencana** yang
    dibawa driver, memakai jam server (AC4). Tidak ada rencana untuk tanggal
    mendatang, karena kiriman tidak bisa direncanakan jauh hari (faktor
    lapangan). Jenis: **pengganti** jawaban "ok" untuk pertanyaan 4.
11. Di layar dipakai kata **"Rute"** untuk wilayah; "ritase" tetap berarti satu
    perjalanan.
12. Mobil dan rute diurus Kepala Gudang dan pemilik; tarif di Bab 5.
13. Perubahan status rencana hanya lewat pintu di server yang memeriksa
    syaratnya (AC1).
14. Hak akses diatur per jabatan lewat pengaturan; rute belanja ditandai dengan
    jenis rute, bukan nama (AC2).
15. Rencana dibatalkan: semua isinya kembali ke antrean, tidak ada yang
    tertinggal (AC5).
16. Status tertunda dicatat di satu tempat untuk semua jenis kiriman (AC6).

Aturan LOG-A yang tidak disinggung jawaban di atas dibawa apa adanya; diperiksa
ulang saat penetapan 4E.

### Pertentangan yang sudah dijawab (12 Oktober 2026)

- A: jawaban 1 ("manual dulu") vs backlog tarik data kasir (dibangun bersama
  Logistik). Jawaban pemilik: manual dulu, modulnya disiapkan supaya saat
  otomatis tinggal jalan (aturan 8).
- B: temuan 3 ("bermula saat diinput") vs pertanyaan 4 ("boleh untuk besok").
  Jawaban pemilik: tanggal kirim dimulai saat surat jalan dimasukkan ke
  rencana; tidak ada rencana untuk besok (aturan 10).

**4A selesai dibahas.** Tidak ada pertanyaan 4A yang menunggu.

---

# Bagian 4B: Perjalanan dan muat

Sumber: `hris-app/app/(dashboard)/logistik/jalan/page.tsx` (2.221 baris; bagian
uang, potong nota, dan retur di halaman ini digali di 4C), `laporan-muat/page.tsx`
(1.208), `kirim-barang/page.tsx` (1.191), `jemput-toko-pusat/page.tsx` (265),
bagian "Catat Trip Harian" di `penggajian/driver/page.tsx`; fungsi
`complete_logistics_delivery`, `complete_supplier_task`,
`claim_central_loading_package`, `finish_central_loading`, `start_tp_trip`,
`finish_tp_trip`; kebijakan akses di database.

## 4B.1 Bagian ini mengurus apa

Perjalanan truk gudang dari berangkat sampai kembali ke garasi (trip), siapa
yang ikut (driver dan kenek), barang titipan cabang toko yang ikut diangkut
(Laporan Muat), perjalanan antar barang oleh karyawan cabang sendiri (Kirim
Barang, jalur "Diantar Sendiri"), dan kapan satu ritase tercatat sebagai dasar
upah driver dan kenek.

## 4B.2 Data di sistem lama (dicek ke database, 12 Oktober 2026)

| Data | Isinya | Tabel | Jumlah baris |
|---|---|---|---|
| Trip truk gudang | Rencana yang dijalankan: berangkat, foto bak kosong, foto amper bensin, perlu isi bensin, toko yang sedang dituju | `logistics_delivery_plans` (25 kolom) | 49 (45 selesai) |
| Ritase | Siapa, tanggal, mobil, rute, ada kenek atau tidak, upah driver dan kenek, minggu, status bayar | `delivery_trips` | 316 (30 Mei s.d. 11 Oktober 2026); 49 lahir dari sistem, sisanya dicatat tangan |
| Laporan muat cabang | Cabang asal, toko tujuan, jalur antar, ongkir, nota cabang, status, tunda, gagal | `logistics_central_loadings` (47 kolom) | 86 (1 s.d. 12 Oktober 2026) |
| Foto isi muatan | Foto barang per laporan | `logistics_central_loading_items` | 188 |
| Paket | Foto paket yang diambil driver, siapa, kapan, masuk kunjungan mana | `logistics_central_loading_packages` | 83 (10 belum diambil) |
| Perjalanan antar sendiri | PJ, foto ambil, foto kembali, lama berangkat dan kembali, alasan | `logistics_tp_trips` | 16 (semua selesai) |
| Tujuan perjalanan antar sendiri | Toko, jemput atau antar kucing, foto sampai | `logistics_tp_trip_stops` | 20 |
| Pengaturan logistik | Jeda anti-curang dinyalakan atau tidak | `logistics_settings` | 1 |

Keadaan data:

- **Jeda anti-curang 30 menit sedang mati.** Di kode tertulis "SEMENTARA 0
  untuk keperluan testing Owner, WAJIB dikembalikan ke 30". Sampai hari ini
  belum dinyalakan lagi; 19 dari 45 trip dilaporkan sampai garasi kurang dari
  30 menit setelah foto bak kosong.
- 6 dari 45 trip selesai di hari yang berbeda dengan tanggal rencananya; yang
  paling lama 31,5 jam dari berangkat sampai garasi. Lama tengah-tengah trip
  5,6 jam.
- 28 dari 45 trip ditekan "Berangkat" oleh kenek, bukan driver (boleh).
- 13 trip melaporkan perlu isi bensin.
- 65 kunjungan toko lahir dari paket cabang yang diambil driver, bukan dari
  surat jalan.
- 57 dari 81 laporan muat selesai **tanpa nominal nota** (nota baru wajib sejak
  migrasi 082).
- 4 tugas belanja selesai, masing-masing menjadi satu ritase tersendiri.
- Ada **dua fungsi bernama sama** `complete_logistics_delivery` (versi lama
  tanpa nominal bensin, dan versi baru). Pola yang sama dengan penanda alpha
  yang gagal tiap hari (Bab 2). Saat ini layar memanggil versi baru, jadi
  belum rusak.

## 4B.3 Aturan yang ditemukan

### Trip truk gudang

| No | Aturan | Sumber |
|---|---|---|
| LOG-B01 | Driver dan kenek hanya melihat trip yang menugaskan dirinya, berstatus Siap Kirim, Berjalan, atau Menuju Garasi. | `jalan/page.tsx` `fetchPlans` |
| LOG-B02 | "Berangkat" boleh ditekan driver atau kenek. Kalau ada laporan muat cabang ke toko di trip itu yang belum ditandai Selesai, muncul peringatan, tetapi tetap boleh berangkat. | `handleBerangkat`, `get_unfinished_loadings_for_plan` |
| LOG-B03 | Saat trip Siap Kirim dibuka dan masih ada paket cabang yang menunggu dijemput (toko mana pun), muncul pengingat "Jemput Barang Cabang". Pengingat bisa ditutup. | `checkCentralPending` |
| LOG-B04 | Urutan toko bebas; nomor urut hanya referensi. Toko yang sedang dituju disimpan supaya kantor melihat "sedang menuju ...". | `selectTargetStore` |
| LOG-B05 | Tiap toko diselesaikan dengan **Kirim** (foto bukti, cara bayar, kejadian) atau **Gagal kirim** (Kirim Besok atau Gagal, wajib alasan dan foto). Isinya digali di 4C. | `submitKirim`, `fail_plan_store` |
| LOG-B06 | Dua orang di satu trip tidak bisa memproses toko yang sama dua kali; yang kedua mendapat pesan "sudah lebih dulu diproses rekan Anda". | `submit_plan_store_delivery` |
| LOG-B07 | **Selesai Tugas lebih awal**: toko yang belum didatangi ditandai Kirim Besok sekaligus, wajib satu alasan, tanpa foto. Ditulis langsung dari layar, bukan lewat pintu server. | `submitFinishEarly` |
| LOG-B08 | Tugas belanja ke supplier dikerjakan kapan saja selama trip berjalan; selesai seketika saat foto nota supplier terunggah. | `submitSupplierTaskDone` |
| LOG-B09 | Setelah semua toko dan belanja beres: foto bak kosong, lalu status menjadi Menuju Garasi. | `confirmBoxPhoto` |
| LOG-B10 | Lapor sampai garasi baru bisa **30 menit** setelah foto bak kosong (anti-curang). Pemilik bisa mematikan jeda ini dari Dashboard Pengiriman; saat ini mati. | `complete_logistics_delivery`, `logistics_settings` |
| LOG-B11 | Lapor sampai garasi: foto amper bensin, jawab "perlu isi bensin besok?" dan kira-kira nominalnya, supaya admin menyiapkan uang dari pagi. | `submitSelesaiKirim` |
| LOG-B12 | Trip tidak bisa selesai selama masih ada tugas retur yang belum dilaporkan posisi akhirnya, atau barang potong nota yang belum diantar ke pemiliknya (4C). | `canSubmitSelesaiKirim` |
| LOG-B13 | Semua foto langsung tersimpan saat diambil, supaya tidak hilang kalau tombol kembali tertekan. | `persistStorePhotoField` |
| LOG-B14 | Tombol dikunci 1 detik setiap kali tampilan berganti, karena driver pernah menekan dua kali dan toko terselesaikan tanpa sempat mengisi kejadian. | `clickGuardKey` |
| LOG-B15 | Driver dan kenek boleh **mengubah baris trip-nya sendiri secara langsung**, kolom apa pun (termasuk mobil, rute, kenek, dan status), selama trip itu menugaskan dirinya. Satu-satunya pagar: jeda 30 menit garasi. | kebijakan `logistics_plans_update_field` |
| LOG-B16 | Kantor (Kepala Gudang dan pemilik) melihat dan mengubah semua trip; HR dan finance hanya melihat. | kebijakan `logistics_plans_*` |

### Ritase

| No | Aturan | Sumber |
|---|---|---|
| LOG-B17 | Satu trip yang selesai sampai garasi = **satu ritase**, tercatat otomatis saat "Selesai Kirim". Upah diambil dari tarif pasangan mobil dan rute: driver dengan kenek, driver tanpa kenek, dan kenek. | `complete_logistics_delivery` |
| LOG-B18 | Tiap tugas belanja yang selesai = **satu ritase tambahan** dengan tarif mobil dan rute belanja, tercatat seketika saat foto nota. | `complete_supplier_task` |
| LOG-B19 | Ambil retur tidak punya ritase sendiri; dibayar lewat ritase trip-nya (keputusan pemilik di sistem lama). | memory retur |
| LOG-B20 | Ritase trip memakai **tanggal rencana**; ritase belanja memakai **tanggal hari itu** dari server. Trip yang selesai lewat tengah malam tetap bertanggal rencana. | dua fungsi di atas |
| LOG-B21 | Ritase tetap penuh walaupun sebagian toko tidak terkirim (Selesai Tugas lebih awal, Kirim Besok, Gagal). | `complete_logistics_delivery` (tidak menghitung toko) |
| LOG-B22 | Minggu upah dimulai hari **Jumat**. | `v_week_start` |
| LOG-B23 | Tarif tidak bertanggal berlaku; nominal disalin ke ritase saat tercatat, jadi perubahan tarif hanya mengenai ritase berikutnya. | `driver_rate_configs` |
| LOG-B24 | HR, finance, dan pemilik masih bisa **mencatat ritase tangan** ("Catat Trip Harian") dan menghapusnya. Cek dobel (driver yang sama di tanggal yang sama) hanya di layar. 3 ritase dicatat tangan sejak sistem rencana berjalan. | `penggajian/driver/page.tsx`, kebijakan `trips_*` |

### Laporan Muat cabang

| No | Aturan | Sumber |
|---|---|---|
| LOG-B25 | Staf cabang toko membuat laporan muat: toko tujuan dan cabang asal. Pemilik memilih cabang asal. Toko baru bisa ditambah dari sini (tambah cepat). | `handleCreateLoading` |
| LOG-B26 | Isi laporan: foto isi barang dan foto paket. Paket yang nanti diambil driver; minimal satu paket untuk menandai selesai. | `finish_central_loading` |
| LOG-B27 | **Tandai Selesai** wajib memilih jalur (diantar driver gudang atau diantar sendiri) dan nominal nota cabang. Setelah itu foto tidak bisa ditambah atau dihapus. | `finish_central_loading` |
| LOG-B28 | Setelah selesai, jalur, ongkir, nota, dan pengantar masih bisa diubah; semua perubahan nota, ongkir, dan pengantar tercatat (lama, baru, siapa). Ganti pengantar wajib alasan. | `set_central_loading_*`, `reassign_loading_before_pickup` |
| LOG-B29 | Laporan yang masih Proses bisa dibatalkan; riwayat dan foto tetap tersimpan. | `handleBatalkan` |
| LOG-B30 | Yang mengelola laporan: staf cabang asal atau pemilik. Kepala Gudang ikut memutuskan kiriman Gagal. | `canManage`, `can_manage_branch_loading` |
| LOG-B31 | Paket yang lama menunggu berganti warna: kuning, oranye setelah 6 jam, merah setelah 24 jam. | `waitingTone` |
| LOG-B32 | Laporan Proses yang tokonya sudah ada di trip driver ditandai "segera Tandai Selesai". | `get_proses_loadings_on_trips` |

### Jemput Barang Cabang

| No | Aturan | Sumber |
|---|---|---|
| LOG-B33 | Driver atau kenek mengambil paket satu per satu ke trip-nya yang Siap Kirim atau Berjalan. Hanya paket dari laporan selesai berjalur driver. | `claim_central_loading_package` |
| LOG-B34 | Mengambil paket **otomatis memasukkan toko tujuannya ke trip** (kunjungan baru di urutan terakhir), tanpa surat jalan dan tanpa Kepala Gudang. | `claim_central_loading_package` |
| LOG-B35 | Semua paket satu nota wajib dibawa driver yang sama selama trip-nya berjalan. | `claim_central_loading_package` |

### Kirim Barang (jalur "Diantar Sendiri" oleh karyawan cabang)

| No | Aturan | Sumber |
|---|---|---|
| LOG-B36 | Pengantar ditunjuk cabang asal saat Tandai Selesai: karyawan aktif cabang toko yang punya akun. Ongkir diisi (0 kalau tidak ada). | `finish_central_loading`, `is_valid_delivery_assignee` |
| LOG-B37 | Tiga foto berjam server: **Foto 1** ambil barang (hanya pengantar yang ditunjuk; yang memotret menjadi PJ), **Foto 2** sampai di tiap tujuan, **Foto 3** kembali di cabang asal PJ. | `start_tp_trip`, `arrive_tp_stop`, `finish_tp_trip` |
| LOG-B38 | Satu perjalanan boleh berisi beberapa kiriman barang dan tugas jemput atau antar kucing grooming sekaligus. Satu orang hanya boleh punya satu perjalanan berjalan. | `start_tp_trip` |
| LOG-B39 | Tiap tahap minimal 2 menit. Kalau lama berangkat dan lama kembali berselisih 20 menit atau lebih, wajib alasan (macet, bensin, istirahat, menunggu di toko, tugas lain, lainnya). | `finish_tp_trip` |
| LOG-B40 | Foto dari galeri yang lebih tua dari 2 menit ditolak. | `MAX_FILE_AGE_MS` |
| LOG-B41 | PJ mendapat **bonus 50% ongkir**, hanya kalau perjalanan selesai sampai Foto 3; bonus grooming baru cair kalau order grooming selesai (digali di 4D). Perjalanan ini **bukan ritase**. | `tripBonus`, `resync_ongkir_bonus_payroll` |
| LOG-B42 | PJ bisa dialihkan ke orang lain dengan alasan. | `reassign_tp_trip` |

## 4B.4 Menu di sistem lama

| Menu | Sub menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|---|
| Logistik › Pengiriman (Jalankan) | Pilih trip, toko, belanja, retur, garasi | Layar driver dan kenek | Satu layar memuat lima jenis tugas |
| Logistik › Jemput Barang Cabang | — | Driver mengambil paket cabang ke trip | Pengingat yang sama muncul di layar Jalankan |
| Logistik › Laporan Muat | Daftar, detail | Cabang menyiapkan barang untuk toko | Kiriman Gagal-nya juga diputuskan di Surat Jalan (4A) |
| Logistik › Kirim Barang | Trip saya, rekap | Karyawan cabang mengantar sendiri | Perjalanan kedua yang terpisah dari trip gudang |
| Penggajian › Driver | Catat Trip Harian | Ritase tangan | Ritase juga lahir otomatis dari trip |

## 4B.5 Tumpang tindih

1. **Dua jenis perjalanan dengan dua cara kerja.** Trip truk gudang (rencana,
   foto bak, garasi, ritase) dan perjalanan antar sendiri (3 foto, selisih
   waktu, bonus ongkir) disimpan di tabel berbeda dengan pagar berbeda.
2. **Ritase lahir dari tiga jalan**: selesai trip, selesai belanja, dan dicatat
   tangan. Cek dobel hanya ada di layar jalan ketiga.
3. **Toko masuk trip dari dua pintu**: surat jalan (oleh kantor) dan paket cabang
   (oleh driver). Aturan 4A (LOG-A23) menyebut "hanya lewat surat jalan".
4. **Fungsi menyelesaikan trip ada dua** dengan nama sama.
5. **Pagar anti-curang berbeda**: trip gudang memakai jeda 30 menit (sedang mati),
   antar sendiri memakai minimal 2 menit per tahap dan alasan selisih 20 menit.
6. Tanggal ritase trip dari rencana, tanggal ritase belanja dari hari itu.

## 4B.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| Waktu habis, masih ada toko | Selesai Tugas lebih awal, sisanya Kirim Besok dengan satu alasan | Ya, tetapi tanpa foto dan bukan lewat pintu server |
| Driver menekan dua kali | Tombol dikunci 1 detik | Ya |
| Foto hilang karena tombol kembali | Foto sudah tersimpan | Ya |
| Driver lapor garasi padahal belum sampai | Jeda 30 menit | **Tidak**, jeda sedang mati |
| Trip lupa ditutup sampai besok | Tetap bisa ditutup, ritase bertanggal rencana | Ya, tetapi tidak ada yang diberi tahu (6 kejadian, terlama 31,5 jam) |
| Driver tidak sempat memakai aplikasi | Ritase dicatat tangan oleh HR atau finance | Ya, cek dobel hanya di layar |
| Cabang lupa menandai laporan muat selesai | Peringatan saat berangkat | Ya, tetapi paketnya tertinggal |
| Driver dan kenek memproses toko yang sama | Yang kedua ditolak | Ya |
| Salah pilih kenek, rute, atau mobil | Kantor mengganti sampai Menuju Garasi | Ya; tetapi driver sendiri juga bisa mengubahnya langsung (LOG-B15) |
| Pengantar antar sendiri berhalangan | PJ dialihkan dengan alasan | Ya |
| Antar sendiri terlalu lama | Wajib alasan | Ya |

## 4B.7 Pertanyaan untuk pemilik (diajukan di percakapan, 12 Oktober 2026)

Butuh pandangan pemilik:

1. **Apa yang dihitung satu ritase.** Usulan: satu trip yang selesai sampai
   garasi = satu ritase, ditambah satu ritase per tugas belanja; retur tidak;
   ritase tetap penuh walau ada toko yang tidak terkirim.
2. **Pengganti jeda 30 menit.** Usulan: lapor sampai garasi wajib berada di
   titik lokasi gudang (fitur titik yang sama dengan absen), jeda waktu dibuang.

Cukup ok/tidak:

3. Paket cabang menjadi pintu kedua yang sah untuk memasukkan toko ke trip
   (pengecualian atas LOG-A23).
4. Trip yang belum sampai garasi sampai jam 12.00 hari berikutnya ditandai
   untuk Kepala Gudang dan pemilik.
5. Ritase tangan tetap ada sebagai jalan darurat: hanya pemilik, wajib alasan,
   dicek dobel di server.
6. Dua jenis perjalanan (truk gudang dan antar sendiri) tetap ada; perjalanan
   antar sendiri bukan ritase.

## 4B.8 Usulan untuk v3 (belum disetujui)

| No | Usulan |
|---|---|
| AD1 | Driver dan kenek tidak pernah mengubah baris trip langsung. Semua langkah (berangkat, pilih toko, foto bak, sampai garasi, selesai lebih awal) lewat pintu server yang memeriksa syaratnya. Mobil, rute, dan kenek hanya diganti kantor. |
| AD2 | Ritase hanya dicatat oleh server, sekali per trip atau tugas belanja, tidak bisa dobel. Tarif dicari menurut tanggal ritase (WAJ-07). |
| AD3 | Selesai lebih awal lewat pintu server, wajib alasan dan foto; toko sisanya masuk satu tempat tertunda (4A aturan 16). |
| AD4 | Satu pintu, satu fungsi: tidak boleh ada dua fungsi bernama sama (pelajaran dari penanda alpha dan fungsi garasi). |
| AD5 | Pengaturan uji (misalnya mematikan pagar) punya batas waktu dan kembali menyala sendiri; selama mati tampil peringatan di dashboard pemilik. |
| AD6 | Dibawa: urutan toko bebas, foto langsung tersimpan, kunci tombol 1 detik, semua paket satu nota dibawa driver yang sama, peringatan laporan muat belum selesai saat berangkat, pengingat jemput paket cabang. |
| AD7 | Dibawa untuk antar sendiri: 3 foto berjam server, minimal 2 menit per tahap, alasan wajib kalau selisih 20 menit, foto galeri ditolak, satu perjalanan berjalan per orang, PJ bisa dialihkan dengan alasan. |
| AD8 | Tanggal ritase satu aturan untuk trip dan belanja: tanggal trip dimulai (4A aturan 10). |

Titipan untuk Bab 5: minggu upah Jumat s.d. Kamis (LOG-B22), nominal tarif, dan
"hari tidak bisa jalan" orang yang dibayar per ritase (KEH-32).

## 4B.9 Jawaban pemilik (12 Oktober 2026)

Tanggapan atas temuan:

| Temuan | Jawaban |
|---|---|
| 1. Jeda 30 menit mati | Benar; pemilik meminta saran terbaik |
| 2. Driver bisa mengubah trip langsung | "Betulkan" |
| 3. Toko masuk trip tanpa surat jalan | "Perbaiki" |
| 4. Dua fungsi bernama sama | "Perbaiki, jangan sampai terjadi lagi" |
| 5. Trip ditutup keesokan harinya | Ok |

Saran yang diberikan untuk temuan 1: pemilik menyalakan lagi sakelar jeda di
Dashboard Pengiriman sistem lama (pengaturan, bukan perubahan kode); di v3
diganti cek lokasi garasi (pertanyaan 2).

Jawaban pertanyaan 4B.7:

| No | Jawaban |
|---|---|
| 1 | Ya, sesuai usulan. Kata pemilik: satu ritase adalah proses dari berangkat sampai kembali lagi |
| 2 | Setuju: lapor garasi wajib di titik lokasi gudang, jeda waktu dibuang |
| 3–6 | Ok |
| AD1–AD8 | Ok semua |

### Pertentangan yang sudah dijawab (12 Oktober 2026)

- C: temuan 2–4 "betulkan/perbaiki" vs arahan 4A.9 dan WAJ-09. Jawaban
  pemilik: **hanya di v3**; "betulkan" berarti kejadian seperti itu tidak boleh
  terjadi lagi di sistem baru. Sistem lama tidak disentuh sama sekali (termasuk
  sakelar jeda garasi), supaya fokus menuntaskan v3.
- D: jawaban 1 "berangkat sampai kembali" vs ritase tambahan per tugas belanja.
  Jawaban pemilik: belanja **dihitung terpisah**: satu trip = satu ritase,
  ditambah upah belanja kalau trip itu punya tugas belanja (aturan 1a).

## 4B.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 4E)

Ritase:

1. Satu ritase = satu trip truk gudang dari berangkat sampai lapor sampai
   garasi. Ambil retur tidak punya ritase sendiri. Ritase tetap penuh walaupun
   ada toko yang tidak terkirim.
1a. Tugas belanja ke supplier **bukan ritase**; dibayar terpisah sebagai upah
   belanja per tugas yang selesai, di atas ritase trip-nya (ritase + belanja).
   Tarifnya per mobil dan rute belanja, nominalnya dibahas di Bab 5. Jenis:
   **pengganti** LOG-B18 (belanja tidak lagi disebut ritase).
2. Ritase hanya dicatat server, sekali per trip, tidak bisa dobel; tarif dicari
   menurut tanggal ritase (AD2, WAJ-07).
3. Tanggal ritase = tanggal trip dimulai (AD8).
4. Ritase tangan hanya untuk darurat: hanya pemilik, wajib alasan, dicek dobel
   di server (pertanyaan 5).

Trip:

5. Lapor sampai garasi wajib berada di titik lokasi gudang; jeda 30 menit
   dibuang. Jenis: **pengganti** LOG-B10.
6. Semua langkah trip lewat pintu server; driver dan kenek tidak mengubah baris
   trip langsung; mobil, rute, dan kenek hanya diganti kantor (AD1).
7. Selesai lebih awal wajib alasan dan foto; toko sisanya masuk satu tempat
   tertunda (AD3).
8. Trip yang belum lapor sampai garasi sampai jam 12.00 hari berikutnya
   ditandai untuk Kepala Gudang dan pemilik (pertanyaan 4).
9. Toko masuk trip lewat dua pintu: surat jalan gudang dan paket cabang yang
   diambil driver. Jenis: **pengecualian** atas LOG-A23 (pertanyaan 3).
10. Pengaturan uji yang mematikan pagar punya batas waktu, menyala lagi
    sendiri, dan selama mati tampil peringatan di dashboard pemilik (AD5).
11. Satu pintu, satu fungsi; tidak boleh ada dua fungsi bernama sama (AD4).
12. Dibawa: AD6 (urutan toko bebas, foto langsung tersimpan, kunci tombol 1
    detik, paket satu nota satu driver, peringatan laporan muat belum selesai).

Perjalanan antar sendiri:

13. Dua jenis perjalanan tetap ada: truk gudang (ritase) dan antar sendiri oleh
    karyawan cabang (bukan ritase, bonus 50% ongkir digali di 4D)
    (pertanyaan 6).
14. Dibawa: AD7 (3 foto berjam server, minimal 2 menit per tahap, alasan wajib
    kalau selisih 20 menit, foto galeri ditolak, satu perjalanan berjalan per
    orang, PJ bisa dialihkan dengan alasan).

Aturan LOG-B yang tidak disinggung jawaban di atas dibawa apa adanya; diperiksa
ulang saat penetapan 4E.

**4B selesai dibahas.** Tidak ada pertanyaan 4B yang menunggu.

---

# Bagian 4C: Nota, uang dari toko, dan retur

Sumber: bagian uang, potong nota, kejadian, dan retur di
`hris-app/app/(dashboard)/logistik/jalan/page.tsx`; `components/VerifikasiUangPengiriman.tsx`
(530 baris), `logistik/penerimaan-retur/page.tsx` (268), `logistik/tertunda/page.tsx`
(277), `keuangan/piutang/page.tsx` (417), bagian retur di `logistik/toko/page.tsx`;
dokumen `hris-app/docs/RENCANA-NOTA-CABANG.md`; fungsi `submit_plan_store_delivery`,
`update_plan_store_payment`, `apply_visit_payment`, `apply_loading_payment`,
`set_visit_cuts`, `decide_visit_cut`, `set_visit_incident_items`, `fail_plan_store`,
`decide_failed_note`, `decide_failed_loading`, `close_postponed_visit`,
`verify_visit_payment`, `unverify_visit_payment`, `verify_nota_payment`,
`resolve_verify_account`, `record_receivable_payment`, `cancel_receivable_payment`,
`guard_receivable_locked`, `sync_visit_cash_in`, `sync_loading_cash_in`, semua fungsi
retur; view `fin_receivable_notas`; kebijakan akses di database.

## 4C.1 Bagian ini mengurus apa

Apa yang terjadi di toko setelah barang diturunkan: nota apa saja yang dibawa,
berapa uang yang diterima dan bagaimana uang itu dibagi ke tiap nota, potong
nota, barang salah muat atau lebih, kiriman yang gagal atau ditunda, barang
retur yang diambil dari toko, pemeriksaan uang oleh finance, sisa tagihan
(piutang), dan aliran uang itu ke Kas Masuk.

## 4C.2 Data di sistem lama (dicek ke database, 12 Oktober 2026)

| Data | Isinya | Tabel | Jumlah baris |
|---|---|---|---|
| Kunjungan toko (bagian uang) | Cara bayar, nota gudang, uang diterima, lebih bayar, jatuh tempo, verifikasi, kejadian, potongan | `logistics_plan_stores` (36 kolom) | 276 (265 terkirim, 3 gagal, 8 menunggu) |
| Surat jalan per nota | Nominal, bagian uang, potongan | `logistics_delivery_notes` | 37 (32 terkirim, 3 menunggu, 2 batal) |
| Nota cabang | Nominal, cara bayar, bagian uang, potongan, verifikasi | kolom `nota_*` di `logistics_central_loadings` | 25 laporan bernota |
| Potong nota | Barang, nominal, alasan, nasib barang, pemilik | `logistics_visit_cuts` | **0** |
| Barang kejadian | Barang salah muat atau lebih, pemilik, nasib | `logistics_visit_incident_items` | 1 |
| Retur | Toko, cabang penerima, trip, foto akhir, penerimaan | `logistics_store_returns` + `_items` | 4 (semua dari kantor) |
| Pelunasan piutang | Setoran atau pakai saldo, dibagi ke nota | `fin_receivable_payments`, `_allocations` | **0** |
| Kas Masuk otomatis | Uang terverifikasi per cabang | `fin_cash_in` bersumber `delivery_*` | **0** (tanggal mulai belum diisi) |

Keadaan data:

- **143 dari 265 kunjungan terkirim memakai tempo (54%)**; 125 di antaranya
  sudah lewat tanggal jatuh tempo. Buku Piutang baru menghitung nota sejak
  10 Oktober 2026, jadi tempo sebelum itu tidak tercatat sebagai piutang di
  HRIS. Sejak 10 Oktober: 33 kunjungan terkirim, 21 tempo.
- **14 kunjungan transfer belum pernah diverifikasi sama sekali** (tertua 22
  September). Semua 100 kunjungan yang diverifikasi adalah cash dan deposit.
  13 kunjungan bukan tempo belum diverifikasi lebih dari 3 hari.
- 226 dari 265 kunjungan terkirim berasal dari sebelum pembagian uang otomatis
  (tidak punya angka "uang diterima" asli).
- 5 kunjungan kurang bayar, 1 lebih bayar, 1 diverifikasi dengan angka berbeda
  dari laporan driver.
- Potong nota belum pernah dipakai; barang kejadian 1 kali; retur 4 kali, 3 di
  antaranya sudah diserahkan driver tetapi **belum dikonfirmasi diterima**
  cabang.
- Kas Masuk otomatis dan pelunasan piutang belum pernah berjalan.
- Angka Buku Piutang tidak bisa dihitung dari luar aplikasi, karena view-nya
  tertutup hak akses; jumlah di atas dihitung dari tabel kunjungan.

## 4C.3 Aturan yang ditemukan

### Pembayaran di lapangan

| No | Aturan | Sumber |
|---|---|---|
| LOG-C01 | Satu kunjungan bisa membawa beberapa nota: satu nota per surat jalan gudang, dan satu nota per laporan muat cabang yang paketnya diambil driver. Nominal nota tidak diketik driver; hanya kunjungan lama tanpa surat jalan yang nota gudangnya diketik. | `submit_plan_store_delivery`, `visit_notes_total` |
| LOG-C02 | Empat cara bayar: cash, transfer, deposit, tempo. **Satu cara bayar per kunjungan**; kalau di lapangan campur, dipakai deposit. | `check_visit_payment_input`, rencana nota cabang aturan 8 |
| LOG-C03 | **"Deposit" punya tiga arti**: di layar driver "DP (bayar sebagian)", di rencana "campuran", di Kas Masuk dicatat "campuran", dan saat verifikasi otomatis masuk rekening Kas Tunai. | `jalan/page.tsx` baris 102–106, `sync_visit_cash_in` |
| LOG-C04 | Driver mengetik **satu angka** uang diterima untuk semua nota; wajib lebih dari 0 kecuali tempo. Tempo wajib tanggal jatuh tempo. Transfer wajib foto bukti. | `check_visit_payment_input`, `submit_plan_store_delivery` |
| LOG-C05 | Kurang bayar tidak menghambat driver; selisihnya tampil di halaman finance. | rencana nota cabang aturan 10 |
| LOG-C06 | Uang dibagi otomatis di server: nota **terbesar dulu**, sama besar Nota Gudang dulu. Potongan disetujui dikurangkan dulu dari nota pemilik barang. Lebihnya dicatat sebagai **lebih bayar (saldo konsumen)**. | `apply_visit_payment` |
| LOG-C07 | Driver dan kenek bisa mengubah pembayaran selama trip belum selesai; Kepala Gudang dan pemilik kapan saja; terkunci setelah diverifikasi. Mengubah cara bayar menjadi transfer **tidak meminta foto bukti**. | `update_plan_store_payment` |
| LOG-C08 | Kejadian di toko: tidak ada, salah muat, retur, barang lebih. Selain "tidak ada" wajib foto dan keterangan. | `check_visit_payment_input` |
| LOG-C09 | Driver dan kenek **masih bisa mengubah baris kunjungan langsung** (kebijakan update), termasuk kolom uang, melewati pintu server. Yang dijaga hanya kolom verifikasi. | kebijakan `logistics_plan_stores_update`, `trg_guard_logistics_office_verification` |
| LOG-C10 | Antar sendiri: pengantar memilih cara bayar dan mengetik uang diterima di Foto 2; satu nota, tanpa pembagian. Foto bukti transfer wajib hanya di layar, server belum memaksa. | `arrive_tp_stop`, rencana nota cabang (085) |

### Potong nota

| No | Aturan | Sumber |
|---|---|---|
| LOG-C11 | Driver menjawab "Apakah ini potong nota?". Per barang: nama, nominal, alasan (salah muat, rusak atau kedaluwarsa, kurang jumlah, harga beda, lainnya), nasib barang (dibawa kembali, atau memang tidak ada), dan pemilik barang (otomatis kalau hanya satu pemilik). Satu foto wajib. | `set_visit_cuts` |
| LOG-C12 | Potongan tidak boleh melebihi nota pemilik barang, dan hanya mengurangi nota pemilik itu (terbesar dulu). | `set_visit_cuts`, `apply_visit_payment` |
| LOG-C13 | Potong nota disimpan lewat **langkah kedua yang terpisah** setelah kunjungan terkirim. Kalau langkah kedua gagal, kunjungan sudah tercatat terkirim tanpa potongan. | `jalan/page.tsx`, rencana nota cabang bagian 8 |
| LOG-C14 | Potongan perlu disetujui (Owner, HR, atau finance; pesan di layar menyebut "Owner/Finance"). Sebelum diputuskan atau kalau ditolak (wajib alasan), potongan dihitung sebagai kurang bayar. Keputusan bisa diubah selama nota belum punya pelunasan. | `decide_visit_cut` |
| LOG-C15 | Setiap kali potongan diubah, daftar potongan dan retur potong nota yang lama **dihapus**, lalu dibuat ulang. | `set_visit_cuts` |
| LOG-C16 | Barang potongan yang dibawa kembali menjadi tugas antar ke pemiliknya, wajib foto saat diserahkan; trip tidak bisa selesai sebelum diantar. Setelah barang diterima, potongan terkunci. | `set_visit_cuts`, `guard_plan_store_returns` |

### Barang kejadian (salah muat, barang lebih)

| No | Aturan | Sumber |
|---|---|---|
| LOG-C17 | Per barang: nama barang terkirim, seharusnya barang apa (boleh kosong), jumlah (boleh kosong), pemilik, dan nasib: **dibawa pulang** (jadi tugas antar ke pemilik, wajib foto) atau **dibeli toko** (tidak ada barang kembali, hanya catatan untuk koreksi stok pemilik). | `set_visit_incident_items` |
| LOG-C18 | Kejadian dibeli toko dengan harga lebih murah dicatat lewat potong nota alasan "harga beda". Setiap perubahan menghapus dan membuat ulang daftar barang dan retur kejadiannya. | rencana nota cabang bagian 8C, `set_visit_incident_items` |

### Gagal dan Kirim Besok

| No | Aturan | Sumber |
|---|---|---|
| LOG-C19 | Driver memilih **Kirim Besok** (toko tutup, tidak ada orang) atau **Gagal** (ditolak, batal pesan); wajib alasan dan foto. | `fail_plan_store` |
| LOG-C20 | Kirim Besok: surat jalan kembali menunggu (tampil paling atas saat menyusun rencana), paket cabang kembali menunggu dijemput. | `handle_plan_store_outcome` |
| LOG-C21 | Gagal: surat jalan dan laporan muat menjadi **perlu keputusan**; kantor (atau cabang asal untuk barang cabang) memilih jadwal ulang atau batal, batal wajib alasan. | `decide_failed_note`, `decide_failed_loading` |
| LOG-C22 | Tertunda lebih dari 3 hari tampil merah untuk pemilik. Kepala Gudang atau pemilik bisa menutup tertunda dengan keterangan. Kalau toko itu akhirnya terkirim, tertunda lain untuk toko yang sama tertutup sendiri. | `get_postponed_overdue_count`, `close_postponed_visit` |
| LOG-C23 | Gagal di jalur antar sendiri: laporan muat **langsung dibatalkan**, tanpa langkah "perlu keputusan" seperti jalur driver. | `fail_tp_stop` |

### Retur (ambil barang dari toko)

| No | Aturan | Sumber |
|---|---|---|
| LOG-C24 | Retur ditandai Kepala Gudang, pemilik, atau finance dari Master Toko, dengan memilih cabang penerima. Satu toko hanya boleh punya satu retur kantor yang belum selesai. | `flag_store_return` |
| LOG-C25 | Retur masuk trip **hanya karena ditugaskan kantor** (trip draf, siap kirim, atau berjalan). Bisa dilepas kembali; trip batal mengembalikannya ke menunggu. Trip boleh berisi retur saja. | `assign_store_return`, `release_store_return`, memory retur |
| LOG-C26 | Retur yang belum ditugaskan dibatalkan dengan **menghapus barisnya**, tanpa alasan. | `toko/page.tsx` `cancelReturn` |
| LOG-C27 | Driver mencatat tiap barang: foto, nama, alasan, pemilik. **Tidak ada jumlah dan tidak ada nilai rupiah.** Barang bisa dihapus selama retur belum selesai. | `add_store_return_item`, `delete_store_return_item` |
| LOG-C28 | Selesai: foto posisi akhir dan keterangan lokasi. Barang milik cabang lain dipisah menjadi tugas antar ke pemiliknya. Kalau tidak ada barang: foto toko dan alasan. | `finish_store_return`, `finish_store_return_empty` |
| LOG-C29 | Trip tidak bisa selesai selama masih ada retur atau barang antar ke pemilik yang belum selesai. | `guard_plan_store_returns` |
| LOG-C30 | Penerimaan Retur: karyawan cabang penerima atau pemilik mengonfirmasi dengan foto. **Tidak ada pilihan "barang tidak sesuai" atau "kurang"**. | `receive_store_return` |
| LOG-C31 | Retur **tidak mengubah nota atau tagihan toko**. Pengurangan tagihan hanya lewat potong nota saat kunjungan. | semua fungsi retur |

### Verifikasi finance

| No | Aturan | Sumber |
|---|---|---|
| LOG-C32 | Tab "Uang Pengiriman" di Verifikasi Keuangan: per kunjungan **Cocok** atau **Tidak Cocok** (ketik angka benar, lalu dibagi ulang). Boleh Owner, HR, dan finance. | `verify_visit_payment`, `VerifikasiUangPengiriman.tsx` |
| LOG-C33 | Transfer wajib memilih rekening; cash dan deposit otomatis rekening Kas Tunai. | `resolve_verify_account` |
| LOG-C34 | Tempo tidak diverifikasi; langsung menjadi piutang resmi. | `fin_receivable_notas` |
| LOG-C35 | Verifikasi bisa dibatalkan kapan saja **tanpa alasan** (kecuali nota sudah punya pelunasan). Verifikasi ulang menimpa angka lama tanpa jejak. | `unverify_visit_payment`, `verify_visit_payment` |
| LOG-C36 | Antar sendiri diverifikasi per laporan muat, lewat fungsi lain dengan aturan yang sama. Laporan Pengiriman masih punya tombol verifikasi lama (cash dan deposit) yang diarahkan ke fungsi baru. | `verify_nota_payment`, `verify_cash_payment` |

### Piutang dan saldo konsumen

| No | Aturan | Sumber |
|---|---|---|
| LOG-C37 | Buku Piutang dihitung langsung dari nota sejak 10 Oktober 2026, tanpa saldo awal. Resmi = sudah diverifikasi atau tempo. Sisa = nota − potongan − bayar di lapangan − pelunasan. | `fin_receivable_notas`, `fin_receivables` |
| LOG-C38 | Pelunasan dicatat Owner atau finance (akun ber-role HR juga bisa): **setoran** (cash atau transfer) atau **pakai saldo konsumen**. Dibagi ke nota paling lama dulu. Tanggal pelunasan boleh diisi bebas. | `record_receivable_payment` |
| LOG-C39 | Membatalkan pelunasan **menghapus barisnya**. | `cancel_receivable_payment` |
| LOG-C40 | Nota yang sudah punya pelunasan terkunci dari ubah driver, verifikasi ulang, dan ubah nominal. | `guard_receivable_locked` |
| LOG-C41 | Cabang tidak bisa melihat piutang; hanya Owner dan finance. | `can_access_receivables` |

### Aliran ke Kas Masuk

| No | Aturan | Sumber |
|---|---|---|
| LOG-C42 | Uang terverifikasi otomatis masuk Kas Masuk per cabang pemilik nota, tetapi **baru berjalan kalau tanggal mulai laporan kasir diisi** (sekarang kosong). | `sync_visit_cash_in`, `cashier_report_settings` |
| LOG-C43 | Tanggal Kas Masuk berbeda per jenis: nota cabang = tanggal laporan muat dibuat; surat jalan = tanggal surat jalan; nota gudang lama dan lebih bayar = tanggal kunjungan. | `sync_visit_cash_in`, `sync_loading_cash_in` |
| LOG-C44 | Lebih bayar masuk Kas Masuk sebagai pemasukan cabang Gudang (atau cabang nota terbesar kalau tidak ada nota gudang). | `sync_visit_cash_in` |
| LOG-C45 | Setiap perubahan **menghapus** baris Kas Masuk otomatis lalu menulis ulang. | `sync_visit_cash_in` |
| LOG-C46 | Cabang Gudang dicari dengan **nama "Gudang"** di empat tempat (pembagian uang, pemilik potongan, Kas Masuk, Buku Piutang). | `apply_visit_payment`, `visit_cut_owners`, `sync_visit_cash_in`, `fin_receivable_notas` |

## 4C.4 Menu di sistem lama

| Menu | Sub menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|---|
| Logistik › Pengiriman (Jalankan) | Kirim (bukti, uang, kejadian, potong nota), Gagal, Retur, Antar ke Pemilik | Driver di toko | Lima jenis tugas di satu layar |
| Logistik › Tertunda | — | Kirim Besok yang belum terkirim | Surat jalan "perlu keputusan" ada di menu Surat Jalan |
| Logistik › Surat Jalan | Tab perlu keputusan | Memutuskan surat jalan gagal | Laporan muat gagal diputuskan di Laporan Muat |
| Logistik › Master Toko | Tandai Ada Retur, Masukkan ke Trip | Membuat tugas retur | Retur juga bisa dimasukkan dari Rencana |
| Logistik › Penerimaan Retur | — | Cabang mengonfirmasi barang kembali | Satu daftar untuk empat sumber barang kembali |
| Logistik › Laporan Pengiriman | Tombol verifikasi lama | Finance melihat uang per trip | Verifikasi juga di Verifikasi Keuangan |
| Keuangan › Verifikasi Keuangan › Uang Pengiriman | Belum, Sudah, Potong Nota | Cocok atau Tidak Cocok, memutuskan potongan | — |
| Keuangan › Buku Piutang | — | Sisa tagihan per toko, pelunasan, saldo konsumen | Kasir mungkin juga mencatat piutang penjualan (belum dipastikan) |

## 4C.5 Tumpang tindih

1. **Uang satu kunjungan disimpan di tiga tempat**: kolom kunjungan (Nota Gudang,
   ditambah lebih bayar), kolom surat jalan, dan kolom nota cabang di laporan
   muat. Setiap perubahan menghapus semua bagian lalu membagi ulang.
2. **"Deposit" tiga arti** (DP, campuran, Kas Tunai).
3. **Barang kembali dari empat sumber** (retur kantor, potong nota, kejadian,
   pecahan) dalam satu tabel dengan aturan berbeda per sumber.
4. **Gagal punya dua aturan**: jalur driver lewat "perlu keputusan", jalur antar
   sendiri langsung batal.
5. **Verifikasi dua pintu** (Verifikasi Keuangan dan tombol lama di Laporan
   Pengiriman) dan dua fungsi (kunjungan driver, antar sendiri).
6. **Tiga aturan tanggal** untuk Kas Masuk dari satu kunjungan.
7. **Piutang toko**: HRIS punya Buku Piutang sejak 10 Oktober 2026; sistem
   kasir kemungkinan juga mencatat piutang penjualan. Satu data, dua pemilik
   (WAJ-03) kalau benar.
8. Kunjungan, potong nota, dan kejadian disimpan lewat tiga langkah terpisah
   dari layar, bukan satu langkah.

## 4C.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| Toko bayar kurang | Tetap lolos, selisih jadi piutang | Ya |
| Toko bayar lebih | Saldo konsumen, dipakai finance untuk melunasi | Ya, tetapi masuk Kas Masuk sebagai pemasukan |
| Toko bayar sebagian cash, sebagian transfer | Pakai "deposit" | Ya, tetapi kata "deposit" berarti DP di layar |
| Driver salah ketik uang | Driver ubah sebelum trip selesai; sesudahnya kantor | Ya; ganti ke transfer tanpa foto bukti lolos |
| Uang yang diserahkan driver beda dengan laporannya | Finance pilih Tidak Cocok, ketik angka benar | Ya, tetapi tidak ada catatan siapa yang menanggung selisih |
| Finance salah verifikasi | Batalkan verifikasi | Ya, tanpa alasan dan tanpa jejak |
| Transfer belum dicek ke rekening | Menunggu di tab Belum | **Tidak ada batas waktu**: 14 transfer tidak pernah diverifikasi |
| Tempo lewat jatuh tempo | Tampil di Buku Piutang (sejak 10 Oktober) | Sebagian; 125 tempo lama tidak tercatat |
| Barang rusak di toko, toko minta potong | Potong nota, disetujui finance | Ya (belum pernah dipakai) |
| Potong nota gagal tersimpan | Tombol simpan ulang | Ya, tetapi kunjungan sudah terkirim tanpa potongan |
| Toko tutup | Kirim Besok, kembali ke antrean | Ya |
| Toko menolak barang | Gagal, kantor memutuskan | Ya (jalur antar sendiri langsung batal) |
| Retur salah ditandai | Dihapus | Ya, tetapi tanpa alasan dan tanpa jejak |
| Barang retur yang diterima cabang kurang atau beda | Tidak ada pilihan | **Tidak** |
| Toko mengembalikan barang yang sudah dibayar | Retur dicatat, tagihan tidak berubah | **Tidak** (kecuali potong nota saat kunjungan) |
| Pelunasan salah catat | Dibatalkan (dihapus) | Ya, tanpa jejak |

## 4C.7 Pertanyaan untuk pemilik (diajukan di percakapan, 12 Oktober 2026)

Butuh pandangan pemilik:

1. **Piutang toko milik siapa: kasir atau HRIS?** Usulan: kalau kasir sudah
   mencatat penjualan tempo, kasir pemilik piutang; HRIS hanya mencatat uang
   yang dibawa driver dan mengirimnya ke kasir. Kalau belum, HRIS pemilik
   sampai kasir siap.
2. **Retur mengurangi tagihan toko atau tidak?** Usulan: ya, retur diberi
   jumlah dan nilai rupiah, disahkan finance, dan menjadi pengurang tagihan
   atau saldo toko.
3. **Cara bayar.** Usulan: kata "deposit" dibuang; pilihan menjadi cash,
   transfer, campuran (cash dan transfer, dua angka), dan tempo. Bayar
   sebagian tidak perlu pilihan sendiri, karena kekurangannya otomatis menjadi
   piutang.

Cukup ok/tidak:

4. Lebih bayar dicatat sebagai **titipan toko**, bukan pemasukan cabang.
5. Tanggal Kas Masuk satu aturan: tanggal uang diterima di toko.
6. Semua uang termasuk transfer wajib diverifikasi finance paling lambat 3
   hari; lewat itu ditandai untuk pemilik. Membatalkan verifikasi wajib
   alasan dan tercatat.
7. Gagal di jalur antar sendiri disamakan dengan jalur driver (perlu keputusan
   kantor atau cabang asal).
8. Penerimaan retur bisa melaporkan "barang tidak sesuai" (kurang atau beda)
   dengan foto dan catatan, lalu ditinjau Kepala Gudang.
9. Yang memutuskan potong nota dan memverifikasi uang: finance dan pemilik
   (HR tidak).

## 4C.8 Usulan untuk v3 (belum disetujui)

| No | Usulan |
|---|---|
| AE1 | Kirim, uang, potong nota, dan kejadian disimpan dalam **satu langkah** di server: berhasil semua atau gagal semua. Driver tidak pernah mengubah baris kunjungan langsung (sejalan dengan 4B aturan 6). |
| AE2 | **Tidak ada yang dihapus**: potongan, retur, pelunasan, dan Kas Masuk otomatis dibatalkan dengan alasan, bukan dihapus (PRI-02). |
| AE3 | Satu daftar **nota** untuk semua jenis (surat jalan gudang, nota cabang), masing-masing dengan cabang pemilik. Bagian uang disimpan sekali per nota; kunjungan tidak menyimpan salinannya. |
| AE4 | Cabang Gudang ditandai dengan **jenis cabang**, bukan dicari dengan nama (WAJ-05). |
| AE5 | Verifikasi disimpan sebagai riwayat (siapa, angka, kapan, alasan kalau dibatalkan). |
| AE6 | Retur wajib berisi jumlah per barang. |
| AE7 | Satu aturan Gagal untuk dua jalur (pertanyaan 7). |
| AE8 | Foto bukti transfer dipaksa server di semua jalur, termasuk saat cara bayar diubah. |
| AE9 | Tempo yang lewat jatuh tempo tampil di daftar tagih untuk finance dan pemilik. |
| AE10 | Dibawa: pembagian uang ke nota terbesar dulu, kurang bayar tidak menghambat driver, potong nota per pemilik barang dengan persetujuan, barang kembali wajib diantar dengan foto dan menahan trip, retur hanya ditugaskan kantor, Kirim Besok dan Gagal dibedakan, tertunda lebih dari 3 hari merah, nota yang sudah dilunasi terkunci. |

## 4C.9 Jawaban pemilik (12 Oktober 2026)

| No | Jawaban |
|---|---|
| 1 | Piutang toko **dipegang sistem kasir** |
| 2 | Ya, retur mengurangi tagihan toko |
| 3 | "Cuma ada deposit, karena driver tidak bisa cek apakah transfernya sudah benar atau belum." Maksudnya belum pasti; ditanyakan ulang (F) |
| 4–9 | Ok |
| AE1–AE10 | Ok semua |

### Pertentangan dan hal yang ditanyakan ulang (diajukan di percakapan, 12 Oktober 2026)

- E: jawaban 1 (piutang di kasir) vs pertanyaan 4 (lebih bayar = titipan toko),
  jawaban 2 (retur mengurangi tagihan), dan AE9 (daftar tagih di HRIS).
  Titipan, tagihan, dan daftar tagih adalah bagian dari buku piutang, jadi
  kalau piutang milik kasir, ketiganya juga di kasir. Usulan: HRIS tidak punya
  Buku Piutang; HRIS mengirim ke kasir uang terverifikasi per nota, potong nota
  yang disetujui, retur yang disahkan beserta nilainya, dan lebih bayar. Selama
  sambungan ke kasir belum menyala, finance mencatatnya di kasir dengan tangan
  dari daftar kiriman di HRIS (pola sama dengan 4A pertentangan A).
- F: arti jawaban 3. Tafsiran yang diajukan: pilihan driver menjadi cash,
  deposit, tempo; "deposit" = toko mengaku sudah transfer, driver tidak bisa
  memeriksa, finance yang memastikan uangnya masuk rekening. Pilihan
  "transfer" terpisah dibuang. Ditanyakan juga: bayar campuran (sebagian cash,
  sebagian deposit) diketik dua angka, dan foto bukti dari toko tetap wajib
  (AE8).

Jawaban pemilik atas E dan F (12 Oktober 2026):

- E: **setuju**, dengan catatan: yang menagih biasanya **orang kantor**, karena
  kasir tidak akan sempat menjadi penagih.
- F: pilihan **transfer tetap ada**, wajib foto bukti. Kalau tidak ada bukti,
  driver memilih deposit atau tempo. Kata pemilik: deposit itu sering hanya
  cara halus konsumen untuk tempo.
- F a (bayar campuran): kasusnya ada tetapi jarang; pemilik meminta saran.
  Saran Claude: pilihan **Campuran** dengan dua angka (cash dan transfer) dan
  foto bukti untuk bagian transfer. **Disetujui pemilik.**
- F b (foto bukti wajib): ok.

## 4C.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 4E)

Uang di lapangan:

1. Cara bayar: **cash, transfer, deposit, tempo**. Transfer wajib foto bukti
   dari toko, dipaksa server di semua jalur, termasuk saat cara bayar diubah
   (AE8). Tanpa bukti, driver memilih deposit atau tempo. **Deposit** = toko
   mengaku sudah atau akan transfer tanpa bukti; finance memastikan uangnya
   masuk rekening, dan yang tidak masuk menjadi sisa tagihan. Jenis:
   **pengganti** LOG-C02 dan LOG-C03 (deposit tidak lagi berarti DP atau
   campuran).
2. Pilihan **Campuran** untuk kasus jarang: dua angka, cash dan
   transfer, dengan foto bukti untuk bagian transfer. Jenis: **pengecualian**
   atas "satu cara bayar per kunjungan".
3. Driver mengetik uang diterima; kurang bayar tidak menghambat driver; uang
   dibagi ke nota terbesar dulu, sama besar Nota Gudang dulu (AE10).
4. Kirim, uang, potong nota, dan kejadian disimpan dalam satu langkah di
   server; driver tidak mengubah baris kunjungan langsung (AE1).
5. Satu daftar nota untuk nota gudang dan nota cabang; bagian uang disimpan
   sekali per nota (AE3). Cabang Gudang dikenali dari jenis cabang, bukan nama
   (AE4).
6. Lebih bayar adalah **titipan toko**, bukan pemasukan cabang; dicatat di
   kasir (pertanyaan 4, E). Jenis: **pengganti** LOG-C44.

Potong nota dan barang kembali:

7. Potong nota per pemilik barang, disetujui finance atau pemilik; HR tidak
   (pertanyaan 9). Jenis: **pengganti** LOG-C14 (HR tidak lagi memutuskan).
8. Barang yang kembali wajib diantar ke pemiliknya dengan foto dan menahan
   trip sampai selesai (AE10).

Gagal dan Kirim Besok:

9. Kirim Besok dan Gagal dibedakan. Gagal di kedua jalur (truk gudang dan
   antar sendiri) menunggu keputusan kantor atau cabang asal (pertanyaan 7,
   AE7). Tertunda lebih dari 3 hari ditandai merah. Jenis: **pengganti**
   LOG-C23.

Retur:

10. Retur hanya ditugaskan kantor dan wajib berisi jumlah per barang (AE6).
    Nilainya disahkan finance dan **mengurangi tagihan toko** di kasir
    (jawaban 2, E). Jenis: **pengganti** LOG-C27 dan LOG-C31.
11. Penerimaan retur bisa melaporkan "barang tidak sesuai" dengan foto dan
    catatan, lalu ditinjau Kepala Gudang (pertanyaan 8).

Verifikasi dan Kas Masuk:

12. Semua uang selain tempo diperiksa finance atau pemilik paling lambat 3
    hari; lewat itu ditandai untuk pemilik. Rekening dipilih finance untuk
    transfer dan deposit; cash masuk kas tunai. Membatalkan pemeriksaan wajib
    alasan, dan setiap pemeriksaan tersimpan sebagai riwayat (pertanyaan 6,
    AE5). Jenis: **pengganti** LOG-C33 dan LOG-C35.
13. Tanggal Kas Masuk = tanggal uang diterima di toko (pertanyaan 5). Jenis:
    **pengganti** LOG-C43.

Piutang:

14. Piutang toko **milik sistem kasir**; HRIS tidak punya Buku Piutang. HRIS
    mengirim ke kasir: uang terverifikasi per nota, potong nota yang
    disetujui, retur yang disahkan beserta nilainya, dan titipan toko. Selama
    sambungan ke kasir belum menyala, finance mencatatnya di kasir dengan
    tangan dari daftar di HRIS (E). Jenis: **pengganti** LOG-C37 s.d. C41.
15. Yang menagih adalah **orang kantor**. Daftar tagih (termasuk tempo lewat
    jatuh tempo) dibaca dari kasir dan ditampilkan untuk kantor dan pemilik.
    Jenis: **pengganti** AE9 (daftar tagih bukan milik HRIS). Pelunasan dari
    tagihan dicatat orang kantor langsung di sistem kasir (disetujui pemilik).

Umum:

16. Tidak ada catatan uang atau barang yang dihapus; semuanya dibatalkan
    dengan alasan (AE2).

Aturan LOG-C yang tidak disinggung jawaban di atas dibawa apa adanya; diperiksa
ulang saat penetapan 4E.

**4C selesai dibahas.** Tidak ada pertanyaan 4C yang menunggu.

---

# Bagian 4D: Grooming dan laporan

Sumber: `hris-app/app/(dashboard)/logistik/grooming/page.tsx` (1.465 baris),
`logistik/dashboard/page.tsx` (245), `logistik/laporan/page.tsx` (836), bagian
grooming dan bonus di `logistik/kirim-barang/page.tsx` (1.191);
`hris-app/docs/RENCANA-PENGIRIMAN-GROOMING.md`; migrasi `069` s.d. `074` dan
`080`; fungsi grooming dan ongkir, tabel `grooming_*`, kebijakan akses di
database.

Bonus grooming dan ongkir sudah dibahas dari sisi gaji di Bab 3 (GAJ-24 s.d.
34; galian GAJ-C24 s.d. C29). Di sini digali alur order grooming yang
melahirkan bonus itu, serta dashboard dan laporan Logistik.

## 4D.1 Bagian ini mengurus apa

Layanan grooming kucing: order diterima di cabang, kucing dijemput atau datang
sendiri, dikerjakan di cabang pengerja, lalu diantar atau diambil pelanggan.
Dari order yang selesai lahir bonus grooming (untuk groomer) dan bonus ongkir
(untuk penjemput dan pengantar). Juga dua layar pantauan untuk kantor:
Dashboard Pengiriman dan Laporan Pengiriman.

## 4D.2 Data di sistem lama (dicek ke database, 12 Oktober 2026)

| Data | Isinya | Tabel | Jumlah baris |
|---|---|---|---|
| Pengaturan cabang grooming | Cabang mana mengerjakan, cabang penerima diteruskan ke mana | `logistics_store_branches` | 4 (2 mengerjakan, 2 meneruskan) |
| Order grooming | Cabang penerima dan pengerja, pelanggan, nomor nota, foto struk, cara datang dan pulang, ongkir dan petugas per perjalanan, status, foto tiap tahap | `grooming_orders` (33 kolom) | 5, semua selesai (sejak 8 Oktober 2026) |
| Kucing per order | Harga, groomer, foto selesai, paksa lanjut, tanda ganti groomer | `grooming_order_cats` | 7 |
| Jejak ganti groomer, harga, petugas, ongkir | Dari, ke, oleh, kapan, alasan | `grooming_groomer_changes`, `_price_changes`, `_assignment_changes`, `_ongkir_changes` | 7 (semuanya penugasan awal), 0, 0, 0 |
| Groomer tambahan | Orang di luar cabang pengerja yang selalu muncul di pilihan groomer | `grooming_extra_groomers` | 1 (jabatan Owner, tanpa akun, belum pernah dipilih) |
| Buku bonus grooming | Bonus groomer yang bukan target promo | `grooming_bonus_ledger` | 5, semua disahkan |
| Laporan promo otomatis dari grooming | Bonus groomer yang terdaftar di target promo | `promo_sales_reports` bertanda kucing | 2, menunggu |
| Lapor manual grooming | Groomer melapor sendiri lewat Penjualan Promo | `promo_sales_reports` produk grooming | 8, semua menunggu (22 September s.d. 10 Oktober) |
| Pengaturan grooming | Tanggal tutup lapor manual | `grooming_settings` | 1, **tanggal kosong** |
| Perjalanan antar sendiri | Tujuan barang, jemput kucing, serah kucing, antar kucing | `logistics_tp_trip_stops` | 8 barang, 4 jemput, 4 serah, 4 antar |
| Tanda perlu isi bensin | Dari laporan garasi driver | kolom `needs_refuel` di `logistics_delivery_plans` | 13 menyala |

Keadaan data:

- Order grooming baru dipakai sejak 8 Oktober 2026: 5 order (4 dijemput dan
  diantar, 1 datang dan diambil sendiri; 1 lintas cabang; 1 memakai jalur
  darurat foto tunggal), 7 kucing, 1 kucing diselesaikan dengan paksa lanjut.
- Bonusnya terbagi dua jalur: 5 kucing di buku bonus grooming (disahkan), 2
  kucing di laporan promo otomatis (masih menunggu).
- **Lapor manual grooming masih terbuka** karena tanggal tutupnya belum diisi:
  5 laporan manual masuk setelah order grooming dipakai. Tidak ada yang sama
  groomer dan sama hari dengan kucing dari order, jadi belum terlihat dobel.
  Kedelapan laporan manual belum diperiksa, yang tertua sejak 22 September.
- Belum ada slip yang memuat bonus grooming atau ongkir (slip Oktober belum
  dibuat).
- **Ke-13 tanda "perlu isi bensin" masih menyala semua**; tidak satu pun
  pernah ditandai "Sudah Diisi".

## 4D.3 Aturan yang ditemukan

### Pengaturan grooming

| No | Aturan | Sumber |
|---|---|---|
| LOG-D01 | Tiap cabang toko diatur: mengerjakan grooming sendiri, meneruskan order ke cabang pengerja lain (Toko Depan ke Toko Pusat, Markas ke Raja), atau tidak menerima order. Hanya pemilik yang mengubah. | `save_grooming_branch_settings`, `get_groom_branch_id` |
| LOG-D02 | Daftar harga grooming dan persen bonusnya diambil dari **produk promo** grooming cabang pengerja (modul Penjualan Promo). Produk itu disalin otomatis ke periode baru kalau belum ada; produk yang dimatikan dianggap sengaja. | `get_grooming_price_options`, `ensure_grooming_promo_product` |
| LOG-D03 | Pengaturan grooming tersebar di empat tempat: cabang grooming (tab di Master Toko), harga dan persen (produk promo), tanggal tutup lapor manual (tab Persetujuan Bonus), groomer tambahan (tabel yang hanya diubah pemilik). | halaman-halaman terkait |

### Order grooming

| No | Aturan | Sumber |
|---|---|---|
| LOG-D04 | Order dibuat karyawan cabang penerima order (pemilik boleh untuk cabang mana pun). Jabatan Groomer **tidak boleh** membuat order (supaya tidak menentukan bonusnya sendiri); jabatan itu dikenali dari **nama jabatan** yang diawali "groomer". | `create_grooming_order`, `is_my_position_groomer` |
| LOG-D05 | Foto struk dan **nomor nota wajib**; nomor disimpan huruf besar dan unik per cabang, kecuali order batal (nomornya bebas dipakai lagi). Nomor diketik tangan, tidak dicocokkan dengan sistem kasir. | `create_grooming_order` |
| LOG-D06 | Pelanggan dipilih dari Master Toko (jenis pelanggan), wajib nomor HP yang unik di antara pelanggan; bisa dibuat baru dari layar order. | `quick_create_logistics_store`, `set_logistics_store_phone` |
| LOG-D07 | Per kucing: harga dipilih dari daftar harga, dan groomer dipilih (boleh beda per kucing). Calon groomer: karyawan aktif cabang pengerja ditambah daftar groomer tambahan. Groomer boleh tidak punya akun. | `list_groomer_candidates`, `is_valid_groomer` |
| LOG-D08 | Cara datang (dijemput atau datang sendiri) dan cara pulang (diantar atau diambil sendiri) bebas dikombinasikan. Dijemput atau diantar wajib ongkir dan petugas untuk perjalanan itu. | `create_grooming_order` |
| LOG-D09 | Status order: **menunggu** → **dikerjakan** (foto kucing sampai di cabang pengerja) → **siap** (semua kucing selesai) → **selesai** (foto serah terima), atau **batal**. | `grooming_orders` |
| LOG-D10 | Foto selesai per kucing oleh groomernya, paling cepat 5 menit sejak kucing sampai. | `finish_grooming_cat` |
| LOG-D11 | **Paksa lanjut**: pembuat order atau pemilik boleh menandai tahap selesai atas nama orang lain (misalnya groomer tanpa akun), wajib foto dan alasan minimal 5 huruf, tercatat. | `finish_grooming_cat` |
| LOG-D12 | Lintas cabang dan diambil sendiri: kucing dikembalikan dulu ke cabang penerima dengan foto "diterima" oleh karyawan cabang itu, baru diserahkan ke pelanggan. Foto kucing sampai (datang sendiri) hanya oleh karyawan cabang pengerja. | `mark_grooming_returned`, `mark_grooming_arrived` |
| LOG-D13 | Ganti groomer sampai kucing selesai, wajib alasan, tercatat; ganti setelah dikerjakan diberi tanda ⚠. **Layar** hanya memberi tombol ke pembuat order dan pemilik; **server** mengizinkan juga karyawan cabang penerima dan pengerja. | `change_grooming_groomer`, `grooming/page.tsx` baris 439 |
| LOG-D14 | Koreksi harga oleh pembuat order atau pemilik, wajib alasan, tercatat; ditolak kalau bonus kucing itu sudah disahkan. | `correct_grooming_price` |
| LOG-D15 | Batal kapan pun; order yang sudah selesai hanya oleh pemilik. Batal **menggugurkan semua bonus** (grooming dan ongkir) dan melepas tugas perjalanan yang belum difoto. **Layar** hanya memberi tombol ke pembuat order dan pemilik; **server** mengizinkan juga karyawan cabang penerima. | `cancel_grooming_order`, `grooming/page.tsx` baris 437 |

### Jemput dan antar kucing

| No | Aturan | Sumber |
|---|---|---|
| LOG-D16 | Tugas jemput dan antar kucing tampil di **Kirim Barang** (mesin perjalanan antar sendiri, 4B); satu perjalanan boleh berisi barang dan kucing sekaligus. Jemput selalu berpasangan dengan "serah kucing" di cabang pengerja; kalau cabang pengerja = cabang petugas, serah otomatis dengan foto kembali. | `start_tp_trip`, `arrive_tp_stop`, `finish_tp_trip` |
| LOG-D17 | Ganti penjemput atau pengantar hanya sebelum foto berangkat, wajib alasan. Ongkir diubah setelah perjalanan diambil hanya oleh pemilik. Semuanya tercatat. | `reassign_grooming_leg`, `set_grooming_ongkir` |
| LOG-D18 | **Jalur darurat**: kalau perjalanan tidak bisa dipakai, pembuat order atau pemilik memotret sampai atau serah terima sendiri dengan alasan; ditolak selama perjalanannya masih berjalan, dan ongkir perjalanan itu **tidak menjadi bonus**. | `mark_grooming_arrived`, `complete_grooming_handover` |

### Bonus dari grooming dan ongkir

| No | Aturan | Sumber |
|---|---|---|
| LOG-D19 | Saat order selesai, tiap kucing menghasilkan bonus untuk **groomer terakhir** = persen × harga (bawaan 10%). | `create_grooming_bonus_records` |
| LOG-D20 | Bonus itu masuk **dua jalur** (GAJ-C25): groomer yang terdaftar di target produk promo grooming cabangnya menjadi laporan promo otomatis bertanggal **kucing selesai**; selain itu masuk buku bonus grooming berperiode **order selesai**. Dua tanggal untuk bonus yang sama. | `create_grooming_bonus_records`, `grooming_promo_product_for` |
| LOG-D21 | Lapor manual grooming lewat Penjualan Promo tetap terbuka sampai tanggal tutup diisi pemilik (sekarang kosong). Laporan yang sama groomer, tanggal, dan harganya dengan kucing dari order diberi tanda merah "mungkin dobel". | `submit_promo_sales_report`, `grooming_order_cat_exists` |
| LOG-D22 | Buku bonus grooming disahkan pemilik, HR, atau finance; boleh dikembalikan ke menunggu atau diubah kapan saja, tanpa memeriksa apakah slipnya sudah ditutup. Yang diperbarui hanya slip draf. | `review_grooming_bonus`, `resync_grooming_bonus_payroll` |
| LOG-D23 | Bonus ongkir 50% (dibulatkan ke bawah) untuk petugas perjalanan yang selesai normal; perjalanan kucing hanya kalau ordernya selesai; masuk periode tanggal paling akhir antara kembali dan order selesai (GAJ-C27 s.d. C29). | `tp_ongkir_bonus_items` |
| LOG-D24 | Rekap Bonus menggabungkan tiga sumber (promo otomatis, buku grooming, lapor manual) dalam satu daftar per periode gaji; karyawan melihat miliknya sendiri. | `get_grooming_bonus_recap` |

### Dashboard Pengiriman

| No | Aturan | Sumber |
|---|---|---|
| LOG-D25 | Menampilkan **hanya trip truk gudang** yang sedang berjalan (siap, berangkat, menuju garasi) dengan progres toko, diperbarui tiap 20 detik. Perjalanan antar sendiri, order grooming, tertunda, retur, dan uang belum diperiksa tidak tampil. | `dashboard/page.tsx` |
| LOG-D26 | Kotak "Perlu Isi Bensin" (20 terakhir) dengan tombol "Sudah Diisi" yang mengubah baris trip langsung dari layar, tanpa nominal sebenarnya dan tanpa catatan siapa. Layar memberi tombol ke HR dan finance, tetapi **database hanya mengizinkan Kepala Gudang dan pemilik**: untuk HR dan finance tombol tidak berbuat apa-apa dan tidak ada pesan. | `dismissRefuel`, kebijakan `logistics_plans_update_admin` |
| LOG-D27 | Sakelar jeda garasi 30 menit untuk pemilik (sudah dibahas di 4B). | `logistics_settings` |
| LOG-D28 | Hak lihat: pemilik, HR, finance, Kepala Gudang; dijaga di layar. | `dashboard/page.tsx` |

### Laporan Pengiriman

| No | Aturan | Sumber |
|---|---|---|
| LOG-D29 | Per **bulan kalender** (bukan periode 26–25), hanya trip truk gudang (siap sampai selesai): mobil, awak, toko, cara bayar, foto, retur, tugas belanja. | `laporan/page.tsx` |
| LOG-D30 | Ringkasan uang (sudah dan belum diverifikasi, selisih) dan **"Sisa Piutang Konsumen"** dihitung di layar: rumus ketiga di samping verifikasi finance dan Buku Piutang. | `laporan/page.tsx` |
| LOG-D31 | Tombol verifikasi lama untuk cash dan deposit masih ada (LOG-C36). | `verify_cash_payment` |
| LOG-D32 | Tidak bisa diunduh. Antar sendiri dan grooming tidak punya laporan kantor; yang ada hanya riwayat di Kirim Barang dan tab Riwayat order grooming (per periode gaji, rekap per groomer). | `laporan/page.tsx`, `kirim-barang`, `grooming/page.tsx` |

## 4D.4 Menu di sistem lama

| Menu | Sub menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|---|
| Logistik › Order Grooming | Order Aktif, Buat Order, Riwayat, Persetujuan Bonus, Rekap Bonus | Seluruh alur grooming dan bonusnya | Bonus grooming juga disahkan di Penjualan Promo |
| Logistik › Master Toko | Tab Cabang Grooming | Pengaturan cabang pengerja | Pengaturan grooming lain di tiga tempat lain |
| Penjualan Promo | Produk grooming, lapor manual | Harga, persen bonus, target, lapor manual | Bonus grooming jalur kedua |
| Logistik › Kirim Barang | Tugas jemput dan antar kucing, bonus ongkir | Perjalanan antar sendiri | Satu-satunya pantauan perjalanan antar sendiri |
| Logistik › Dashboard Pengiriman | Bensin, sakelar jeda garasi | Pantauan trip truk | Hanya trip truk |
| Logistik › Laporan Pengiriman | Ringkasan uang, rincian trip | Laporan bulanan trip truk | Uang juga di Verifikasi Keuangan dan Buku Piutang |

## 4D.5 Tumpang tindih

1. **Bonus grooming dua jalur dan dua tanggal** (laporan promo bertanggal
   kucing selesai, buku grooming berperiode order selesai), disahkan di dua
   halaman. Sudah diputuskan satu jalur (GAJ-26); yang belum: tanggalnya.
2. **Lapor manual dan order otomatis berjalan bersamaan** karena tanggal tutup
   kosong: satu kucing bisa dilaporkan dua kali, dan penjaganya hanya tanda
   merah.
3. **Pengaturan grooming di empat tempat** (LOG-D03), dan harga grooming
   menumpang pada produk promo.
4. **Hak ganti groomer dan batal berbeda** antara layar dan server
   (LOG-D13, D15).
5. **Laporan memakai bulan kalender**, padahal bonus dan gaji memakai periode
   26–25.
6. **Sisa piutang dihitung di layar laporan**, padahal piutang sudah
   diputuskan milik kasir (4C.10 aturan 14).
7. **Pantauan terpecah**: trip truk di Dashboard, perjalanan antar sendiri
   (termasuk tanda lebih dari 6 jam) di Kirim Barang, tertunda di menu
   Tertunda, transfer belum diperiksa di Verifikasi Keuangan, grooming di
   Order Grooming. Tidak ada satu layar untuk "apa yang perlu perhatian hari
   ini".

## 4D.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| Groomer tidak punya akun | Paksa lanjut oleh pembuat order atau pemilik, dengan foto dan alasan | Ya |
| Groomer diganti di tengah pengerjaan | Ganti dengan alasan, tanda ⚠, bonus ke groomer terakhir | Ya |
| Pelanggan menambah layanan | Koreksi harga sebelum bonus disahkan | Ya; setelah disahkan **tidak ada** |
| Pelanggan batal setelah kucing dijemput | Batal, semua bonus gugur termasuk ongkir penjemput | Ya, tetapi penjemput tidak dibayar walau sudah berangkat |
| Petugas jemput berhalangan | Ganti sebelum foto berangkat; sesudahnya pemilik memindah perjalanan | Ya |
| Perjalanan tidak bisa dipakai | Jalur darurat foto tunggal | Ya, ongkir tidak jadi bonus |
| Groomer melapor manual juga | Tanda merah "mungkin dobel" | Sebagian; tetap bisa disahkan dua kali |
| Bonus disahkan setelah slip dibuat | Hanya slip draf yang diperbarui | **Tidak** (sudah diputuskan di Bab 3: masuk slip berikutnya) |
| Nomor nota salah ketik | Tidak bisa diubah; batal lalu buat ulang | Sebagian |
| HR atau finance menekan "Sudah Diisi" bensin | Tidak terjadi apa-apa, tanpa pesan | **Tidak** |
| Uang bensin sebenarnya beda dari perkiraan | Tidak ada tempat mencatat | **Tidak** |

## 4D.7 Pertanyaan untuk pemilik (diajukan di percakapan, 12 Oktober 2026)

Butuh pandangan pemilik:

1. **Pertentangan G: groomer tambahan berjabatan Owner.** Rencana lama: orang
   ini selalu muncul di pilihan groomer dan **mendapat bonus grooming**.
   Aturan v3 GAJ-09: jabatan Pemilik **tidak menerima bonus**. Saran: orang
   berjabatan Pemilik tetap bisa dipilih sebagai groomer (supaya tercatat siapa
   yang mengerjakan), tetapi bonusnya tidak dibuat.
2. **Order grooming dan sistem kasir.** Nomor nota grooming diketik tangan
   dari struk kasir. Saran: sama dengan surat jalan (4A pertentangan A):
   manual dulu, modul tarik data kasir disiapkan supaya kelak nomor nota dan
   harga dicocokkan otomatis dengan nota kasir.
3. **Target dan lapor manual grooming.** Saran: di v3 tidak ada lapor manual
   grooming; setiap kucing dari order yang selesai menjadi satu baris Buku
   Bonus jenis Grooming. Kalau target cabang grooming masih dipakai, angkanya
   dihitung dari jumlah kucing selesai, bukan dari laporan promo.

Cukup ok/tidak:

4. Bonus grooming bertanggal **order selesai** (satu tanggal, sama dengan
   ongkir kucing).
5. Pengaturan grooming di satu tempat: cabang pengerja dan daftar harga,
   bertanggal berlaku, lepas dari produk promo. Persen bonus grooming dan
   ongkir menjadi pengaturan jenis bonus (GAJ-25).
6. Ganti groomer, koreksi harga, dan batal: pembuat order dan pemilik
   (mengikuti layar); server memakai daftar yang sama.
7. Satu **Dashboard Logistik** "perlu perhatian hari ini": trip truk dan
   perjalanan antar sendiri yang berjalan, order grooming aktif, tertunda
   lebih dari 3 hari, uang belum diperiksa lebih dari 3 hari, trip belum
   ditutup, permintaan bensin. Dilihat pemilik dan Kepala Gudang; finance
   melihat bagian uang.
8. Laporan Logistik memakai periode 26–25 atau tanggal bebas, mencakup semua
   jalur (truk, antar sendiri, grooming), angka uang dibaca dari hasil
   pemeriksaan finance (tidak dihitung di layar), tanpa piutang, dan bisa
   diunduh Excel.
9. Bensin: "Sudah Diisi" dicatat dengan nominal sebenarnya, foto struk, dan
   siapa; oleh Kepala Gudang, finance, atau pemilik. Alirannya ke pengeluaran
   dibahas di Bab 6.

## 4D.8 Usulan untuk v3 (belum disetujui)

| No | Usulan |
|---|---|
| AF1 | Setiap langkah order grooming satu langkah di server; hak dicek di server, layar hanya mengikuti. |
| AF2 | Satu jalur bonus grooming ke Buku Bonus, untuk groomer terakhir; tanda ⚠ ganti groomer tampil di Persetujuan Bonus. |
| AF3 | Bonus ongkir dicatat otomatis ke Buku Bonus, persen dari pengaturan jenis bonus, dibulatkan ke bawah. |
| AF4 | Cabang toko dan cabang pengerja grooming ditandai dengan pengaturan cabang, bukan nama; jabatan yang tidak boleh membuat order diatur di pengaturan jabatan, bukan nama jabatan di kode (WAJ-05). |
| AF5 | Tidak ada yang dihapus: order batal tetap tercatat beserta alasannya (PRI-02). |
| AF6 | Dibawa: foto struk dan nomor nota unik per cabang, pelanggan dengan HP unik, empat kombinasi datang dan pulang, jemput dan antar lewat mesin perjalanan yang sama, foto selesai paling cepat 5 menit, paksa lanjut berfoto dan beralasan, batal menggugurkan bonus, lintas cabang dengan foto diterima cabang penerima, jalur darurat tanpa bonus ongkir. |
| AF7 | Dashboard dan laporan hanya membaca angka dari pemiliknya (satu rumus, WAJ-04), tidak menghitung sendiri. |

## 4D.9 Jawaban pemilik (12 Oktober 2026)

| No | Jawaban |
|---|---|
| 1 | Pemilik memang bisa mengerjakan grooming karena dia **pelatih grooming**, dan **tetap mendapat bonus**. Bertentangan dengan GAJ-09; ditanyakan ulang (pertentangan G, di bawah) |
| 2 | Ya, disiapkan (manual dulu, modul tarik data kasir disiapkan) |
| 3 | Ok, ikuti saran |
| 4–9 | Ok |
| AF1–AF7 | Ok semua (dijawab bersama pertentangan G) |

### Pertentangan G (diajukan di percakapan, 12 Oktober 2026)

Jawaban 1 bertabrakan dengan GAJ-09 dan GAJ-30 (jabatan Pemilik tidak
menerima bonus), dan dengan GAJ-26 (bonus disahkan HR dan pemilik: pemilik
bisa mengesahkan bonusnya sendiri). Usulan: **pengecualian** atas GAJ-09,
yaitu jenis bonus bisa diatur "boleh untuk jabatan Pemilik"; untuk sekarang
hanya Bonus Grooming. Bonus milik seorang pemilik tidak boleh disahkan oleh
dirinya sendiri, dan hanya terlihat oleh para pemilik (sejalan dengan
GAJ-46). Ditanyakan juga: orang itu salah satu dari 3 pemilik (KAR-59), atau
hanya tercatat berjabatan Owner di sistem lama.

Jawaban pemilik atas G (12 Oktober 2026): orang itu **memang salah satu
pemilik**; pengecualian bonus pemilik **disetujui**. AF1–AF7 **ok semua**.
GAJ-09 dan GAJ-30 di `../03-gaji.md` sudah diberi pengecualian ini.

## 4D.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 4E)

Order grooming:

1. Setiap langkah order grooming satu langkah di server; hak dicek di server,
   layar hanya mengikuti (AF1).
2. Ganti groomer, koreksi harga, dan batal order: **pembuat order dan
   pemilik** saja; order yang sudah selesai dibatalkan hanya oleh pemilik
   (pertanyaan 6). Jenis: **pengganti** LOG-D13 dan LOG-D15 (karyawan cabang
   penerima dan pengerja tidak lagi boleh).
3. Nomor nota dan foto struk wajib, nomor unik per cabang. Tahap awal nomor
   diketik tangan; modul tarik data kasir disiapkan sejak awal supaya kelak
   nomor nota dan harga dicocokkan otomatis dengan nota kasir (pertanyaan 2,
   pola sama dengan 4A pertentangan A).
4. Pengaturan grooming di **satu tempat**, bertanggal berlaku: cabang
   pengerja dan daftar harga, lepas dari produk promo (pertanyaan 5). Cabang
   toko, cabang pengerja, dan jabatan yang tidak boleh membuat order dikenali
   dari pengaturan, bukan nama (AF4). Jenis: **pengganti** LOG-D02 dan D03.
5. Order batal tetap tercatat beserta alasannya, tidak dihapus (AF5).
6. Dibawa (AF6): pelanggan dengan HP unik, empat kombinasi datang dan pulang,
   jemput dan antar lewat mesin perjalanan antar sendiri, foto selesai paling
   cepat 5 menit, paksa lanjut berfoto dan beralasan, batal menggugurkan
   semua bonus, lintas cabang dengan foto diterima cabang penerima, jalur
   darurat tanpa bonus ongkir.

Bonus:

7. **Satu jalur**: tiap kucing dari order yang selesai menjadi satu baris
   Buku Bonus jenis Grooming untuk groomer terakhir, bertanggal **order
   selesai**; tanda ⚠ ganti groomer tampil di Persetujuan Bonus
   (pertanyaan 3 dan 4, AF2). **Tidak ada lapor manual grooming** di v3.
   Jenis: **pengganti** LOG-D20 s.d. D22.
8. Target cabang grooming, kalau dipakai, dihitung dari jumlah kucing
   selesai, bukan dari laporan promo (pertanyaan 3).
9. Bonus ongkir dicatat otomatis ke Buku Bonus; persen bonus grooming dan
   ongkir adalah pengaturan jenis bonus, dibulatkan ke bawah (pertanyaan 5,
   AF3, GAJ-25).
10. Pemilik yang mengerjakan grooming **menerima Bonus Grooming**: pengecualian
    atas GAJ-09 lewat pengaturan jenis bonus "boleh untuk jabatan Pemilik".
    Bonus pemilik tidak disahkan dirinya sendiri dan hanya terlihat oleh para
    pemilik (pertentangan G). Jenis: **pengecualian**.

Dashboard dan laporan:

11. Satu **Dashboard Logistik "perlu perhatian hari ini"**: trip truk dan
    perjalanan antar sendiri yang berjalan, order grooming aktif, tertunda
    lebih dari 3 hari, uang belum diperiksa lebih dari 3 hari, trip belum
    ditutup, permintaan bensin. Pemilik dan Kepala Gudang melihat semua;
    finance bagian uang (pertanyaan 7). Jenis: **pengganti** LOG-D25 dan D28.
12. Laporan Logistik: periode 26–25 atau tanggal bebas, semua jalur (truk,
    antar sendiri, grooming), angka uang dibaca dari hasil pemeriksaan
    finance, tanpa piutang, bisa diunduh Excel (pertanyaan 8). Jenis:
    **pengganti** LOG-D29, D30, D32.
13. Dashboard dan laporan hanya membaca angka dari pemiliknya, tidak
    menghitung sendiri (AF7, WAJ-04).
14. Bensin "Sudah Diisi" dicatat lewat server dengan nominal sebenarnya, foto
    struk, dan siapa; oleh Kepala Gudang, finance, atau pemilik. Alirannya ke
    pengeluaran dibahas di Bab 6 (pertanyaan 9). Jenis: **pengganti** LOG-D26.

Aturan LOG-D yang tidak disinggung jawaban di atas dibawa apa adanya;
diperiksa ulang saat penetapan 4E.

**4D selesai dibahas.** Tidak ada pertanyaan 4D yang menunggu.

---

# Bagian 4E: Penetapan

Dimulai 12 Oktober 2026. Hasilnya `../04-logistik.md`.

## 4E.1 Pertentangan dan hal yang belum diatur (diajukan di percakapan, 12 Oktober 2026)

Ke-60 aturan dari 4A.10, 4B.10, 4C.10, dan 4D.10, ditambah aturan LOG-A s.d.
LOG-D yang dibawa apa adanya, dicocokkan satu sama lain dan dengan KAR, KEH,
GAJ, dan PRI.

Butuh pandangan pemilik:

1. **Tanggal trip.** 4A.10 aturan 10 (tanggal dimulai saat surat jalan masuk
   rencana) dan 4B.10 aturan 3 (tanggal ritase = tanggal trip dimulai) bisa
   berbeda kalau rencana disusun malam dan truk berangkat pagi. Saran: tanggal
   trip dan ritase = tanggal **truk berangkat** menurut jam server.
2. **Trip yang isinya hanya belanja.** 4B.10 aturan 1 (satu trip = satu
   ritase) dan 1a (belanja dibayar di atas ritase) membuat trip belanja saja
   dibayar dua kali. Saran: trip yang isinya hanya belanja dibayar **upah
   belanja saja**; ritase hanya untuk trip yang punya toko atau retur.

Cukup ok/tidak:

3. Jalan keluar lapor garasi (WAJ-11): kalau GPS atau handphone bermasalah,
   Kepala Gudang atau pemilik menutup trip atas nama driver, wajib alasan dan
   foto; ritase tetap dicatat server sekali.
4. "Nota yang sudah dilunasi terkunci" (AE10) tidak bisa dipakai karena
   pelunasan di kasir (4C.10 aturan 14). Pengganti: nota terkunci begitu
   **tercatat di kasir**; koreksi sesudahnya oleh finance atau pemilik dengan
   alasan, dan masuk daftar kiriman ke kasir sebagai koreksi.
5. Tanggal Kas Masuk untuk **deposit** = tanggal uang masuk rekening, diisi
   finance saat memeriksa (cash dan transfer tetap tanggal di toko).
6. Pola "manual dulu, tarik data kasir disiapkan" berlaku juga untuk **daftar
   toko** dan **nota cabang**, bukan hanya surat jalan dan nota grooming.
7. "Hari tidak bisa jalan" driver dan kenek (KEH-32) milik modul Logistik,
   supaya orangnya tidak muncul di pilihan rencana hari itu; rincian dan
   akibatnya ke upah di Bab 5.
8. Hak lihat: HR tidak punya menu Logistik (data ritase dibaca lewat Bab 5);
   finance melihat bagian uang; Laporan Logistik dilihat pemilik, Kepala
   Gudang, dan finance.
9. Dashboard Logistik ditambah: barang kembali yang belum dikonfirmasi
   diterima lebih dari 3 hari, dan titik toko yang menunggu persetujuan.
10. Cabang kejadian bonus (GAJ-28): bonus grooming = cabang pengerja; bonus
    ongkir = cabang asal perjalanan.

## 4E.2 Jawaban pemilik (12 Oktober 2026)

| No | Jawaban |
|---|---|
| 1 | "Biasanya ketika selesai (biasanya juga driver berangkat di hari yang sama)". Bertentangan dengan AD8 (tanggal trip dimulai) yang sudah disetujui di 4B; ditanyakan ulang (H) |
| 2 | Kalau hanya belanja, cukup upah belanja saja. Dicek ke database: sistem lama **tidak** punya trip khusus belanja; trip belanja saja akan dibayar dua kali (ritase trip dengan tarif rute rencana, ditambah ritase belanja). Belum pernah terjadi: keempat tugas belanja menumpang trip yang juga membawa 1–9 toko. Keputusan: trip yang isinya hanya belanja dibayar **upah belanja saja** |
| 3–10 | Ok |

Keterangan baru dari pemilik tentang jabatan kantor:

- **Owner dan GM**: aksesnya sama.
- **Finance**.
- **Marketing**: mengurus hutang piutang, tagihan, dan pengiriman.
- **HR**: cakupannya diserahkan ke saran Claude (butir 8: HR tidak punya menu
  Logistik).

Ditanyakan ulang di percakapan:

- H: tanggal trip = tanggal selesai atau tanggal berangkat.
- I: GM "akses sama dengan Owner" bertabrakan dengan hak yang sudah ditetapkan
  khusus untuk pemilik (PRI-24, KAR-59, GAJ-11, GAJ-45, GAJ-46).
- J: cakupan Marketing di Logistik.

Jawaban pemilik atas H, I, J (12 Oktober 2026):

- H: "mobil dihitung dari mereka berangkat", karena mobil selalu pulang di hari
  yang sama dan tidak pernah menginap; trip yang melewati hari terjadi karena
  kesalahan driver atau pelapor yang tidak punya jalan keluar. Dicatat:
  tanggal trip = tanggal berangkat (LOG-25); jalan keluarnya LOG-30 dan LOG-31.
  Jenis: **pelapis** atas 4A.10 aturan 10 (tanggal kirim tetap dimulai saat
  surat jalan masuk rencana; tanggal trip dan ritase dari berangkat).
- I: **GM adalah pemilik yang sedang bertanya ini sendiri**: bertugas selevel
  owner, tetapi secara harfiah bukan pemilik usaha. Dicatat: di Logistik hak GM
  setara jabatan Pemilik (LOG-84). Akibatnya ke aturan khusus pemilik di Bab 1
  dan 3 (gaji pemilik, membayar slip, meniadakan potongan) ditanyakan
  terpisah; dicatat di bagian 6 buku aturan.
- J: setuju. Marketing menagih, membuat surat jalan, menandai retur, melihat
  pengiriman; tidak memeriksa uang dan tidak menyetujui potong nota (LOG-84).

Dicatat tanpa ditanyakan, karena hanya melengkapi:

- Daftar toko dibaca menurut daftar hak akses, bukan semua orang login
  (LOG-07, mengganti LOG-A07; sejalan KAR-58).
- "Back Office" sebagai pencatat surat jalan diganti jabatan Marketing (hak
  per jabatan, bukan per cabang, KAR-58).
- Pilihan kenek mengikuti izin tugas lapangan (KAR-05); "semua karyawan muncul
  kalau tidak ada yang cocok" (LOG-A22) dibuang, sejalan KAR-65.
- Groomer tambahan masuk pengaturan grooming yang satu tempat (LOG-67).
- Nominal bonus pemilik tidak tampil di halaman order dan rekap untuk selain
  para pemilik (LOG-78, sejalan GAJ-46).
- Upah belanja bertanggal tanggal trip, sama dengan ritase (AD8, LOG-35).

## 4E.3 Asal aturan

| Nomor v3 | Asal |
|---|---|
| LOG-01 | 4A.10 aturan 1; 4E.1 butir 6; LOG-A08 |
| LOG-02 | 4A.10 aturan 2; LOG-A02, A03, D06 |
| LOG-03 | 4A.10 aturan 4 (AC10); LOG-A04, A05 |
| LOG-04 | 4A.10 aturan 3 |
| LOG-05 | 4A.10 aturan 5 |
| LOG-06 | 4A.10 aturan 6 |
| LOG-07 | 4E.2 (dicatat tanpa ditanyakan); LOG-A07 diganti |
| LOG-08 | 4A.10 aturan 7, 8; LOG-A12 |
| LOG-09 | LOG-A10, A13; 4E.2 J |
| LOG-10 | LOG-A14, A15 |
| LOG-11 | 4A.10 aturan 9; LOG-A16 |
| LOG-12 | LOG-A17; 4C.10 aturan 16 |
| LOG-13 | 4C.10 aturan 5 |
| LOG-14 | 4E.1 butir 4 (mengganti "nota yang sudah dilunasi terkunci" di AE10) |
| LOG-15 | LOG-A20, A22; KAR-05; 4E.1 butir 7 |
| LOG-16 | 4A.10 aturan 10 |
| LOG-17 | 4A.10 aturan 11, 14 |
| LOG-18 | 4A.10 aturan 12 |
| LOG-19 | LOG-A23; 4B.10 aturan 9 |
| LOG-20 | LOG-A24 |
| LOG-21 | LOG-A26, A27, A28; 4A.10 aturan 13 |
| LOG-22 | LOG-A30, A31 |
| LOG-23 | LOG-A29; 4A.10 aturan 15 |
| LOG-24 | LOG-B01; 4B.10 aturan 6 |
| LOG-25 | LOG-B02, B03; 4E.2 H |
| LOG-26 | LOG-B04, B06, B13, B14; 4B.10 aturan 12 |
| LOG-27 | LOG-B05; 4B.10 aturan 7 |
| LOG-28 | LOG-B09, B12 |
| LOG-29 | 4B.10 aturan 5; LOG-B11 |
| LOG-30 | 4E.1 butir 3 |
| LOG-31 | 4B.10 aturan 8; 4E.2 H |
| LOG-32 | 4B.10 aturan 10 |
| LOG-33 | 4B.10 aturan 1; LOG-B19, B21; 4E.2 butir 2 |
| LOG-34 | 4B.10 aturan 1a; 4E.2 butir 2 |
| LOG-35 | 4B.10 aturan 2, 3; 4E.2 H |
| LOG-36 | 4B.10 aturan 4 |
| LOG-37 | LOG-B25, B26 |
| LOG-38 | LOG-B27; 4E.1 butir 6 |
| LOG-39 | LOG-B28, B29, B30 |
| LOG-40 | LOG-B31, B32 |
| LOG-41 | LOG-B33, B34, B35 |
| LOG-42 | 4B.10 aturan 13; LOG-B36 |
| LOG-43 | 4B.10 aturan 14; LOG-B37 s.d. B42 |
| LOG-44 | 4C.10 aturan 1; LOG-C04 |
| LOG-45 | 4C.10 aturan 2 |
| LOG-46 | 4C.10 aturan 3; LOG-C04, C06 |
| LOG-47 | 4C.10 aturan 4 |
| LOG-48 | LOG-C07; 4E.1 butir 4 |
| LOG-49 | 4C.10 aturan 6 |
| LOG-50 | LOG-C10 |
| LOG-51 | LOG-C11, C12 |
| LOG-52 | 4C.10 aturan 7; LOG-C14; 4E.1 butir 4 |
| LOG-53 | LOG-C08, C17, C18 |
| LOG-54 | 4C.10 aturan 8; LOG-C16 |
| LOG-55 | LOG-C19, C20 |
| LOG-56 | 4C.10 aturan 9; LOG-C21 |
| LOG-57 | 4A.10 aturan 16; LOG-C22, A35 |
| LOG-58 | 4C.10 aturan 10, 16; LOG-C24, C25; 4E.2 J |
| LOG-59 | 4C.10 aturan 10; LOG-C27, C28 |
| LOG-60 | 4C.10 aturan 10 |
| LOG-61 | 4C.10 aturan 11; LOG-C30 |
| LOG-62 | 4C.10 aturan 12; LOG-C32, C36 |
| LOG-63 | 4C.10 aturan 12 |
| LOG-64 | 4C.10 aturan 13, 16; 4E.1 butir 5 |
| LOG-65 | 4C.10 aturan 14 |
| LOG-66 | 4C.10 aturan 15; 4E.2 J |
| LOG-67 | 4D.10 aturan 4; LOG-D01 |
| LOG-68 | LOG-D04; 4D.10 aturan 4 (AF4) |
| LOG-69 | 4D.10 aturan 3; LOG-D05 |
| LOG-70 | LOG-D07, D08 |
| LOG-71 | 4D.10 aturan 1; LOG-D09 |
| LOG-72 | 4D.10 aturan 6; LOG-D10, D11, D12 |
| LOG-73 | 4D.10 aturan 2, 5, 6; LOG-D13, D14, D15 |
| LOG-74 | 4D.10 aturan 6; LOG-D16, D17, D18 |
| LOG-75 | 4D.10 aturan 7; LOG-D19; 4E.1 butir 10 |
| LOG-76 | 4D.10 aturan 9; LOG-D23; 4E.1 butir 10 |
| LOG-77 | 4D.10 aturan 9 |
| LOG-78 | 4D.10 aturan 10 |
| LOG-79 | 4D.10 aturan 8 |
| LOG-80 | 4D.10 aturan 11; 4E.1 butir 9; 4E.2 J |
| LOG-81 | 4D.10 aturan 12; 4E.1 butir 8 |
| LOG-82 | 4D.10 aturan 13 |
| LOG-83 | 4D.10 aturan 14 |
| LOG-84 | 4A.10 aturan 14; 4E.1 butir 8; 4E.2 I, J |
| LOG-85 | 4B.10 aturan 11 |
| LOG-86 | 4C.10 aturan 16; 4D.10 aturan 5 |
| LOG-87 | 4E.1 butir 7; KEH-32 |
| LOG-88 | angka dari aturan di atas |

## 4E.4 Keputusan tentang GM (12 Oktober 2026)

Ditanyakan: apakah GM ikut hak yang khusus pemilik, dengan usulan pagar "tidak
mengurus untuk dirinya sendiri". Jawaban pemilik: "intinya GM itu setara
owner, dan bisa melihat semuanya, bahkan GM menggaji dirinya sendiri."

Dicatat sebagai **KAR-67** (pelapis atas PRI-24, KAR-59, GAJ-11, 45, 46): GM
setara jabatan Pemilik di semua modul, termasuk menutup dan membayar slipnya
sendiri. Usulan pagar tidak dipakai. Catatan ditambahkan di PRI-24 dan di
kepala `../03-gaji.md`.

Belum dijawab (bagian 6 butir 7 `../01-karyawan.md`): GM diabsen dan kena
telat atau tidak; gaji GM terlihat HR atau tidak; GAJ-09 berlaku untuk GM atau
tidak. Usulan Claude: sama dengan jabatan Pemilik.

Jawaban pemilik atas tiga butir sisa (12 Oktober 2026): GM **tidak** diabsen
dan tidak kena telat; gaji GM **tidak** terlihat HR; GM **tidak** menerima
bonus. Ketiganya sama dengan jabatan Pemilik; dicatat di KAR-67. Tidak ada
pertanyaan Bab 4 yang menunggu.
