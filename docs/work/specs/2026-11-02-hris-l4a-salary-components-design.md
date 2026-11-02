# Spec HRIS L4a — Komponen Gaji

Tanggal: 2026-11-02 · Status: **disetujui owner 2026-11-02 (§9 semua sesuai saran: "8 keputusan ok")**
Cakupan: bagian pertama L4 (Gaji Bulanan), yaitu inti 4E-1 di [PRD 06](../../hris_planning/PRD/fase_1/06-gaji-bulanan.md): Gaji Karyawan, Gaji Seseorang, Ubah Gaji, Jenis Komponen Gaji, Gaji Standar (GAJ-L01 s.d. L05), ditambah usulan ubah gaji lewat Mesin Pengajuan dan Gaji Standar Karyawan otomatis saat promosi Training.
Sumber: v3 `03-gaji` GAJ-02 s.d. 05, 08, 09, 46, 62 s.d. 66; `gaji-bulanan-spec` §1, §3.1 (GAJ-L01 s.d. L05); `01-karyawan` KAR-22, 67, 73, 83.
Dasar kode: L2b (jabatan, hak per jabatan, `ownerOnly`/`selfForbidden`), L2c (karyawan, `work_status`, Promosi Training berlaku awal periode berikutnya), L2e (pengaturan bertanggal + Pengaturan Jabatan), L2f-1 (Mesin Pengajuan, `notify()`, Beranda), L2f-2 (pemilik lain diberi tahu, `announceToOwners`), L3c (`payPeriodOf`, `shiftPeriod`).
Aliran migrasi: **`hris` 0016**. Modul baru: `apps/hris/modules/payroll`.

## 1. Batas

**Dikerjakan:** daftar jenis komponen gaji; gaji tiap orang sebagai paket komponen bertanggal berlaku (selalu tanggal 26) beserta riwayatnya; Ubah Gaji 4 langkah (langsung oleh Pemilik/GM, usulan oleh HR); batalkan perubahan yang belum berlaku; dua paket Gaji Standar (Training dan Karyawan); promosi Training yang disetujui menjadwalkan Gaji Standar Karyawan; tanda "Belum ada gaji"; tab "Gaji" di halaman orang; dua pengaturan jabatan baru (§3.6).

**Tidak dikerjakan di L4a** (pindah ke bagian yang pertama kali memakainya, §9 butir 1):

| Hal (v3 4E-1) | Di mana | Akibat sementara |
|---|---|---|
| Pengaturan Gaji (tarif telat, lembur, pengali tidak hadir, denda, pembagi 26; GAJ-L06) | L4b Hitungan Kehadiran (4E-2) | Gaji harian di layar memakai pembagi 26 yang ditulis sebagai pengaturan `payroll.daily_divisor` (satu-satunya angka gaji di L4a) |
| Aturan Potongan (GAJ-L07) | L4b (kartunya baru berisi bila rumusnya ada) | Belum ada menu Panduan |
| Periode Gaji + mesin periode (GAJ-L08) | L4 halaman periode & slip (4E-5a) | Periode dibaca dengan `payPeriodOf` (26–25) yang sudah dipakai Kehadiran |
| Buku Upah + tab "Upah" | L7 Gaji Driver (barisnya baru lahir dari ritase/bongkaran) | Tab tidak ditampilkan |
| Gaji Saya / Pendapatan Saya (karyawan melihat gajinya sendiri) | 4E-5c | Pemberitahuan "gaji berubah" tanpa nominal dan tanpa tautan (§9 butir 8) |
| Kunci slip tertutup (periode yang slipnya sudah ditutup tidak bisa dipilih) | 4E-5a | Belum ada slip yang ditutup; semua periode berjalan/depan boleh dipilih sesuai §3.3 |

## 2. Data (`hris` 0016)

Tidak ada yang dihapus (PRI-02); pembatalan dan perubahan selalu baris baru atau tanda.

| Tabel | Isi |
|---|---|
| `salary_component_types` | id, nama, urutan tampil, aktif, dibuat/diubah oleh-kapan. Isi awal: Gaji Pokok (1), Tunjangan Jabatan (2), Tunjangan Tetap (3) |
| `salary_component_type_names` | riwayat nama (jenis, nama lama → baru, oleh, kapan); slip yang ditutup kelak menyimpan nama saat ditutup (GAJ-39) |
| `salary_changes` | satu baris = **paket lengkap** gaji seseorang mulai satu tanggal 26 (GAJ-63): karyawan, `effective_from` (tanggal 26), asal (`DIRECT` / `PROPOSAL` / `STANDARD_PROMOTION`), alasan, dibuat oleh, disetujui oleh, id pengajuan (bila usulan), dibatalkan oleh/kapan/alasan |
| `salary_change_lines` | isi paket: perubahan, jenis komponen, nominal (rupiah bulat > 0). Satu jenis paling banyak satu baris per paket |
| `salary_standards` | paket acuan: macam (`TRAINING` / `EMPLOYEE`), `effective_from`, alasan, oleh, kapan, dibatalkan |
| `salary_standard_lines` | isi paket acuan: jenis komponen, nominal |
| `salary_change_proposals` | isi khas pengajuan "Usulan ubah gaji" (pola `identity_change`): id pengajuan, karyawan, `effective_from`, isi paket (JSON baris), alasan. Status di `hris.requests` |

Aturan baca: gaji seseorang pada tanggal X = paket `salary_changes` **tidak dibatalkan** dengan `effective_from` terbesar yang ≤ X. Tidak ada paket = "Belum ada gaji". Pagar DB: `effective_from` harus tanggal 26; satu paket berlaku per orang per tanggal (indeks unik sebagian `WHERE cancelled_at IS NULL`).

## 3. Aturan

### 3.1 Gaji tetap dan gaji harian (GAJ-03, 05, 65)
- Semua komponen diperlakukan sama: **dijumlah** menjadi gaji tetap sebulan. Tidak ada tanda per komponen.
- Gaji harian = gaji tetap ÷ `payroll.daily_divisor` (awal 26). Di layar tampil dua angka di belakang koma **hanya sebagai keterangan**; tidak dibulatkan lebih dulu (GAJ-07). Rumusnya satu fungsi `monthlyTotal()` / `dailyRate()` di `modules/payroll/rules`, dipakai lagi oleh slip di L4b.

### 3.2 Siapa punya gaji bulanan (GAJ-02, DRV-04)
- Tampil di Gaji Karyawan: orang **aktif** (atau berhenti di periode berjalan) yang jabatannya ber-`position.pay_basis = MONTHLY` (§3.6).
- Training dan Pemilik/GM termasuk (GAJ-02, KAR-59). Pekerja lepas tidak.
- Tanda kuning **"Belum ada gaji"**: orang di atas tanpa paket berlaku di periode berjalan. Ikut tampil di "Perlu perhatian" Beranda untuk yang berhak melihat gaji (§5).

### 3.3 Tanggal berlaku (GAJ-04, 63)
- Pilihan hanya tanggal 26: periode berjalan dan **3 periode depan**. Tidak ada kotak tanggal bebas.
- **Kenaikan** (jumlah baru > jumlah yang berlaku di tanggal itu) boleh untuk periode berjalan. **Penurunan** hanya periode depan. Sama jumlah tetapi isi berbeda (mis. pindah nominal antar-komponen) diperlakukan seperti kenaikan.
- Orang yang **belum ada gaji** boleh diisi untuk periode berjalan (pengisian pertama bukan penurunan).
- Periode yang slipnya sudah ditutup ditolak — baru berlaku sesudah slip ada (4E-5a); kodenya sudah memanggil satu pemeriksa `isPeriodLocked()` yang di L4a selalu "tidak".
- Satu paket per orang per tanggal: menyimpan paket baru di tanggal yang sudah berisi paket terjadwal **menggantikannya** (yang lama ditandai dibatalkan dengan alasan "diganti"), hanya selama tanggalnya belum lewat atau periodenya masih berjalan.

### 3.4 Siapa mengubah (GAJ-62, KAR-67, 73, 83)
- **Pemilik/GM:** langsung terjadwal; pemilik lain diberi tahu (`announceToOwners`, tanpa nominal).
- **HR:** hanya **mengusulkan** (jenis pengajuan baru `salary_change`, "Usulan ubah gaji"); Pemilik/GM memutuskan di Persetujuan. Satu usulan menunggu per orang per tanggal. Pengusul bisa **Tarik usulan**.
- **Usulan hangus** bila belum diputuskan sampai akhir periode tanggal berlakunya + 4 hari (hari ke-4 sesudah tanggal 25 = perkiraan batas tutup slip v3, GAJ-41). Bila disetujui sesudah periodenya lewat padahal itu periode berjalan saat diajukan, tetap berlaku (slip belum ada).
- Tidak ada yang memutuskan usulan untuk dirinya sendiri. **GM boleh mengubah gajinya sendiri** langsung (GAJ-62); para pemilik diberi tahu. Pemilik tidak bisa mengubah gaji dirinya sendiri (hanya Pemilik lain atau GM).
- Gaji orang yang jabatannya ber-`position.salary_owner_only = YES` hanya dilihat dan diubah Pemilik/GM (§5).

### 3.5 Gaji Standar (GAJ-64, KAR-22)
- Dua paket: **Gaji Standar Training** dan **Gaji Standar Karyawan**, bertanggal berlaku (tanggal 26, boleh periode berjalan), tidak per jabatan. Mengubahnya **tidak mengubah gaji siapa pun**; layar periksa menyebut "Gaji N orang yang sudah ada tidak ikut berubah."
- Dipakai sebagai isian awal yang masih bisa diubah di Ubah Gaji: tombol **Isi dari Gaji Standar Training/Karyawan** (sesuai status kerja) untuk orang "Belum ada gaji", dan **Terapkan Gaji Standar** di Gaji Seseorang.
- **Promosi Training disetujui** → server langsung menjadwalkan paket baru di tanggal promosinya berlaku (awal periode berikutnya, sudah dihitung L2c): komponen yang ada di paket Karyawan diganti nominal paket; komponen lain dibawa. Asal `STANDARD_PROMOTION`, tanpa usulan terpisah. Bila paket Karyawan kosong atau orangnya belum ada gaji → tidak ada yang dijadwalkan, orangnya muncul "Belum ada gaji"/tetap dengan gaji lama dan HR diberi tahu.

### 3.6 Pengaturan jabatan baru (didaftarkan di registry, isi awal di migrasi; §9 butir 2 dan 3)
| Kunci | Isi | Isi awal |
|---|---|---|
| `position.pay_basis` | Bulanan / Mingguan (per ritase) | Driver dan Kenek = Mingguan; lainnya Bulanan |
| `position.salary_owner_only` | Gaji hanya terlihat Pemilik dan GM: Ya / Tidak | Pemilik dan GM = Ya; lainnya Tidak |
| `payroll.daily_divisor` (umum) | Pembagi gaji harian | 26 (hanya mulai tanggal 26, `startDay: 26`) |

Ketiganya `affectsMoney`, diubah lewat Pengaturan Jabatan/Pengaturan yang sudah ada (Pemilik/GM langsung, HR mengusulkan).

### 3.7 Jenis komponen (GAJ-65)
- Hanya Pemilik/GM menambah, mengganti nama, mengubah urutan, menonaktifkan. HR melihat.
- Nonaktifkan **ditolak** selama ada paket berlaku atau terjadwal yang memakainya; pesannya menyebut nama orangnya (atau "N orang" bagi HR bila sebagian bertanda `salary_owner_only`).
- Nama unik (tanpa beda huruf besar/kecil).

## 4. Layar

| Layar | Alamat | Menu |
|---|---|---|
| Gaji Karyawan (GAJ-L01) | `/gaji` | **Kantor › Gaji Karyawan** (baru) |
| Gaji Seseorang (GAJ-L02) | `/gaji/[employeeId]` + tab "Gaji" di `/karyawan/[id]` | dari Gaji Karyawan |
| Ubah Gaji 4 langkah (GAJ-L03) | `/gaji/[employeeId]/ubah` (`?standar=1` terisi dari paket) | dari Gaji Seseorang |
| Jenis Komponen Gaji (GAJ-L04) | `/pengaturan/komponen-gaji` | Pengaturan |
| Gaji Standar (GAJ-L05) | `/pengaturan/gaji-standar` | Pengaturan |
| Putuskan usulan ubah gaji | isi khas di `/persetujuan/[id]` | Persetujuan |

- **Gaji Karyawan:** nama, jabatan, cabang, status kerja, gaji tetap sebulan, gaji harian (keterangan), berlaku sejak, perubahan terjadwal (nominal baru + tanggal). Saring: cabang, jabatan, status kerja, "Belum ada gaji", "Ada usulan menunggu". Cari nama. Per halaman.
- **Gaji Seseorang:** kepala (nama, jabatan, cabang, status kerja); tab **Gaji sekarang** (komponen, jumlah, gaji harian; perubahan terjadwal + **Batalkan perubahan** dengan alasan, hanya sebelum berlaku); tab **Riwayat** (kartu per paket terbaru di atas: berlaku dari, isi, alasan, pengusul, penyetuju, kapan, dibatalkan). Kotak kuning bila ada usulan menunggu, dengan **Tarik usulan** untuk pengusulnya.
- **Ubah Gaji** (TAM-07): 1. mulai berlaku (pilihan tanggal 26 sesuai §3.3) · 2. isi komponen (ubah nominal, hentikan ×, tambah dari jenis aktif; jumlah dan gaji harian dihitung server) · 3. alasan (pengaturan `shared.reason_min_length`) · 4. periksa: sebelum → sesudah per komponen, jumlah lama → baru, selisih; penurunan = kotak merah; tombol Simpan ditahan (`shared.hold_seconds_consequential`).
- Pesan berhasil: "Gaji Rina mulai 26 November 2026 menjadi Rp2.900.000. Rina diberi tahu." / "Usulan terkirim. Menunggu Pemilik atau GM."
- Semua rupiah berpemisah ribuan; error di jendela "OK, paham"; tanda **Baru** untuk ketiga menu.

## 5. Hak

Tindakan baru + hak awal di migrasi. Pemilik dan GM memiliki semuanya (KAR-67). **Dijaga di server**: orang ber-`salary_owner_only` tidak dikirim sama sekali ke yang bukan Pemilik/GM (bukan baris kosong).

| Tindakan | HR | Admin HR | Finance | Lainnya |
|---|---|---|---|---|
| `salary.view` (Gaji Karyawan, Gaji Seseorang, tab Gaji, kartu Belum ada gaji) | ✓ (tanpa jabatan bertanda) | — | — | — |
| `salary.propose` (Ubah Gaji sebagai usulan, Tarik usulan) · selfForbidden | ✓ | — | — | — |
| `salary.change` (langsung, Batalkan perubahan, putuskan usulan) · ownerOnly | — | — | — | Pemilik, GM |
| `salary_components.manage` · ownerOnly | — (melihat lewat `salary.view`) | — | — | Pemilik, GM |
| `salary_standard.manage` · ownerOnly | — (melihat lewat `salary.view`) | — | — | Pemilik, GM |

Admin HR dan Finance tidak menerima nominal per orang dari server (GAJ-46); ringkasan total untuk Finance menyusul di 4E-5b.

Penolakan server yang dites: HR melihat/mengubah gaji jabatan bertanda; HR mengubah langsung (bukan usulan); HR mengusulkan untuk dirinya sendiri; Pemilik mengubah gajinya sendiri; Pemilik memutuskan usulan untuk dirinya; penurunan di periode berjalan; tanggal bukan 26 atau lebih dari 3 periode depan; dua usulan menunggu untuk orang + tanggal yang sama; jenis nonaktif; nominal 0/minus/pecahan; jenis ganda dalam satu paket; batalkan paket yang sudah berlaku; nonaktifkan jenis yang dipakai; Admin HR/Finance membuka `/gaji`.

## 6. Mesin terjadwal

- Tidak ada mesin baru untuk perubahan gaji: paket berlaku dibaca menurut tanggal (§2), jadi tidak ada yang perlu "dijalankan" tanggal 26.
- Satu mesin kecil `salary-proposal-expire` (harian 04.40, pola penghangus klaim lembur L3h): usulan `salary_change` yang lewat batas §3.4 menjadi **Hangus** (status `EXPIRED` yang sudah ada di Mesin Pengajuan; jenisnya ber-`deadline: RULES`). Baris baru di crontab + `jobs.ts`.

## 7. Pemberitahuan

| Kapan | Ke siapa | Isi (tanpa nominal) |
|---|---|---|
| Perubahan terjadwal (langsung, usulan disetujui, promosi) | orangnya | "Gaji Anda berubah mulai 26 November 2026." |
| Pemilik/GM mengubah langsung, GM mengubah gajinya sendiri | pemilik lain | "Elan mengubah gaji Rina mulai 26 November 2026." |
| Usulan dikirim | Pemilik, GM | lewat Persetujuan (angka di kotak) |
| Usulan disetujui / ditolak / hangus | pengusul (HR) | sesuai Mesin Pengajuan |
| Perubahan dibatalkan | orangnya, pengusul | "Perubahan gaji mulai … dibatalkan." |
| Promosi tanpa Gaji Standar Karyawan | HR | "Rina naik menjadi Karyawan, tetapi Gaji Standar Karyawan belum diisi." |

Perubahan gaji perorangan tidak diumumkan di Papan (GAJ-63).

## 8. Tes

- Unit (`modules/payroll/rules`): jumlah dan gaji harian; pilihan tanggal (berjalan/3 depan, hanya 26); kenaikan vs penurunan vs isi pertama; paket aktif pada tanggal X (termasuk dibatalkan dan diganti); terapan Gaji Standar promosi (komponen dibawa); batas hangus usulan.
- Integrasi DB (tanggal lampau): ubah langsung + pemberitahuan; usulan → setujui/tolak/tarik/hangus; batalkan sebelum berlaku; ganti paket di tanggal yang sama; promosi Training menjadwalkan paket; pagar `salary_owner_only` di daftar, halaman, dan API; nonaktifkan jenis dipakai ditolak; pagar DB tanggal 26 + unik.
- Registry: tiga pengaturan baru terdaftar; tiap jenis pengajuan punya handler; `APPROVAL_ACTIONS` memuat `salary.change`.

## 9. Keputusan owner (disetujui 2026-11-02: semua sesuai saran)

1. **Lingkup L4a.** v3 menaruh Pengaturan Gaji, Aturan Potongan, Periode Gaji, dan Buku Upah di 4E-1, padahal angkanya baru dipakai di bagian sesudahnya. **Saran: L4a hanya komponen gaji (5 layar di §4)**; empat hal itu ikut bagian yang memakainya (§1), supaya yang diuji Anda memang bisa dipakai.
2. **Siapa bergaji bulanan.** **Saran: pengaturan jabatan baru "Dasar gaji"**, isi awal Driver dan Kenek = Mingguan (per ritase, L7), semua jabatan lain = Bulanan. Kalau ada Driver/Kenek yang sekarang digaji bulanan, sebutkan.
3. **Gaji yang hanya terlihat Pemilik dan GM.** **Saran: pengaturan jabatan baru, isi awal Ya untuk Pemilik dan GM saja.** HR tidak melihat orangnya sama sekali di layar gaji.
4. **Nominal awal Gaji Standar Training dan Karyawan.** **Saran: kosong saat tayang, Anda isi sendiri di layar Gaji Standar** (sekaligus menjadi uji). Atau sebutkan angkanya dan komponennya, saya tanam di migrasi.
5. **Kenaikan di periode berjalan.** v3: kenaikan boleh untuk periode berjalan selama slip belum ditutup; penurunan hanya periode depan. **Saran: ikut v3**; karena slip belum ada, semua kenaikan untuk periode 26 Okt – 25 Nov masih boleh.
6. **Paling jauh ke depan.** v3 tidak menyebut batas. **Saran: periode berjalan + 3 periode depan.**
7. **Batas waktu usulan HR.** v3: hangus di batas tutup slip periode yang dipilih. **Saran: hangus hari ke-4 sesudah periode itu berakhir (tanggal 29)**, nanti disambungkan ke batas tutup slip sungguhan di 4E-5a.
8. **Karyawan melihat gajinya sendiri.** Pendapatan Saya baru di 4E-5c. **Saran: di L4a karyawan hanya menerima pemberitahuan "Gaji Anda berubah mulai …" tanpa nominal**; layar Gaji Saya tidak dibuat dulu.

## 10. Catatan implementasi

- **Orang yang diajukan di Mesin Pengajuan = pengusul (HR)**, bukan orang yang gajinya diusulkan, supaya orangnya tidak melihat usulan di Pengajuan Saya. Sasarannya disimpan di `salary_change_proposals` beserta pengusul dan **keadaan** (OPEN/APPROVED/CLOSED), sehingga modul Gaji tidak membaca tabel pengajuan langsung (pagar batas modul).
- **Hangus otomatis**: Mesin Pengajuan mendapat `expireRequest`. Mesin tidak punya akun, jadi riwayatnya tercatat atas nama pengusul dengan alasan berawalan "Otomatis:"; pengusul diberi tahu. Mesin `salary-proposal-expire` 04.40 WIB.
- **`salary.propose` tidak bertanda selfForbidden**, karena Mesin Pengajuan memeriksa tindakan mengajukan terhadap diri pengaju; larangan mengusulkan gaji sendiri diperiksa di handler.
- **Pembagi gaji harian** diubah langsung oleh Pemilik/GM (`settings.manage`), tidak lewat usulan HR: mekanisme usulan pengaturan baru ada untuk Pengaturan Jabatan. `position.salary_owner_only` hanya terlihat dan diubah Pemilik/GM.
- **Tab "Gaji" di halaman orang** dibuat sebagai kartu ringkas + tautan ke Gaji Seseorang.
- **Pemilik vs GM** dibedakan lewat nama jabatan (pola L3d). Pemilik tidak bisa mengubah gajinya sendiri; GM bisa.
- **Uang**: L4a hanya menjumlah rupiah bulat (integer, pasti tepat); gaji harian hanya keterangan. big.js belum ditambahkan ke HRIS; dipakai saat rumus slip berpecahan (L4b).
- **Jenis Komponen**: kolom "Dipakai" berupa jumlah orang; nama orang hanya muncul di pesan tolak nonaktifkan (untuk Pemilik/GM).
- **Promosi Training**: `decidePromotion` menerima kait `onApproved` (dirangkai di route), supaya modul Karyawan tidak mengimpor modul Gaji.
- **Tes**: unit 14 (`rules/salary.test.ts`), integrasi DB 11 (`payroll.integration.test.ts`): ubah langsung + pemberitahuan tanpa nominal, penurunan/tanggal, ganti paket di tanggal sama, batal, usulan HR → setujui, pagar gaji Pemilik/GM, Pemilik/GM atas diri sendiri, Driver mingguan, nonaktif jenis dipakai, promosi, hangus, pagar DB. Belum diuji orang di layar.
