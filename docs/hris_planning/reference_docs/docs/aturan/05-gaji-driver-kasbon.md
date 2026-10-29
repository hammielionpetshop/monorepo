# Buku Aturan: Gaji Driver, Bongkaran, dan Kasbon

Status: **ditetapkan 12 Oktober 2026** (perincian 4G-1 dan 4G-2 disetujui 14 Oktober 2026; perincian 4G-3a disetujui 14 Oktober 2026; perincian 4G-3b disetujui 14 Oktober 2026; perincian 4G-4a disetujui 14 Oktober 2026; perincian 4G-4b disetujui 14 Oktober 2026), kecuali yang tercantum di bagian 6
("Masih terbuka").

Nomor aturan tidak diurutkan ulang, supaya rujukan dari dokumen lain tetap benar.

File ini hanya berisi aturan yang berlaku di v3. Hasil galian sistem lama, hasil
cek database, semua pertanyaan, dan jawaban pemilik disimpan di
`arsip/05-gaji-driver-kasbon-galian.md` (bagian 5A s.d. 5E). Nomor DRV-A, DRV-B,
dan DRV-C di arsip itu adalah nomor galian sistem lama, bukan nomor aturan v3.
Asal tiap aturan di bawah tercatat di bagian 5E arsip itu.

Kapan sebuah ritase atau upah belanja tercatat diatur di buku Logistik
(LOG-33 s.d. 36). Buku ini mengatur **berapa** nilainya dan **bagaimana**
dibayar.

Di buku ini, "pemilik" dalam urusan hak akses berarti jabatan Pemilik (Owner)
dan **GM**, yang haknya setara (KAR-67).

## 1. Modul ini mengurus apa

Semua upah yang bukan gaji bulanan, dan pinjaman karyawan. Isinya:

- **Gaji Driver**: tarif ritase dan upah belanja, slip mingguan driver dan
  kenek, denda mereka, dan pembayarannya tiap Sabtu. Aturan slip mingguan
  ada di buku ini; slipnya sendiri disimpan mesin slip milik Gaji, bersama
  slip bulanan (keputusan 3A, 13 Oktober 2026)
- **Bongkaran**: Laporan Bongkaran, upah per kg yang dibagi rata, dan
  pembayaran tunai hari itu
- **Kasbon**: pengajuan, pengesahan, penyerahan uang, cicilan lewat slip,
  Dana Kasbon, dan Kasbon Khusus
- **Jenis upah dan jalur bayar**: satu cara kerja untuk semua upah, supaya
  orang yang menerima lebih dari satu jenis upah bukan pengecualian

Modul ini membaca ritase dari Logistik dan jadwal libur dari Kehadiran, dan
tidak mengubahnya.

## 2. Data yang dimiliki modul ini

| Data | Isinya |
|---|---|
| Daftar Jenis Upah | Tiap jenis: satuan, sumber tarif, pencatat, jalur bayar; bertanggal berlaku |
| Tarif ritase dan upah belanja | Per pasangan mobil dan rute: upah driver dengan kenek, upah driver tanpa kenek, upah kenek; bertanggal berlaku |
| Jenis denda dan denda driver/kenek | Daftar jenis bernominal; tiap denda: siapa, jenis, tanggal, pengaju, pengesah |
| Laporan Bongkaran | Tanggal kerja, supplier, barang (produk, satuan, jumlah, berat yang dipakai), peserta, bagian tiap peserta, foto surat jalan, pembayaran |
| Berat per satuan produk | Per produk per satuan, beserta riwayat perubahannya |
| Tarif bongkaran | Rupiah per kg, bertanggal berlaku |
| Kasbon | Pengajuan (siapa mengisi, untuk siapa, nominal, kali potong, alasan), usulan finance, keputusan pemilik, penyerahan uang, jadwal cicilan, cicilan terpotong, penundaan, pelunasan tunai, penghapusan utang, tanda Khusus |
| Pengaturan kasbon | Batas per orang, besar dua Dana Kasbon, paling banyak kali potong, syarat masa kerja, batas waktu proses; bertanggal berlaku |

Yang **bukan** milik modul ini:

| Data | Milik modul |
|---|---|
| Ritase dan upah belanja (kapan tercatat, untuk siapa), mobil, rute | Logistik (LOG-17, LOG-33 s.d. 36) |
| Orang, jabatan, pengaturan jabatan (termasuk slip utama), status kerja Freelance, tanggal bergabung, izin tugas lapangan | Karyawan (KAR-05, KAR-61, KAR-62) |
| Jadwal libur dan hari tutup | Kehadiran (KEH-31, KEH-79) |
| Buku Upah, slip bulanan, **slip mingguan dan pembayarannya** (satu mesin slip; aturan khasnya tetap DRV-20 s.d. 23), minggu upah, Potongan Lain, Buku Bonus, Dana Disiplin | Gaji (PRI-19, GAJ-21, GAJ-24, GAJ-33). Slip mingguan **dipindah** dari buku ini ke Gaji (keputusan 3A, 13 Oktober 2026; jenis: pengganti atas baris bagian 2 lama) |
| Jalur pengajuan kasbon dan denda (status, penyetuju, lampiran) | Perlengkapan Bersama (PRI-23); isi kasbon dan denda tetap milik buku ini |
| Daftar produk (kode, nama, satuan) dan purchase order | Sistem kasir, dibaca lewat Tarik Data Kasir |
| Daftar supplier | Keuangan (KEU-57) |
| Catatan keuangan (Buku Kas, tempat uang sumber), pengeluaran bantuan, Piutang Lain | Keuangan (KEU-24, 25, 74) |

## 3. Aturan

### 3.1 Jenis upah, jalur bayar, dan slip utama

| No | Aturan |
|---|---|
| DRV-01 | **Satu Buku Upah** (PRI-19): setiap upah, dari jenis apa pun, tercatat sebagai satu baris: siapa, jenis upah, tanggal kejadian, banyaknya, tarif yang berlaku, nominal, dan asalnya (trip, Laporan Bongkaran, lembur yang disahkan, dan seterusnya). Baris lahir dari modul asalnya; **tidak ada baris upah yang diketik bebas**. |
| DRV-02 | **Daftar Jenis Upah** disimpan sebagai data. Tiap jenis punya satuan, sumber tarif, pencatat, dan jalur bayar. Isi awalnya tabel di bawah, dan daftar itu **lengkap**: tidak ada pekerjaan berbayar lain. Jenis baru hanya ditambah pemilik, bertanggal berlaku. "Karyawan harian" berarti pekerja lepas bongkaran (DRV-45); tidak ada jenis karyawan harian lain dan tidak ada slip harian. *(Diganti sebagian DRV-86, 14 Oktober 2026; disetujui 14 Oktober 2026: jenis baru lewat pembangunan sistem, bukan tombol.)* |
| DRV-03 | **Jalur bayar hanya tiga:** slip bulanan (tanggal 1), slip mingguan (Sabtu), dan tunai hari itu (di luar slip). Jalur ditentukan perusahaan **per jenis upah**. Karyawan tidak memilih, dan **tidak ada pengaturan per orang**. *(Dilapisi GAJ-86, 13 Oktober 2026: bonus masuk slip utama orang itu, termasuk slip mingguan.)* |
| DRV-04 | Tiap orang punya **satu slip utama**, bulanan atau mingguan, ditentukan **pengaturan jabatannya** (KAR-62), bukan nama departemen. **Semua potongan** (denda, Potongan Lain, kasbon) hanya diambil dari slip utama, dan Dana Kasbon orang itu mengikuti slip utamanya. Isi awal: jabatan driver dan jabatan kenek mingguan; jabatan lain bulanan. |
| DRV-05 | Slip di luar slip utama (misalnya slip mingguan milik orang bergaji bulanan yang ikut jadi kenek) hanya berisi upah dan **dibayar utuh tanpa potongan**. |
| DRV-06 | Orang yang **berganti slip utama** karena jabatannya berubah pindah di **awal periode gaji (tanggal 26)**, sama dengan perubahan gaji (GAJ-04). Slip lamanya yang terakhir dihitung sampai tanggal 25 (GAJ-06), dan kasbonnya ikut pindah (DRV-74). |
| DRV-07 | **Kenek selalu diupah per ritase**; tidak ada kenek bergaji tetap. |
| DRV-84 | **Kapan baris Buku Upah lahir** (Tahap 3D, 13 Oktober 2026; jenis: pelapis atas DRV-01): upah dari kejadian lahir saat kejadiannya sah (ritase saat trip ditutup, bongkaran saat Laporan Bongkaran disahkan, lembur saat klaim disahkan, bonus saat baris Buku Bonus disahkan); **gaji tetap lahir saat slip ditutup**, satu baris per komponen, dan sebelum itu hanya tampil di Perkiraan. Buku Upah hanya berisi upah; potongan tetap di menunya masing-masing dan bertemu upah di slip (GAJ-38). Tiap baris masuk periode menurut tanggal kejadiannya (PRI-34). *(Untuk bongkaran diperinci DRV-101, 14 Oktober 2026; disetujui 14 Oktober 2026: "disahkan" berarti tersimpan dan Berlaku.)* |

Isi awal Daftar Jenis Upah (DRV-02):

| Jenis upah | Dihitung per | Jalur bayar | Aturan |
|---|---|---|---|
| Gaji tetap (komponen gaji) | bulan | slip bulanan, tanggal 1 | GAJ-01, 03, 41 |
| Lembur, kompensasi libur | jam, hari | slip bulanan, tanggal 1 | GAJ-12, 15 |
| Bonus (semua jenis) | kejadian | slip utama orang itu (bulanan atau mingguan; GAJ-86) | GAJ-24, 27, 86 |
| Ritase driver dan kenek | trip | slip mingguan, Sabtu | DRV-08 s.d. 28 |
| Upah belanja | tugas belanja | slip mingguan, Sabtu | DRV-11 |
| Bongkaran | kg, dibagi rata | tunai hari itu, di luar slip | DRV-31 s.d. 53 |

### 3.2 Tarif ritase dan upah belanja

| No | Aturan |
|---|---|
| DRV-08 | Tarif ditentukan per **pasangan mobil dan rute**, berisi tiga angka: upah driver dengan kenek, upah driver tanpa kenek, dan upah kenek. Tarif **bertanggal berlaku**: kenaikan ditambah sebagai baris baru dengan tanggal mulainya, dan tarif lama tetap tersimpan. 23 tarif yang berjalan di sistem lama dibawa sebagai tarif awal. *(Diperinci DRV-89 dan 90, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-09 | Upah driver untuk satu ritase = tarif "dengan kenek" kalau trip-nya berkenek, selain itu tarif "tanpa kenek". Upah kenek = tarif kenek. Tarif yang dipakai adalah yang berlaku pada **tanggal trip** (tanggal berangkat, LOG-35). Nominalnya tersimpan di baris upahnya; tarif yang berubah belakangan tidak mengubah ritase yang sudah tercatat. *(Diperinci DRV-87, 14 Oktober 2026; disetujui 14 Oktober 2026; pembetulan salah ketik DRV-90.)* |
| DRV-10 | **Upah kenek Rp0 adalah isi tarif yang sah**, bukan kesalahan. Saat ini berlaku untuk rute Singaparna dan semua rute belanja. Aturannya hidup di tarif; tidak ada nama rute di kode (WAJ-05). |
| DRV-11 | **Upah belanja** = tarif rute berjenis belanja (LOG-17, LOG-34), dibayar di atas ritase trip-nya. Pada tarif yang berjalan, upah kenek di semua rute belanja Rp0, jadi upah belanja hanya diterima driver. |
| DRV-12 | Tarif tidak dihapus. Mobil dan rute milik Logistik dan hanya dinonaktifkan (LOG-18). Rencana kirim tidak bisa menjadi Siap Kirim kalau pasangan mobil dan rutenya belum bertarif pada tanggal itu (LOG-21). *(Diperinci DRV-92, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-13 | Tarif hanya diubah **pemilik**. Kepala Gudang boleh melihat tarif. |

### 3.3 Ritase sebagai dasar upah

| No | Aturan |
|---|---|
| DRV-14 | Modul ini **tidak mencatat ritase**. Ritase dan upah belanja dicatat server di Logistik, sekali per trip atau tugas (LOG-33 s.d. 35); ritase tangan hanya oleh pemilik (LOG-36). Modul ini memberi nominalnya dan memasukkannya ke slip. |
| DRV-15 | **Ritase tidak dihapus.** Hanya pemilik yang membatalkan, wajib alasan. Ritase yang slipnya sudah ditutup dikoreksi dengan baris baru di slip minggu berikutnya. *(Diperinci DRV-88, 14 Oktober 2026; disetujui 14 Oktober 2026: koreksi minus dipotong di slip utama.)* |
| DRV-16 | **Orang bergaji bulanan yang ikut trip mendapat upah ritase hanya kalau ikut di hari liburnya**, yaitu libur terjadwal (KEH-31) atau hari tutup cabangnya (KEH-79). Berlaku sama baik ia ikut sebagai kenek maupun menyetir, dan untuk upah belanja. Di hari kerjanya ritasenya tetap tercatat dengan upah Rp0 dan keterangan "hari kerja, sudah dibayar gaji". Di hari ia izin, sakit, cuti, atau alpha ritasenya juga Rp0, dengan keterangan "bukan hari libur", dan ditandai untuk HR dan pemilik. Server memeriksanya sendiri dari jadwal libur; tidak ada yang mengetik. Ikut trip di hari libur tidak memindah libur dan tidak memberi kompensasi libur (KEH-46, GAJ-15). Upahnya dibayar lewat slip mingguan, sama seperti kenek lain; **ritase tidak pernah masuk slip bulanan**. *(Diperinci DRV-87, 88, 91, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-17 | Ritase berupah **Rp0 tetap tampil** di slip sebagai baris Rp0 dengan keterangan sebabnya. Sebabnya: "rute tanpa upah kenek" (DRV-10), atau orang bergaji bulanan yang ikut bukan di hari liburnya (DRV-16). |
| DRV-18 | **Hari tidak bisa jalan tidak dicatat di sistem.** Driver atau kenek lapor ke Kepala Gudang, lalu tidak dipilih di rencana (LOG-15). Tidak ada batas waktu dan tidak ada akibat ke upah, karena upah dihitung per ritase. |

### 3.4 Slip mingguan

| No | Aturan |
|---|---|
| DRV-19 | **Minggu upah Jumat sampai Kamis**, dihitung di satu tempat di server (PRI-22). **Hari bayar Sabtu.** Jadwal bayar ritase **satu untuk semua** driver dan kenek, disimpan sebagai pengaturan bertanggal berlaku. Kalau kelak diubah (misalnya menjadi bulanan), berubah untuk semua sejak tanggal berlakunya dan diumumkan dulu (PRI-29). Hitungannya tetap per ritase; yang berubah hanya hari bayarnya. |
| DRV-20 | Ada **slip mingguan yang disimpan**, satu per orang per minggu upah, bertahap Perkiraan → Ditutup → Dibayar. Isinya semua ritase orang itu di minggu itu, sebagai driver maupun kenek, dan upah belanjanya. Rinciannya tersimpan baris demi baris dan tidak dihitung ulang saat dibuka (GAJ-39). |
| DRV-21 | Driver dan kenek memakai **satu cara kerja**: satu jenis slip, satu tempat denda, satu tempat potongan. |
| DRV-22 | **Jadwal slip mingguan:** minggu upah dibuka Jumat dan berakhir Kamis (DRV-19); slipnya dikunci begitu minggu itu berakhir, yaitu **Jumat**, dan dibayar **Sabtu** *(diperinci DRV-93 s.d. 97, 14 Oktober 2026; disetujui 14 Oktober 2026)*. Keberatan sebelum ditutup dibetulkan di sumbernya; setelah ditutup, keberatan diterima 3 hari dan koreksinya masuk slip minggu berikutnya (GAJ-42). Ritase yang baru tercatat setelah slip minggunya ditutup masuk slip minggu berikutnya dengan keterangan tanggal asalnya. Untuk hal yang tidak disebut khusus di buku ini, slip mingguan mengikuti aturan slip bulanan: menutup dan membayar masing-masing satu langkah di server, buka kembali sebelum dibayar, batal bayar dengan alasan, jejak siapa dan kapan, bernomor, tidak pernah dihapus (GAJ-47 s.d. 51). |
| DRV-23 | **Tidak ada potongan yang diketik di slip mingguan.** Slip membaca denda yang sudah disahkan (DRV-29), cicilan Potongan Lain (GAJ-21), dan cicilan kasbon yang jatuh tempo (DRV-66) dari menunya masing-masing. Untuk orang berslip utama mingguan, satu kali potong berarti satu slip mingguan. |
| DRV-24 | **Upah bersih tidak pernah minus, dan kelebihan potongan tidak hangus** (GAJ-52). Urutan pengambilan: denda, lalu Potongan Lain, lalu kasbon. Yang tidak tertampung dibawa ke slip minggu berikutnya sebagai "sisa potongan". Pembayaran tidak pernah ditolak karena potongan lebih besar. |
| DRV-25 | Slip mingguan **ditutup HR atau pemilik** dan **dibayar pemilik saja** (GAJ-45). HR dan pemilik melihat slip per orang; finance hanya melihat total per minggu (GAJ-46). |
| DRV-26 | **Membayar adalah satu langkah utuh di server:** tanggal bayar dari server, pembayar, sumber dana, dan **satu** catatan keuangan tersimpan bersama (GAJ-48). Satu slip dibayar sekali dan penuh. Slip yang bersihnya Rp0 tetap ditutup, dan potongannya tetap terkunci. *(Dilapisi GAJ-99, 13 Oktober 2026: tanggal uang boleh mundur sampai 7 hari; jam catat dari server.)* |
| DRV-27 | Slip mingguan yang belum dibayar lewat dari hari bayarnya **ditandai** untuk pemilik. *(Diperinci GAJ-104, 13 Oktober 2026: pengingat berantai.)* |
| DRV-28 | Driver dan kenek melihat **slip mingguannya utuh** di portal: ritase, upah belanja, denda, potongan, sisa potongan, dan jumlah bersih yang sama dengan uang diterima. Sebelum ditutup tampil sebagai "perkiraan". |

### 3.5 Denda driver dan kenek

| No | Aturan |
|---|---|
| DRV-29 | Denda driver dan kenek diambil dari **daftar jenis denda** yang bernominal dan bertanggal berlaku; tidak ada denda bernominal bebas. Jenis pertama: **tidak taat administrasi**. Diajukan Kepala Gudang atau pemilik, **disahkan pemilik**. Nominal tiap jenis diisi pemilik di pengaturan. *(Diperinci DRV-98 s.d. 100, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-30 | Denda yang benar-benar terpotong masuk **Dana Disiplin** saat slipnya ditutup (GAJ-33). Denda orang yang slip utamanya bulanan diambil dari slip bulanannya (DRV-04), bukan dari slip mingguannya. |

### 3.6 Bongkaran: Laporan Bongkaran

| No | Aturan |
|---|---|
| DRV-31 | Setiap bongkaran dicatat sebagai **Laporan Bongkaran** oleh **Kepala Gudang**: tanggal kerja, supplier, daftar barang (produk, satuan, jumlah, berat per satuan), peserta, dan foto surat jalan supplier. Menyimpannya **satu langkah utuh di server**: laporan, barang, peserta, dan pembagian tersimpan bersama atau tidak sama sekali. *(Diperinci DRV-101 s.d. 103, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-32 | Barang **dipilih dengan mencari** di daftar produk kasir (ketik nama, barangnya muncul). **Berat per satuan** (per sak, per dus, menurut satuannya) disimpan per produk per satuan saat pertama kali diisi, dan terisi otomatis pada bongkaran berikutnya. *(Diperinci DRV-105, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-33 | Berat per satuan boleh **diubah Kepala Gudang**. Perubahan tercatat (siapa, kapan, dari berapa ke berapa) dan hanya berlaku untuk laporan berikutnya; tiap laporan menyimpan salinan berat yang dipakainya, sehingga laporan lama tidak ikut berubah. *(Diperinci DRV-105, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-34 | **"Barang lain" adalah jalan terakhir, bukan jalan pintas.** Pilihannya baru muncul setelah pencarian tidak menemukan apa pun; wajib nama barang, kg, dan alasan. Baris ini **ditandai**, dan pemilik melihat daftar serta jumlahnya (berapa laporan, berapa kg, oleh siapa). Pemilik bisa memasangkannya ke produk yang benar belakangan. *(Diperinci DRV-109, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-35 | **Total kg dihitung mesin, tidak diketik:** jumlah tiap barang × berat per satuannya, dijumlahkan. Total upah = total kg × tarif, dibulatkan ke rupiah terdekat (PRI-28). Rumusnya ada di **satu tempat di server** (WAJ-04). *(Diperinci DRV-108, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-36 | **Tanggal kerja** bawaannya hari ini menurut server. Boleh mundur paling lama **3 hari**; lebih dari itu hanya pemilik, dengan alasan. Tidak boleh tanggal yang akan datang. *(Diperinci DRV-104, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-37 | Laporan kedua di tanggal yang sama dengan supplier dan total kg yang sama meminta **konfirmasi** sebelum disimpan. |
| DRV-38 | **Daftar produk** (kode, nama, satuan) masuk ke HRIS lewat **file export dari sistem kasir yang diunggah** di modul Tarik Data Kasir; tiap unggahan tercatat kapan dan oleh siapa. Mengunggah ulang memperbarui daftar tanpa menghilangkan berat yang sudah tersimpan. Selama daftar produk belum ada: total kg diketik, dan foto surat jalan supplier wajib. *(Dilapisi DRV-103 dan diperinci DRV-109, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-39 | **Disiapkan sejak awal, dinyalakan belakangan: sambungan ke purchase order kasir.** Laporan Bongkaran bisa memilih satu purchase order; barang dan jumlahnya terisi dari sana, dan Kepala Gudang hanya **mencocokkan jumlah** yang datang. Selisih ditandai. HRIS tidak menulis ke sistem kasir. *(Diperinci DRV-106, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-40 | **Laporan Bongkaran bukan penerimaan stok.** Stok tetap diurus sistem kasir; jumlah di laporan ini hanya untuk berat dan upah. |
| DRV-41 | Supplier dipilih dari **satu daftar supplier**; tidak diketik bebas. Daftar itu milik Keuangan; Kepala Gudang boleh menambah supplier baru bertanda "belum diperiksa" (KEU-57). |

### 3.7 Bongkaran: tarif, peserta, dan pembagian

| No | Aturan |
|---|---|
| DRV-42 | **Tarif** satu angka rupiah per kg, bertanggal berlaku; Rp20 dibawa sebagai tarif awal. Hanya pemilik yang menambah tarif; tarif tidak dihapus. Server mengambil tarif menurut tanggal kerja: tidak bisa diketik per laporan, tidak ada angka cadangan di kode, dan laporan ditolak kalau tarif untuk tanggal itu tidak ada. *(Diperinci DRV-110, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-43 | Upah **selalu dibagi rata**. Tiap peserta mendapat hasil bagi dibulatkan ke bawah; sisa rupiahnya diberikan satu rupiah per orang menurut **urutan abjad nama**. Jumlah semua bagian selalu sama dengan total upah. *(Diperinci DRV-108, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-44 | Peserta: karyawan mana pun yang aktif pada tanggal kerja itu, atau pekerja lepas. Satu orang tidak bisa tercantum dua kali. **Siapa pun yang ikut tetap mendapat bagian, di hari kerja maupun hari liburnya**, termasuk karyawan bergaji bulanan di jam kerjanya sendiri; DRV-16 tidak berlaku untuk bongkaran. Keikutsertaan tercatat sebagai pekerjaan hari itu (PRI-16), tanpa mengubah jabatannya. *(Diperinci DRV-102 dan 107, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-45 | **Pekerja lepas** hanya dicatat nama dan nomor HP: tanpa akun, tanpa absen, tanpa slip, dan karena itu tidak bisa kasbon. Dicatat di **satu tempat**, yaitu sebagai orang berstatus kerja Freelance (KAR-61); tidak ada daftar pekerja lepas kedua. Pekerja lepas baru ditambahkan Kepala Gudang langsung saat membuat Laporan Bongkaran; nomor HP yang sama dengan orang lain ditolak. HR dan pemilik melihat daftarnya. |
| DRV-46 | Upah dicatat **per orang**: satu baris Buku Upah per peserta per laporan. |

### 3.8 Bongkaran: membayar, koreksi, dan laporan

| No | Aturan |
|---|---|
| DRV-47 | **Bongkaran dibayar tunai hari itu juga oleh finance** (pemilik juga boleh). Ini **pengecualian** atas GAJ-45 (membayar hanya pemilik) dan GAJ-56 (pengeluaran gaji hanya dari slip), khusus bongkaran. Membayar adalah **satu langkah utuh di server**: tanggal bayar dari server, pembayar, sumber dana, dan **satu** catatan keuangan yang bertaut ke laporannya. Satu laporan dibayar sekali dan penuh; tidak bisa dibayar dua kali. *(Diperinci DRV-111 dan 113, dilapisi DRV-112, 14 Oktober 2026; disetujui 14 Oktober 2026: tanggal uang boleh mundur 7 hari, diserahkan kepada siapa dicatat, pembayar bukan peserta atau pembuat.)* |
| DRV-48 | **Kasbon dan denda tidak dipotong dari upah bongkaran**, karena uangnya diterima tunai hari itu. Upah bongkaran tidak masuk slip mingguan maupun bulanan. |
| DRV-49 | Laporan Bongkaran **tidak dihapus**. Sebelum dibayar boleh dikoreksi Kepala Gudang dengan alasan dan jejak. Setelah dibayar hanya pemilik yang membatalkan atau mengoreksi, wajib alasan. Kalau akibatnya seseorang **kurang dibayar**, kekurangannya dibayar tunai oleh finance sebagai pembayaran susulan yang bertaut ke laporannya. Kalau **lebih dibayar**, kelebihannya diperhitungkan di pembayaran bongkaran berikutnya orang itu; yang belum tertagih setelah 30 hari ditandai untuk pemilik, yang memutuskan ditagih tunai atau dihapus dengan alasan. *(Diperinci DRV-115 s.d. 119, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-50 | **Tidak ada Kas Keluar bongkaran yang diketik tangan.** Kategori "Bongkar", "Upah Borongan", dan "Gaji Freelance" di sistem lama menjadi satu jalur yang hanya lahir dari Laporan Bongkaran. |
| DRV-51 | Biaya bongkaran dibebankan ke cabang yang ditunjuk di **pengaturan** (isi awal: Gudang), bukan nama cabang di kode (WAJ-05). |
| DRV-52 | Laporan yang belum dibayar setelah lewat hari kerjanya **ditandai** untuk finance dan pemilik. Daftar yang belum dibayar selalu tampil, berapa pun umurnya. *(Diperinci DRV-114, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-53 | Ada **laporan bongkaran per orang**: siapa saja yang membongkar, berapa kali, berapa kg, dan menerima berapa, dengan periode bawaan **26–25** dan rentang yang bisa diganti. Peserta melihat upah bongkarannya sendiri di portal: tanggal, kg, jumlah peserta, bagiannya, sudah dibayar atau belum. *(Diperinci DRV-120, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |

### 3.9 Kasbon: syarat, batas, dan dana

| No | Aturan |
|---|---|
| DRV-54 | **Satu buku Kasbon untuk semua orang:** satu tempat, satu alur, satu rumus. Tidak ada kasbon khusus driver atau kenek, dan tidak ada pengalihan menurut nama departemen atau jabatan (WAJ-05). |
| DRV-55 | **Syarat masa kerja 6 bulan**, dihitung dari tanggal bergabung sebenarnya. Yang belum memenuhi ditolak dengan kalimat terus terang: "Kasbon baru bisa diajukan setelah 6 bulan bekerja. Kalau mendesak, hubungi GM." *(Diperinci DRV-121, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-56 | **Batas per orang Rp250.000**, sama untuk semua. Yang dibatasi adalah **sisa utang**: sisa semua kasbon biasa orang itu, ditambah pengajuannya yang masih menunggu, ditambah pengajuan baru. Boleh punya lebih dari satu kasbon berjalan selama masih di dalam batas. **Angka batas tidak pernah ditampilkan ke karyawan.** Kalimat penolakan: "Pastikan Anda sudah membayar kasbon lama. Ditolak karena kasbon lama masih banyak." Kalau orangnya tidak punya kasbon berjalan, dipakai kalimat DRV-57. *(Diperinci DRV-121, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-57 | Ada **dua Dana Kasbon, masing-masing Rp1.000.000**: satu untuk orang berslip utama bulanan, satu untuk orang berslip utama mingguan (DRV-04). Sisa dana = besar dana dikurangi sisa utang semua kasbon biasa yang berjalan di dana itu dan pengajuan yang masih menunggu. Dana terisi lagi tiap cicilan terpotong, dilunasi, atau pengajuan ditarik, ditolak, atau dibatalkan. Kalau sisa dana tidak cukup: "Kasbon belum bisa diajukan saat ini. Silakan coba lagi setelah gajian." *(Diperinci DRV-121, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-58 | **Urutan periksa** saat mengajukan, semuanya di server dan di satu tempat (WAJ-04): masa kerja, lalu batas orangnya, lalu sisa dana. Gagal di satu langkah berarti pengajuan tidak tersimpan. *(Diperinci DRV-121, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |

### 3.10 Kasbon: dari mengajukan sampai uang diberikan

| No | Aturan |
|---|---|
| DRV-59 | **Mengajukan:** karyawan untuk dirinya sendiri, dijaga server. HR boleh mengisi atas nama karyawan; tercatat siapa yang mengisi dan untuk siapa. Isinya: nominal, **kali potong (1 sampai 3)**, dan **alasan wajib minimal 15 karakter**. *(Diperinci DRV-122 dan 123, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-60 | Setelah pengajuan tersimpan, karyawan melihat: "Kasbon diproses paling cepat 2 hari setelah pengajuan, tidak bisa langsung cair." Ini pemberitahuan; uang **boleh** cair lebih cepat kalau prosesnya selesai. |
| DRV-61 | **Alur pengesahan** sama untuk semua orang: (a) **finance memeriksa** dan boleh mengusulkan perubahan nominal dan kali potong; (b) **pemilik meninjau, boleh mengubah lagi, lalu menyetujui atau menolak**. Nominal hanya boleh **diturunkan**; kali potong 1 sampai 3. Angka akhir adalah keputusan pemilik. Karyawan melihat yang ia ajukan dan yang disetujui. Menolak wajib alasan. Ini melapisi "cara bayar dipilih karyawan" (GAJ bagian 7 butir 3): karyawan memilih, tetapi pilihannya bisa diubah. *(Diperinci DRV-124 dan 125, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-62 | **Menyetujui adalah satu langkah utuh di server:** status, nominal akhir, dan jadwal cicilan tersimpan bersama atau tidak sama sekali. Tidak ada yang menyetujui kasbonnya sendiri. *(Diperinci DRV-125, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-63 | Begitu disetujui, finance mendapat pemberitahuan. **Menyerahkan uang adalah langkah tersendiri**, oleh finance (pemilik juga boleh), satu langkah utuh di server: tanggal dari server, siapa yang menyerahkan, **sumber dana wajib**, dan satu catatan keuangan yang bertaut ke kasbonnya. Status kasbon membedakan dengan jelas **"disetujui, belum diberikan"** dan **"sudah diberikan"**. Satu kasbon cair sekali. *(Diperinci DRV-126 dan 127, dilapisi DRV-126 atas "tanggal dari server", 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-64 | Pengajuan yang belum selesai diproses setelah **2 hari**, dan kasbon yang sudah disetujui tetapi belum ditandai sudah diberikan, **ditandai** untuk finance dan pemilik. Tidak ada yang ditolak otomatis. *(Diperinci DRV-130, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |

### 3.11 Kasbon: cicilan dan pelunasan

| No | Aturan |
|---|---|
| DRV-65 | **Jadwal cicilan** dibuat server: nominal dibagi rata ke kali potongnya, dibulatkan ke bawah ke rupiah, sisanya masuk cicilan terakhir. Cicilan pertama masuk slip periode saat uang diberikan; kalau slip itu sudah ditutup, slip berikutnya. Periode mengikuti slip utama orangnya (26–25 atau Jumat–Kamis), bukan bulan kalender. *(Diperinci DRV-132, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-66 | **Potongan kasbon tidak pernah diketik** (GAJ-22). Slip membaca cicilan yang jatuh tempo; cicilan ditandai terpotong hanya saat slip ditutup (GAJ-47), bertaut ke slipnya, dan **boleh sebagian**. Yang tidak tertampung ikut slip berikutnya sebagai "sisa potongan" (GAJ-52, DRV-24). *(Diperinci DRV-133, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-67 | **Sisa kasbon tidak disimpan dan tidak diketik:** selalu dihitung server dari nominal yang diberikan dikurangi cicilan terpotong dan pelunasan tunai, di satu tempat (WAJ-04). *(Diperinci DRV-131, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-68 | **Menunda cicilan:** diminta karyawan dengan alasan, disahkan pemilik, paling banyak 1 kali per kasbon; jadwal bergeser satu slip. *(Diperinci DRV-134 dan 135, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-69 | **Melunasi tunai lebih cepat** boleh: diterima finance dan tercatat sebagai uang masuk yang bertaut ke kasbonnya. *(Diperinci DRV-136, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-70 | **Menghapus utang** (diikhlaskan) hanya pemilik, wajib alasan, tercatat sebagai beban perusahaan. *(Diperinci DRV-137, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-71 | **"Lunas" bukan tombol.** Status lunas lahir sendiri saat sisa nol. *(Diperinci DRV-131, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |

### 3.12 Kasbon: batal, berhenti, dan ganti slip

| No | Aturan |
|---|---|
| DRV-72 | **Kasbon tidak dihapus** (PRI-02). Pengaju boleh menarik pengajuannya sebelum disetujui. Setelah disetujui dan belum diberikan: dibatalkan pemilik dengan alasan. Setelah diberikan: tidak dibatalkan, hanya dicicil, dilunasi, atau dihapus utangnya. *(Diperinci DRV-128 dan 129, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-73 | **Orang yang berhenti:** seluruh sisa kasbon ditagih di slip terakhirnya, bulanan maupun mingguan; yang tidak tertutup menjadi piutang ke mantan karyawan (GAJ-53). *(Diperinci DRV-139, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-74 | **Orang yang berganti slip utama** membawa kasbonnya; jadwal sisa cicilannya disusun ulang server mengikuti slip barunya, dan sisa utangnya pindah ke Dana Kasbon slip barunya. Perpindahan itu tidak pernah ditolak walaupun dana tujuannya sedang penuh; yang tertahan hanya pengajuan baru di dana itu sampai sisanya ada lagi. *(Diperinci DRV-140, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |

### 3.13 Kasbon Khusus dan pemberian

| No | Aturan |
|---|---|
| DRV-75 | **Kasbon Khusus** untuk keadaan mendesak (misalnya kecelakaan, sakit, duka): hanya **dibuat pemilik** atas nama karyawan, wajib alasan dan jenis kejadian. Boleh melewati syarat 6 bulan, batas Rp250.000, dan Dana Kasbon; **tidak mengurangi Dana Kasbon** dan dihitung terpisah. Kali potong ditentukan pemilik dan **boleh lebih dari 3** (pengecualian atas DRV-59). Tidak ada yang membuat Kasbon Khusus untuk dirinya sendiri: untuk GM dibuat Owner, dan sebaliknya. *(Diperinci DRV-141, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-76 | Selebihnya Kasbon Khusus mengikuti aturan kasbon biasa: uang diserahkan dengan sumber dana dan tanda sudah diberikan, dipotong lewat slip, tidak dihapus, terlihat karyawan. Di daftar Kasbon Berjalan tampil terpisah dengan tanda "Khusus". *(Diperinci DRV-141, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-77 | **Pemberian bukan kasbon.** Bantuan yang tidak perlu dikembalikan tidak dicatat di buku Kasbon dan tidak dipotong dari gaji. Kalau uangnya dari kas kantor, dicatat sebagai pengeluaran bantuan di Keuangan (KEU-25). Bantuan campuran dicatat dua kali sesuai jenisnya. |

### 3.14 Yang dilihat karyawan dan pemilik

| No | Aturan |
|---|---|
| DRV-78 | Karyawan melihat kasbonnya **utuh** di portal: status, nominal diajukan dan disetujui, sudah diberikan atau belum, jadwal cicilan, yang sudah terpotong beserta slipnya, dan sisa. Angka batas dan sisa dana tidak ditampilkan. *(Diperinci DRV-142, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-79 | Pemilik punya daftar **"Kasbon Berjalan"**: semua orang, sisa, cicilan berikutnya, cicilan yang ditunda atau terbawa, pengajuan yang menunggu, sisa tiap Dana Kasbon, dan Kasbon Khusus. Finance melihat pengajuan yang menunggu diperiksa dan kasbon yang menunggu diberikan. *(Diperinci DRV-142, 14 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-80 | Karyawan punya halaman **"Pendapatan Saya"**: semua upahnya dari ketiga jalur dalam satu daftar per periode 26–25. Pemilik punya laporan **total diterima per orang** lintas jalur. Hak lihat mengikuti GAJ-46. *(Diperinci GAJ-107 dan 114, 13 Oktober 2026; disetujui 14 Oktober 2026.)* |
| DRV-81 | Satu halaman **Jadwal Bayar** untuk pemilik: yang jatuh bayar hari ini dan yang sudah lewat, untuk semua jalur (slip bulanan, slip mingguan, bongkaran), dalam satu daftar. *(Diperinci GAJ-104, 13 Oktober 2026.)* |

### 3.15 Hak akses dan aturan umum

DRV-82. **Hak akses isi awal** (diatur di daftar hak akses per jabatan, KAR-58;
dijaga di server; tidak ada nama jabatan di kode):

| Jabatan | Di modul ini |
|---|---|
| Pemilik dan **GM** (hak setara) | Semua. Khusus mereka: mengubah tarif ritase, tarif bongkaran, jenis denda, dan pengaturan kasbon; mengesahkan denda; membayar slip mingguan; membatalkan ritase; membatalkan Laporan Bongkaran yang sudah dibayar; menyetujui, menolak, dan membatalkan kasbon; menyetujui tunda cicilan; menghapus utang; membuat Kasbon Khusus |
| HR | Menutup slip mingguan; melihat slip mingguan per orang; mengisi pengajuan kasbon atas nama karyawan; melihat daftar pekerja lepas dan laporan total diterima per orang (GAJ-46) |
| Finance | Melihat total slip mingguan per minggu; membayar bongkaran dan melihat rinciannya (peserta dan bagiannya); memeriksa pengajuan kasbon dan mengusulkan perubahan; menyerahkan uang kasbon; menerima pelunasan tunai |
| Kepala Gudang | Melihat tarif ritase; mengajukan denda; membuat dan mengoreksi Laporan Bongkaran; mengubah berat per satuan; menambah pekerja lepas; melihat rincian bongkaran |
| Driver dan kenek | Slip mingguannya sendiri |
| Semua karyawan | Mengajukan kasbon untuk dirinya sendiri; melihat kasbonnya, upah bongkarannya, dan Pendapatan Saya |

Finance dan Kepala Gudang melihat bagian tiap peserta bongkaran karena mereka
yang mencatat dan membayarnya. Ini pengecualian atas PRI-24, khusus upah
bongkaran; slip dan gaji tetap tertutup bagi mereka.

| No | Aturan |
|---|---|
| DRV-83 | **Tidak ada catatan upah, denda, bongkaran, atau kasbon yang dihapus;** semuanya dibatalkan dengan alasan (PRI-02). Semua langkah yang menyangkut uang lewat pintu di server, dan tiap rumus (nominal ritase, pembagian bongkaran, jadwal cicilan, sisa kasbon, sisa dana, upah bersih) ada di satu tempat (WAJ-04). Semua aturan uang di buku ini masuk daftar tes wajib (WAJ-06). |

### 3.16 Pengaturan dan angka awalnya

DRV-85. Semua angka di bawah adalah pengaturan bertanggal berlaku (WAJ-07),
disimpan di satu tempat dan dibaca server. Tidak ada yang ditulis di kode.
Hanya pemilik yang mengubahnya. Perubahan yang menyangkut karyawan diumumkan
dulu (PRI-29).

*(Nomor paragraf ini semula tertulis DRV-84, sama dengan aturan Buku Upah di
bagian 3.1. Dirapikan 14 Oktober 2026 menjadi DRV-85; DRV-84 tetap aturan Buku
Upah karena nomor itulah yang dirujuk spec Gaji dan Logistik.)*

| Pengaturan | Angka awal | Aturan |
|---|---|---|
| Slip utama per jabatan | driver dan kenek: mingguan; jabatan lain: bulanan | DRV-04 |
| Tarif ritase dan upah belanja | 23 tarif yang berjalan di sistem lama | DRV-08 |
| Minggu upah | Jumat sampai Kamis | DRV-19 |
| Hari bayar slip mingguan | Sabtu | DRV-19 |
| Batas menutup slip mingguan | Jumat | DRV-22 |
| Masa keberatan setelah slip mingguan ditutup | 3 hari | DRV-22 |
| Jenis denda driver dan kenek | "tidak taat administrasi" Rp10.000 per kejadian (S1) | DRV-29, 98 |
| Jam tombol Tutup slip mingguan aktif; jam mulai pengingat | Jumat 10.00; Jumat 15.00 (S4) | DRV-93 |
| Tanggal kejadian denda paling jauh ke belakang | 7 hari (S3) | DRV-99 |
| Tarif bongkaran | Rp20 per kg | DRV-42 |
| Tanggal kerja bongkaran boleh mundur | 3 hari | DRV-36 |
| Cabang yang menanggung biaya bongkaran | Gudang | DRV-51 |
| Batas kelebihan bayar bongkaran belum tertagih | 30 hari | DRV-49 |
| Beda berat per satuan yang ditandai untuk pemilik | lebih dari 10% (L5) | DRV-105 |
| Jumlah foto surat jalan per Laporan Bongkaran | 1 sampai 5 (L3) | DRV-103 |
| Tanggal uang bongkaran boleh mundur tanpa alasan | 7 hari, dibaca dari pengaturan tanggal uang Gaji (B1) | DRV-112 |
| Masa "Uang belum saya terima" | 3 hari sejak diberi tahu dibayar (B2) | DRV-113 |
| Syarat masa kerja kasbon | 6 bulan | DRV-55 |
| Batas kasbon per orang | Rp250.000 | DRV-56 |
| Dana Kasbon slip bulanan | Rp1.000.000 | DRV-57 |
| Dana Kasbon slip mingguan | Rp1.000.000 | DRV-57 |
| Paling banyak kali potong | 3 | DRV-59 |
| Alasan kasbon paling pendek | 15 karakter | DRV-59 |
| Batas waktu memproses kasbon | 2 hari | DRV-64 |
| Tunda cicilan | paling banyak 1 kali per kasbon | DRV-68 |
| Kelipatan nominal kasbon; nominal terkecil | Rp10.000; Rp50.000 (K1) | DRV-122 |
| Masa "Uang belum saya terima" kasbon | 3 hari sejak diberi tahu diberikan (K5) | DRV-127 |
| Tanggal uang kasbon boleh mundur tanpa alasan | 7 hari, dibaca dari pengaturan tanggal uang Gaji (K4) | DRV-126 |
| Slip mulai Ubah jadwal paling jauh | 3 slip utama sesudah slip terbuka terdekat (C2) | DRV-135 |
| Tanggal uang pelunasan tunai boleh mundur tanpa alasan | 7 hari, dibaca dari pengaturan tanggal uang Gaji (C3) | DRV-136 |
| Kali potong Kasbon Khusus paling banyak | 12 (C7) | DRV-141 |
| Jenis kejadian Kasbon Khusus | Kecelakaan, Sakit, Duka, Lainnya (C7) | DRV-141 |

### 3.17 Perincian Tahap 4G-1: tarif dan ritase

Keputusan pemilik 14 Oktober 2026 (U1 s.d. U5, jawaban "ok" = sesuai saran). Spec:
`../work/specs/2026-10-14-gaji-driver-spec.md` bagian 3.1.

| No | Aturan |
|---|---|
| DRV-86 | **Daftar Jenis Upah hanya dibaca** (U1; jenis: pengganti atas kalimat "Jenis baru hanya ditambah pemilik" di DRV-02). Isinya diisi lewat migrasi. Jenis upah baru berarti modul asal, layar, dan tes baru, jadi ditambah lewat pembangunan sistem dan rilis, bukan tombol. Jadwal bayar tetap diubah lewat pengaturan (DRV-19, 85). |
| DRV-87 | **Satu fungsi "nilai ritase"** (jenis: perincian DRV-09, 10, 11, 16, 17, 84) memberi rupiah setiap baris ritase dan upah belanja begitu barisnya lahir: tarif pasangan mobil dan rute (untuk upah belanja: mobil trip dan rute belanja tugasnya) pada tanggal trip; angka menurut peran dan berkenek; untuk orang berslip utama bulanan dibaca status harinya (libur terjadwal, libur pengganti, hari tutup = penuh; hari kerja, termasuk jabatan yang tidak diabsen = Rp0 "hari kerja, sudah dibayar gaji"; izin, sakit, cuti, alpha = Rp0 "bukan hari libur"). Bila dua sebab Rp0 berlaku, keterangan hari yang dipakai. Satu ritase hanya punya satu baris upah yang berlaku. |
| DRV-88 | **Penilaian ulang otomatis** (U2; jenis: pelapis DRV-15, 16). Bila status hari, angka tarif (pembetulan), atau status ritase berubah, server menilai ulang. Slip mingguan tujuannya belum ditutup: baris lama dibatalkan, baris baru ditulis. Sudah ditutup: selisih **plus** masuk slip mingguan berikutnya (dibuat khusus bila tidak ada ritase); selisih **minus** menjadi potongan "koreksi upah ritase" kelompok (a) di **slip utama** berikutnya (DRV-04, GAJ-75), dan yang tidak tertampung menjadi sisa potongan. Orangnya diberi tahu beserta sebabnya. |
| DRV-89 | **Tarif pertama pasangan baru boleh berlaku hari itu** (U3; jenis: pengecualian atas PRI-35 butir 4, khusus pasangan mobil dan rute yang belum pernah bertarif). Perubahan tarif lainnya tetap lewat Papan: tidak mundur, jarak 1 hari bila semua angka sama atau naik, 7 hari bila ada yang turun; server menentukan jaraknya dari perbandingan angka (perincian DRV-08, PRI-29, 35). |
| DRV-90 | **Salah ketik tarif dibetulkan** (U4; jenis: pelapis DRV-08, 12): hanya Pemilik atau GM, alasan wajib, angka saja (tanggal dan pasangan tetap), selama belum ada slip mingguan **Dibayar** yang memuat ritase yang dinilai dengan baris itu. Baris lama berstatus Dibetulkan; ritasenya dinilai ulang (DRV-88). Pembetulan bukan perubahan aturan, jadi tidak lewat Papan. Sesudah ada yang dibayar: tarif baru ke depan, dan selisihnya lewat Bonus Bebas atau Potongan Lain dengan alasan. |
| DRV-91 | **Ritase di hari izin, sakit, cuti, atau alpha ditandai "Perlu dilihat"** (U5; jenis: perincian DRV-16): untuk HR di Beranda dan daftar Upah Ritase, ditutup dengan "Sudah dilihat" oleh HR, Pemilik, atau GM. Tidak ada akibat uang dan tidak menahan slip; pembetulan status hari dilakukan di Kehadiran. |
| DRV-92 | **Pagar tarif kosong** (jenis: perincian DRV-12, LOG-21, 36): Siap Kirim memeriksa pasangan trip **dan** pasangan tiap tugas belanja; menambah tugas belanja ke trip berjalan dan ritase tangan ditolak bila pasangannya belum bertarif pada tanggal itu. Bila tetap ada ritase tanpa tarif, barisnya Rp0 berstatus "Belum bertarif", masuk antrean Pemilik dan GM, dan menahan slip mingguan orang itu sampai tarif diisi; lalu dinilai ulang. Tidak ada angka cadangan di kode. |

### 3.18 Perincian Tahap 4G-2: slip mingguan dan denda

Keputusan pemilik 14 Oktober 2026 (S1 s.d. S4, jawaban "ok" = sesuai saran). Spec:
`../work/specs/2026-10-14-gaji-driver-spec.md` bagian 3.2.

| No | Aturan |
|---|---|
| DRV-93 | **Jendela tutup slip mingguan** (S4; jenis: perincian DRV-22): tombol Tutup aktif **Jumat 10.00** untuk minggu yang berakhir Kamis kemarin; pengingat berantai ke HR, Pemilik, GM mulai **Jumat 15.00** selama masih ada slip Perkiraan; jatuh bayar **Sabtu**, atau tanggal ditutup bila lebih lambat. Jam aktif dan jam pengingat adalah pengaturan; batas pengingat bukan pagar. Tidak ada masa keberatan perkiraan bertanggal; keberatan yang masuk sebelum tutup tidak menahan slip (GAJ-93). |
| DRV-94 | **Slip mingguan lahir** (jenis: perincian DRV-20, 05): slip utama mingguan dibuat untuk setiap orang berslip utama mingguan yang aktif sekurang-kurangnya sehari di minggu itu, **walaupun tanpa ritase**, supaya potongan yang jatuh tempo tampil dan dibawa terang; slip di luar slip utama dibuat saat baris upah pertama orang itu lahir di minggu itu. |
| DRV-95 | **Isi slip mingguan** (jenis: perincian DRV-20, 23, 24): dihitung fungsi hitung slip yang sama dengan slip bulanan (GAJ-91). Pendapatan: ritase, upah belanja, koreksi plus upah ritase, bonus yang slip tujuannya minggu itu (GAJ-86). Potongan (hanya slip utama) mengikuti GAJ-75: (a) denda driver dan kenek, potongan koreksi upah ritase; (b) kehilangan barang dan minus kas hanya bila jabatannya bertanda; (c) Potongan Lain; (d) kasbon. Tidak ada cabang khusus driver di kode (WAJ-05). |
| DRV-96 | **Penahan slip mingguan** (jenis: pelapis GAJ-93): penahan baru nomor 7 **"ada baris upah Belum bertarif"** (DRV-92), berlaku umum untuk slip mana pun. Untuk orang per ritase hanya penahan 5, 6, dan 7 yang bisa muncul. Usulan denda menunggu, keberatan, trip yang masih Berjalan, tanda Perlu dilihat, dan Pemeriksaan Uang yang belum selesai **bukan** penahan. |
| DRV-97 | **Langkah tutup dan bayar slip mingguan** (jenis: perincian DRV-22, 25, 26): langkah tutup dan bayar Gaji (GAJ-47, 48, 91 s.d. 106) dipakai apa adanya. Sebelum tutup, Penilai ulang dijalankan untuk orang dan minggu itu (DRV-88). Denda dan potongan koreksi upah ritase masuk Dana Disiplin sebesar yang terpotong (DRV-30). Kunci catatan hari kerja tidak berlaku untuk orang per ritase. |
| DRV-98 | **Denda driver dan kenek: jenis dan nominal** (S1; jenis: perincian DRV-29): jenis awal "Tidak taat administrasi" **Rp10.000 per kejadian**, tetap, tanpa tambahan bertingkat. Nominal disimpan sebagai pengaturan bersasaran jenis, disalin ke denda pada tanggal kejadian. Jenis baru dan kenaikan nominal lewat Papan dengan jarak 7 hari (PRI-35); penurunan 1 hari. Nominal awal diumumkan sebelum modul tayang. |
| DRV-99 | **Denda: mengajukan dan mengesahkan** (S3; jenis: perincian DRV-29, 30): Kepala Gudang mengajukan (usulan, Mesin Pengajuan); Pemilik atau GM mengesahkan atau menolak tanpa mengubah nominal, atau mencatat langsung berlaku. Sasaran: orang berslip utama mingguan yang aktif, atau awak trip pada tanggal itu; bukan jabatan Pemilik dan GM, bukan dirinya sendiri. **Tanggal kejadian paling lama 7 hari ke belakang**, tidak masa depan. Uraian paling sedikit 15 huruf; trip wajib dipilih bila ada. Masuk slip utama periode tanggal kejadian, atau berikutnya bila sudah ditutup (GAJ-50). Kurang setoran, kembalian bensin, dan barang rusak **bukan denda**: lewat Potongan Lain (LOG-129, GAJ-80). |
| DRV-100 | **Denda: keberatan, batal, tiadakan** (S2; jenis: pelapis GAJ-81, perincian PRI-02): keberatan lewat "Keberatan potongan" dalam 3 hari sejak diberi tahu, diputuskan Pemilik atau GM; denda tetap berjalan selama menunggu. Sebelum terpotong: **Batalkan** (Pemilik, GM, alasan). Sesudah terpotong: **Tiadakan** (Pemilik, GM, alasan, atau keberatan Ditiadakan) menjadi koreksi plus di slip utama berikutnya dan mutasi keluar Dana Disiplin. Usulan yang belum disahkan tidak tampil ke orangnya. Kartu "Upah Minggu Ini" di Beranda menampilkan perkiraan minggu berjalan dan status slip minggu lalu dari fungsi yang sama (perincian DRV-28). |

### 3.19 Perincian Tahap 4G-3a: Laporan Bongkaran

Keputusan pemilik 14 Oktober 2026 (L1 s.d. L7, jawaban "ok" = sesuai saran). Spec:
`../work/specs/2026-10-14-gaji-driver-spec.md` bagian 3.3.

| No | Aturan |
|---|---|
| DRV-101 | **Laporan Bongkaran langsung Berlaku saat disimpan** (L1; jenis: perincian DRV-31, 84). Tidak ada pengesahan terpisah: "disahkan" di DRV-84 berarti tersimpan dan Berlaku. Saat itu juga baris Buku Upah tiap peserta lahir dan laporan siap dibayar. Mata kedua adalah Finance yang melihat rincian dan tanda-tandanya sebelum membayar, serta Pemilik dan GM yang melihat semua tanda. Laporan bernomor dan tidak dihapus. |
| DRV-102 | **Pembuat laporan boleh menjadi peserta** (L2; jenis: perincian DRV-44). Laporannya bertanda "pembuat ikut jadi peserta", tampil ke Finance sebelum membayar dan ke Pemilik dan GM. Tanda di laporan (pembuat ikut, Barang lain, kg diketik, berat berubah, tanpa surat jalan, tanggal mundur, serupa, selisih PO, supplier belum diperiksa) adalah keterangan, **bukan penahan**. |
| DRV-103 | **Foto surat jalan supplier wajib di setiap laporan** (L3; jenis: pelapis DRV-31 dan 38, yang hanya menyebut wajib selama daftar produk belum ada): 1 sampai 5 foto. Bila supplier tidak memberi surat jalan: foto barang yang dibongkar dan alasan, dan laporan bertanda "tanpa surat jalan". |
| DRV-104 | **Laporan terlambat** (L4; jenis: perincian DRV-36). Tanggal kerja lebih dari 3 hari ke belakang tetap diisi Kepala Gudang dengan alasan, tersimpan **Menunggu persetujuan** sebagai pengajuan "Laporan Bongkaran terlambat" (PRI-23), dan diputuskan Pemilik atau GM yang bukan pembuat dan bukan peserta laporan itu. Selama menunggu tidak ada baris upah dan tidak bisa dibayar. Disetujui: Berlaku dengan tarif tanggal kerja. Pemilik atau GM yang membuatnya sendiri: langsung Berlaku, alasan wajib. |
| DRV-105 | **Berat per satuan** (L5; jenis: perincian DRV-32, 33): kg sampai 3 angka di belakang koma, lebih dari 0, per produk + satuan. Berat yang sudah ada tampil sebagai tulisan; mengubahnya wajib **alasan**. Perubahan lebih dari **10%** dari berat sebelumnya masuk daftar "Berat berubah" untuk Pemilik dan GM dan menjadi tanda di laporannya, tanpa menahan laporan atau pembayaran. Berat di atas 100 kg per satuan meminta konfirmasi. Jumlah barang boleh pecahan sampai 3 angka di belakang koma. |
| DRV-106 | **Purchase order** (L6; jenis: perincian DRV-39; menutup butir terbuka 12). Pilihan "Dari purchase order" hanya tampil bila jenis data purchase order di Data Kasir bercara Sambungan dan menyala; tidak ada saklar kedua di modul ini dan tanggalnya tidak ditetapkan sekarang (dinyalakan GM atau Owner dengan pengumuman 7 hari, SIS-09). Barang dan jumlah terisi dari PO; Kepala Gudang mencocokkan jumlah yang datang; yang berbeda bertanda "Selisih dengan PO"; hitungan memakai jumlah yang datang. Satu PO boleh dipakai lebih dari satu laporan. |
| DRV-107 | **Peserta di hari izin, sakit, cuti, atau alpha** (L7; jenis: perincian DRV-44): tetap mendapat bagian, dan baris upahnya bertanda "Perlu dilihat" untuk HR **tanpa nominal**, ditutup dengan "Sudah dilihat" oleh HR, Pemilik, atau GM. Tidak ada akibat uang; pembetulan status hari di Kehadiran. Status hari dibaca sekali saat laporan Berlaku. |
| DRV-108 | **Satu fungsi "hitung bongkaran"** (jenis: perincian DRV-35, 43, 46): kg baris = jumlah × berat, dibulatkan ke 3 angka di belakang koma; total kg = jumlah kg baris; total upah = total kg × tarif tanggal kerja, dibulatkan ke rupiah terdekat (setengah ke atas); bagian = hasil bagi dibulatkan ke bawah, sisanya Rp1 per orang menurut abjad nama lengkap (nama sama: yang lebih dulu terdaftar). Layar tidak mengirim kg total, tarif, atau bagian. Tarif, berat, dan bagian tersalin di laporan. Satu baris Buku Upah per peserta, periode menurut tanggal kerja, tidak pernah masuk slip. |
| DRV-109 | **Barang lain dan masa tanpa daftar produk** (jenis: perincian DRV-34, 38): pilihan Barang lain hanya muncul sesudah pencarian (paling sedikit 3 huruf) tidak menemukan apa pun; memasangkannya ke produk belakangan **tidak mengubah kg dan upah** laporan itu. Isian "Total kg" hanya ada selama daftar produk kasir masih kosong, dan hilang sendiri begitu daftar terisi; keadaan itu dibaca dari isi daftar, bukan dari saklar. |
| DRV-110 | **Tarif bongkaran** (jenis: perincian DRV-42): satu angka rupiah bulat per kg di kerangka Pengaturan, hanya Pemilik dan GM, tidak bisa diberikan ke jabatan lain. Perubahan lewat Papan Perubahan Aturan: tidak mundur, paling cepat 1 hari bila naik dan 7 hari bila turun (PRI-29, 35). Peserta harus aktif pada tanggal kerja; orang datang separuh jalan diselesaikan dengan dua laporan, bukan pembagian tidak rata. |

### 3.20 Perincian Tahap 4G-3b: bayar bongkaran

Keputusan pemilik 14 Oktober 2026 (B1 s.d. B6, jawaban "ok" = sesuai saran). Spec:
`../work/specs/2026-10-14-gaji-driver-spec.md` bagian 3.4.

| No | Aturan |
|---|---|
| DRV-111 | **Langkah bayar bongkaran** (B3; jenis: perincian DRV-47, 48, 50, 51). Finance, Pemilik, atau GM; satu langkah utuh per laporan; beberapa laporan boleh sekaligus dari satu tempat uang, tiap laporan tetap satu pembayaran dan satu baris Buku Kas berkejadian "Upah bongkaran", cabang penanggung dari salinan di laporan. Uang yang keluar dihitung server (jumlah bagian dikurangi lebih bayar yang diperhitungkan); tidak ada isian nominal dan tidak ada potongan lain. **Pembayar bukan peserta dan bukan pembuat laporan itu**; Pemilik dan GM tetap boleh, tercatat dan diberitahukan ke para pemilik. Catatan Cepat milik orang yang berhak membayar boleh dipasangkan bila nominalnya sama persis (KEU-18). |
| DRV-112 | **Tanggal uang bongkaran** (B1; jenis: pelapis atas kalimat "tanggal bayar dari server" di DRV-47, sejalan GAJ-99): saat menandai dibayar, tanggal uang boleh dipilih mundur sampai 7 hari (lebih jauh dengan alasan), tidak sebelum tanggal kerja dan tidak masa depan. Jam catat selalu dari server. Angka 7 hari dibaca dari pengaturan Gaji, tidak disimpan dua kali. |
| DRV-113 | **Diserahkan kepada siapa, dan "Uang belum saya terima"** (B2; jenis: perincian DRV-47, 53). Pembayar wajib memilih: langsung ke tiap peserta, atau dititipkan ke satu nama (peserta atau pembuat laporan). Peserta yang punya akun diberi tahu dan boleh melapor "Uang belum saya terima" dalam **3 hari**; laporannya pengajuan "Upah bongkaran belum diterima" yang diputuskan Pemilik atau GM (untuk pekerja lepas, Pemilik atau GM mengisikan). Tidak ada akibat uang otomatis. |
| DRV-114 | **Jatuh bayar, pengingat, dan Tanyakan dulu** (B4; jenis: perincian DRV-52). Jatuh bayar = hari laporan Berlaku. Mulai 07.00 keesokan harinya, setiap hari, pengingat berantai ke Finance, Pemilik, dan GM sampai dibayar atau dibatalkan; daftar belum dibayar tanpa batas umur. Pembayar yang ragu boleh menekan **Tanyakan dulu** dengan pertanyaannya: laporan bertanda "Ditanyakan Finance", pembuat menjawab atau mengoreksi. Tanda ini bukan penahan; pengingat tetap berjalan. |
| DRV-115 | **Koreksi dan batal sebelum dibayar** (B6; jenis: perincian DRV-49). Kepala Gudang, Pemilik, atau GM; alasan wajib. Koreksi menyimpan versi lama, menjalankan fungsi "hitung bongkaran" yang sama dengan tarif tanggal kerja, dan menulis ulang baris Buku Upah. Tanggal kerja baru mengikuti batas DRV-36 dihitung dari hari laporan dibuat. **Kepala Gudang juga boleh membatalkan** laporan yang belum dibayar; laporan batal tidak dihidupkan lagi. "Dikoreksi" adalah tanda dan versi, bukan status. |
| DRV-116 | **Koreksi dan batal sesudah dibayar** (jenis: perincian DRV-49). Hanya Pemilik atau GM, alasan wajib, tanpa batas waktu, tidak bisa diberikan ke jabatan lain. Satu fungsi "selisih bongkaran" membandingkan bagian baru dan lama per orang: selisih plus lebih dulu mengurangi sisa lebih bayar orang itu dari laporan yang sama, sisanya menjadi susulan; selisih minus lebih dulu mengurangi susulannya yang masih menunggu, sisanya menjadi lebih bayar. Batal = semua bagian baru Rp0. Pembayaran pertama dan baris Buku Kasnya tidak diubah. |
| DRV-117 | **Bayar susulan** (jenis: perincian DRV-49): lahir otomatis, satu per koreksi per laporan, berisi baris per orang; tampil di daftar belum dibayar dan Jadwal Bayar; dibayar dengan langkah bayar yang sama; satu baris Buku Kas per susulan, bertaut ke laporannya. |
| DRV-118 | **Lebih bayar** (B5; jenis: perincian DRV-49). Satu baris per orang per koreksi; sisanya dihitung, tidak disimpan. Diperhitungkan otomatis saat pembayaran bongkaran berikutnya orang itu, yang paling lama lebih dulu, **sampai habis atau sampai bagiannya Rp0**. Tidak diambil dari slip dan bukan Potongan Lain. Lewat 30 hari masih bersisa: ditandai untuk Pemilik dan GM, yang memutuskan (juga boleh lebih cepat) **Tagih tunai** (Finance mencatat Terima pengembalian sebagai uang masuk yang bertaut ke laporan asal; perhitungan otomatis tetap berjalan) atau **Hapus** dengan alasan (tanpa uang bergerak). |
| DRV-119 | **Batal bayar bongkaran** (jenis: perincian DRV-47, sejalan GAJ-103): untuk pembayaran yang salah catat; hanya Pemilik atau GM, alasan wajib. Satu langkah: pembayaran dan baris Buku Kas dibatalkan, lebih bayar yang diperhitungkan hidup kembali, laporan kembali Berlaku. Ditolak bila laporan itu sudah dikoreksi atau dibatalkan sesudah dibayar. |
| DRV-120 | **Laporan bongkaran per orang dan sisi peserta** (jenis: perincian DRV-53): "Bongkaran per Orang" untuk Pemilik, GM, Finance, dan Kepala Gudang (bukan HR): berapa kali, kg bagian, jumlah bagian, diterima, belum dibayar, sisa lebih bayar; periode bawaan 26–25. Peserta melihat status bayar, diserahkan lewat siapa, koreksi, susulan, dan lebih bayarnya di Pendapatan Saya; tidak ada layar baru. Jumlah bagian selalu sama dengan diterima + diperhitungkan + belum dibayar. |

### 3.21 Perincian Tahap 4G-4a: kasbon, mengajukan sampai uang diberikan

Keputusan pemilik 14 Oktober 2026 (K1 s.d. K7, jawaban "ok" = sesuai saran). Spec: `../work/specs/2026-10-14-gaji-driver-spec.md`
bagian 3.5.

| No | Aturan |
|---|---|
| DRV-121 | **Satu fungsi "periksa kasbon"** (jenis: perincian DRV-55 s.d. 58). Masa kerja = tanggal bergabung ditambah 6 bulan kalender; orangnya aktif dan bukan Freelance. **Terpakai** dihitung satu fungsi, tidak disimpan: pengajuan Menunggu atau Diperiksa sebesar nominal diajukan; disetujui belum diberikan sebesar nominal akhir; sudah diberikan sebesar sisanya; sisa bawaan sistem lama ikut (SIS-28); Kasbon Khusus tidak dihitung. Batas orang dan Dana Kasbon memakai hitungan itu; dananya mengikuti slip utama orang itu **pada hari mengajukan**. Kalimat DRV-56 dipakai bila orangnya punya kasbon bersisa atau pengajuan menunggu; selain itu kalimat DRV-57. Pengaturan dibaca pada hari mengajukan; saat menyetujui tidak diperiksa ulang. **Satu pengajuan kasbon yang menunggu per orang.** |
| DRV-122 | **Nominal kasbon** (K1; jenis: perincian DRV-59): kelipatan **Rp10.000**, paling sedikit **Rp50.000**; keduanya pengaturan. Berlaku juga untuk usulan Finance dan nominal akhir. Batas atas tidak ditampilkan (DRV-56). |
| DRV-123 | **Diisikan atas nama** (jenis: perincian DRV-59): oleh HR, Admin HR, Pemilik, atau GM, **bukan untuk dirinya sendiri**; syaratnya diperiksa fungsi yang sama. Orangnya diberi tahu, melihat "diisi oleh …", dan boleh menariknya; pengisi boleh membatalkan sebelum diputuskan. "Untuk siapa" pada pengajuan sendiri diisi server dari akun yang masuk. |
| DRV-124 | **Pemeriksaan Finance** (K2, K3; jenis: perincian DRV-61 huruf a): Finance mengusulkan nominal lebih kecil dan kali potong 1 s.d. 3 dengan catatan, lalu **Sudah diperiksa**. Finance **tidak menolak dan tidak menyetujui**; usulannya tidak tampil ke karyawan. **Finance tidak memeriksa pengajuannya sendiri.** **Pemilik atau GM boleh memutuskan tanpa menunggu pemeriksaan**; kasbonnya bertanda "tanpa pemeriksaan Finance" dan Finance diberi tahu. Finance tidak melihat gaji atau slip pengaju (PRI-24). |
| DRV-125 | **Keputusan** (jenis: perincian DRV-61 huruf b, 62): nominal akhir paling banyak sebesar yang **diajukan** (boleh kembali ke angka pengaju walau Finance mengusulkan lebih kecil); kali potong 1 s.d. 3; mengubah dari angka pengaju wajib catatan yang dibaca pengaju. Satu langkah: status, nominal akhir, kali potong akhir, dan baris cicilan (dibagi rata, sisa di cicilan terakhir, DRV-65). **Slip tujuan cicilan baru dipasang saat uang diberikan.** Tidak ada yang menyetujui kasbonnya sendiri: kasbon GM diputuskan Owner dan sebaliknya. Ditolak: pengaju boleh Ajukan ulang, syarat diperiksa lagi. |
| DRV-126 | **Langkah serah uang** (K3, K4; jenis: perincian DRV-63, dan **pelapis** atas kalimat "tanggal dari server" di DRV-63, sejalan GAJ-99 dan DRV-112): Finance, Pemilik, atau GM; nominal = nominal akhir, penuh, tidak diketik; tempat uang wajib; satu baris Buku Kas berkejadian "Kasbon diberikan", bukan biaya. **Tanggal uang** boleh mundur sampai 7 hari (lebih jauh dengan alasan), tidak sebelum tanggal disetujui dan tidak masa depan; jam catat dari server. **Penyerah bukan penerima kasbon itu**; Pemilik dan GM tetap boleh, tercatat dan diberitahukan ke para pemilik. Catatan Cepat "Kasbon" dipasangkan bila nominalnya sama persis (KEU-18); bila tanggalnya sebelum disetujui, diterima dan bertanda "uang keluar sebelum disetujui". Catatan Cepat "Kasbon" tanpa kasbon yang cocok tidak menjadi kasbon dengan sendirinya (KEU-32). Dipakai juga oleh Kasbon Khusus (DRV-76). |
| DRV-127 | **Diserahkan kepada siapa, dan "Uang belum saya terima"** (K5; jenis: perincian DRV-63, 78, sejalan DRV-113): penyerah memilih langsung ke orangnya atau dititipkan lewat satu nama. Orangnya diberi tahu dan boleh melapor "Uang belum saya terima" dalam **3 hari**; laporannya pengajuan "Uang kasbon belum diterima" yang diputuskan Pemilik atau GM. Tidak ada akibat uang otomatis. |
| DRV-128 | **Batal serah uang** (K6; jenis: **perincian** DRV-72, sejalan GAJ-103 dan DRV-119): untuk **catatan penyerahan yang salah** (salah tempat uang, salah tanggal, tertandai padahal uang belum diberikan). Hanya Pemilik atau GM, alasan wajib, selama belum ada cicilan kasbon itu yang terpotong, dilunasi, atau dihapus. Satu langkah: penyerahan dan baris Buku Kas dibatalkan, slip tujuan cicilan dilepas, kasbon kembali "disetujui, belum diberikan". Kasbonnya sendiri tidak dibatalkan; kalimat "setelah diberikan tidak dibatalkan" di DRV-72 tetap berlaku untuk kasbon yang uangnya benar-benar sudah diterima. |
| DRV-129 | **Menarik dan membatalkan sebelum uang diberikan** (jenis: perincian DRV-72): selama Menunggu atau Diperiksa, pengaju atau pengisinya membatalkan sendiri. Sesudah disetujui, pengaju menekan **Minta dibatalkan**; selama permintaan menunggu, serah uang ditolak server; Pemilik atau GM memutuskan. Pemilik atau GM juga boleh membatalkan tanpa diminta, dengan alasan. Kasbon batal tidak dihidupkan lagi, cicilannya ikut batal, dan yang terpakai di batas dan dana lepas. |
| DRV-130 | **Tanda 2 hari dan pengingat** (K7; jenis: perincian DRV-64, dan **pengecualian** atas KEU-56 huruf a khusus tanda kasbon): lewat 48 jam sejak diajukan belum diputuskan, kasbon bertanda "Lewat 2 hari" di perlu perhatian Finance, Pemilik, dan GM. Dihitung **hari kalender**; libur Finance tidak menunda tanda, karena Pemilik atau GM bisa bertindak sendiri (DRV-124, 126). Kasbon disetujui yang belum diberikan diingatkan tiap hari mulai 07.00 keesokan harinya kepada Finance, Pemilik, dan GM. Tidak ada yang ditolak, hangus, atau disetujui otomatis. Kasbon menunggu diberikan tidak masuk Jadwal Bayar (DRV-81). |

### 3.22 Perincian Tahap 4G-4b: kasbon, cicilan sampai lunas

Keputusan pemilik 14 Oktober 2026 (C1 s.d. C7, jawaban "ok" = sesuai saran). Ditulis
memakai saran Claude. Spec: `../work/specs/2026-10-14-gaji-driver-spec.md`
bagian 3.6.

| No | Aturan |
|---|---|
| DRV-131 | **Satu fungsi "sisa kasbon" dan catatan berkurang** (jenis: perincian DRV-67, 71). Sisa = nominal diberikan dikurangi mutasi Berlaku: terpotong di slip (termasuk sisa dibawa yang terpotong belakangan), dilunasi tunai, dihapus, dialihkan ke Piutang Lain. Sisa selalu sama dengan cicilan Terjadwal ditambah sisa potongan kasbon yang dibawa; bila tidak, masuk "perlu perhatian" GM. Keadaan **Berjalan, Lunas, Dialihkan** dihitung dari sisa dan mutasi, tidak ada tombolnya, dan kembali Berjalan bila sebabnya dibalik. |
| DRV-132 | **Pasang jadwal** (jenis: perincian DRV-65): cicilan pertama di slip utama periode yang memuat **tanggal uang**; bila slip itu sudah Ditutup, slip utama berikutnya; lalu satu per slip utama berturut-turut. Slip tujuan ditunjuk dengan orang + periode + slip utama. Jadwal **tidak diedit**: tiap perubahan menulis versi baru dan menandai yang lama Diganti; cicilan yang sudah terpotong tidak disentuh. Slip tujuan tidak pernah slip yang sudah Ditutup dan tidak melewati slip terakhir orang yang tanggal berhentinya tercatat. |
| DRV-133 | **Cicilan di slip** (jenis: perincian DRV-66): slip utama membaca cicilan Terjadwal yang tujuannya slip itu, dari semua kasbon orang itu, yang paling lama diberikan lebih dulu, sesudah sisa kasbon yang dibawa (GAJ-75). Saat slip ditutup, fungsi "tandai cicilan" menulis mutasi sebesar yang tertampung (Terpotong atau Sebagian); sisanya menjadi sisa potongan kasbon. Buka kembali slip membalik mutasinya; batal bayar slip tidak menyentuh cicilan. |
| DRV-134 | **Tunda cicilan** (C1; jenis: perincian DRV-68): diminta pemilik kasbon (HR atau Admin HR boleh mengisikan atas nama) dengan alasan, diputuskan Pemilik atau GM yang bukan pemilik kasbon itu, **1 kali per kasbon** (pengaturan). Disetujui: **semua** cicilan Terjadwal bergeser satu slip utama; sisa yang sudah dibawa tidak ikut. Bila slip cicilan terdekat ditutup sebelum diputuskan, permintaan **gugur**, cicilan dipotong biasa, dan jatah tidak terpakai. Ditolak atau gugur tidak memakai jatah. Permintaan menunggu bukan penahan slip. |
| DRV-135 | **Ubah jadwal oleh Pemilik atau GM** (C2; jenis: **pelapis** DRV-68, jalan kantor di samping tunda karyawan): tanpa diminta, alasan wajib, bukan kasbonnya sendiri. Jumlah rupiah tetap sama dengan cicilan Terjadwal; banyaknya cicilan sisa paling banyak 3 untuk kasbon biasa dan 12 untuk Kasbon Khusus; slip mulai belum ditutup dan paling jauh 3 slip utama sesudah slip terbuka terdekat (pengaturan). Tidak memakai jatah tunda. |
| DRV-136 | **Pelunasan tunai** (C3; jenis: perincian DRV-69): dicatat Finance, Pemilik, atau GM; **penerima bukan pemilik kasbon itu** (Pemilik dan GM boleh, tercatat dan diberitahukan). Boleh **sebagian**, lebih dari Rp0 dan paling banyak sebesar sisa. Mengurangi sisa yang dibawa lebih dulu, lalu cicilan terdekat. Tempat uang wajib; tanggal uang boleh mundur 7 hari (dibaca dari pengaturan Gaji), tidak sebelum tanggal diberikan; satu baris Buku Kas uang masuk "Pelunasan kasbon", bukan pendapatan; satu langkah utuh. |
| DRV-137 | **Hapus utang** (C4; jenis: perincian DRV-70): hanya Pemilik atau GM, bukan kasbonnya sendiri, alasan wajib, tidak bisa diberikan ke jabatan lain. Seluruh sisa atau **sebagian**, dengan urutan pengurangan yang sama dengan DRV-136. Tidak ada uang bergerak; Keuangan mencatat biaya "Utang kasbon dihapus" pada tanggal dihapus, cabang orang itu (KEU-25). |
| DRV-138 | **Batal pelunasan dan batal hapus** (jenis: perincian DRV-83, jalan keluar WAJ-11): untuk catatan yang salah; hanya Pemilik atau GM, alasan wajib. Mutasi dibalik, baris Keuangan dibatalkan (bulan tertutup: koreksi bulan berjalan, KEU-112), dan jumlahnya kembali ke cicilan Terjadwal terdekat atau menjadi satu cicilan di slip utama terbuka berikutnya. Ditolak bila kasbonnya sudah Dialihkan ke Piutang Lain. |
| DRV-139 | **Orang berhenti** (C6; jenis: perincian DRV-73, dan **pelapis** atas langkah 1 DRV-121): slip terakhir memuat semua cicilan Terjadwal dan sisa dibawa; yang tidak tertampung dialihkan ke Piutang Lain satu baris jenis kasbon (GAJ-82, KEU-74), kasbonnya Dialihkan. Sejak tanggal berhenti dicatat: pengajuan baru ditolak dengan kalimat terus terang; pengajuan menunggu dan kasbon belum diberikan bertanda "Akan berhenti" untuk Finance, Pemilik, dan GM (tidak batal otomatis); serah uang sesudah hari terakhir bekerja ditolak; tunda ditolak. |
| DRV-140 | **Berganti slip utama** (C5; jenis: perincian DRV-74): cicilan Terjadwal yang slipnya belum ditutup dan periodenya berakhir pada atau sesudah tanggal pindah dipasang ulang; **banyak dan nominalnya tetap**, mulai slip utama baru pertama yang periodenya dimulai pada atau sesudah tanggal pindah. Dijalankan saat perubahan jabatan tersimpan, dibatalkan, atau tanggalnya diubah. Kasbon yang sudah diberikan dihitung di Dana slip utama orang itu pada hari ini; yang belum diberikan tetap di dana saat diajukan sampai diberikan. Sisa dibawa ikut ke slip utama baru. |
| DRV-141 | **Membuat Kasbon Khusus** (C7; jenis: perincian DRV-75, 76): langsung oleh Pemilik atau GM, tanpa Mesin Pengajuan, bukan untuk dirinya; untuk karyawan aktif, bukan Freelance, berslip utama. Isi: jenis kejadian (daftar pengaturan, isi awal Kecelakaan, Sakit, Duka, Lainnya), alasan, nominal kelipatan Rp10.000 tanpa batas atas, kali potong **1 s.d. 12** (pengaturan). Lahir sebagai "Disetujui, belum diberikan"; uangnya lewat langkah serah uang yang sama, boleh langsung ("Buat dan serahkan sekarang"). Para pemilik diberi tahu. |
| DRV-142 | **Kasbon Berjalan, sisi karyawan, dan kasbon bawaan** (jenis: perincian DRV-78, 79, SIS-28): daftar Kasbon Berjalan dan Selesai untuk Pemilik dan GM (dengan sisa kedua dana), Finance dan HR tanpa sisa dana. Karyawan melihat sisa, jadwal per gajian dengan statusnya, mutasi beserta alasan hapus, dan tombol Minta tunda; tanpa angka batas, sisa dana, dan tempat uang. Kasbon bawaan sistem lama adalah kasbon jenis bawaan yang dianggap sudah diberikan pada tanggal tayang tanpa baris Buku Kas, paling banyak 3 kali potong. |

## 4. Yang diganti dari sistem lama

Daftar lengkap aturan sistem lama dan nasibnya ada di arsip. Yang paling mengubah
cara kerja:

| Di sistem lama | Di v3 | Aturan |
|---|---|---|
| Slip driver hanya cetakan sesaat; yang tersimpan status bayar per ritase | Slip mingguan disimpan, tiga tahap | DRV-20 |
| 111 ritase driver dan 107 upah kenek "belum dibayar" tanpa ada yang tahu | Bayar per slip; yang terlambat ditandai | DRV-26, 27 |
| Gaji driver dua baris di Kas Keluar | Satu catatan keuangan per slip | DRV-26 |
| Upah kenek dicatat ke keuangan saat driver-nya lunas | Kenek punya slip sendiri | DRV-20, 21 |
| Driver dan kenek dua salinan (dua status, dua tabel denda, dua tabel potongan) | Satu cara kerja | DRV-21 |
| Tarif tanpa tanggal berlaku; bisa dihapus | Bertanggal berlaku; tidak dihapus | DRV-08, 12 |
| Tarif diubah pemilik, HR, dan finance | Pemilik saja | DRV-13 |
| Ritase bisa dihapus tanpa jejak, termasuk yang sudah dibayar | Dibatalkan pemilik dengan alasan | DRV-15 |
| Ritase kenek Rp0 tidak tampil | Tampil dengan keterangan sebabnya | DRV-17 |
| Orang bergaji bulanan menerima ritase di hari ia absen masuk (86 ritase) | Hanya di hari liburnya | DRV-16 |
| Potongan kasbon dan denda diketik tangan tiap minggu | Slip hanya membaca | DRV-23, 29 |
| Pembayaran ditolak kalau potongan lebih besar dari upah | Sisa potongan dibawa ke minggu berikutnya | DRV-24 |
| Tanggal bayar diketik (sampai bertanggal masa depan); bayar beberapa langkah lepas | Tanggal dari server; satu langkah | DRV-26, 47 |
| Driver tidak melihat denda dan potongannya | Slip utuh di portal | DRV-28 |
| Hitungan minggu Jumat–Kamis ditulis lima kali | Satu tempat di server | DRV-19 |
| Bongkaran dicatat pemilik, HR, atau finance, sampai 13 hari kemudian; kg diketik tanpa bukti | Laporan Bongkaran oleh Kepala Gudang; kg dihitung dari barang; mundur paling lama 3 hari | DRV-31, 35, 36 |
| Bongkaran dibayar lewat Kas Keluar "Bongkar" yang diketik, tanpa penghubung | Hanya lahir dari Laporan Bongkaran | DRV-47, 50 |
| Entri belum dibayar hilang dari layar setelah 9 minggu | Selalu tampil dan ditandai | DRV-52 |
| Entri lunas bisa diedit dan dihapus; tarif diketik per entri; tarif cadangan Rp20 di kode | Tidak dihapus; tarif dari server | DRV-42, 49 |
| Sisa pembagian ke "yang dicentang terakhir"; rumus ditulis dua kali | Urutan abjad; satu rumus | DRV-35, 43 |
| Peserta tidak melihat upahnya; pemilik tidak tahu siapa terima berapa | Portal dan laporan per orang | DRV-53 |
| Pekerja lepas di dua tempat | Satu tempat, status kerja Freelance | DRV-45 |
| Dua sistem kasbon, tiga tabel, pengalihan menurut nama departemen | Satu buku Kasbon | DRV-54 |
| Plafon Rp0 untuk semua; "melebihi limit" hanya tulisan merah | Batas per orang dan Dana Kasbon yang menolak | DRV-56, 57, 58 |
| Kasbon driver = uang diberikan dulu, dicatat saat gajian | Disetujui dulu; yang mendesak lewat Kasbon Khusus | DRV-61, 75 |
| Dianggap cair begitu disahkan; 57 pencairan tanpa sumber dana | Menyerahkan uang langkah tersendiri, sumber dana wajib | DRV-63 |
| Mengesahkan dua langkah lepas; bisa sah tanpa cicilan | Satu langkah, jadwal dibuat server | DRV-62, 65 |
| Cicilan yang tidak terpotong tidak ikut slip berikutnya | Ikut sebagai sisa potongan | DRV-66 |
| Sisa kasbon disimpan sebagai angka; rumus di empat halaman | Selalu dihitung, satu tempat | DRV-67 |
| Tombol "Tandai Lunas" dan hapus tanpa jejak | Lunas lahir sendiri; tidak dihapus | DRV-71, 72 |
| Karyawan bisa mengajukan atas nama orang lain; tidak tercatat siapa yang mengisi | Dijaga server; pengisi tercatat | DRV-59 |
| Pengajuan tidak dijawab sampai 11 hari | Ditandai setelah 2 hari | DRV-64 |
| Jenis penggajian "terlalu banyak dan membingungkan" | Daftar Jenis Upah, tiga jalur bayar, Pendapatan Saya, Jadwal Bayar | DRV-02, 03, 80, 81 |

## 5. Kejadian di lapangan dan jalan keluarnya

| Kejadian | Jalan keluar di v3 | Aturan |
|---|---|---|
| Tarif ritase naik | Baris tarif baru bertanggal; ritase lama tetap nominal lama | DRV-08, 09 |
| Ritase salah catat | Dibatalkan pemilik dengan alasan; kalau slipnya sudah ditutup, koreksi di slip berikutnya | DRV-15 |
| Trip Kamis baru ditutup Jumat siang, slip sudah ditutup | Ritasenya masuk slip minggu berikutnya dengan keterangan tanggal asal | DRV-22 |
| Potongan lebih besar dari upah minggu itu | Bersih Rp0; sisanya dibawa sebagai "sisa potongan" | DRV-24 |
| Slip minggu ini lupa dibayar | Ditandai untuk pemilik; tampil di Jadwal Bayar | DRV-27, 81 |
| Slip mingguan salah dibayar | Pembayaran dibatalkan dengan alasan, lalu dibayar ulang | DRV-22, GAJ-49 |
| Driver merasa upahnya kurang | Melihat slip utuh; keberatan lewat portal | DRV-22, 28 |
| Kenek ikut rute Singaparna | Ritase tampil Rp0 dengan keterangan "rute tanpa upah kenek" | DRV-10, 17 |
| Staf toko ikut jadi kenek di hari kerjanya | Ritase tercatat Rp0, "hari kerja, sudah dibayar gaji" | DRV-16 |
| Staf toko ikut jadi kenek di hari liburnya | Dibayar ritase lewat slip mingguan, utuh tanpa potongan | DRV-05, 16 |
| Driver tidak bisa jalan besok | Lapor ke Kepala Gudang; tidak dicatat di sistem | DRV-18 |
| Driver tidak taat administrasi | Denda dari daftar jenis, disahkan pemilik | DRV-29 |
| Barang bongkaran tidak ada di daftar produk | "Barang lain" dengan alasan, ditandai untuk pemilik | DRV-34 |
| Berat per sak sebuah produk berubah | Diubah Kepala Gudang, tercatat; laporan lama tidak berubah | DRV-33 |
| Bongkaran kemarin belum dicatat | Tanggal kerja boleh mundur 3 hari; lebih dari itu pemilik | DRV-36 |
| Dua bongkaran serupa di hari yang sama | Diminta konfirmasi | DRV-37 |
| Laporan Bongkaran salah, belum dibayar | Dikoreksi Kepala Gudang dengan alasan | DRV-49 |
| Laporan Bongkaran salah, sudah dibayar | Dibatalkan atau dikoreksi pemilik; kurang bayar disusulkan tunai, lebih bayar diperhitungkan di bongkaran berikutnya | DRV-49 |
| Ada orang baru ikut membongkar | Kepala Gudang menambahkannya sebagai pekerja lepas (nama dan HP) | DRV-45 |
| Bongkaran lupa dibayar | Ditandai untuk finance dan pemilik; tidak pernah hilang dari daftar | DRV-52 |
| Karyawan baru 3 bulan mengajukan kasbon | Ditolak dengan kalimat terus terang; yang mendesak menghubungi GM | DRV-55, 75 |
| Kasbon lama belum lunas, mengajukan lagi melewati batas | Ditolak tanpa menyebut angka batas | DRV-56 |
| Dana Kasbon sedang habis | "Silakan coba lagi setelah gajian" | DRV-57 |
| Karyawan berubah pikiran setelah mengajukan | Menarik pengajuannya sebelum disetujui | DRV-72 |
| Sudah disetujui, karyawan tidak jadi mengambil | Dibatalkan pemilik dengan alasan | DRV-72 |
| Uang kasbon belum juga diberikan | Ditandai untuk finance dan pemilik | DRV-64 |
| Gaji bulan ini tidak cukup untuk cicilan | Dipotong sebagian; sisanya ikut slip berikutnya | DRV-66 |
| Karyawan minta cicilan ditunda | Sekali per kasbon, disahkan pemilik | DRV-68 |
| Karyawan mau melunasi lebih cepat | Bayar tunai ke finance | DRV-69 |
| Utang diikhlaskan | Dihapus pemilik dengan alasan, menjadi beban perusahaan | DRV-70 |
| Orang berhenti masih punya kasbon | Ditagih di slip terakhir; sisanya piutang | DRV-73 |
| Staf toko pindah jabatan menjadi driver | Pindah slip utama tanggal 26; kasbon dan jadwal cicilannya ikut | DRV-06, 74 |
| Karyawan kecelakaan, butuh uang besar segera | Kasbon Khusus oleh pemilik | DRV-75 |
| Owner memberi bantuan tanpa perlu dikembalikan | Pemberian; bukan kasbon | DRV-77 |

## 6. Masih terbuka

Delapan butir penetapan (5E.1 arsip) sudah dijawab pemilik 12 Oktober 2026;
jawabannya di 5E.2 arsip. Nomor di bawah tidak diurutkan ulang.

Tidak menghambat bab berikutnya, tetapi harus diputuskan sebelum spec modul ini
ditulis (Tahap 4):

9. ~~Nominal tiap jenis denda~~: **diputuskan 14 Oktober 2026** (S1), Rp10.000
   per kejadian untuk "tidak taat administrasi" (DRV-98). Butir ini selesai.
10. **Bentuk file export produk dari sistem kasir** (DRV-38): kolomnya akan
    disampaikan pemilik. Jangan ditebak dan jangan ditanyakan lagi sampai
    pemilik menyampaikannya.
11. ~~Pemilik daftar supplier~~: **diputuskan 12 Oktober 2026**, milik
    Keuangan (KEU-57). Butir ini selesai.
12. ~~Kapan sambungan purchase order kasir dinyalakan~~: **diputuskan 14
    Oktober 2026** (L6): tanggalnya tidak ditetapkan; pilihan PO muncul
    sendiri saat sambungan PO di Data Kasir dinyalakan (DRV-106). Butir ini
    selesai.
13. ~~Cara bayar slip mingguan~~: **diputuskan 12 Oktober 2026**, sama dengan
    cara bayar gaji (KEU-24). Butir ini selesai.

## 7. Titipan dan catatan

Untuk Bab 1 (Karyawan):

1. Pengaturan jabatan ditambah satu isian: **slip utama** (bulanan atau
   mingguan), DRV-04.
2. Butir terbuka nomor 4 buku Karyawan (Freelance) ditutup oleh DRV-45.
3. Tanggal bergabung sebenarnya dipastikan saat akun v3 dibuat (KAR-53),
   karena menjadi dasar syarat 6 bulan (DRV-55).

Untuk Bab 3 (Gaji):

4. Denda driver dan kenek masuk Dana Disiplin (DRV-30, GAJ-33). Potongan Lain
   dan cicilan kasbon dibaca juga oleh slip mingguan (DRV-23).

Untuk Bab 6 (Keuangan):

5. Bentuk catatan keuangan dari slip mingguan, dari pembayaran bongkaran, dan
   dari kasbon (diberikan, dicicil, dilunasi tunai, dihapus utangnya).
6. Satu kategori pengeluaran bongkaran; pemilik daftar supplier; pengeluaran
   bantuan (pemberian); piutang mantan karyawan.
7. Diperiksa di data lama: apakah laporan keuangan menjumlahkan `driver_wage`
   dan `driver_payout`; pengeluaran dobel "Bongkar" dan "Upah Borongan"; 4
   pencairan kasbon yang kemungkinan tercatat dua kali.

   Butir 5–7 **terjawab** (12 Oktober 2026): bentuk catatan keuangannya di
   KEU-24 dan KEU-25, daftar supplier di KEU-57, Piutang Lain di KEU-74;
   hasil periksa data lama ada di bagian 6A.2 arsip Keuangan.

Untuk modul Tarik Data Kasir:

8. Tempat mengunggah file export produk (DRV-38) dan bentuk sambungan purchase
   order (DRV-39).

Untuk Tahap 3 dan 4:

9. Buku Upah (DRV-01) dan Buku Bonus (GAJ-24) dirancang bersama. Slip bulanan
   dan slip mingguan memakai satu mesin slip (DRV-22).
10. Bagian 5 dijadikan daftar tes (PRI-06). Wajib dites (WAJ-06): nominal
    ritase menurut tanggal, ritase orang bergaji bulanan (DRV-16), urutan
    potongan dan sisa potongan (DRV-24), pembagian bongkaran (DRV-35, 43),
    urutan periksa kasbon (DRV-58), jadwal cicilan (DRV-65), sisa kasbon dan
    sisa dana (DRV-57, 67).
11. Mesin pengaman hak akses wajib mencoba DRV-82: finance tidak bisa membuka
    slip mingguan per orang, Kepala Gudang tidak bisa mengubah tarif, karyawan
    tidak bisa mengajukan kasbon atas nama orang lain, tidak ada yang
    menyetujui kasbonnya sendiri.
12. Pemberitahuan ke finance dan pemilik lewat aplikasi (PRI-25).

Untuk keputusan data lama (WIP, keputusan terbuka 3):

13. 111 ritase driver dan 107 upah kenek berstatus belum dibayar, dan 19 entri
    bongkaran belum dibayar, dipastikan dulu sebelum saldo dipindah.
14. Sisa kasbon yang masih berjalan dipindah sebagai saldo awal. Rp4.661.529
    potongan kasbon di slip lama tanpa catatan kasbon tidak bisa ditelusuri.
15. 4 orang yang punya slip bulanan dan upah ritase ditentukan slip utamanya
    saat akun v3 dibuat.

    Butir 13–15 **terjawab** (13 Oktober 2026) di `00-gambaran-sistem.md`:
    SIS-25 (tidak ada tunggakan upah yang dibawa), SIS-28 (sisa kasbon),
    SIS-24 (slip utama).

## 8. Istilah

Dimasukkan ke `00-kamus-istilah.md`: Gaji Driver, slip mingguan, minggu upah,
Buku Upah, jenis upah, jalur bayar, slip utama, bongkaran, Laporan Bongkaran,
berat per satuan, pekerja lepas, Kasbon, Dana Kasbon, Kasbon Khusus, pemberian.
