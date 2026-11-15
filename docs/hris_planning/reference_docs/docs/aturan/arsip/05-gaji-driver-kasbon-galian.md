# Galian Sistem Lama: Gaji Driver, Borongan, dan Kasbon

Status: selesai; buku aturannya ditetapkan 12 Oktober 2026
Digali dari sistem lama mulai: 12 Oktober 2026

Bab 5 dipecah menjadi lima bagian (disetujui pemilik, 12 Oktober 2026):

| Bagian | Isi | Status |
|---|---|---|
| 5A | Gaji Driver: tarif ritase, upah belanja, minggu upah, hari tidak bisa jalan, slip mingguan, rekap, Pendapatan Ritase di portal | **Sudah digali** (12 Oktober 2026), database sudah dicek. DRV-A01 s.d. A33. **Dijawab pemilik** (5A.9), 17 aturan di 5A.10, AG1–AG11 disetujui. Pertentangan H dijawab (LOG-87 dicabut). **SELESAI dibahas** |
| 5B | Borongan: bongkar muat per kg, pembagian ke peserta, pekerja lepas, tarif | **Sudah digali** (12 Oktober 2026), database sudah dicek. DRV-B01 s.d. B24. **Dijawab pemilik** (5B.9), 24 aturan di 5B.10, AH1–AH10 disetujui. Pertentangan I dijawab (pengecualian GAJ-45 dan GAJ-56). **SELESAI dibahas** |
| 5C | Kasbon: pengajuan, pengesahan, pencairan, cicilan, plafon, cara bayar | **Sudah digali** (12 Oktober 2026), database sudah dicek. DRV-C01 s.d. C36. **Dijawab pemilik** (5C.9), 29 aturan di 5C.10, AI1–AI13 disetujui. Pertentangan P dijawab. **SELESAI dibahas** |
| 5D | Jenis upah dan jadwal bayar: satu cara kerja untuk semua upah | **Disusun dan dijawab pemilik** (12 Oktober 2026), database sudah dicek. 14 aturan di 5D.10, AJ1–AJ8 disetujui. Butir Z dan pertentangan AA dijawab. **SELESAI dibahas** |
| 5E | Penetapan menjadi `../05-gaji-driver-kasbon.md` | **Ditetapkan** 12 Oktober 2026: DRV-01 s.d. 84. Delapan butir penetapan dijawab pemilik (5E.2) |

Cara menutup tiap bagian (permintaan pemilik, 12 Oktober 2026): setelah satu
bagian selesai dibahas, Claude memberi pernyataan tegas "bagian ini selesai",
meminta `/clear`, dan bagian berikutnya dikerjakan di sesi baru. Pertanyaan
tiap bagian diajukan di percakapan.

Batas penggalian: kode aplikasi dan struktur database yang berjalan. Isi data
(nama orang, nominal upah per orang) tidak dibuka; yang dihitung hanya jumlah
baris.

Nomor DRV di file ini adalah nomor **galian** (sementara). Nomor aturan v3
ditetapkan di 5E.

---

# Bagian 5A: Gaji Driver

Sumber: `hris-app/app/(dashboard)/penggajian/driver/page.tsx` (1.752 baris),
`driver/setup/page.tsx` (561), `driver/rekap/page.tsx` (466),
`portal/pendapatan-ritase/page.tsx` (212); fungsi
`fin_recompute_driver_weekly_wage`, `fin_recompute_helper_weekly_wage`, dan
lima trigger pemanggilnya; kebijakan akses di database. Kasbon driver dan
kenek hanya disentuh di titik potongannya; isinya digali di 5C.

Yang sudah diputuskan di Bab 4 dan tidak ditanyakan lagi: satu ritase = satu
trip dari berangkat sampai garasi (LOG-33); belanja bukan ritase, dibayar upah
belanja (LOG-34); ritase dan upah belanja hanya dicatat server, bertanggal
tanggal berangkat, tarif dicari menurut tanggal itu (LOG-35); ritase tangan
hanya pemilik (LOG-36).

## 5A.1 Bagian ini mengurus apa

Mengubah ritase yang dicatat Logistik menjadi uang yang diterima driver dan
kenek tiap minggu: tarif per mobil dan rute, pengelompokan per minggu upah,
potongan (denda dan cicilan kasbon), pembayaran, slip, dan catatan ke
keuangan. Juga yang dilihat driver dan kenek sendiri di portal.

## 5A.2 Data di sistem lama (dicek ke database, 12 Oktober 2026)

| Data | Isinya | Tabel | Jumlah baris |
|---|---|---|---|
| Ritase | Driver, kenek, mobil, rute, tanggal, upah driver, upah kenek, awal minggu, status bayar driver, status bayar kenek | `delivery_trips` | 316 (30 Mei s.d. 11 Oktober 2026); 45 lahir dari trip Logistik |
| Tarif | Per pasangan mobil dan rute: upah driver dengan kenek, upah driver tanpa kenek, upah kenek | `driver_rate_configs` | 23 dari 24 pasangan yang mungkin |
| Mobil | Nama, pelat, aktif | `vehicles` | 3 (aktif semua) |
| Rute | Nama, aktif | `delivery_routes` | 9 (8 aktif) |
| Denda driver | Driver, minggu, nominal, alasan, tautan ke Kas Keluar | `driver_fines` | 12 (1 terkunci ke pembayaran) |
| Denda kenek | Sama, untuk kenek | `helper_fines` | 0 |
| Potongan kasbon driver | Kasbon, minggu, nominal, sisa sesudahnya, tautan ke Kas Keluar | `driver_kasbon_deductions` | 48 (14 terkunci) |
| Potongan kasbon kenek | Sama, untuk kenek | `helper_kasbon_deductions` | 4 (0 terkunci) |
| Catatan keuangan otomatis | "Gaji driver/kenek minggu ..." | `fin_cash_out` kategori `driver_wage`, `helper_wage` | 44 dan 12 |
| Catatan keuangan dari tombol bayar | "Gaji driver/kenek minggu ..." | `fin_cash_out` kategori `driver_payout`, `helper_payout` | 23 dan 2 |

**Tidak ada tabel slip mingguan.** Slip driver hanya cetakan yang dihitung di
layar saat tombol ditekan; yang tersimpan hanyalah status bayar per ritase.
**Tidak ada data "hari tidak bisa jalan"** di sistem lama.

Keadaan data:

- **111 ritase driver berstatus belum dibayar; 86 di antaranya lebih tua dari
  2 minggu.** 14 dari 65 minggu-driver belum dibayar sama sekali walaupun
  minggunya sudah lama lewat. Tidak bisa dibedakan dari data: benar-benar
  belum dibayar, atau sudah dibayar tunai tetapi tidak ditandai.
- **Upah kenek: 107 ritase belum dibayar (82 lebih tua dari 2 minggu), 87
  sudah.** Pada 44 ritase driver-nya sudah lunas tetapi kenek-nya belum.
  Tombol bayar kenek baru dipakai 2 kali.
- **Gaji driver tercatat dua baris di Kas Keluar** untuk 14 pembayaran: satu
  baris otomatis (`driver_wage`, upah dikurangi denda) dan satu baris dari
  tombol "Tandai Lunas" (`driver_payout`, upah dikurangi denda dan kasbon).
  Apakah laporan keuangan menjumlahkan keduanya diperiksa di Bab 6.
- Catatan otomatis upah **kenek** muncul saat ritase **driver-nya** ditandai
  lunas, bukan saat kenek dibayar: 12 baris `helper_wage` padahal tombol bayar
  kenek baru 2 kali dipakai.
- 136 dari 316 ritase nominalnya berbeda dari tarif yang sekarang tersimpan
  untuk mobil dan rute yang sama. Tarif pernah diubah, dan riwayatnya tidak
  ada (tarif tidak bertanggal berlaku).
- 10 dari 23 tarif upah kenek-nya Rp0; 26 ritase berkenek tercatat dengan
  upah kenek Rp0 (6 orang). Di 13 tarif, upah driver dengan kenek lebih kecil
  dari tanpa kenek; di 10 sisanya sama.
- 9 orang pernah menerima upah kenek; semuanya berjenis karyawan bulanan, dan
  4 di antaranya juga punya slip gaji bulanan. Tidak ada driver yang punya
  slip bulanan.
- 32 kali satu driver punya lebih dari satu ritase di tanggal yang sama; 2 di
  antaranya mobil dan rutenya juga sama.
- 3 ritase awal minggunya tidak sesuai tanggalnya (bukan Jumat yang benar).
- 24 dari 25 pembayaran bertanggal Sabtu. 4 pembayaran bertanggal di masa
  depan (sampai 24 Oktober 2026), karena tanggal bayar diketik tangan.
- 2 karyawan aktif bertanda "boleh menyetir" selain 4 driver aktif; tidak ada
  driver bertanda "boleh jadi kenek".

## 5A.3 Aturan yang ditemukan

### Tarif, mobil, dan rute

| No | Aturan | Sumber |
|---|---|---|
| DRV-A01 | Tarif ditentukan per **pasangan mobil dan rute**, berisi tiga angka: upah driver kalau ada kenek, upah driver kalau tanpa kenek, dan upah kenek. Satu pasangan satu tarif. | `driver_rate_configs`, `setup/page.tsx` |
| DRV-A02 | Tarif **tidak bertanggal berlaku**. Nominal disalin ke ritase saat tercatat; mengubah tarif hanya mengenai ritase berikutnya, dan tarif lama tidak tersimpan. | `handleEditRateSubmit` |
| DRV-A03 | Tarif bisa **dihapus**. Menghapus mobil ikut menghapus semua tarifnya; mobil yang sudah punya ritase tidak bisa dihapus. Rute hanya bisa dinonaktifkan. | `handleDeleteVehicle`, `handleDeactivateRoute` |
| DRV-A04 | Kalau daftar rute kosong, layar mengisi sendiri tiga rute dengan nama yang tertulis di kode. | `setup/page.tsx` `fetchData` |
| DRV-A05 | Yang boleh mengubah tarif, mobil, dan rute: pemilik, HR, dan finance. Kepala Gudang hanya melihat tarif. | kebijakan `driver_rate_*`, `vehicles_*`, `routes_*` |
| DRV-A06 | Ritase tangan untuk pasangan yang belum bertarif ditolak ("Tarif belum disetup"). | `handleSubmit` |
| DRV-A07 | Upah belanja tidak punya tarif sendiri; memakai tarif pasangan mobil dan rute bernama "Belanja". | `rencana/[id]/page.tsx`, LOG-B18 |

### Ritase sebagai dasar upah

| No | Aturan | Sumber |
|---|---|---|
| DRV-A08 | Upah driver per ritase = tarif "dengan kenek" kalau trip berkenek, selain itu tarif "tanpa kenek". Upah kenek = tarif kenek, atau Rp0 kalau tanpa kenek. | `handleSubmit`, `complete_logistics_delivery` |
| DRV-A09 | Yang bisa dipilih sebagai driver: karyawan berjenis driver atau bertanda "boleh menyetir". Yang bisa dipilih sebagai kenek: karyawan tetap di departemen bernama "Team Gudang" (kalau tidak ada, semua karyawan tetap) dan driver bertanda "boleh jadi kenek". | `fetchMasterData` |
| DRV-A10 | Ritase berkenek dengan upah kenek Rp0 tidak tampil di daftar dan slip upah kenek. | `groupedByHelper` |
| DRV-A11 | HR, finance, dan pemilik bisa **menghapus ritase** dari dua halaman (Gaji Driver dan Rekap), termasuk yang sudah dibayar. Tidak ada alasan, tidak ada jejak. | `handleDeleteTrip`, kebijakan `trips_delete_*` |
| DRV-A12 | Ritase dari trip Logistik diberi tanda "Auto" supaya tidak dicatat dua kali; cek dobel ritase tangan hanya berupa pertanyaan di layar dan boleh dilanjutkan. | `logisticsTripIds`, `handleSubmit` |

### Minggu upah dan hari bayar

| No | Aturan | Sumber |
|---|---|---|
| DRV-A13 | Minggu upah **Jumat sampai Kamis**. Awal minggu disimpan di tiap ritase. | `getWeekStart`, `week_start_date` |
| DRV-A14 | Hari bayar yang dianggap sistem: **Sabtu**, dua hari setelah minggu ditutup (awal minggu + 8 hari). Dipakai sebagai tanggal catatan keuangan otomatis dan untuk menaruh satu minggu ke satu bulan di rekap bulanan. | `fin_recompute_*`, `rekap/page.tsx` |
| DRV-A15 | Tanggal bayar pada tombol "Tandai Lunas" **diketik tangan**, bawaannya hari ini dari jam perangkat. | `openPayDriverModal` |
| DRV-A16 | Layar hanya menampilkan 9 minggu terakhir (Rekap: 12 minggu, atau per bulan, atau rentang bebas). | `weekOptions` |

### Potongan

| No | Aturan | Sumber |
|---|---|---|
| DRV-A17 | Potongan kasbon **diketik tangan per minggu** oleh pembuat slip, untuk tiap kasbon aktif orang itu. Paling banyak sebesar sisa kasbon. Tidak ada jadwal cicilan. | `handleSavePotongan` |
| DRV-A18 | Denda diketik bebas: nominal dan alasan. Tidak ada daftar jenis denda, tidak ada pengesahan, tidak ada batas. | `driver_fines`, `helper_fines` |
| DRV-A19 | Potongan dan denda yang belum terkunci ke pembayaran bisa dihapus; menghapus potongan kasbon mengembalikan sisa kasbon. Yang sudah terkunci tidak bisa. | `handleDeleteFine`, `handleDeleteKasbonDeduction` |
| DRV-A20 | Kalau potongan melebihi upah minggu itu, pembayaran **ditolak** ("kurangi dulu nominal potongannya"). | `confirmPayDriver` |
| DRV-A21 | Kalau upah habis terpotong (bersih Rp0), ritase ditandai lunas tanpa catatan keuangan, dan potongannya **tidak dikunci**. | `confirmPayDriver` |

### Membayar dan catatan keuangan

| No | Aturan | Sumber |
|---|---|---|
| DRV-A22 | Membayar = menandai semua ritase belum lunas milik orang itu di minggu itu menjadi lunas, lalu mencatat satu Kas Keluar sebesar upah dikurangi denda dan kasbon, dari rekening atau kas yang dipilih, dengan cabang orang itu. | `confirmPayDriver`, `confirmPayKenek` |
| DRV-A23 | Membayar adalah **beberapa langkah lepas dari layar**: tandai lunas, catat Kas Keluar, kunci potongan. Kalau langkah kedua gagal, ritase sudah lunas tanpa catatan uang ("Trip sudah ditandai lunas, tapi gagal mencatat Kas Keluar"). | sama |
| DRV-A24 | Driver dan kenek dibayar **terpisah**, dengan dua status bayar di satu baris ritase, dua tombol, dua set tabel potongan, dan dua cetakan slip yang kodenya disalin. | `payment_status`, `helper_payment_status` |
| DRV-A25 | Yang boleh membayar: pemilik, HR, dan finance. Pembayar sekaligus tercatat sebagai pemeriksa catatan keuangannya. Tidak ada tahap tutup atau pengesahan sebelum bayar. | kebijakan `trips_update_*`, `confirmPayDriver` |
| DRV-A26 | Di luar tombol bayar, database **menulis sendiri** satu Kas Keluar "Gaji driver minggu ..." setiap ada ritase berstatus lunas: upah dikurangi denda, **kasbon tidak mengurangi**, bertanggal Sabtu. Sejak minggu 31 Juli 2026 upah kenek dipisah ke baris sendiri; sebelum itu digabung ke driver. | `fin_recompute_driver_weekly_wage` |
| DRV-A27 | Catatan otomatis upah kenek dihitung dari status lunas **driver**, bukan status lunas kenek. | `fin_recompute_helper_weekly_wage` |
| DRV-A28 | Kalau upah dikurangi denda menjadi nol atau minus, catatan otomatis diisi Rp0,01. | sama |
| DRV-A29 | Pembayaran tidak bisa dibatalkan dari layar. | tidak ada tombol |

### Slip dan yang dilihat driver

| No | Aturan | Sumber |
|---|---|---|
| DRV-A30 | Slip mingguan adalah **cetakan sesaat**: daftar ritase, potongan kasbon dengan sisanya, denda, total upah, total potongan, gaji bersih. Tidak disimpan, tidak bernomor. | `handlePrintSlip` |
| DRV-A31 | Slip di halaman Rekap dicetak **tanpa potongan** sama sekali. | `rekap/page.tsx` `handlePrintSlip` |
| DRV-A32 | Driver dan kenek melihat "Pendapatan Ritase" di portal: ritasenya sendiri sebagai driver atau kenek, rentang tanggal bebas, total, lunas, dan belum. **Denda dan potongan kasbon tidak tampil**, jadi jumlahnya bukan uang yang diterima. | `portal/pendapatan-ritase` |
| DRV-A33 | Menu itu hanya muncul untuk orang yang dikenali sebagai driver atau kenek. Driver tidak bisa membaca denda dirinya (hanya pemilik, HR, finance). | `sidebar.tsx`, kebijakan `driver_fines_admin` |

## 5A.4 Menu di sistem lama

| Menu | Sub menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|---|
| Penggajian › Gaji Driver | Rekap Driver, Rekap Kenek, Catat Trip Harian | Melihat ritase per minggu, potongan, bayar, cetak slip | Daftar ritase yang sama ada di Rekap |
| Penggajian › Gaji Driver › Rekap Perjalanan | Mingguan, bulanan, rentang bebas | Melihat dan menghapus ritase, cetak slip tanpa potongan | Cetak slip kedua |
| Penggajian › Setup Gaji & Tarif › Tarif & Mobil Driver | Mobil, rute, tarif | Data induk | Mobil dan rute dipakai Logistik, disimpan di menu Penggajian |
| Portal › Gaji & Kasbon › Pendapatan Ritase | — | Driver dan kenek melihat ritasenya | Terpisah dari Slip Gaji bulanan |

## 5A.5 Tumpang tindih

1. **Gaji driver dicatat ke keuangan lewat dua jalan**: otomatis oleh database
   (kasbon tidak mengurangi) dan oleh tombol bayar (kasbon mengurangi), dengan
   dua kategori berbeda.
2. **Hitungan minggu Jumat–Kamis ditulis empat kali**: halaman Gaji Driver,
   Rekap, portal, dan fungsi di database (ditambah halaman borongan, 5B).
3. **Driver dan kenek adalah dua salinan** dari satu cara kerja: dua status,
   dua tabel denda, dua tabel potongan kasbon, dua tombol, dua slip.
4. **Dua cetakan slip driver** dengan isi berbeda (dengan dan tanpa potongan).
5. **Upah bersih dihitung di tiga tempat**: layar bayar, cetakan slip, dan
   fungsi keuangan, masing-masing dengan rumus sedikit berbeda.
6. **Mobil dan rute** dimiliki halaman Penggajian padahal dipakai Logistik
   (LOG-17 sudah menaruh rute di Logistik).

## 5A.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| Tarif naik | Ubah tarif; ritase lama tetap nominal lama | Ya, tetapi tarif lama hilang dan tidak bisa berlaku mundur atau maju |
| Ritase salah catat | Dihapus | Ya, tanpa jejak, termasuk yang sudah dibayar |
| Potongan lebih besar dari upah | Pembayaran ditolak sampai potongan dikurangi | Ya, dengan mengetik ulang; sisanya tidak dicatat di mana pun |
| Upah habis terpotong | Lunas tanpa Kas Keluar | Ya, tetapi potongan tidak terkunci |
| Salah bayar atau salah tanggal bayar | Tidak ada pembatalan | **Tidak** |
| Kas Keluar gagal setelah ritase lunas | Pesan error | **Tidak**, ritase sudah lunas |
| Minggu lupa dibayar | Tetap bisa dibayar; hanya 9 minggu terakhir tampil | Sebagian; tidak ada yang mengingatkan (86 ritase) |
| Driver merasa upahnya kurang | Melihat Pendapatan Ritase | Sebagian; potongan dan denda tidak terlihat |
| Driver berhalangan jalan | Tidak dicatat di sistem | **Tidak ada** |
| Karyawan bulanan ikut jadi kenek | Dipilih sebagai kenek; upahnya menurut tarif (bisa Rp0) | Ya, tanpa aturan tertulis kapan dibayar dan kapan tidak |
| Kenek belum dibayar padahal driver sudah | Dua status terpisah | Ya, tetapi keuangan sudah mencatat upah kenek |

## 5A.7 Pertanyaan untuk pemilik (diajukan di percakapan, 12 Oktober 2026)

Butuh pandangan pemilik:

1. **Hari tidak bisa jalan** (titipan LOG-87): siapa yang mencatat, batas
   waktunya, dan ada akibat ke upah atau tidak. Saran: driver atau kenek
   mencatat sendiri paling lambat sehari sebelumnya; Kepala Gudang boleh
   mencatatkan kapan saja; tidak ada potongan karena upah per ritase.
2. **Kenek dengan upah Rp0** (10 tarif, 26 ritase) dan **karyawan bulanan yang
   ikut jadi kenek** (4 orang punya slip bulanan dan upah ritase): kapan
   dibayar ritase dan kapan tidak. Saran: dibayar ritase hanya kalau ikut di
   hari liburnya; di hari kerjanya tidak.
3. **Denda driver dan kenek**: untuk apa saja, berapa, siapa yang menetapkan.
   Saran: daftar jenis denda bernominal dan bertanggal berlaku; ditetapkan
   Kepala Gudang atau pemilik, disahkan pemilik; uangnya masuk Dana Disiplin.

Cukup setuju atau tidak:

4. **Nominal tarif**: 23 tarif yang berjalan dibawa apa adanya sebagai tarif
   awal v3 (bertanggal berlaku), termasuk tarif rute Belanja sebagai upah
   belanja. Tetap tiga angka per mobil dan rute.
5. **Minggu dan hari bayar**: Jumat–Kamis, dibayar Sabtu. Ditutup HR atau
   pemilik, dibayar pemilik (sama dengan slip bulanan, GAJ-45 dan GAJ-48).

## 5A.8 Usulan untuk v3 (belum disetujui)

| No | Usulan |
|---|---|
| AG1 | Ada **slip mingguan yang disimpan**, satu per orang per minggu, dengan tiga tahap seperti slip bulanan: Perkiraan, Ditutup, Dibayar. Isinya semua ritase orang itu (sebagai driver maupun kenek) dan upah belanja. |
| AG2 | Driver dan kenek memakai **satu cara kerja**: satu jenis slip, satu tempat denda, satu tempat potongan. |
| AG3 | Potongan kasbon **tidak diketik**; mengikuti cicilan kasbon (dirinci di 5C). Denda tidak diketik bebas (pertanyaan 3). |
| AG4 | Potongan yang melebihi upah minggu itu **dibawa ke minggu berikutnya** sebagai "sisa potongan", sama dengan GAJ-52; pembayaran tidak ditolak. |
| AG5 | Membayar adalah **satu langkah utuh di server** dan menghasilkan **satu** catatan ke keuangan. Tanggal bayar dari server. |
| AG6 | Ritase **tidak dihapus**, hanya dibatalkan dengan alasan oleh pemilik. Ritase yang slipnya sudah ditutup dikoreksi di slip minggu berikutnya. |
| AG7 | Tarif **bertanggal berlaku** dan tidak dihapus; mobil dan rute hanya dinonaktifkan. Rencana kirim tidak bisa disimpan kalau pasangan mobil dan rutenya belum bertarif pada tanggal itu. |
| AG8 | Driver dan kenek melihat **slip mingguannya utuh** di portal, termasuk denda dan potongan, dan jumlah akhirnya sama dengan uang yang diterima. |
| AG9 | Slip mingguan yang belum dibayar lewat dari hari bayarnya **ditandai** untuk pemilik. |
| AG10 | Hitungan minggu upah ada di **satu tempat** di server. |
| AG11 | Hak: tarif diubah pemilik saja; mobil dan rute milik Logistik (Kepala Gudang dan pemilik); slip mingguan dilihat HR dan pemilik, finance hanya total per minggu. |

## 5A.9 Jawaban pemilik (12 Oktober 2026)

Arahan umum: kesembilan temuan yang dilaporkan harus teratasi di sistem baru
(tabel "Temuan dan aturan yang mengatasinya" di 5A.10).

| Pertanyaan | Jawaban |
|---|---|
| 1. Hari tidak bisa jalan | "Biasanya hanya lapor, dan tidak dipilih (ini lebih simple dan mudah)." Orangnya lapor ke Kepala Gudang, lalu tidak dipilih di rencana. Bertabrakan dengan LOG-87 dan LOG-15; lihat pertentangan H di bawah |
| 2. Kenek Rp0 | Ada dua jenis rute yang kenek-nya tidak dibayar: kiriman **Singaparna** dan **belanja ke supplier**. Dicek ke database: cocok persis (10 tarif kenek Rp0 = 3 tarif Singaparna + 7 tarif rute belanja; 26 ritase kenek Rp0 = 10 + 16) |
| 3. Denda | Setuju dengan saran. Yang biasa didenda: **tidak taat administrasi** |
| 4. Nominal tarif | Ok |
| 5. Minggu dan hari bayar | Ok |
| AG1–AG11 | Ok semua |

Belum terjawab dan dipindah ke 5D: karyawan bulanan yang ikut jadi kenek (4
orang punya slip bulanan dan upah ritase), dibayar ritase kapan. Ini bagian
dari keputusan jenis upah dan jadwal bayar.

### Pertentangan H (diajukan di percakapan, 12 Oktober 2026)

LOG-87 (ditetapkan di Bab 4): hari tidak bisa jalan **dicatat** di modul
Logistik, dan LOG-15: orang yang tercatat **tidak muncul** di pilihan rencana.
Jawaban pertanyaan 1: cukup lapor, lalu tidak dipilih; tidak ada pencatatan.

Saran Claude: ikuti jawaban baru. Alasannya: upah per ritase, jadi tidak ada
akibat ke uang yang perlu dibuktikan; Kepala Gudang menyusun rencana tiap hari
dan tahu siapa yang lapor. Akibatnya LOG-87 dicabut dan kalimat terakhir
LOG-15 dihapus (jenis: pengganti, WAJ-12).

**Jawaban pemilik: "ya, ikuti jawaban baru."** LOG-87 dicabut; LOG-15, kamus
istilah, peta modul, dan buku Kehadiran bagian 2 sudah disesuaikan.

## 5A.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 5E)

| No | Aturan | Asal |
|---|---|---|
| 1 | Tarif ditentukan per pasangan mobil dan rute, berisi tiga angka: upah driver dengan kenek, upah driver tanpa kenek, upah kenek. Tarif **bertanggal berlaku**; kenaikan ditambah sebagai baris baru dengan tanggal mulainya, tarif lama tetap tersimpan. 23 tarif yang berjalan dibawa sebagai tarif awal. | P4, AG7, WAJ-07 |
| 2 | **Upah kenek Rp0 adalah isi tarif yang sah**, bukan kesalahan. Saat ini berlaku untuk rute Singaparna dan semua rute belanja. Aturannya hidup di tarif, tidak ditulis di kode dengan nama rute (WAJ-05). Ritase kenek Rp0 tetap tampil di slip kenek sebagai baris Rp0 dengan keterangan "rute tanpa upah kenek". | P2 |
| 3 | **Upah belanja** = tarif rute berjenis belanja (LOG-17, LOG-34), untuk driver. Kenek tidak dibayar untuk belanja. | P2, P4 |
| 4 | Tarif tidak dihapus. Mobil dan rute hanya dinonaktifkan, dan dimiliki modul Logistik. Rencana kirim ditolak kalau pasangan mobil dan rutenya belum bertarif pada tanggal itu. | AG7, AG11 |
| 5 | Tarif hanya diubah pemilik. Kepala Gudang melihat tarif. | AG11 |
| 6 | **Minggu upah Jumat sampai Kamis**, dihitung di satu tempat di server. **Hari bayar Sabtu.** | P5, AG10 |
| 7 | Ada **slip mingguan yang disimpan**, satu per orang per minggu, bertahap Perkiraan, Ditutup, Dibayar. Isinya semua ritase orang itu di minggu itu, baik sebagai driver maupun kenek, dan upah belanja. | AG1 |
| 8 | Driver dan kenek memakai **satu cara kerja**: satu jenis slip, satu tempat denda, satu tempat potongan. | AG2 |
| 9 | Slip mingguan ditutup HR atau pemilik dan **dibayar pemilik saja**. HR dan pemilik melihat slip per orang; finance hanya total per minggu. | P5, AG11, GAJ-45, GAJ-46 |
| 10 | **Denda** driver dan kenek diambil dari daftar jenis denda yang bernominal dan bertanggal berlaku; tidak ada denda bernominal bebas. Jenis pertama: **tidak taat administrasi**. Diajukan Kepala Gudang atau pemilik, disahkan pemilik, dan uangnya masuk Dana Disiplin (GAJ-34). Nominal tiap jenis diisi di pengaturan. | P3 |
| 11 | Potongan kasbon **tidak diketik**; mengikuti cicilan kasbon (dirinci di 5C). | AG3 |
| 12 | Upah bersih tidak pernah minus dan kelebihan potongan tidak hangus: denda diambil dulu, kasbon terakhir; yang tidak tertampung dibawa ke slip minggu berikutnya sebagai "sisa potongan". Pembayaran tidak ditolak. | AG4, GAJ-52 |
| 13 | **Membayar adalah satu langkah utuh di server**: tanggal bayar dari server, pembayar, sumber dana, dan **satu** catatan keuangan tersimpan bersama. Satu slip dibayar sekali dan penuh. Slip bersih Rp0 tetap ditutup dan potongannya tetap terkunci. | AG5, GAJ-48 |
| 14 | **Ritase tidak dihapus.** Hanya pemilik yang membatalkan, wajib alasan. Ritase di slip yang sudah ditutup dikoreksi di slip minggu berikutnya. | AG6, PRI-02 |
| 15 | Driver dan kenek melihat **slip mingguannya utuh** di portal: ritase, denda, potongan, sisa potongan, dan jumlah bersih yang sama dengan uang diterima. Sebelum ditutup tampil sebagai "perkiraan". | AG8, GAJ-46 |
| 16 | Slip mingguan yang belum dibayar lewat dari hari bayarnya **ditandai** untuk pemilik. | AG9 |
| 17 | **Hari tidak bisa jalan tidak dicatat di sistem.** Driver atau kenek lapor ke Kepala Gudang, lalu tidak dipilih di rencana. Tidak ada batas waktu dan tidak ada akibat ke upah. LOG-87 dicabut dan LOG-15 diubah (jenis: pengganti). | P1, pertentangan H |

### Temuan dan aturan yang mengatasinya

| Temuan di sistem lama | Diatasi oleh |
|---|---|
| 1. Slip mingguan tidak pernah disimpan | Aturan 7 |
| 2. Ratusan ritase lama berstatus belum dibayar tanpa ada yang tahu | Aturan 7, 13, 16 (bayar per slip, bukan per ritase; yang terlambat ditandai) |
| 3. Gaji driver dua baris di Kas Keluar | Aturan 13 (satu catatan) |
| 4. Upah kenek dicatat saat driver-nya lunas | Aturan 7, 8, 13 (kenek punya slip sendiri; catatan keuangan lahir dari slipnya) |
| 5. Tarif tanpa tanggal berlaku | Aturan 1, 4 |
| 6. Ritase bisa dihapus tanpa jejak | Aturan 14 |
| 7. Potongan dan denda diketik tangan; pembayaran ditolak kalau potongan lebih besar | Aturan 10, 11, 12 |
| 8. Driver tidak melihat potongannya | Aturan 15 |
| 9. Hari tidak bisa jalan tidak ada di sistem | Aturan 17: memang tidak dicatat, dengan sengaja; cukup lapor ke Kepala Gudang |

Semua aturan uang di atas masuk daftar tes wajib (WAJ-06).

### Titipan dari 5A

- Untuk 5C: cicilan kasbon mingguan untuk orang berslip mingguan (aturan 11).
- Untuk 5D: karyawan bulanan yang ikut jadi kenek; satu orang bisa punya slip
  bulanan dan slip mingguan.
- Untuk Bab 6: bentuk catatan keuangan dari slip mingguan; periksa apakah
  laporan keuangan lama menjumlahkan `driver_wage` dan `driver_payout`.
- Untuk keputusan data lama (WIP, keputusan terbuka 3): 111 ritase driver dan
  107 upah kenek berstatus belum dibayar harus dipastikan dulu sebelum saldo
  dipindah.
- Terbuka: nominal tiap jenis denda.

---

# Bagian 5B: Borongan (bongkar muat)

Sumber: `hris-app/app/(dashboard)/penggajian/borongan/page.tsx` (1.001 baris),
`borongan/pekerja/page.tsx` (269), `borongan/tarif/page.tsx` (237); bagian
kategori gaji di `keuangan/kas-keluar/page.tsx`; tabel `loading_entries`,
`loading_entry_participants`, `loading_rate_config`, `freelance_workers`
beserta kebijakan aksesnya. Tidak ada fungsi atau trigger database untuk
borongan: semua hitungan ada di layar.

## 5B.1 Bagian ini mengurus apa

Upah bongkar muat barang dari supplier di gudang: berapa kilogram yang
dibongkar, siapa saja yang ikut, berapa bagian tiap orang, dan kapan dibayar.
Pesertanya bisa karyawan mana pun (driver, kenek, staf bulanan) atau pekerja
lepas yang bukan karyawan.

## 5B.2 Data di sistem lama (dicek ke database, 12 Oktober 2026)

| Data | Isinya | Tabel | Jumlah baris |
|---|---|---|---|
| Entri bongkaran | Tanggal kerja, total kg, tarif per kg, total upah, keterangan, status bayar, cabang, pencatat, pembayar | `loading_entries` | 25 (1 Agustus s.d. 30 September 2026; terakhir dicatat 3 Oktober) |
| Peserta entri | Karyawan **atau** pekerja lepas, dan bagian upahnya | `loading_entry_participants` | 91 (semuanya karyawan) |
| Tarif | Rupiah per kg dan tanggal berlaku | `loading_rate_config` | 1 (Rp20 sejak 1 Mei 2026) |
| Pekerja lepas | Nama, nomor HP, aktif | `freelance_workers` | 2 (keduanya nonaktif, belum pernah ikut entri) |
| Kas Keluar dari tombol bayar | "Upah Bongkar Muat (n entri)" | `fin_cash_out` kategori `borongan_wage` | 4 (ditambah 1 diketik tangan) |
| Kas Keluar diketik tangan | Kategori "Bongkar" | `fin_cash_out` kategori `bongkar` | **95** (Mei s.d. Oktober 2026, Rp11.844.508; 38 dari impor arus kas lama) |
| Kas Keluar diketik tangan | Kategori "Gaji Freelance" | `fin_cash_out` kategori `gaji_freelance` | 7 (semuanya Juli 2026) |

Keadaan data:

- **Halaman Gajian Bongkar Muat nyaris tidak dipakai untuk membayar.** Dari 25
  entri, 19 berstatus belum dibayar (Rp3.480.678), semuanya lebih tua dari 2
  minggu. Hanya 6 yang lunas, dibayar di 2 hari.
- **Bongkaran sebenarnya dibayar lewat Kas Keluar kategori "Bongkar" yang
  diketik tangan**: 95 baris sejak Mei, 16 sampai 21 baris per bulan. 18 dari
  19 entri "belum dibayar" punya Kas Keluar "Bongkar" di tanggal yang sama, dan
  12 Kas Keluar "Bongkar" nominalnya sama persis dengan sebuah entri di tanggal
  itu. Jadi status "belum dibayar" kemungkinan besar keliru: uangnya sudah
  keluar tunai hari itu, hanya tidak ditandai. Tidak bisa dipastikan dari data.
- Lima entri yang dibayar lewat tombol (3 Oktober) menghasilkan 4 Kas Keluar
  dengan **tanggal diketik**: 30 September, 3 Oktober, **19 Oktober, dan 25
  Oktober** (dua di masa depan). Kalau upah yang sama juga sudah dicatat
  sebagai "Bongkar", pengeluarannya tercatat dua kali. Diperiksa di Bab 6.
- 1 entri lunas (10 Agustus, Rp200.000) tidak punya Kas Keluar: waktu itu
  tombol lunas hanya mengubah status.
- **7 entri belum dibayar (Rp1.353.694) bertanggal sebelum 14 Agustus sudah
  tidak tampil di layar**, karena layar hanya memuat 9 minggu terakhir. Entri
  itu tidak bisa dibayar, diedit, atau dihapus dari layar lagi.
- Semua 91 keikutsertaan adalah karyawan Team Gudang: 12 orang (5 berjenis
  driver, 7 berjenis karyawan tetap); 4 orang kini nonaktif. 11 dari 12 juga
  punya ritase; 3 punya slip gaji bulanan; 6 punya kasbon.
- **Karyawan bulanan ikut bongkaran di hari ia tercatat hadir: 26 kali, 2
  orang.** 23 keikutsertaan karyawan bulanan lain tidak punya baris absen di
  tanggal itu. Sistem tidak mengaitkan bongkaran dengan absen sama sekali.
- 2 sampai 7 orang per entri (rata-rata 3,6). Semua entri dibagi rata; jumlah
  bagian selalu sama dengan total upah.
- 14 dari 25 entri dicatat setelah hari kerjanya, paling lama 13 hari.
- 6 tanggal punya lebih dari satu entri; tidak ada yang kg-nya sama persis.
- 8 entri kg-nya pecahan. Muatan per entri 5.200 sampai 18.681,5 kg.
- Jenis karyawan "Borongan / Freelance" ada di data Karyawan: 0 orang.

## 5B.3 Aturan yang ditemukan

### Tarif

| No | Aturan | Sumber |
|---|---|---|
| DRV-B01 | Tarif adalah **satu angka rupiah per kg** untuk semua orang dan semua barang, **bertanggal berlaku**. Tarif baru ditambah sebagai baris baru; yang lama tetap tersimpan. | `loading_rate_config`, `tarif/page.tsx` |
| DRV-B02 | Tarif entri dicari menurut tanggal kerja. Kalau tidak ketemu, layar memakai **Rp20 yang tertulis di kode**. Halaman tarif juga mengisi sendiri Rp20 bertanggal 1 Januari 2020 kalau tabelnya kosong. | `getActiveRate`, `fetchRates` |
| DRV-B03 | Dari layar tarif hanya bisa ditambah, dengan tanggal berlaku bebas (boleh mundur). Database mengizinkan pemilik, HR, dan finance mengubah dan menghapus tarif. | kebijakan `loading_rate_owner_hr_finance` |
| DRV-B04 | Tarif boleh pecahan (dua angka di belakang koma). | `step="0.01"` |

### Entri bongkaran dan pembagiannya

| No | Aturan | Sumber |
|---|---|---|
| DRV-B05 | Satu entri = satu kali bongkar: tanggal kerja, total kg (boleh pecahan), keterangan (wajib), dan minimal satu peserta. **Total upah = kg × tarif.** | `handleSubmit` |
| DRV-B06 | Total upah **dibagi rata** ke semua peserta, dibulatkan ke rupiah. Sisa pembagian diberikan ke orang yang **dicentang terakhir**. Tidak ada pembagian tidak rata. | `handleSubmit` |
| DRV-B07 | Peserta: pekerja lepas aktif, atau **karyawan aktif mana pun** dari semua departemen dan jabatan. Tidak ada pemeriksaan orang itu sedang bekerja, libur, atau hadir. | `fetchParticipantEmployees` |
| DRV-B08 | Tanggal kerja **diketik**, bawaannya hari ini dari jam perangkat; boleh mundur atau maju tanpa batas. | `formData.entry_date` |
| DRV-B09 | Semua entri dibebankan ke cabang yang **dicari dengan nama "Gudang"** di kode. | `fetchGudangBranchId` |
| DRV-B10 | Yang mencatat: pemilik, HR, dan finance. Kepala Gudang tidak bisa. Tidak ada pengesahan, tidak ada bukti (foto atau nota timbang). | kebijakan `loading_insert_finance` |
| DRV-B11 | Entri bisa **diedit kapan saja, termasuk yang sudah lunas**: tanggal, kg, peserta, dan **tarif per kg diketik tangan** lepas dari tabel tarif. Edit menghapus semua peserta lalu menulis ulang; kalau langkah kedua gagal, entri tertinggal tanpa peserta. | `handleEditSubmit` |
| DRV-B12 | Entri bisa **dihapus, termasuk yang sudah lunas**; pesertanya ikut terhapus dan Kas Keluar-nya tertinggal. Tanpa alasan, tanpa jejak. | `handleDeleteEntry`, kebijakan `loading_delete_*` |
| DRV-B13 | Tidak ada pemeriksaan entri dobel. | tidak ada |

### Membayar

| No | Aturan | Sumber |
|---|---|---|
| DRV-B14 | Status bayar ada di **entri**, bukan di orang: semua peserta entri itu dianggap lunas bersamaan. | `payment_status` |
| DRV-B15 | Membayar = mencentang entri belum lunas di minggu yang tampil, mengisi tanggal (diketik) dan rekening atau kas, lalu: (1) satu Kas Keluar "Upah Borongan" sebesar jumlah entri, (2) entri ditandai lunas. **Dua langkah lepas dari layar**; kalau langkah kedua gagal, uang sudah tercatat keluar tetapi entri masih belum lunas dan bisa dibayar lagi. | `confirmPayBorongan` |
| DRV-B16 | Yang membayar: pemilik, HR, dan finance; pembayar sekaligus pemeriksa catatan keuangannya. Kas Keluar itu tidak bertaut ke entri mana pun. | sama |
| DRV-B17 | **Tidak ada potongan** dari upah bongkaran: kasbon dan denda tidak menyentuhnya. | tidak ada |
| DRV-B18 | Pembayaran tidak bisa dibatalkan dari layar. | tidak ada tombol |
| DRV-B19 | Layar hanya menampilkan **9 minggu terakhir** (Jumat–Kamis; salinan kelima hitungan minggu, 5A.5 butir 2). Entri yang lebih tua tidak terjangkau. | `weekOptions` |

### Slip dan yang dilihat peserta

| No | Aturan | Sumber |
|---|---|---|
| DRV-B20 | Tidak ada slip. Yang ada "Cetak Rekap" per minggu, berisi daftar entri; tidak ada jumlah per orang. | `window.print` |
| DRV-B21 | **Peserta tidak bisa melihat upah bongkarannya** di portal. Upah bongkaran tidak tampil di slip bulanan maupun cetakan slip driver. | tidak ada halaman |

### Pekerja lepas dan kategori keuangan

| No | Aturan | Sumber |
|---|---|---|
| DRV-B22 | Pekerja lepas dicatat nama dan nomor HP saja, bisa dinonaktifkan, tidak punya akun. Diurus pemilik, HR, dan finance. | `freelance_workers`, `pekerja/page.tsx` |
| DRV-B23 | Ada **tempat kedua** untuk orang lepas: jenis karyawan "Borongan / Freelance" di data Karyawan. | `karyawan/page.tsx` |
| DRV-B24 | Upah bongkaran dan orang lepas punya **tiga kategori Kas Keluar**: "Upah Borongan" (dari tombol bayar), "Bongkar", dan "Gaji Freelance" (keduanya diketik tangan). Peringatan "gaji harus lewat jalur resmi" hanya muncul untuk "Upah Borongan" dan bisa dilewati dengan menjawab "freelance/lepas"; "Bongkar" dan "Gaji Freelance" tidak diperingatkan. | `kas-keluar/page.tsx` `PAYROLL_CATEGORIES` |

## 5B.4 Menu di sistem lama

| Menu | Sub menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|---|
| Penggajian › Gajian Bongkar Muat | — | Mencatat entri, melunasi, cetak rekap | Kas Keluar "Bongkar" mengerjakan hal yang sama dengan tangan |
| Penggajian › Setup Gaji & Tarif › Pekerja Lepas | — | Daftar pekerja lepas | Jenis karyawan "Freelance" di menu Karyawan |
| Penggajian › Setup Gaji & Tarif › Tarif Bongkar Muat | — | Riwayat tarif per kg | — |

## 5B.5 Tumpang tindih

1. **Upah bongkaran keluar lewat dua jalan**: tombol bayar di halaman borongan
   (4 kali) dan Kas Keluar "Bongkar" yang diketik tangan (95 kali). Yang
   dipakai sehari-hari justru jalan kedua.
2. **Tiga kategori Kas Keluar** untuk hal yang berdekatan: Upah Borongan,
   Bongkar, Gaji Freelance.
3. **Orang lepas dicatat di dua tempat**: tabel pekerja lepas dan jenis
   karyawan Freelance.
4. **Hitungan minggu Jumat–Kamis** ditulis lagi di halaman ini (salinan
   kelima).
5. **Rumus bagi rata ditulis dua kali** (catat baru dan edit), dan tarif
   bawaan Rp20 ditulis di dua halaman.

## 5B.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| Salah kg atau salah peserta | Edit entri | Ya, tanpa jejak, juga setelah lunas |
| Entri salah catat | Hapus | Ya, tanpa jejak; Kas Keluar tertinggal |
| Tarif naik | Tambah baris tarif bertanggal | Ya |
| Seseorang datang separuh jalan | Tidak ada; selalu bagi rata | **Tidak** |
| Lupa mencatat bongkaran minggu lalu | Tanggal diketik mundur | Ya, tanpa batas dan tanpa tanda |
| Entri lebih tua dari 9 minggu belum dibayar | Tidak tampil | **Tidak** (7 entri) |
| Salah bayar atau salah tanggal bayar | Tidak ada pembatalan | **Tidak** |
| Lunas gagal setelah Kas Keluar tercatat | Pesan error | **Tidak**; bisa terbayar dua kali |
| Dibayar tunai hari itu di luar halaman ini | Kas Keluar "Bongkar" diketik; entri tetap "belum dibayar" | **Tidak ada penghubung** |
| Peserta bertanya berapa upah bongkarannya | Tidak ada tempat melihat | **Tidak** |
| Peserta punya kasbon | Tidak dipotong dari bongkaran | — |
| Karyawan bulanan ikut di jam kerjanya | Tetap dapat bagian; tidak diperiksa | Tanpa aturan tertulis |
| Orang luar ikut membongkar | Didaftarkan sebagai pekerja lepas, atau dibayar lewat Kas Keluar "Gaji Freelance" | Ya, dua jalan |

## 5B.7 Pertanyaan untuk pemilik (diajukan di percakapan, 12 Oktober 2026)

Butuh pandangan pemilik:

1. **Upah bongkaran dibayar kapan?** Kenyataan di data: tunai hari itu lewat
   Kas Keluar "Bongkar". Saran: untuk karyawan dikumpulkan dan dibayar lewat
   slip (satu pintu, kasbon bisa ikut dipotong, tidak ada Kas Keluar diketik);
   pekerja lepas tunai hari itu.
2. **Karyawan bulanan yang ikut bongkaran di jam kerjanya sendiri** (26 kali, 2
   orang): tetap dapat upah bongkaran atau tidak. Saran: tetap dapat, tetapi
   keikutsertaannya tercatat dan terlihat pemilik.
3. **Siapa yang mencatat, dan angka kg dari mana.** Saran: Kepala Gudang
   mencatat hari itu juga dengan foto nota timbang atau surat jalan supplier;
   paling lambat 3 hari; lewat dari itu hanya pemilik.
4. **Pekerja lepas** (butir terbuka KAR-61): masih dipakai atau tidak, dan
   bentuknya. Saran: hanya nama dan nomor HP tanpa akun, satu tempat; jenis
   karyawan "Freelance" tidak dipakai untuk orang seperti ini.

Cukup setuju atau tidak:

5. **Tarif** Rp20 per kg, satu angka untuk semua barang, dibawa sebagai tarif
   awal v3; hanya pemilik yang mengubah.
6. **Dibagi rata**; sisa pembulatan (paling banyak beberapa rupiah) diberikan
   ke peserta pertama menurut urutan abjad nama, bukan "yang dicentang
   terakhir" (PRI-28).
7. **Semua bongkaran dibebankan ke Gudang**, sebagai pengaturan, bukan nama
   cabang di kode (WAJ-05).

## 5B.8 Usulan untuk v3 (belum disetujui)

| No | Usulan |
|---|---|
| AH1 | Mencatat bongkaran adalah **satu langkah utuh di server**: entri, peserta, dan pembagian tersimpan bersama atau tidak sama sekali. |
| AH2 | Tarif **selalu diambil server** dari tabel bertanggal berlaku menurut tanggal kerja; tidak bisa diketik per entri, dan tidak ada angka cadangan di kode. Kalau tarif untuk tanggal itu tidak ada, entri ditolak. |
| AH3 | Upah dicatat **per orang** (satu baris catatan upah per peserta per entri), dan status bayarnya mengikuti orang itu, bukan entrinya. |
| AH4 | Entri **tidak dihapus dan tidak diedit diam-diam** (PRI-02): sebelum dibayar boleh dikoreksi pencatatnya dengan alasan dan jejak; setelah dibayar hanya dibatalkan pemilik, dan selisihnya masuk pembayaran berikutnya. |
| AH5 | **Tidak ada Kas Keluar bongkaran yang diketik tangan.** Kategori "Bongkar", "Upah Borongan", dan "Gaji Freelance" menjadi satu jalur yang lahir dari catatan bongkaran (sejalan GAJ-56). |
| AH6 | Peserta **melihat upah bongkarannya** di portal: tanggal, kg, jumlah peserta, bagiannya, sudah dibayar atau belum. |
| AH7 | Bongkaran yang belum dibayar lewat dari hari bayarnya **ditandai** untuk pemilik; tidak ada daftar yang hilang karena batas minggu (PRI-10, PRI-11). |
| AH8 | Entri kedua di tanggal yang sama dengan kg yang sama meminta **konfirmasi** ("sudah ada bongkaran 10.000 kg hari ini, ini bongkaran lain?"). |
| AH9 | Satu orang tidak bisa tercantum dua kali di satu entri, dan orang yang sudah nonaktif pada tanggal kerja itu tidak bisa dipilih. |
| AH10 | Hak: tarif hanya pemilik; mencatat sesuai jawaban pertanyaan 3; finance hanya melihat total. Dijaga di server. |

## 5B.9 Jawaban pemilik (12 Oktober 2026)

Arahan umum: semua temuan 5B harus dipastikan tidak terulang di sistem baru
(tabel "Temuan dan aturan yang mengatasinya" di 5B.10).

| Pertanyaan | Jawaban |
|---|---|
| 1. Dibayar kapan | "Biasanya dibayar hari itu juga." Pemilik ingin tahu **siapa saja yang membongkar, dan dalam sebulan masing-masing menerima berapa** |
| 2. Karyawan bulanan ikut di jam kerjanya | Tetap dapat |
| 3. Siapa mencatat, kg dari mana | Total kiloan diisi **Kepala Gudang**, lalu **finance memproses**. Yang tahu siapa saja pesertanya hanya Kepala Gudang; orang lain baru tahu besoknya, tidak saat itu juga |
| 4. Pekerja lepas | Seperti saran: nama dan nomor HP saja, tanpa akun, satu tempat |
| 5. Tarif Rp20 per kg dibawa | Ok |
| 6. Dibagi rata; sisa pembulatan ke nama pertama menurut abjad | Ok |
| 7. Dibebankan ke Gudang sebagai pengaturan | Ok |
| 8. AH1–AH10 | Ok semua. AH10 berubah karena jawaban 3: finance melihat rincian bongkaran (peserta dan bagiannya), sebab finance yang memproses pembayarannya |

### Permintaan baru pemilik: Laporan Bongkaran

Saat bongkaran, Kepala Gudang wajib membuat laporan di sistem:

1. **Supplier-nya siapa.**
2. **Barangnya apa saja**, diambil dari daftar produk sistem kasir. Caranya
   seperti mencari: ketik nama, barangnya muncul. Kepala Gudang mengisi
   **jumlahnya** (QTY) dan **berat per sak atau dus** menurut satuannya (UOM).
3. Berat yang sudah pernah diisi **tersimpan otomatis** di produk itu, sehingga
   pada kedatangan berikutnya tidak perlu diisi lagi.

### Pertentangan I dan butir penutup (diajukan di percakapan, 12 Oktober 2026)

**Pertentangan I.** Jawaban 1 dan 3 (dibayar hari itu, diproses finance)
bertabrakan dengan GAJ-45 dan aturan 9 di 5A.10 (membayar upah hanya pemilik)
dan dengan GAJ-56 (pengeluaran gaji di keuangan hanya berasal dari slip).
Saran Claude: bongkaran menjadi **pengecualian** (WAJ-12): dibayar tunai hari
itu oleh finance, satu langkah di server, dan catatan keuangannya lahir dari
Laporan Bongkaran, bukan dari slip dan bukan diketik. Akibatnya kasbon tidak
dipotong dari upah bongkaran.

Butir penutup, cukup setuju atau tidak:

- J. Total kg **dihitung sistem** dari daftar barang (jumlah × berat per
  satuan), tidak diketik.
- K. Daftar produk kasir (nama dan satuan saja) **ditarik sejak awal**, lewat
  modul Tarik Data Kasir; berbeda dari surat jalan yang manual dulu. Selama
  belum tersambung: total kg diketik dengan foto surat jalan supplier.
- L. Laporan Bongkaran **bukan penerimaan stok**; stok tetap diurus sistem
  kasir. Jumlah di laporan ini hanya untuk menghitung berat dan upah.
- M. Berat per satuan boleh **diubah Kepala Gudang**, perubahan tercatat (siapa,
  kapan, dari berapa ke berapa) dan hanya berlaku untuk bongkaran berikutnya.
- N. Barang yang tidak ada di daftar produk: baris **"barang lain"** dengan
  nama dan kg diketik.
- O. Laporan per orang memakai **periode 26–25** seperti laporan lain, dan
  rentangnya bisa diganti.

### Jawaban atas pertentangan I dan butir penutup (12 Oktober 2026)

| Butir | Jawaban |
|---|---|
| I. Bongkaran dibayar hari itu oleh finance | "Ok, setuju saran." Menjadi pengecualian dari GAJ-45 dan GAJ-56 |
| J. Total kg dihitung sistem | Ya, "harus ada mesinnya" |
| K. Daftar produk kasir | "Nanti saya akan tarik datanya saja, jadi siapkan tempat untuk export-nya." Dibaca Claude sebagai: pemilik mengambil file export produk dari sistem kasir, dan HRIS menyediakan tempat mengunggahnya (belum ada tarikan otomatis) |
| L. Bukan penerimaan stok | Betul. Tambahan: siapkan fitur yang berkaitan dengan kasir, yaitu **purchase order**, sehingga nanti Kepala Gudang hanya mencocokkan jumlahnya |
| M. Berat boleh diubah Kepala Gudang, tercatat | Ok |
| N. Barang lain | Boleh, tetapi diperjelas: pemilik khawatir semuanya malah diketik padahal datanya ada |
| O. Laporan per orang periode 26–25 | Ok |

## 5B.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 5E)

| No | Aturan | Asal |
|---|---|---|
| 1 | Setiap bongkaran dicatat sebagai **Laporan Bongkaran** oleh **Kepala Gudang**: tanggal kerja, supplier, daftar barang (produk, satuan, jumlah, berat per satuan), peserta, dan foto surat jalan supplier. Menyimpannya **satu langkah utuh di server**: laporan, barang, peserta, dan pembagian tersimpan bersama atau tidak sama sekali. | Permintaan pemilik, P3, AH1 |
| 2 | Barang **dipilih dengan mencari** di daftar produk kasir (ketik nama, barangnya muncul). **Berat per satuan** (per sak, per dus, menurut satuannya) disimpan per produk per satuan saat pertama kali diisi, dan terisi otomatis pada bongkaran berikutnya. | Permintaan pemilik |
| 3 | Berat per satuan boleh **diubah Kepala Gudang**. Perubahan tercatat (siapa, kapan, dari berapa ke berapa) dan hanya berlaku untuk laporan berikutnya; tiap laporan menyimpan salinan berat yang dipakainya, sehingga laporan lama tidak ikut berubah. | M, WAJ-11 |
| 4 | **"Barang lain" adalah jalan terakhir, bukan jalan pintas.** Pilihannya baru muncul setelah pencarian tidak menemukan apa pun; wajib nama barang, kg, dan alasan. Baris ini **ditandai**, dan pemilik melihat daftar serta jumlahnya (berapa laporan, berapa kg, oleh siapa). Pemilik bisa memasangkannya ke produk yang benar belakangan. | N |
| 5 | **Total kg dihitung mesin, tidak diketik**: jumlah tiap barang × berat per satuannya, dijumlahkan. Total upah = total kg × tarif, dibulatkan ke rupiah terdekat. Rumusnya ada di **satu tempat di server** (WAJ-04) dan masuk daftar tes wajib. | J, PRI-28 |
| 6 | **Tarif** satu angka rupiah per kg, bertanggal berlaku; Rp20 dibawa sebagai tarif awal. Hanya pemilik yang menambah tarif; tarif tidak dihapus. Server mengambil tarif menurut tanggal kerja; tidak bisa diketik per laporan, tidak ada angka cadangan di kode, dan laporan ditolak kalau tarif untuk tanggal itu tidak ada. | P5, AH2, WAJ-07 |
| 7 | Upah **selalu dibagi rata**. Tiap peserta mendapat hasil bagi dibulatkan ke bawah; sisa rupiahnya diberikan satu rupiah per orang menurut **urutan abjad nama**. Jumlah semua bagian selalu sama dengan total upah. | P6, PRI-28 |
| 8 | Peserta: karyawan mana pun yang aktif pada tanggal kerja itu, atau pekerja lepas. Satu orang tidak bisa tercantum dua kali. **Karyawan bulanan yang ikut di jam kerjanya sendiri tetap mendapat bagian.** Keikutsertaan tercatat sebagai pekerjaan hari itu (PRI-16), tanpa mengubah jabatannya. | P2, AH9 |
| 9 | **Pekerja lepas** hanya dicatat nama dan nomor HP: tanpa akun, tanpa absen, tanpa slip. Dicatat di **satu tempat**, yaitu sebagai orang berstatus kerja Freelance (KAR-61); tidak ada daftar pekerja lepas kedua. Menutup butir terbuka nomor 4 buku Karyawan. | P4 |
| 10 | **Tanggal kerja** bawaannya hari ini dari server. Boleh mundur paling lama **3 hari**; lebih dari itu hanya pemilik, dengan alasan. Tidak boleh tanggal yang akan datang. | P3, PRI-01, PRI-09 |
| 11 | **Bongkaran dibayar tunai hari itu juga oleh finance** (pemilik juga boleh). Ini **pengecualian** dari GAJ-45 (membayar hanya pemilik) dan GAJ-56 (pengeluaran gaji hanya dari slip), khusus bongkaran (WAJ-12). Membayar adalah **satu langkah utuh di server**: tanggal bayar dari server, pembayar, sumber dana, dan **satu** catatan keuangan yang bertaut ke laporannya. Satu laporan dibayar sekali dan penuh; tidak bisa dibayar dua kali. | P1, pertentangan I, AH5 |
| 12 | **Kasbon dan denda tidak dipotong dari upah bongkaran**, karena uangnya diterima tunai hari itu. Upah bongkaran tidak masuk slip mingguan maupun bulanan. | Pertentangan I |
| 13 | Upah dicatat **per orang**: satu baris catatan upah per peserta per laporan. | AH3 |
| 14 | Laporan Bongkaran **tidak dihapus**. Sebelum dibayar boleh dikoreksi Kepala Gudang dengan alasan dan jejak. Setelah dibayar hanya pemilik yang membatalkan, wajib alasan; selisih uangnya diperhitungkan di pembayaran bongkaran berikutnya orang itu. | AH4, PRI-02 |
| 15 | **Tidak ada Kas Keluar bongkaran yang diketik tangan.** Kategori "Bongkar", "Upah Borongan", dan "Gaji Freelance" menjadi satu jalur yang hanya lahir dari Laporan Bongkaran. | AH5 |
| 16 | Biaya bongkaran dibebankan ke cabang yang ditunjuk di **pengaturan** (isi awal: Gudang), bukan nama cabang di kode. | P7, WAJ-05 |
| 17 | Laporan kedua di tanggal yang sama dengan supplier dan total kg yang sama meminta **konfirmasi** sebelum disimpan. | AH8 |
| 18 | Laporan yang belum dibayar setelah lewat hari kerjanya **ditandai** untuk finance dan pemilik. Daftar yang belum dibayar selalu tampil, berapa pun umurnya. | AH7, PRI-10, PRI-11 |
| 19 | Ada **laporan bongkaran per orang**: siapa saja yang membongkar, berapa kali, berapa kg, dan menerima berapa, dengan periode bawaan **26–25** dan rentang yang bisa diganti. Peserta melihat upah bongkarannya sendiri di portal: tanggal, kg, jumlah peserta, bagiannya, sudah dibayar atau belum. | P1, O, AH6 |
| 20 | Hak (isi awal, dijaga di server): membuat dan mengoreksi laporan oleh Kepala Gudang; membayar oleh finance dan pemilik; tarif oleh pemilik; rincian (peserta dan bagiannya) dilihat Kepala Gudang, finance, dan pemilik. | P3, AH10 |
| 21 | **Daftar produk** (kode, nama, satuan) masuk ke HRIS lewat **file export dari sistem kasir yang diunggah** di modul Tarik Data Kasir; tiap unggahan tercatat kapan dan oleh siapa. Mengunggah ulang memperbarui daftar tanpa menghilangkan berat yang sudah tersimpan. Selama daftar produk belum ada: total kg diketik dan foto surat jalan supplier wajib. | K, WAJ-03 |
| 22 | **Disiapkan sejak awal, dinyalakan belakangan: sambungan ke purchase order kasir.** Laporan Bongkaran bisa memilih satu purchase order; barang dan jumlahnya terisi dari sana, dan Kepala Gudang hanya **mencocokkan jumlah** yang datang. Selisih ditandai. HRIS tidak menulis ke sistem kasir. | L |
| 23 | **Laporan Bongkaran bukan penerimaan stok.** Stok tetap diurus sistem kasir; jumlah di laporan ini hanya untuk berat dan upah. | L |
| 24 | Supplier dipilih dari **satu daftar supplier**; tidak diketik bebas. Pemilik daftar itu ditentukan di Bab 6. | Permintaan pemilik, WAJ-03 |

### Temuan dan aturan yang mengatasinya

| Temuan di sistem lama | Diatasi oleh |
|---|---|
| 1. Halaman bongkaran tidak dipakai membayar; 19 dari 25 entri "belum dibayar" | Aturan 11, 15, 18 (bayar hanya dari laporan, hari itu; yang tertinggal ditandai) |
| 2. Bongkaran dibayar lewat Kas Keluar "Bongkar" yang diketik tangan, tanpa penghubung | Aturan 11, 15 (satu catatan keuangan, bertaut ke laporan; tidak bisa diketik) |
| 3. 7 entri belum dibayar hilang dari layar karena batas 9 minggu | Aturan 18 |
| 4. Entri lunas bisa diedit dan dihapus tanpa jejak; tarif bisa diketik per entri | Aturan 6, 14 |
| 5. Tanggal bayar diketik, sampai bertanggal masa depan; bayar dua langkah lepas | Aturan 10, 11 |
| 6. Peserta tidak bisa melihat upahnya; pemilik tidak tahu siapa terima berapa | Aturan 13, 19 |
| 7. Pekerja lepas di dua tempat; orang lepas dibayar lewat Kas Keluar "Gaji Freelance" | Aturan 9, 15 |
| 8. Karyawan bulanan ikut di hari hadirnya tanpa aturan | Aturan 8 (boleh, tercatat) |
| 9. Hanya pemilik, HR, finance yang bisa mencatat; dicatat sampai 13 hari kemudian | Aturan 1, 10, 20 |
| 10. Angka kg diketik tanpa bukti | Aturan 1, 2, 5 (dihitung dari barang; foto surat jalan) |
| 11. Nama cabang "Gudang" dan tarif cadangan Rp20 ditulis di kode | Aturan 6, 16 |
| 12. Rumus bagi rata ditulis dua kali; sisa ke "yang dicentang terakhir" | Aturan 5, 7 |

Semua aturan uang di atas masuk daftar tes wajib (WAJ-06).

### Titipan dari 5B

- Untuk 5C: kasbon tidak dipotong dari upah bongkaran (aturan 12).
- Untuk 5D: bongkaran adalah jenis upah yang dibayar tunai harian, di luar
  slip; pertanyaan 1 dan 2 di `backlog/2026-10-11-jenis-upah-dan-jadwal-bayar.md`
  sudah terjawab untuk bongkaran (Kepala Gudang mencatat, finance membayar;
  karyawan bulanan di jam kerjanya tetap dapat).
- Untuk Bab 6: pemilik daftar supplier; satu kategori pengeluaran bongkaran;
  periksa pengeluaran dobel "Bongkar" dan "Upah Borongan" di data lama;
  purchase order kasir.
- Untuk Tahap 3 (Tarik Data Kasir): tempat mengunggah file export produk, dan
  bentuk sambungan purchase order.
- Untuk keputusan data lama: 19 entri bongkaran berstatus belum dibayar
  kemungkinan sudah dibayar tunai; dipastikan dulu sebelum dipindah.
- Terbuka: bentuk persis file export produk dari sistem kasir (kolom apa saja).

---

# Bagian 5C: Kasbon

Sumber: `hris-app/app/(dashboard)/kasbon/page.tsx` (1.362 baris, lima tab);
bagian kasbon di `keuangan/approval/page.tsx`, `keuangan/kas-keluar/page.tsx`
(mode "Cairkan Kasbon"), `penggajian/bulanan/page.tsx`,
`penggajian/driver/page.tsx`, `portal/page.tsx`; tabel `kasbon_requests`,
`kasbon_deductions`, `kasbon_limits`, `driver_kasbon`,
`driver_kasbon_deductions`, `helper_kasbon`, `helper_kasbon_deductions`; fungsi
`approve_driver_kasbon`, `approve_helper_kasbon`, `fin_autopost_kasbon_request`,
`fin_autopost_driver_kasbon`, `fin_autopost_helper_kasbon`, dua fungsi
`fin_cleanup_*_kasbon_cash_out`, `kasbon_request_redirect_ritase`; kebijakan
akses di database.

Yang sudah diputuskan dan tidak ditanyakan lagi: kasbon tidak diketik di slip,
slip membaca cicilan yang jatuh tempo (GAJ-22, GAJ-38, 5A.10 aturan 11); cara
bayar dipilih saat mengajukan, ada plafon, penolakan karena plafon tidak
menyebut sisa plafon (GAJ bagian 7 butir 3); kasbon diambil paling akhir, yang
tidak tertampung dibawa ke slip berikutnya (GAJ-52, 5A.10 aturan 12); sisa
kasbon orang berhenti ditagih di slip terakhir, sisanya piutang (GAJ-53);
cicilan ditandai terpotong saat slip ditutup (GAJ-47); kasbon tidak dipotong
dari upah bongkaran (5B.10 aturan 12).

## 5C.1 Bagian ini mengurus apa

Pinjaman karyawan ke perusahaan yang dikembalikan lewat potongan gaji: siapa
boleh mengajukan dan berapa, siapa mengesahkan, kapan uangnya diserahkan,
bagaimana dicicil, dan apa yang terjadi kalau cicilan tidak terpotong, orangnya
berhenti, atau pengajuannya salah.

## 5C.2 Data di sistem lama (dicek ke database, 12 Oktober 2026)

| Data | Isinya | Tabel | Jumlah baris |
|---|---|---|---|
| Pengajuan kasbon karyawan bulanan | Karyawan, nominal, nominal awal sebelum diubah finance, alasan, status, pemeriksa finance, pengesah, cicilan per bulan, bulan mulai, jumlah terpotong, tanggal cair | `kasbon_requests` | 14 (7 September s.d. 11 Oktober 2026): 11 lunas, 1 disetujui, 2 ditolak; 10 orang |
| Cicilan kasbon bulanan | Pengajuan, bulan dan tahun potong, nominal, sudah dipotong atau belum, slip yang memotong | `kasbon_deductions` | 6 (5 terpotong Rp700.000, 1 menunggu Rp200.000) |
| Plafon (lama) | Karyawan, batas, saldo | `kasbon_limits` | **0** (tidak dipakai lagi) |
| Plafon (baru) | Satu angka di data karyawan | `employees.kasbon_limit` | **Rp0 untuk semua 24 karyawan aktif** |
| Kasbon driver | Driver, nominal, **sisa**, keterangan, status | `driver_kasbon` | 39 (5 Juli s.d. 11 Oktober 2026): 37 lunas, 2 aktif; **3 orang** |
| Potongan kasbon driver | Kasbon, minggu, nominal dipotong, sisa sesudahnya, tautan Kas Keluar | `driver_kasbon_deductions` | 48 (Rp7.594.125) |
| Kasbon kenek | Sama dengan driver | `helper_kasbon` | 6 (18 September s.d. 12 Oktober 2026): 5 lunas, 1 aktif; 2 orang |
| Potongan kasbon kenek | Sama dengan driver | `helper_kasbon_deductions` | 4 (Rp300.000) |
| Kas Keluar pencairan | Kategori `kasbon_cair`, bertaut ke kasbonnya | `fin_cash_out` | 57 (Rp10.269.125): 39 driver, 6 kenek, 10 karyawan bulanan, 2 dari impor arus kas lama |

Keadaan data:

- **Plafon tidak pernah dipakai.** Semua karyawan aktif berplafon Rp0, dan
  peringatan "melebihi limit" hanya muncul kalau plafon lebih dari Rp0. Jadi
  selama ini tidak ada batas apa pun.
- **Cara bayar tidak pernah dicicil.** Ke-12 kasbon bulanan yang disahkan
  semuanya dipotong **satu kali** (cicilan = seluruh nominal). Nominalnya
  Rp50.000 sampai Rp250.000, tengahnya Rp100.000.
- **Kasbon driver lebih mirip "ambil upah di muka" daripada pinjaman.** 39
  kasbon dalam 3,5 bulan untuk 3 driver (kira-kira satu per orang per minggu;
  5 kali satu orang mengambil dua kali di minggu yang sama). Nominal Rp10.000
  sampai Rp400.000, tengahnya Rp200.000. 29 dari 37 yang lunas habis dalam
  **satu kali potong**; lebih dari separuhnya dicatat di **hari yang sama**
  dengan potongannya. Artinya uangnya diberikan lebih dulu, baru dicatat saat
  gajian.
- **Potongan kasbon di slip bulanan jauh lebih besar daripada kasbon yang
  tercatat.** 18 slip memuat potongan kasbon Rp5.361.529 (Mei s.d. September
  2026), tetapi cicilan yang tercatat terpotong hanya Rp700.000 di 4 slip.
  Sisanya Rp4.661.529 diketik di slip tanpa catatan kasbon mana pun (menu
  pengajuan baru dipakai sejak September). Sudah dicatat di 3B sebagai "slip
  berkasbon tidak tertaut ke cicilan".
- **6 pengajuan berstatus lunas padahal belum terpotong serupiah pun**
  (Rp700.000). Semuanya milik driver atau kenek yang salah masuk ke kasbon
  bulanan, lalu dipindah dengan tangan ke kasbon mingguan. **4 di antaranya
  punya Kas Keluar pencairan di dua tempat** (Rp400.000): sekali dari kasbon
  bulanan, sekali lagi dari kasbon mingguan. Kemungkinan pengeluarannya
  tercatat dua kali; diperiksa di Bab 6.
- 5 orang punya kasbon di kedua sistem (bulanan dan mingguan).
- **Semua 57 Kas Keluar pencairan tidak punya rekening atau kas sumber.**
  Catatannya lahir otomatis saat disahkan, tanpa ada yang mengisi uangnya
  diambil dari mana.
- **34 dari 48 potongan kasbon driver (Rp5.574.150) tidak bertaut ke
  pembayaran gaji mana pun**, sejalan dengan temuan 5A (ritase berstatus belum
  dibayar). Potongannya sudah mengurangi sisa kasbon, tetapi gajinya di sistem
  belum "dibayar".
- 1 kasbon kenek (Rp50.000) berstatus lunas tanpa potongan: ditandai lunas
  dengan tombol.
- Pengajuan bulanan **tidak mencatat siapa yang mengisinya** (karyawan sendiri
  atau HR atas nama). Kolom "dibuat oleh" di kasbon driver kosong di semua 39
  baris.
- 6 dari 14 pengajuan tanpa alasan. Jarak pengajuan sampai disahkan 0 sampai
  11 hari. Finance mengubah nominal 1 kali dari 8 yang diperiksanya.

## 5C.3 Aturan yang ditemukan

### Dua sistem kasbon

| No | Aturan | Sumber |
|---|---|---|
| DRV-C01 | Ada **dua sistem kasbon yang tidak saling mengenal**: kasbon karyawan bulanan (dipotong per bulan di slip bulanan) dan kasbon driver serta kenek (dipotong per minggu di gaji driver). Kasbon mingguan sendiri dipecah dua tabel kembar: driver dan kenek. | `kasbon_requests`, `driver_kasbon`, `helper_kasbon` |
| DRV-C02 | Pengajuan yang masuk ke kasbon bulanan **dialihkan diam-diam oleh database** ke kasbon mingguan kalau orangnya berjenis driver, atau berdepartemen **"Team Gudang"** dan berjabatan **"Helper"** (nama ditulis di kode). Layar tetap berkata "berhasil" walau barisnya tidak ada di daftar yang sedang dilihat. | `kasbon_request_redirect_ritase` |
| DRV-C03 | Daftar orang yang bisa diberi kasbon kenek dicari dengan nama departemen "Team Gudang"; kalau tidak ketemu, **semua karyawan tetap** tampil. | `TabKasbonKenek.fetchAll` |

### Mengajukan

| No | Aturan | Sumber |
|---|---|---|
| DRV-C04 | Yang mengajukan: karyawan untuk dirinya sendiri, atau pemilik dan HR atas nama karyawan mana pun. Isinya nominal dan alasan (**alasan tidak wajib**). | `handleAjukan` |
| DRV-C05 | Di layar, kepala cabang punya tombol "Ajukan Kasbon", tetapi database **menolaknya**: yang diizinkan menambah hanya pemilik, HR, dan karyawan biasa. | `canSelfSubmit`, kebijakan `kasbon_req_insert` |
| DRV-C06 | Database **tidak memeriksa pengajuan itu untuk siapa**: akun karyawan biasa bisa memasukkan pengajuan atas nama orang lain. Hanya layar yang mengunci namanya. | kebijakan `kasbon_req_insert` |
| DRV-C07 | Plafon satu angka per orang. Kalau sisa kasbon ditambah pengajuan baru melebihi plafon, layar hanya **menulis merah "melebihi limit"**; pengajuan tetap tersimpan. Plafon Rp0 berarti tidak diperiksa. Plafon diubah pemilik, HR, atau finance dari tab Limit. | `outstandingFor`, `TabLimit` |
| DRV-C08 | Boleh punya **beberapa kasbon berjalan sekaligus**; tidak ada pemeriksaan. | tidak ada |
| DRV-C09 | Tidak ada syarat masa kerja, status training, atau batas jumlah pengajuan. | tidak ada |
| DRV-C10 | Kasbon driver dan kenek bisa juga dimasukkan langsung oleh pemilik, HR, atau finance dari tab Kasbon Driver dan Kasbon Kenek: orang, nominal, keterangan. | `handleTambahKasbon` |

### Mengesahkan

| No | Aturan | Sumber |
|---|---|---|
| DRV-C11 | Kasbon bulanan disahkan **dua tahap**: (1) finance memeriksa dan **boleh mengubah nominalnya** (naik atau turun); nominal awal disimpan dan karyawan melihat "diajukan Rp…"; (2) pemilik mengesahkan dan **menentukan cicilan per bulan dan bulan mulai potong**. Karyawan tidak memilih cara bayar. | `handleKasbonReview`, `handleKasbonApprove` |
| DRV-C12 | Mengesahkan adalah **dua langkah lepas dari layar**: status diubah dulu, lalu baris cicilan ditulis; hasil langkah kedua tidak diperiksa. Kalau gagal, kasbon sudah sah dan sudah cair tetapi **tidak punya cicilan**, sehingga tidak pernah terpotong. | `handleKasbonApprove` |
| DRV-C13 | Cicilan dijadwalkan per **bulan kalender** (bulan dan tahun), cicilan terakhir berisi sisanya. Tidak mengenal periode 26–25. | sama, `kasbon_deductions` |
| DRV-C14 | Menolak: finance atau pemilik, wajib alasan. | `handleKasbonReject` |
| DRV-C15 | Kasbon driver dan kenek disahkan **satu tahap** oleh pemilik, tanpa pemeriksaan finance, tanpa jadwal cicilan. **Tidak ada status "ditolak"**: menolak berarti **menghapus** pengajuannya. | `approve_driver_kasbon`, `handleDriverHelperReject` |
| DRV-C16 | Pengesahan kasbon driver dan kenek hanya dijaga fungsi; **kebijakan tabelnya mengizinkan pemilik, HR, dan finance menulis apa saja**, termasuk memasukkan kasbon yang langsung berstatus aktif atau mengubah nominal dan sisanya. | kebijakan `driver_kasbon_admin`, `helper_kasbon_admin` |
| DRV-C17 | Pengajuan yang menunggu tampil di tiga tempat: menu Kasbon, Verifikasi Keuangan (dua tab), dan angka "Kasbon Menunggu" di dashboard (hanya kasbon bulanan). Tidak ada batas waktu menjawab. | `approval/page.tsx`, `dashboard/page.tsx` |

### Mencairkan

| No | Aturan | Sumber |
|---|---|---|
| DRV-C18 | **Begitu disahkan, kasbon dianggap sudah cair**: database langsung menulis Kas Keluar "Pencairan kasbon (auto)" berstatus sudah diverifikasi, bertanggal hari pengesahan, **tanpa rekening atau kas sumber**, dan menandai tanggal cair. Tidak ada langkah "uang benar-benar diserahkan". | `fin_autopost_kasbon_request`, `fin_autopost_driver_kasbon`, `fin_autopost_helper_kasbon` |
| DRV-C19 | Masih ada **jalan pencairan kedua**: mode "Cairkan Kasbon" di Kas Keluar (memilih pengajuan yang sudah sah dan belum cair, dua langkah lepas dari layar, tanggal diketik). Sejak DRV-C18 daftarnya selalu kosong, tetapi layarnya masih ada. | `kas-keluar/page.tsx` |
| DRV-C20 | Biaya pencairan dibebankan ke cabang orangnya saat itu. Kalau orangnya tidak punya cabang, Kas Keluar **diam-diam tidak dibuat**. | fungsi `fin_autopost_*` |

### Memotong dari slip bulanan

| No | Aturan | Sumber |
|---|---|---|
| DRV-C21 | Saat slip dibuat, kolom potongan kasbon terisi dari cicilan yang dijadwalkan bulan itu, lalu **boleh diketik ulang**; di daftar slip juga bisa diubah per baris. Nominal ketikan harus pas dengan jumlah cicilan utuh. | `createKasbon`, `handleSaveKasbon` |
| DRV-C22 | Cicilan baru ditandai terpotong saat slip **ditandai lunas**, bukan saat dibuat atau disetujui: cicilan tertua dulu, hanya cicilan yang **utuh**; tidak ada potong sebagian. Jumlah terpotong di pengajuan ditambah, dan pengajuan menjadi lunas kalau sudah penuh. Semuanya ditulis dari layar, beberapa langkah lepas. | `applyKasbonDeductionFifo` |
| DRV-C23 | Cicilan yang tidak terpotong di bulannya **tetap menunggu dengan bulan lamanya**; slip bulan berikutnya tidak membacanya (slip hanya mencari cicilan bulan itu). Tidak ada tanda dan tidak ada yang diberi tahu. | `kasbon_deductions` dibaca per bulan |
| DRV-C24 | Menghapus slip mengembalikan cicilan yang ditandainya menjadi belum terpotong. | `reverseKasbonDeductionForPayroll` |
| DRV-C25 | Sisa kasbon dihitung di layar (nominal dikurangi jumlah terpotong) dan **rumusnya ditulis di empat halaman**: tab Limit, portal, gaji bulanan, dan form pengajuan (yang terakhir tidak mensyaratkan sudah cair). | `fetchData`, `fetchKasbonSaldo`, `kasbonSaldoMap`, `outstandingFor` |

### Memotong dari gaji mingguan

| No | Aturan | Sumber |
|---|---|---|
| DRV-C26 | Tidak ada cicilan. Saat gajian, pembuat slip **mengetik** berapa yang dipotong dari tiap kasbon aktif minggu itu; boleh sebagian, paling banyak sebesar sisa. | `penggajian/driver/page.tsx` `handleSaveDeductions` |
| DRV-C27 | **Sisa kasbon disimpan sebagai angka** dan dikurangi dari layar; lunas kalau sisa nol. Membatalkan potongan mengembalikan sisa dari layar. | sama, `handleDeleteKasbonDeduction` |
| DRV-C28 | Kalau potongan melebihi upah minggu itu, pembayaran ditolak sampai potongannya dikurangi (sudah dicatat di 5A). | 5A.3 bagian Potongan |
| DRV-C29 | Di catatan keuangan, gaji driver dan kenek diakui penuh ("potongan kasbon tidak mengurangi gaji"), karena kasbonnya sudah dicatat sebagai pengeluaran saat cair. | `fin_recompute_driver_weekly_wage` |

### Menutup, menghapus, dan yang dilihat karyawan

| No | Aturan | Sumber |
|---|---|---|
| DRV-C30 | Ada tombol **"Tandai Lunas"**: kasbon bulanan oleh pemilik, kasbon driver dan kenek oleh pemilik, HR, atau finance. Status menjadi lunas (dan sisa menjadi nol) **tanpa uang masuk yang dicatat, tanpa alasan**. | `handleLunas` (tiga salinan) |
| DRV-C31 | Kasbon driver dan kenek bisa **dihapus kapan saja, termasuk yang aktif dan lunas**, oleh pemilik, HR, atau finance. Kasbon driver: riwayat potongan dan Kas Keluar-nya ikut terhapus. Kasbon kenek yang sudah punya potongan gagal dihapus, tetapi layar tetap berkata "Kasbon dihapus". | `handleHapus`, `fin_cleanup_*_kasbon_cash_out` |
| DRV-C32 | Kasbon bulanan bisa dihapus pemilik dan HR langsung di database (tidak ada tombol); cicilannya ikut terhapus, Kas Keluar-nya tertinggal. Menghapus data karyawan ikut menghapus seluruh kasbonnya. | kebijakan `kasbon_req_delete`, `ON DELETE CASCADE` |
| DRV-C33 | Pemilik bisa mengubah kolom apa pun di kasbon bulanan berstatus apa pun. Tidak ada jejak perubahan. | kebijakan `kasbon_req_update` |
| DRV-C34 | Karyawan bulanan melihat pengajuannya, statusnya, sisa "Kasbon Aktif", dan perkiraan cicilan bulan ini di portal. Driver dan kenek melihat daftar "Kasbon Mingguan Saya" (nominal, sisa, status), tanpa riwayat potongan. | `portal/page.tsx`, `TabPengajuan` |
| DRV-C35 | Karyawan tidak bisa menarik pengajuannya sendiri. | tidak ada tombol |
| DRV-C36 | Tidak ada aturan untuk orang yang berhenti dengan sisa kasbon, tidak ada pelunasan tunai lebih cepat, tidak ada penundaan cicilan. | tidak ada |

## 5C.4 Menu di sistem lama

| Menu | Sub menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|---|
| Kasbon | Pengajuan | Mengajukan dan melihat status kasbon bulanan; "Tandai Lunas" | Verifikasi Keuangan › Kasbon |
| Kasbon | Limit Karyawan | Plafon per orang dan sisa kasbon | — (tidak pernah diisi) |
| Kasbon | Riwayat Potongan | Cicilan per bulan | Kolom kasbon di Gaji Bulanan |
| Kasbon | Kasbon Driver, Kasbon Kenek | Daftar, tambah, setujui, lunas, hapus, riwayat | Kembar satu sama lain; Verifikasi Keuangan › Kasbon Driver/Kenek |
| Keuangan › Verifikasi Keuangan | Kasbon; Kasbon Driver/Kenek | Finance memeriksa, pemilik mengesahkan atau menolak | Menu Kasbon |
| Keuangan › Kas Keluar | mode "Cairkan Kasbon" | Mencairkan dengan tangan | Sudah digantikan pencairan otomatis |
| Penggajian › Gaji Bulanan | kolom Pot. Kasbon | Mengetik potongan | Riwayat Potongan |
| Penggajian › Gaji Driver | Detail & Cetak Slip | Mengetik potongan mingguan | — |

## 5C.5 Tumpang tindih

1. **Tiga tabel kasbon dan tiga tabel potongan** untuk satu hal yang sama,
   dibedakan menurut jenis pekerja; ditambah tabel plafon lama yang kosong.
2. **Dua cara mengesahkan** (dua tahap dengan finance, dan satu tahap) dan
   **dua cara menolak** (status ditolak dengan alasan, dan dihapus).
3. **Dua cara mencicil**: jadwal per bulan yang ditentukan pemilik, dan
   ketikan bebas tiap minggu.
4. **Dua cara menyimpan sisa**: dihitung dari jumlah terpotong, dan angka sisa
   yang disimpan lalu dikurangi dari layar.
5. **Dua jalan pencairan**: otomatis saat disahkan, dan mode "Cairkan Kasbon".
6. **Rumus sisa kasbon ditulis di empat halaman**; tombol "Tandai Lunas" tiga
   salinan; tab Kasbon Driver dan Kasbon Kenek adalah salinan satu sama lain.
7. **Pengesahan di dua menu** (Kasbon dan Verifikasi Keuangan).
8. Potongan kasbon di slip bisa berasal dari cicilan **atau** ketikan.

## 5C.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| Salah ketik nominal saat mengajukan | Tidak bisa diubah atau ditarik karyawan; finance bisa mengubah saat memeriksa | Sebagian |
| Karyawan berubah pikiran sebelum disahkan | Tidak ada tombol tarik | **Tidak** |
| Disahkan, ternyata uangnya tidak jadi diambil | Sudah tercatat cair otomatis; tidak ada pembatalan | **Tidak** (driver dan kenek: hapus, tanpa jejak) |
| Driver salah mengajukan lewat kasbon bulanan | Sejak Oktober dialihkan otomatis; yang lama dipindah dengan tangan | Ya, dengan akibat pencairan tercatat dua kali (4 kasus) |
| Gaji bulan itu tidak cukup untuk cicilan | Slip tidak boleh minus; cicilan tetap menunggu di bulan lamanya dan tidak ikut slip berikutnya | **Tidak** |
| Slip tidak pernah ditandai lunas | Cicilan tidak pernah ditandai terpotong walau gajinya sudah dipotong | **Tidak** |
| Karyawan minta cicilan ditunda | Ketik ulang potongan di slip menjadi Rp0; jadwalnya tidak bergeser | Tanpa aturan |
| Karyawan melunasi tunai lebih cepat | "Tandai Lunas", tanpa catatan uang masuk | Tanpa jejak |
| Orang berhenti dengan sisa kasbon | Tidak ada apa-apa; sisanya tertinggal | **Tidak** |
| Kasbon diikhlaskan pemilik | "Tandai Lunas" | Tanpa alasan, tanpa jejak |
| Pengesahan gagal di tengah (cicilan tidak tertulis) | Tidak ada pesan | **Tidak** |
| Pengajuan tidak dijawab berhari-hari | Tidak ada tanda (pernah 11 hari) | **Tidak** |
| Orang pindah dari bulanan ke mingguan atau sebaliknya | Kasbonnya tertinggal di sistem lamanya | **Tidak** |
| Uang diberikan dulu, dicatat saat gajian | Kasbon dan potongannya dicatat di hari yang sama | Ya, tetapi pengesahan jadi formalitas |

## 5C.7 Pertanyaan untuk pemilik (diajukan di percakapan, 12 Oktober 2026)

Butuh pandangan pemilik:

1. **Plafon**: per orang atau per jabatan, berapa besarnya, dan kapan terisi
   lagi. Saran: plafon adalah batas **sisa utang** (bukan batas sekali
   pinjam), bawaannya per jabatan dan bisa diubah per orang oleh pemilik;
   terisi lagi tiap cicilan terpotong.
2. **Paling banyak berapa kali potong.** Kenyataan: semua kasbon dipotong
   sekali. Saran: bulanan paling banyak 3 kali; mingguan paling banyak 4
   minggu.
3. **Siapa mengesahkan dan siapa menyerahkan uang.** Saran: disahkan pemilik
   saja (satu tahap, sama untuk semua orang); finance **mencairkan** sebagai
   langkah tersendiri yang mencatat sumber dana dan tanggal uang diserahkan;
   cicilan baru berjalan setelah cair.
4. **Kasbon driver dan kenek**: kenyataannya uang diberikan dulu di tengah
   minggu lalu dicatat saat gajian. Saran: tetap satu jenis Kasbon dengan
   aturan yang sama, wajib diajukan dan disahkan **sebelum** uang diberikan;
   bawaan cara bayarnya sekali potong di slip minggu itu.
5. **Syarat boleh kasbon.** Saran: karyawan training belum boleh; boleh punya
   lebih dari satu kasbon berjalan selama jumlah sisanya tidak melewati
   plafon.

Cukup setuju atau tidak:

6. Pengesah boleh **menyetujui lebih kecil** dari yang diajukan; karyawan
   melihat keduanya. Finance tidak mengubah nominal.
7. Cicilan pertama masuk slip periode saat uang cair; kalau slip periode itu
   sudah ditutup, slip berikutnya. Periode mengikuti slip (26–25 atau
   Jumat–Kamis), bukan bulan kalender.
8. **Menunda cicilan**: diminta karyawan dengan alasan, disahkan pemilik,
   paling banyak 1 kali per kasbon; jadwal bergeser satu slip.
9. **Melunasi tunai lebih cepat** boleh: diterima finance, tercatat sebagai
   uang masuk yang bertaut ke kasbonnya.
10. **Menghapus utang** (diikhlaskan) hanya pemilik, wajib alasan, tercatat
    sebagai beban perusahaan; bukan tombol "Lunas".
11. Alasan mengajukan **wajib** diisi. HR boleh mengajukan atas nama karyawan,
    dan tercatat siapa yang mengisi.
12. Pengajuan yang belum dijawab **3 hari** ditandai untuk pemilik (tidak
    otomatis ditolak).

## 5C.8 Usulan untuk v3 (belum disetujui)

| No | Usulan |
|---|---|
| AI1 | **Satu buku Kasbon untuk semua orang**: satu tempat, satu alur, satu rumus. Jadwal potong mengikuti jenis slip orangnya (bulanan atau mingguan). Tidak ada pengalihan menurut nama departemen atau jabatan (WAJ-05). |
| AI2 | **Mengesahkan adalah satu langkah utuh di server**: status, nominal yang disetujui, dan jadwal cicilan tersimpan bersama atau tidak sama sekali. |
| AI3 | **Mencairkan adalah satu langkah utuh di server**: tanggal dari server, siapa yang menyerahkan, sumber dana (wajib), dan satu catatan keuangan yang bertaut ke kasbonnya. Satu kasbon cair sekali. |
| AI4 | **Sisa kasbon tidak disimpan dan tidak diketik**: selalu dihitung server dari nominal cair dikurangi cicilan terpotong dan pelunasan tunai, di satu tempat (WAJ-04). |
| AI5 | Cicilan ditandai terpotong **hanya oleh penutupan slip** (GAJ-47), bertaut ke slipnya, dan **boleh sebagian**; sisanya ikut slip berikutnya sebagai "sisa potongan" (GAJ-52). |
| AI6 | **Kasbon tidak dihapus** (PRI-02). Pengaju boleh menarik pengajuannya sebelum disahkan. Menolak wajib alasan. Setelah disahkan dan belum cair: dibatalkan pemilik dengan alasan. Setelah cair: tidak dibatalkan, hanya dilunasi atau dihapus utangnya. |
| AI7 | **"Lunas" bukan tombol.** Status lunas lahir sendiri saat sisa nol. |
| AI8 | **Plafon dijaga server** dan menolak pengajuan; pesannya tidak menyebut sisa plafon (GAJ bagian 7 butir 3). Plafon bertanggal berlaku (WAJ-07). |
| AI9 | Karyawan melihat kasbonnya **utuh** di portal: status, nominal diajukan dan disetujui, jadwal cicilan, yang sudah terpotong beserta slipnya, dan sisa. |
| AI10 | Tiap pengajuan mencatat **siapa yang mengisi dan untuk siapa**; karyawan hanya bisa mengajukan untuk dirinya, dijaga server. |
| AI11 | Pemilik punya daftar **"Kasbon Berjalan"**: semua orang, sisa, cicilan berikutnya, cicilan yang tertunda atau terbawa, dan pengajuan yang menunggu. Finance melihat kasbon yang sudah sah dan menunggu dicairkan. |
| AI12 | Orang yang berhenti: seluruh sisa kasbon ditagih di slip terakhirnya, bulanan maupun mingguan; yang tidak tertutup menjadi piutang (GAJ-53). |
| AI13 | Orang yang berganti jenis slip membawa kasbonnya; jadwal sisa cicilannya disusun ulang server mengikuti slip barunya. |

## 5C.9 Jawaban pemilik (12 Oktober 2026)

Arahan umum: semua temuan 5C harus dipastikan tidak terulang di sistem baru
(tabel "Temuan dan aturan yang mengatasinya" dibuat di 5C.10).

| Pertanyaan | Jawaban |
|---|---|
| 1. Plafon | Dua lapis. **Dana kasbon kantor hanya Rp1.000.000** untuk semua orang, dan **batas tiap karyawan Rp250.000**, sama untuk semua. Urutan periksa: batas orangnya dulu; kalau lolos, lihat sisa dana kantor; kalau dananya tidak ada, tidak bisa mengajukan. Nominal batas tiap orang **tidak disampaikan**, biarkan gagal. Karyawan diberi tahu: kasbon diproses **paling cepat 2 hari setelah pengajuan**, tidak bisa langsung cair |
| 2. Kali potong | Paling banyak **3 kali**, berapa pun nominalnya, dan semuanya lewat prosedur persetujuan |
| 3. Pengesah dan pencair | Diajukan karyawan → **diperiksa finance** (finance boleh mengubah nominal dan jumlah kali bayar) → **GM dan Owner meninjau, boleh mengubah lagi, lalu menyetujui** → finance mendapat pemberitahuan untuk menyerahkan uang. Harus jelas uangnya **sudah diberikan atau belum** |
| 4. Kasbon driver dan kenek | "Ya, tetap": satu jenis Kasbon, aturan yang sama, disahkan sebelum uang diberikan |
| 5. Syarat | **Masa kerja 6 bulan.** Kalau mendesak, karyawan menghubungi GM; ada cara khusus |
| 6. Pengesah boleh menyetujui lebih kecil | Ok (bagian "finance tidak mengubah nominal" bertabrakan dengan jawaban 3; lihat pertentangan P) |
| 7. Cicilan pertama mengikuti periode slip saat cair | Ok |
| 8–12 | Ok semua. Tambahan untuk 11: alasan wajib **minimal 15 karakter** |
| AI1–AI7, AI9–AI13 | Ok |
| AI8 | Ok, dengan kalimat penolakan: "Pastikan Anda sudah membayar kasbon lama. Ditolak karena kasbon lama masih banyak." |

Dicek ke database setelah jawaban (12 Oktober 2026), untuk menimbang akibatnya:

- Menurut tanggal bergabung di sistem lama, **17 dari 24 karyawan aktif belum
  6 bulan bekerja**, dan semua 39 kasbon driver diambil saat masa kerjanya
  (menurut data) belum 6 bulan. Bisa jadi tanggal bergabung di sistem lama
  bukan tanggal sebenarnya.
- 7 dari 39 kasbon driver di atas Rp250.000 (paling besar Rp400.000).
- Sisa kasbon berjalan saat ini Rp700.000 (di bawah Rp1.000.000). Tidak ada
  minggu yang kasbon driver barunya melebihi Rp1.000.000.

### Pertentangan P dan butir penutup (diajukan di percakapan, 12 Oktober 2026)

**Pertentangan P.** Jawaban 3 (finance boleh mengubah nominal dan kali bayar)
bertabrakan dengan jawaban 6 ("finance tidak mengubah nominal") dan melapisi
keputusan lama "cara bayar dipilih karyawan saat mengajukan" (GAJ bagian 7
butir 3). Saran Claude: jawaban 3 yang dipakai. Karyawan mengajukan nominal
dan memilih kali bayar; finance **mengusulkan** perubahan; GM atau Owner yang
memutuskan angka akhirnya. Nominal hanya boleh diturunkan, kali bayar 1 sampai
3. Karyawan melihat yang diajukan dan yang disetujui.

Butir penutup:

- Q. **Sisa dana kantor** = Rp1.000.000 dikurangi sisa utang semua kasbon yang
  berjalan dan pengajuan yang masih menunggu. Dana terisi lagi tiap cicilan
  terpotong atau dilunasi.
- R. Kalimat kalau **dana kantor habis** (bukan karena batas orangnya).
- S. **"Paling cepat 2 hari"**: aturan keras (uang tidak bisa diserahkan
  sebelum 2 hari sejak pengajuan) atau hanya pemberitahuan. Berlaku juga untuk
  driver dan kenek.
- T. **Cara khusus lewat GM** untuk yang mendesak: bentuknya, dan apakah boleh
  melewati batas Rp250.000 serta dana Rp1.000.000.
- U. Syarat 6 bulan dihitung dari **tanggal bergabung sebenarnya**; data
  tanggal bergabung dipastikan benar saat akun v3 dibuat (KAR-53).
- V. Batas Rp250.000, dana Rp1.000.000, 3 kali potong, 6 bulan, dan 2 hari
  disimpan sebagai **pengaturan bertanggal berlaku** yang hanya diubah GM dan
  Owner (WAJ-05, WAJ-07).

### Jawaban atas pertentangan P dan butir penutup (12 Oktober 2026)

| Butir | Jawaban |
|---|---|
| P. Finance mengusulkan, GM atau Owner memutuskan; nominal hanya turun; kali bayar 1–3 | Ok |
| Q. Cara menghitung sisa dana | Ok. Tambahan: ada **dua dana kasbon**, satu untuk tim toko dan satu khusus driver dan helper |
| R. Kalimat dana habis | Ok. Diingatkan: pengamannya, kasbon hanya untuk karyawan yang sudah 6 bulan bekerja |
| S. Paling cepat 2 hari | "Ya ok, tapi tidak tutup kemungkinan di hari pertama sudah bisa cair. Tujuannya biar tidak ada yang terlewat." Dibaca Claude sebagai: **bukan** larangan mencairkan sebelum 2 hari, melainkan pemberitahuan ke karyawan dan batas waktu memproses |
| T. Cara khusus lewat GM | Pemilik meminta saran. Keterangan: ada kasus seperti kecelakaan yang harus dibantu dan pencatatannya harus ada; berbeda dengan Owner "memberi"; ada juga kasus yang memang kasbon saja |
| U. Dihitung dari tanggal bergabung sebenarnya | Ok |
| V. Disimpan sebagai pengaturan bertanggal berlaku | Boleh |

Diajukan di percakapan setelah jawaban ini (12 Oktober 2026): pembagian dan
besar dua dana kasbon (W), rancangan Kasbon Khusus (X), dan bacaan atas
jawaban S (Y).

### Jawaban atas butir W, X, dan Y (12 Oktober 2026)

| Butir | Jawaban |
|---|---|
| W. Dua dana mengikuti jenis slip (bulanan; mingguan) | Setuju. **Rp1.000.000 untuk masing-masing dana.** Batas per orang sama, Rp250.000 |
| X. Kasbon Khusus (8 butir) dan pembedaan kasbon biasa, Kasbon Khusus, pemberian | Ok |
| Y. "2 hari" adalah pemberitahuan dan batas waktu memproses, bukan larangan cair lebih cepat; tanda setelah 2 hari menggantikan 3 hari; kalimat untuk yang belum 6 bulan | Ok |

## 5C.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 5E)

"Pemilik" di bawah berarti Owner atau GM (KAR-67).

| No | Aturan | Asal |
|---|---|---|
| 1 | **Satu buku Kasbon untuk semua orang**: satu tempat, satu alur, satu rumus. Tidak ada kasbon khusus driver atau kenek, dan tidak ada pengalihan menurut nama departemen atau jabatan. | AI1, P4, WAJ-05 |
| 2 | **Syarat masa kerja 6 bulan**, dihitung dari tanggal bergabung sebenarnya. Yang belum memenuhi ditolak dengan kalimat terus terang: "Kasbon baru bisa diajukan setelah 6 bulan bekerja. Kalau mendesak, hubungi GM." | P5, U, Y |
| 3 | **Batas per orang Rp250.000**, sama untuk semua. Yang dibatasi adalah **sisa utang**: sisa semua kasbon biasa orang itu, ditambah pengajuannya yang masih menunggu, ditambah pengajuan baru. Boleh punya lebih dari satu kasbon berjalan selama masih di dalam batas. **Angka batas tidak pernah ditampilkan ke karyawan.** Kalimat penolakan: "Pastikan Anda sudah membayar kasbon lama. Ditolak karena kasbon lama masih banyak." Kalau orangnya tidak punya kasbon berjalan, dipakai kalimat aturan 4. | P1, P5, AI8 |
| 4 | Ada **dua Dana Kasbon, masing-masing Rp1.000.000**: satu untuk orang berslip bulanan, satu untuk orang berslip mingguan (driver dan kenek). Dana mengikuti **jenis slip**, bukan nama departemen. Sisa dana = besar dana dikurangi sisa utang semua kasbon biasa yang berjalan di dana itu dan pengajuan yang masih menunggu. Dana terisi lagi tiap cicilan terpotong, dilunasi, atau pengajuan ditarik, ditolak, atau dibatalkan. Kalau sisa dana tidak cukup: "Kasbon belum bisa diajukan saat ini. Silakan coba lagi setelah gajian." | P1, Q, R, W |
| 5 | **Urutan periksa** saat mengajukan, semuanya di server dan di satu tempat: masa kerja, lalu batas orangnya, lalu sisa dana. Gagal di satu langkah berarti pengajuan tidak tersimpan. Masuk daftar tes wajib. | P1, AI8, WAJ-04, WAJ-06 |
| 6 | **Mengajukan**: karyawan untuk dirinya sendiri, dijaga server. HR boleh mengisi atas nama karyawan; tercatat siapa yang mengisi dan untuk siapa. Isinya: nominal, **kali potong (1 sampai 3)**, dan **alasan wajib minimal 15 karakter**. | P2, P11, AI10 |
| 7 | Setelah pengajuan tersimpan, karyawan melihat: "Kasbon diproses paling cepat 2 hari setelah pengajuan, tidak bisa langsung cair." Ini pemberitahuan; uang **boleh** cair lebih cepat kalau prosesnya selesai. | P1, S, Y |
| 8 | **Alur pengesahan** sama untuk semua orang: (a) **finance memeriksa** dan boleh mengusulkan perubahan nominal dan kali potong; (b) **pemilik meninjau, boleh mengubah lagi, lalu menyetujui atau menolak**. Nominal hanya boleh **diturunkan**; kali potong 1 sampai 3. Angka akhir adalah keputusan pemilik. Karyawan melihat yang ia ajukan dan yang disetujui. Menolak wajib alasan. | P3, P6, pertentangan P |
| 9 | **Menyetujui adalah satu langkah utuh di server**: status, nominal akhir, dan jadwal cicilan tersimpan bersama atau tidak sama sekali. Tidak ada yang menyetujui kasbonnya sendiri. | AI2, PRI-24 |
| 10 | Begitu disetujui, finance mendapat pemberitahuan. **Menyerahkan uang adalah langkah tersendiri oleh finance**, satu langkah utuh di server: tanggal dari server, siapa yang menyerahkan, **sumber dana wajib**, dan satu catatan keuangan yang bertaut ke kasbonnya. Status kasbon membedakan dengan jelas **"disetujui, belum diberikan"** dan **"sudah diberikan"**. Satu kasbon cair sekali. | P3, AI3 |
| 11 | Pengajuan yang belum selesai diproses setelah **2 hari**, dan kasbon yang sudah disetujui tetapi belum ditandai sudah diberikan, **ditandai** untuk finance dan pemilik. Tidak ada yang ditolak otomatis. | P12, Y |
| 12 | **Jadwal cicilan** dibuat server: nominal dibagi rata ke kali potongnya, dibulatkan ke bawah ke rupiah, sisanya masuk cicilan terakhir. Cicilan pertama masuk slip periode saat uang diberikan; kalau slip itu sudah ditutup, slip berikutnya. Periode mengikuti slip orangnya (26–25 atau Jumat–Kamis), bukan bulan kalender. | P7, PRI-28 |
| 13 | **Potongan kasbon tidak pernah diketik.** Slip membaca cicilan yang jatuh tempo; cicilan ditandai terpotong hanya saat slip ditutup, bertaut ke slipnya, dan **boleh sebagian**. Yang tidak tertampung ikut slip berikutnya sebagai "sisa potongan". | AI5, GAJ-22, GAJ-47, GAJ-52, 5A.10 aturan 11–12 |
| 14 | **Sisa kasbon tidak disimpan dan tidak diketik**: selalu dihitung server dari nominal yang diberikan dikurangi cicilan terpotong dan pelunasan tunai, di satu tempat. | AI4, WAJ-04 |
| 15 | **Menunda cicilan**: diminta karyawan dengan alasan, disahkan pemilik, paling banyak 1 kali per kasbon; jadwal bergeser satu slip. | P8 |
| 16 | **Melunasi tunai lebih cepat** boleh: diterima finance dan tercatat sebagai uang masuk yang bertaut ke kasbonnya. | P9 |
| 17 | **Menghapus utang** (diikhlaskan) hanya pemilik, wajib alasan, tercatat sebagai beban perusahaan. | P10 |
| 18 | **"Lunas" bukan tombol.** Status lunas lahir sendiri saat sisa nol. | AI7 |
| 19 | **Kasbon tidak dihapus.** Pengaju boleh menarik pengajuannya sebelum disetujui. Setelah disetujui dan belum diberikan: dibatalkan pemilik dengan alasan. Setelah diberikan: tidak dibatalkan, hanya dicicil, dilunasi, atau dihapus utangnya. | AI6, PRI-02, WAJ-11 |
| 20 | **Kasbon Khusus** untuk keadaan mendesak (misalnya kecelakaan, sakit, duka): hanya **dibuat pemilik** atas nama karyawan, wajib alasan dan jenis kejadian. Boleh melewati syarat 6 bulan, batas Rp250.000, dan Dana Kasbon; **tidak mengurangi Dana Kasbon** dan dihitung terpisah. Kali potong ditentukan pemilik dan **boleh lebih dari 3** (pengecualian aturan 6, WAJ-12). Tidak ada yang membuat Kasbon Khusus untuk dirinya sendiri: untuk GM dibuat Owner, dan sebaliknya. | P5, T, X |
| 21 | Selebihnya Kasbon Khusus mengikuti aturan kasbon biasa: uang diserahkan finance dengan sumber dana dan tanda sudah diberikan, dipotong lewat slip, tidak dihapus, terlihat karyawan. Di daftar Kasbon Berjalan tampil terpisah dengan tanda "Khusus". | X |
| 22 | **Pemberian bukan kasbon.** Bantuan yang tidak perlu dikembalikan tidak dicatat di buku Kasbon dan tidak dipotong dari gaji. Kalau uangnya dari kas kantor, dicatat sebagai pengeluaran bantuan di Keuangan (Bab 6). Bantuan campuran dicatat dua kali sesuai jenisnya. | X |
| 23 | **Orang yang berhenti**: seluruh sisa kasbon ditagih di slip terakhirnya, bulanan maupun mingguan; yang tidak tertutup menjadi piutang ke mantan karyawan. | AI12, GAJ-53 |
| 24 | **Orang yang berganti jenis slip** membawa kasbonnya; jadwal sisa cicilannya disusun ulang server mengikuti slip barunya, dan sisa utangnya pindah ke Dana Kasbon jenis slip barunya. | AI13 |
| 25 | Karyawan melihat kasbonnya **utuh** di portal: status, nominal diajukan dan disetujui, sudah diberikan atau belum, jadwal cicilan, yang sudah terpotong beserta slipnya, dan sisa. Angka batas dan sisa dana tidak ditampilkan. | AI9, P1 |
| 26 | Pemilik punya daftar **"Kasbon Berjalan"**: semua orang, sisa, cicilan berikutnya, cicilan yang ditunda atau terbawa, pengajuan yang menunggu, sisa tiap Dana Kasbon, dan Kasbon Khusus. Finance melihat pengajuan yang menunggu diperiksa dan kasbon yang menunggu diberikan. | AI11 |
| 27 | Batas per orang, besar tiap Dana Kasbon, paling banyak kali potong, syarat masa kerja, dan batas waktu proses disimpan sebagai **pengaturan bertanggal berlaku**; hanya pemilik yang mengubahnya. Tidak ada angka yang ditulis di kode. | V, WAJ-05, WAJ-07 |
| 28 | Kasbon **tidak dipotong dari upah bongkaran**. | 5B.10 aturan 12 |
| 29 | Hak (isi awal, dijaga server): mengajukan oleh karyawan sendiri dan HR atas nama; memeriksa dan menyerahkan uang oleh finance; menyetujui, menolak, membatalkan, menunda, menghapus utang, dan membuat Kasbon Khusus oleh pemilik. | P3, AI10 |

### Temuan dan aturan yang mengatasinya

| Temuan di sistem lama | Diatasi oleh |
|---|---|
| 1. Dua sistem kasbon, tiga tabel, pengalihan menurut nama departemen dan jabatan | Aturan 1, 4, 24 |
| 2. Plafon Rp0 untuk semua; "melebihi limit" hanya tulisan merah | Aturan 3, 4, 5, 27 |
| 3. Tidak ada yang mencicil; cicilan ditentukan pemilik, bukan dipilih | Aturan 6, 8, 12 |
| 4. Kasbon driver = uang diberikan dulu, dicatat saat gajian | Aturan 1, 8, 10, 11 (wajib disetujui dulu; yang mendesak lewat aturan 20) |
| 5. Dianggap cair begitu disahkan; 57 pencairan tanpa sumber dana | Aturan 10 |
| 6. Mengesahkan dua langkah lepas; bisa sah tanpa cicilan | Aturan 9, 12 |
| 7. Cicilan yang tidak terpotong di bulannya tidak ikut slip berikutnya | Aturan 12, 13 |
| 8. "Tandai Lunas" dan hapus tanpa jejak | Aturan 16, 17, 18, 19 |
| 9. Potongan kasbon diketik di slip tanpa catatan kasbon (Rp4,66 juta) | Aturan 13, 14 |
| 10. Pencairan tercatat dua kali karena kasbon dipindah dengan tangan | Aturan 1, 10, 24 (satu buku, cair sekali, pindah jenis slip diurus server) |
| 11. Karyawan bisa mengajukan atas nama orang lain; HR dan finance bisa memasukkan kasbon langsung aktif | Aturan 6, 8, 29 |
| 12. Tidak tercatat siapa yang mengisi pengajuan | Aturan 6 |
| 13. Rumus sisa kasbon ditulis di empat halaman; sisa disimpan sebagai angka | Aturan 14 |
| 14. Tidak ada jalan untuk berubah pikiran, batal, menunda, melunasi cepat, atau orang berhenti | Aturan 15, 16, 19, 23 |
| 15. Pengajuan tidak dijawab sampai 11 hari tanpa tanda | Aturan 7, 11 |
| 16. Driver dan kenek tidak melihat riwayat potongannya | Aturan 25 |
| 17. Kasbon kenek gagal dihapus tetapi layar berkata berhasil | Aturan 19 (tidak ada hapus); TAM-01 s.d. 06 |

Semua aturan uang di atas masuk daftar tes wajib (WAJ-06).

### Titipan dari 5C

- Untuk 5D: orang yang punya slip bulanan **dan** slip mingguan (4 orang)
  memakai Dana Kasbon yang mana dan dipotong dari slip yang mana.
- Untuk 5E: aturan 8 melapisi titipan GAJ bagian 7 butir 3 (karyawan memilih
  kali potong, tetapi finance mengusulkan dan pemilik memutuskan); kamus
  istilah sudah diisi (Dana Kasbon, Kasbon Khusus, Pemberian).
- Untuk Bab 6: bentuk catatan keuangan saat kasbon diberikan, dicicil,
  dilunasi tunai, dan dihapus utangnya; pengeluaran bantuan (pemberian);
  periksa 4 pencairan yang kemungkinan tercatat dua kali; piutang mantan
  karyawan.
- Untuk Tahap 3: pemberitahuan ke finance dan pemilik (PRI-25); tanggal
  bergabung sebenarnya dipastikan saat akun v3 dibuat (KAR-53).
- Untuk keputusan data lama: sisa kasbon yang masih berjalan dipindah sebagai
  saldo awal; Rp4.661.529 potongan kasbon di slip lama tanpa catatan kasbon
  tidak bisa ditelusuri.

---

# Bagian 5D: Jenis upah dan jadwal bayar

Ukuran: **sedang**. Bagian ini lebih banyak merancang daripada menggali.
Sumber: `../../work/backlog/2026-10-11-jenis-upah-dan-jadwal-bayar.md`, PRI-16,
PRI-19, PRI-22, buku Gaji (GAJ), dan titipan 5A, 5B, 5C.

## 5D.1 Bagian ini mengurus apa

Menyatukan cara kerja semua upah yang sudah diputuskan (gaji bulanan, ritase,
upah belanja, bongkaran) supaya orang yang menerima lebih dari satu jenis upah
bukan pengecualian, dan menjawab tiga hal yang masih terbuka: karyawan bulanan
yang jadi kenek, orang dengan dua slip, dan pekerjaan harian lain.

## 5D.2 Yang sudah diputuskan dan tidak ditanyakan lagi

| Jenis upah | Dihitung per | Dibayar lewat | Kapan | Aturan |
|---|---|---|---|---|
| Gaji tetap (komponen gaji) | bulan | slip bulanan | tanggal 1 | GAJ-01, 03, 41 |
| Lembur, kompensasi libur | jam, hari | slip bulanan | tanggal 1 | GAJ-12, 15 |
| Bonus (semua jenis) | per kejadian | slip bulanan | tanggal 1 | GAJ-24, 27 |
| Ritase driver dan kenek | trip | slip mingguan | Sabtu | 5A.10 aturan 6, 7 |
| Upah belanja | tugas belanja | slip mingguan | Sabtu | 5A.10 aturan 3 |
| Bongkaran | kg, dibagi rata | tunai, di luar slip | hari itu | 5B.10 aturan 11, 12 |

Juga sudah diputuskan: karyawan bulanan yang ikut bongkaran di jam kerjanya
tetap dapat (5B.10 aturan 8); Dana Kasbon mengikuti jenis slip (5C.10 aturan
4); kasbon tidak dipotong dari bongkaran (5C.10 aturan 28).

## 5D.3 Data di sistem lama (dicek ke database, 12 Oktober 2026; hanya jumlah baris)

- 4 orang punya slip bulanan dan juga upah kenek. Ritase mereka sebagai kenek:
  **140** (30 Mei s.d. 11 Oktober 2026), 126 di antaranya berupah (14 Rp0).
- **96 dari 140 ritase itu terjadi di hari orangnya absen masuk**; yang berupah
  dan di hari hadir: **86**. Jadi kebanyakan bukan "ikut saat hari libur".
- Hanya **7 orang-bulan** yang menerima slip bulanan dan upah ritase di bulan
  yang sama.
- Sistem lama tidak mengaitkan ritase dengan absen maupun slip bulanan sama
  sekali.

## 5D.7 Pertanyaan untuk pemilik (diajukan di percakapan, 12 Oktober 2026)

Butuh pandangan pemilik:

1. **Karyawan bergaji bulanan yang jadi kenek di hari kerjanya sendiri**:
   dibayar ritase juga atau tidak. Saran: dibayar ritase hanya kalau ikut di
   **hari liburnya**; di hari kerjanya tidak (gaji hari itu sudah dibayar).
   Ikut kenek di hari libur tidak memindah libur dan tidak memberi kompensasi
   libur (KEH-46, GAJ-15).
2. **Upah ritase orang bergaji bulanan dibayar lewat mana**: (a) slip mingguan
   hari Sabtu seperti kenek lain, atau (b) masuk slip bulanannya. Saran: (a).
3. **Pekerjaan berbayar lain** di luar daftar 5D.2, dan siapa yang dimaksud
   "karyawan harian". Saran: kalau tidak ada, daftar ditutup; jenis baru hanya
   ditambah pemilik.

Cukup setuju atau tidak: usulan AJ1–AJ8.

## 5D.8 Usulan untuk v3 (belum disetujui)

| No | Usulan |
|---|---|
| AJ1 | **Satu Buku Upah** (PRI-19): setiap upah, dari jenis apa pun, tercatat sebagai satu baris: siapa, jenis upah, tanggal kejadian, banyaknya, tarif yang berlaku, nominal, dan asalnya (trip, Laporan Bongkaran, lembur yang disahkan, dan seterusnya). Baris lahir dari modul asalnya; tidak ada baris upah yang diketik bebas. |
| AJ2 | **Daftar Jenis Upah** disimpan sebagai data. Tiap jenis punya: satuan, sumber tarif, siapa pencatatnya, dan **jalur bayarnya**. Jenis baru hanya ditambah pemilik, bertanggal berlaku. |
| AJ3 | **Jalur bayar hanya tiga**: slip bulanan (tanggal 1), slip mingguan (Sabtu), tunai hari itu (di luar slip). Jalur ditentukan perusahaan **per jenis upah**; karyawan tidak memilih, dan tidak ada pengaturan per orang. |
| AJ4 | Tiap orang punya **satu slip utama**, ditentukan pengaturan jabatannya (bulanan atau mingguan), bukan nama departemen. **Semua potongan** (denda, Potongan Lain, kasbon) hanya diambil dari slip utama, dan Dana Kasbon orang itu mengikuti slip utamanya. |
| AJ5 | Slip di luar slip utama (misalnya slip mingguan milik orang bergaji bulanan) hanya berisi upah dan **dibayar utuh tanpa potongan**. |
| AJ6 | Orang yang **berganti slip utama** (jabatan berubah) pindah di awal periode: slip lama terakhirnya dihitung sebagian (GAJ-06), kasbonnya ikut pindah (5C.10 aturan 24). |
| AJ7 | Karyawan punya halaman **"Pendapatan Saya"**: semua upahnya dari ketiga jalur dalam satu daftar per periode 26–25. Pemilik punya laporan **total diterima per orang** lintas jalur. |
| AJ8 | Satu halaman **Jadwal Bayar** untuk pemilik: yang jatuh bayar hari ini (slip bulanan, slip mingguan, bongkaran) dan yang sudah lewat, dalam satu daftar. |

## 5D.9 Jawaban pemilik (12 Oktober 2026)

| Pertanyaan | Jawaban |
|---|---|
| 1. Bulanan jadi kenek di hari kerjanya | "Kenek sepertinya tidak akan pernah jadi gaji bulanan (tapi tidak tutup kemungkinan akan dibayar bulanan, ini hanya beda cara bayar saja, sistemnya tetap ritase)." Artinya: kenek selalu diupah per ritase, tidak bergaji tetap. Belum menjawab kasus orang bergaji bulanan (staf toko, staf gudang bulanan) yang ikut jadi kenek; lihat butir Z di bawah |
| 2. Ritase orang bergaji bulanan dibayar lewat mana | Lewat ritase (slip mingguan), sesuai saran |
| 3. Pekerjaan berbayar lain; "karyawan harian" | "Harian" = pekerja lepas bongkaran. Tidak ada jenis upah lain; daftar 5D.2 lengkap |
| AJ1–AJ8 | Ok semua |

### Butir Z dan pertentangan AA (diajukan di percakapan, 12 Oktober 2026)

- **Z.** Orang bergaji bulanan yang ikut jadi kenek di hari kerjanya sendiri:
  dapat ritase atau tidak. Saran: hanya di hari liburnya.
- **AA.** "Kenek bisa saja dibayar bulanan" bertabrakan dengan AJ3 (jalur
  ditentukan per jenis upah, tidak per orang) dan 5A.10 aturan 6 (ritase
  dibayar Sabtu). Saran: jadwal bayar ritase tetap satu untuk semua orang,
  disimpan sebagai pengaturan bertanggal berlaku; kalau kelak diubah menjadi
  bulanan, berubah untuk semua, bukan per orang.

### Jawaban atas butir Z dan pertentangan AA (12 Oktober 2026)

| Butir | Jawaban |
|---|---|
| Z | Ok: ritase hanya kalau ikut di hari liburnya. Tambahan pemilik: orang itu **tetap dibayar kalau ikut bongkaran**, karena bongkaran biasanya setelah jam tutup toko (sejalan 5B.10 aturan 8, tidak ada yang berubah) |
| AA | Ok: jadwal bayar ritase satu untuk semua, sebagai pengaturan bertanggal berlaku |

## 5D.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 5E)

"Pemilik" di bawah berarti Owner atau GM (KAR-67).

| No | Aturan | Asal |
|---|---|---|
| 1 | **Satu Buku Upah** (PRI-19): setiap upah, dari jenis apa pun, tercatat sebagai satu baris: siapa, jenis upah, tanggal kejadian, banyaknya, tarif yang berlaku, nominal, dan asalnya (trip, Laporan Bongkaran, lembur yang disahkan, dan seterusnya). Baris lahir dari modul asalnya; **tidak ada baris upah yang diketik bebas**. | AJ1 |
| 2 | **Daftar Jenis Upah** disimpan sebagai data. Tiap jenis punya satuan, sumber tarif, pencatat, dan jalur bayar. Isi awal adalah tabel 5D.2 dan daftar itu **lengkap**: tidak ada pekerjaan berbayar lain. Jenis baru hanya ditambah pemilik, bertanggal berlaku. | AJ2, P3 |
| 3 | **Jalur bayar hanya tiga**: slip bulanan (tanggal 1), slip mingguan (Sabtu), tunai hari itu (di luar slip). Jalur ditentukan perusahaan **per jenis upah**. Karyawan tidak memilih, dan **tidak ada pengaturan per orang**. | AJ3 |
| 4 | **Jadwal bayar ritase satu untuk semua** driver dan kenek, disimpan sebagai pengaturan bertanggal berlaku (isi awal: mingguan, Sabtu). Kalau kelak diubah (misalnya menjadi bulanan), berubah untuk semua sejak tanggal berlakunya dan diumumkan dulu (PRI-29). Hitungannya tetap per ritase; yang berubah hanya hari bayarnya. | Pertentangan AA, WAJ-07 |
| 5 | **Kenek selalu diupah per ritase**; tidak ada kenek bergaji tetap. | P1 |
| 6 | "Karyawan harian" berarti **pekerja lepas bongkaran** (5B.10 aturan 9). Tidak ada jenis karyawan harian lain dan tidak ada slip harian. | P3 |
| 7 | Tiap orang punya **satu slip utama**, ditentukan pengaturan jabatannya (bulanan atau mingguan), bukan nama departemen. **Semua potongan** (denda, Potongan Lain, kasbon) hanya diambil dari slip utama, dan Dana Kasbon orang itu mengikuti slip utamanya. Menjawab titipan 5C. | AJ4, WAJ-05 |
| 8 | Slip di luar slip utama hanya berisi upah dan **dibayar utuh tanpa potongan**. | AJ5 |
| 9 | **Orang bergaji bulanan yang ikut jadi kenek mendapat upah ritase hanya kalau ikut di hari liburnya.** Di hari kerjanya ritasenya tetap tercatat dengan upah Rp0 dan keterangan "hari kerja, sudah dibayar gaji". Server memeriksanya sendiri dari jadwal libur; tidak ada yang mengetik. Ikut kenek di hari libur tidak memindah libur dan tidak memberi kompensasi libur (KEH-46, GAJ-15). Masuk daftar tes wajib. | Butir Z |
| 10 | Upah ritase orang bergaji bulanan dibayar lewat **slip mingguan**, sama seperti kenek lain, tanpa potongan (aturan 8). Ritase tidak pernah masuk slip bulanan. | P2 |
| 11 | **Bongkaran tidak terkena aturan 9**: siapa pun yang ikut tetap mendapat bagian, di hari kerja maupun libur, karena bongkaran biasanya setelah jam tutup toko (5B.10 aturan 8). | Butir Z |
| 12 | Orang yang **berganti slip utama** (jabatan berubah) pindah di awal periode: slip lama terakhirnya dihitung sebagian (GAJ-06) dan kasbonnya ikut pindah (5C.10 aturan 24). | AJ6 |
| 13 | Karyawan punya halaman **"Pendapatan Saya"**: semua upahnya dari ketiga jalur dalam satu daftar per periode 26–25. Pemilik punya laporan **total diterima per orang** lintas jalur. Hak lihat mengikuti GAJ-46. | AJ7 |
| 14 | Satu halaman **Jadwal Bayar** untuk pemilik: yang jatuh bayar hari ini dan yang sudah lewat, untuk semua jalur, dalam satu daftar. | AJ8 |

### Temuan dan aturan yang mengatasinya

| Temuan di sistem lama | Diatasi oleh |
|---|---|
| 1. Orang bergaji bulanan menerima ritase di hari ia absen masuk (86 ritase berupah) tanpa aturan | Aturan 9 |
| 2. Ritase tidak dikaitkan dengan absen maupun slip bulanan | Aturan 1, 9, 13 |
| 3. Orang dengan dua jenis bayaran punya kasbon di dua sistem | Aturan 7, 8 |
| 4. Jenis penggajian "terlalu banyak dan membingungkan" | Aturan 2, 3, 13, 14 |

### Titipan dari 5D

- Untuk 5E: aturan 9 melapisi 5A.10 aturan 2 (ritase Rp0 punya dua sebab: rute
  tanpa upah kenek, dan hari kerja orang bergaji bulanan); isi awal slip utama
  per jabatan; kamus istilah (Buku Upah, jenis upah, jalur bayar, slip utama).
- Untuk Tahap 3: Buku Upah dan Buku Bonus (GAJ-24) dirancang bersama; pemilik
  data "slip utama" adalah pengaturan jabatan (KAR-62).
- Untuk keputusan data lama: 4 orang yang punya slip bulanan dan ritase
  ditentukan slip utamanya saat akun v3 dibuat.

**5D SELESAI** (12 Oktober 2026). Tidak ada pertanyaan 5D yang menunggu.

---

# Bagian 5E: Penetapan

Dimulai 12 Oktober 2026. Ukuran **sedang** (ke-84 aturan sudah diputuskan di 5A
s.d. 5D; pekerjaannya menyatukan, mencocokkan, dan memberi nomor). Hasilnya
`../05-gaji-driver-kasbon.md`.

## 5E.1 Pertentangan dan hal yang belum diatur (diajukan di percakapan, 12 Oktober 2026)

Ke-84 aturan dari 5A.10, 5B.10, 5C.10, dan 5D.10 dicocokkan satu sama lain dan
dengan KAR, KEH, GAJ, LOG, dan PRI. Tidak ditemukan dua keputusan yang saling
membatalkan. Yang ditemukan: delapan hal yang belum diatur atau baru terlihat
saat aturan dari bagian yang berbeda dipertemukan.

Butuh pandangan pemilik:

1. **Hari apa yang dihitung "hari libur"** bagi orang bergaji bulanan yang ikut
   trip (5D.10 aturan 9). Aturan itu hanya menyebut "hari liburnya". Belum
   jelas untuk hari ia izin, sakit, cuti tahunan, atau hari tutup cabangnya.
   Saran: dibayar ritase hanya di **libur terjadwal** (KEH-31) dan **hari
   tutup** cabangnya (KEH-79). Di hari izin, sakit, cuti, atau alpha ritasenya
   Rp0 dan ditandai untuk HR dan pemilik.

Cukup ok atau tidak:

2. 5D.10 aturan 9 hanya menyebut kenek. Saran: berlaku sama kalau orang
   bergaji bulanan itu **menyetir** (punya izin "boleh menyetir", KAR-05), dan
   untuk **upah belanja**.
3. **Jadwal slip mingguan** belum punya hari tutup. Saran: minggu berakhir
   Kamis, ditutup Jumat, dibayar Sabtu; keberatan setelah ditutup 3 hari dan
   koreksinya di slip berikutnya; ritase yang baru tercatat setelah slip
   ditutup masuk slip minggu berikutnya; hal lain (buka kembali, batal bayar,
   jejak, nomor) mengikuti aturan slip bulanan (GAJ-47 s.d. 51).
4. **Potongan Lain** (GAJ-21) untuk orang berslip utama mingguan: diambil dari
   slip mingguan, urutannya denda, Potongan Lain, kasbon; satu kali potong =
   satu slip mingguan.
5. **Pekerja lepas baru** (5B.10 aturan 9 menaruhnya di data Karyawan, padahal
   pendaftaran orang disetujui HR, KAR-60): Kepala Gudang boleh menambahkannya
   langsung saat membuat Laporan Bongkaran, cukup nama dan HP; HR dan pemilik
   melihat daftarnya. Pekerja lepas tidak bisa kasbon karena tidak punya slip.
6. **Laporan Bongkaran yang dikoreksi setelah dibayar** (5B.10 aturan 14 hanya
   menyebut "selisih diperhitungkan di pembayaran berikutnya"): kurang bayar
   disusulkan tunai oleh finance; lebih bayar diperhitungkan di bongkaran
   berikutnya orang itu; yang belum tertagih 30 hari ditandai untuk pemilik
   (ditagih tunai atau dihapus dengan alasan). Ini bukan potongan kasbon atau
   denda, jadi tidak melanggar 5B.10 aturan 12.
7. **Menyerahkan uang kasbon** (5C.10 aturan 10 hanya menyebut finance):
   pemilik juga boleh, supaya Kasbon Khusus yang mendesak tidak menunggu
   finance. Sama dengan bongkaran (5B.10 aturan 11).
8. **Pindah slip utama** (5D.10 aturan 12 menyebut "awal periode" tanpa
   menyebut periode yang mana): di tanggal 26. Sisa kasbonnya pindah ke Dana
   Kasbon slip barunya walaupun dana itu sedang penuh; yang tertahan hanya
   pengajuan baru.

## 5E.2 Jawaban pemilik (12 Oktober 2026)

| No | Jawaban |
|---|---|
| 1 | "Jika libur." Dibaca Claude: ritase dibayar hanya kalau orangnya sedang libur, sesuai saran (libur terjadwal dan hari tutup cabangnya); izin, sakit, cuti, alpha Rp0 dan ditandai. Menjadi DRV-16 |
| 2 | "Ya berlaku": sama untuk menyetir dan upah belanja (DRV-16) |
| 3 | "Buka tutup harinya sudah ada." Dibaca Claude: minggu upah yang dibuka Jumat dan ditutup Kamis sudah diputuskan (5A) dan tidak berubah; slip dikunci begitu minggu itu berakhir (Jumat) dan dibayar Sabtu. Bagian lain saran (keberatan 3 hari, ritase susulan, ikut aturan slip bulanan) tidak ditolak dan dicatat di DRV-22 |
| 4–8 | Ok |

Kedua bacaan (butir 1 dan 3) disampaikan ke pemilik di percakapan saat
menutup 5E; kalau keliru, DRV-16 atau DRV-22 diubah.

Dicatat tanpa ditanyakan, karena hanya melengkapi atau merapikan kalimat:

- Rumus upah per ritase (DRV-A08: tarif "dengan kenek" kalau trip berkenek)
  dibawa apa adanya menjadi DRV-09; 5A.10 tidak menuliskannya.
- 5A.10 aturan 3 ("kenek tidak dibayar untuk belanja") ditulis sebagai isi
  tarif, bukan aturan keras, supaya sejalan dengan aturan 2 (upah kenek Rp0
  hidup di tarif, WAJ-05). Menjadi DRV-11.
- 5A.10 aturan 4 ("rencana kirim ditolak kalau belum bertarif") diselaraskan
  dengan LOG-21 yang sudah ditetapkan: yang ditolak adalah menjadi Siap Kirim.
- "Jenis slip" di 5C.10 aturan 4 dan 24 dibaca sebagai **slip utama** (5D.10
  aturan 7).
- Denda orang yang slip utamanya bulanan diambil dari slip bulanannya (akibat
  5D.10 aturan 7 dan 8). Menjadi DRV-30.
- Bagian tiap peserta bongkaran terlihat finance dan Kepala Gudang (jawaban
  5B.9 butir 8); dicatat sebagai pengecualian atas PRI-24, khusus bongkaran.
- Buku Upah tetap milik modul Gaji (peta modul, PRI-19); modul ini mencatat
  ke dalamnya, sama seperti Logistik mencatat ke Buku Bonus.
- Isi awal slip utama: jabatan driver dan kenek mingguan, lainnya bulanan
  (titipan 5D). Siapa berjabatan apa ditentukan saat akun v3 dibuat.

## 5E.3 Asal aturan

| Nomor v3 | Asal |
|---|---|
| DRV-01 | 5D.10 aturan 1 |
| DRV-02 | 5D.10 aturan 2, 6; tabel 5D.2 |
| DRV-03 | 5D.10 aturan 3 |
| DRV-04 | 5D.10 aturan 7; titipan 5D |
| DRV-05 | 5D.10 aturan 8 |
| DRV-06 | 5D.10 aturan 12; 5E.1 butir 8 |
| DRV-07 | 5D.10 aturan 5 |
| DRV-08 | 5A.10 aturan 1; DRV-A01 |
| DRV-09 | DRV-A08; LOG-35 |
| DRV-10 | 5A.10 aturan 2 |
| DRV-11 | 5A.10 aturan 3; DRV-A07 |
| DRV-12 | 5A.10 aturan 4; LOG-21 |
| DRV-13 | 5A.10 aturan 5 |
| DRV-14 | LOG-33 s.d. 36; DRV-A12 diganti |
| DRV-15 | 5A.10 aturan 14 |
| DRV-16 | 5D.10 aturan 9, 10; 5E.1 butir 1, 2 |
| DRV-17 | 5A.10 aturan 2; titipan 5D; DRV-A10 diganti |
| DRV-18 | 5A.10 aturan 17 (pertentangan H) |
| DRV-19 | 5A.10 aturan 6; 5D.10 aturan 4 |
| DRV-20 | 5A.10 aturan 7; 5D.10 aturan 10 |
| DRV-21 | 5A.10 aturan 8 |
| DRV-22 | 5E.1 butir 3 |
| DRV-23 | 5A.10 aturan 11; 5E.1 butir 4 |
| DRV-24 | 5A.10 aturan 12; 5E.1 butir 4 |
| DRV-25 | 5A.10 aturan 9 |
| DRV-26 | 5A.10 aturan 13 |
| DRV-27 | 5A.10 aturan 16 |
| DRV-28 | 5A.10 aturan 15 |
| DRV-29 | 5A.10 aturan 10 |
| DRV-30 | 5A.10 aturan 10; 5D.10 aturan 7 |
| DRV-31 | 5B.10 aturan 1 |
| DRV-32 | 5B.10 aturan 2 |
| DRV-33 | 5B.10 aturan 3 |
| DRV-34 | 5B.10 aturan 4 |
| DRV-35 | 5B.10 aturan 5 |
| DRV-36 | 5B.10 aturan 10 |
| DRV-37 | 5B.10 aturan 17 |
| DRV-38 | 5B.10 aturan 21 |
| DRV-39 | 5B.10 aturan 22 |
| DRV-40 | 5B.10 aturan 23 |
| DRV-41 | 5B.10 aturan 24 |
| DRV-42 | 5B.10 aturan 6 |
| DRV-43 | 5B.10 aturan 7 |
| DRV-44 | 5B.10 aturan 8; 5D.10 aturan 11 |
| DRV-45 | 5B.10 aturan 9; 5E.1 butir 5 |
| DRV-46 | 5B.10 aturan 13 |
| DRV-47 | 5B.10 aturan 11 (pertentangan I) |
| DRV-48 | 5B.10 aturan 12; 5C.10 aturan 28 |
| DRV-49 | 5B.10 aturan 14; 5E.1 butir 6 |
| DRV-50 | 5B.10 aturan 15 |
| DRV-51 | 5B.10 aturan 16 |
| DRV-52 | 5B.10 aturan 18 |
| DRV-53 | 5B.10 aturan 19 |
| DRV-54 | 5C.10 aturan 1 |
| DRV-55 | 5C.10 aturan 2 |
| DRV-56 | 5C.10 aturan 3 |
| DRV-57 | 5C.10 aturan 4; 5D.10 aturan 7 |
| DRV-58 | 5C.10 aturan 5 |
| DRV-59 | 5C.10 aturan 6 |
| DRV-60 | 5C.10 aturan 7 |
| DRV-61 | 5C.10 aturan 8 (pertentangan P) |
| DRV-62 | 5C.10 aturan 9 |
| DRV-63 | 5C.10 aturan 10; 5E.1 butir 7 |
| DRV-64 | 5C.10 aturan 11 |
| DRV-65 | 5C.10 aturan 12 |
| DRV-66 | 5C.10 aturan 13; 5A.10 aturan 11 |
| DRV-67 | 5C.10 aturan 14 |
| DRV-68 | 5C.10 aturan 15 |
| DRV-69 | 5C.10 aturan 16 |
| DRV-70 | 5C.10 aturan 17 |
| DRV-71 | 5C.10 aturan 18 |
| DRV-72 | 5C.10 aturan 19 |
| DRV-73 | 5C.10 aturan 23 |
| DRV-74 | 5C.10 aturan 24; 5E.1 butir 8 |
| DRV-75 | 5C.10 aturan 20 |
| DRV-76 | 5C.10 aturan 21 |
| DRV-77 | 5C.10 aturan 22 |
| DRV-78 | 5C.10 aturan 25 |
| DRV-79 | 5C.10 aturan 26 |
| DRV-80 | 5D.10 aturan 13 |
| DRV-81 | 5D.10 aturan 14 |
| DRV-82 | 5A.10 aturan 5, 9, 10; 5B.10 aturan 20; 5C.10 aturan 29; 5E.1 butir 5, 7 |
| DRV-83 | 5A.10 aturan 14; 5B.10 aturan 14; 5C.10 aturan 19; PRI-02, WAJ-04, WAJ-06 |
| DRV-84 | angka dari aturan di atas; 5C.10 aturan 27 |

Semua butir 5A.10 (1-17), 5B.10 (1-24), 5C.10 (1-29), dan 5D.10 (1-14) punya
nomor v3.
