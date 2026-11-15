# Gambaran Sistem

Sistemnya apa, untuk siapa, apa yang termasuk dan tidak, bagaimana tayangnya,
data lama diapakan, dan memakai alat apa. Nomor aturan: SIS.

Ditulis bagian demi bagian (Tahap 1 peta jalan):

| Bagian | Isi | Status |
|---|---|---|
| 1A | Batas sistem (bab 1 s.d. 6) | **Ditetapkan** 13 Oktober 2026 |
| 1B | Rencana tayang (bab 7) | **Ditetapkan** 13 Oktober 2026 |
| 1C | Data lama (bab 8) | **Ditetapkan** 13 Oktober 2026 |
| 1D | Alat dan server (bab 9) | **Ditetapkan** 13 Oktober 2026 |

## 1. Sistem ini apa dan untuk siapa

| No | Aturan |
|---|---|
| SIS-01 | HRIS Hammielion v3 adalah sistem untuk mengurus **orang dan uang di dalam perusahaan**: karyawan, kehadiran, gaji, pengiriman, upah driver dan bongkaran, kasbon, keuangan, dan kinerja. Ia **bukan** sistem jual beli; jual beli tetap di sistem kasir (SIS-07). |
| SIS-02 | Pemakainya **Hammielion saja**, satu perusahaan. Sistem dirancang "siap dijual, belum dijual" (PRI-31), tetapi tidak ada fitur untuk perusahaan lain di v3. |
| SIS-03 | Bahasa Indonesia sederhana di semua layar. Karyawan toko, driver, dan kenek memakai **handphone**; orang kantor memakai PC dan handphone. Semua layar harus bisa dipakai di handphone (TAM-12). |

## 2. Yang termasuk v3

| No | Aturan |
|---|---|
| SIS-04 | **Tujuh modul**, masing-masing dengan buku aturannya: Karyawan dan Akses (KAR), Kehadiran (KEH), Gaji Bulanan (GAJ), Logistik (LOG), Gaji Driver–Bongkaran–Kasbon (DRV), Keuangan (KEU), Kinerja (KIN). Portal karyawan bukan modul; ia tampilan yang membaca ketujuhnya. |
| SIS-05 | **Perlengkapan bersama** yang ikut dibangun: pintu Tarik Data Kasir (satu arah, HRIS hanya mengambil); tempat uji dengan akun contoh per jabatan dan "Lihat sebagai" (KAR-52); mesin pengaman hak akses dan error (WAJ-06, KAR-63); Papan Perubahan Aturan (PRI-29); layar Kesehatan Mesin (PRI-33). |
| SIS-06 | **Satu menu "Panduan"** untuk karyawan: Panduan Karyawan (halaman baca sederhana, dibawa dari sistem lama), Papan Perubahan Aturan, dan Pedoman Lapor (KAR-57). Tujuannya karyawan hanya punya satu tempat mencari "aturannya bagaimana". |

## 3. Yang bukan urusan HRIS

| No | Aturan |
|---|---|
| SIS-07 | **Sistem kasir tetap sistem tersendiri** dan tidak digabung ke v3. Miliknya: stok dan nilainya, penjualan, piutang toko dan pelunasannya, nota belanja ke supplier, purchase order, dan identitas toko (LOG-65, KEU-58, 72, 97). HRIS hanya membaca lewat Tarik Data Kasir dan tidak pernah menulis ke sana. |

## 4. Yang sengaja tidak masuk v3

Dikerjakan setelah v3 jadi, sebagai fitur tambahan. Tidak dirancang dan tidak
dibangun sekarang.

| No | Hal | Dasar |
|---|---|---|
| SIS-08 | Rekrutmen | `../work/backlog/2026-10-12-rekrutmen-ditangguhkan.md` |
| | Posisi driver di peta | `../work/backlog/2026-10-12-posisi-driver-di-peta.md` |
| | Pengenalan wajah saat absen | `../work/backlog/2026-10-11-absen-qr-dan-titik-lokasi.md` |
| | Bonus Kinerja, Ranking Disiplin, Tabungan Loyalitas | GAJ-31, GAJ-32, KIN-18 |
| | Laporan untuk pajak, akuntan, dan bank | `../work/backlog/2026-10-12-laporan-pajak.md` |
| | Menjual aplikasi: pendaftaran perusahaan, tagihan, paket harga | PRI-31 |
| | WhatsApp otomatis | PRI-25 |
| | Mesin fingerprint (dibuang, bukan ditunda) | absen memakai QR |

## 5. Disiapkan sejak awal, dinyalakan belakangan

| No | Aturan |
|---|---|
| SIS-09 | Tempatnya dibuat sejak modulnya dibangun, supaya kelak tinggal dinyalakan tanpa membongkar: sambungan otomatis ke kasir untuk surat jalan (LOG), purchase order (DRV-39), setoran per shift dan uraian QRIS (KEU), nilai stok (KEU-97), target omzet di rapor (KIN), serta jasa grooming dan baris ongkir beserta pengantarnya (GAJ-61, LOG-76; tahap awal diunggah dari laporan kasir); serta notifikasi ke handphone (PRI-25). Pada tahap awal datanya diketik atau diunggah. Kapan dinyalakan ditentukan pemilik. |

## 6. Kapan disebut selesai, dan daftar isi dikunci

| No | Aturan |
|---|---|
| SIS-10 | Sebuah modul disebut **selesai** kalau tiga syarat terpenuhi: (1) lulus semua tes mesin; (2) sudah dicoba pemilik sendiri di tempat uji; (3) sudah diuji banding dengan sistem lama dan hasilnya cocok (SIS-14, 15; untuk Kinerja SIS-21). **v3 selesai** saat semua modul pindah (SIS-12) dan sistem lama ditutup; sistem lama baru dimatikan setelah Rekrutmen dibangun (SIS-22). |
| SIS-11 | **Daftar isi v3 dikunci sejak 13 Oktober 2026.** Hal baru di luar bab 2 dicatat di backlog untuk dikerjakan setelah v3 jadi, tidak diselipkan di tengah. Yang boleh mengubah daftar ini hanya pemilik, dengan menyebut apa yang ditambah dan apa akibatnya ke jadwal. |

*Kenapa SIS-11:* perubahan di tengah pembangunan adalah sumber tumpang tindih di
sistem lama (peta jalan, "Kenapa urutannya begini").

## 7. Rencana tayang

Ditetapkan 13 Oktober 2026 dari jawaban pemilik (catatan di akhir file).

| No | Aturan |
|---|---|
| SIS-12 | **Pindah resmi satu kali** untuk ketujuh modul. "Pindah per modul" (peta jalan Tahap 6 butir 4) **dibatalkan** pemilik; jenis: pengganti. |
| SIS-13 | **Hari pindah = hari mulai (KEU-08), selalu sebuah tanggal 26** (awal periode). Upah mingguan pindah pada Jumat terdekat. Tidak ada periode yang dihitung separuh di sistem lama dan separuh di v3. **Bulannya tidak dikejar:** pindah dilakukan ketika semuanya benar-benar sudah pas (SIS-10), lalu dipilih tanggal 26 berikutnya. |
| SIS-14 | **Tidak ada kerja dobel.** Karyawan, driver, dan orang kantor tidak pernah mengisi dua sistem. Sebagai gantinya dilakukan **uji banding**: data sistem lama dari satu periode yang sudah tutup (absen, perjalanan, dan seterusnya) disalin ke tempat uji v3, v3 menghitung, lalu hasilnya dibandingkan dengan hasil sistem lama. Sistem lama hanya dibaca (WAJ-09). Yang tidak bisa diuji dengan data salinan (absen QR dengan titik lokasi, laporan driver di jalan) dicoba pemilik di tempat uji memakai handphone sungguhan. |
| SIS-15 | **Arti "cocok".** Aturan v3 sengaja berbeda dari sistem lama, jadi angka tidak harus sama. Tiap selisih harus masuk **daftar beda yang disengaja** (dengan nomor aturannya) atau diperbaiki. Daftar itu **hanya dilihat GM dan Owner**, dan hanya mereka yang menyatakan cocok. |
| SIS-16 | **Ukuran uji banding** per modul: yang bulanan (Karyawan, Kehadiran, Gaji Bulanan) satu periode 26–25; Logistik dan Gaji Driver–Bongkaran–Kasbon dua minggu upah; Keuangan satu bulan. Kalau belum cocok, diperbaiki dan diulang paling banyak sekali, lalu pemilik memutuskan. Sebelum pindah ada satu **gladi bersih**: satu periode data dijalankan lewat semua modul sekaligus. |
| SIS-17 | Sampai hari pindah, **yang resmi sistem lama**: gaji dan upah dibayar dari sana. v3 hanya pembanding. |
| SIS-18 | **Aturan uang yang baru berlaku sejak periode pertama v3 resmi** (WAJ-07), dan diumumkan ke karyawan paling lambat 7 hari sebelum hari pindah. |
| SIS-19 | **Daftar ulang akun (KAR-53) dilakukan sebelum hari pindah**, supaya pada hari pindah semua orang sudah disetujui HR dan langsung bisa absen. |
| SIS-20 | **Jalan mundur** (WAJ-11). Setelah pindah, sistem lama ditutup untuk diisi tetapi tetap bisa dilihat. Kalau pada periode pertama ada masalah besar, pemilik boleh memutuskan kembali ke sistem lama. Menutup sistem lama adalah **satu-satunya pengecualian WAJ-09**, dikerjakan dengan izin pemilik pada saat itu. **Urutan menutupnya di SIS-27** (pelapis, 13 Oktober 2026): pada hari pindah hanya kejadian baru yang ditolak; urusan periode terakhir diselesaikan dulu di sana. |
| SIS-21 | **Kinerja tidak punya pembanding** (KPI sistem lama belum pernah menghasilkan angka). Syarat ketiga SIS-10 untuk Kinerja diganti satu periode percobaan yang hasilnya diperiksa pemilik sebelum dipakai untuk bonus. |
| SIS-22 | **Halaman lamaran.** Setelah pindah, sistem lama tetap hidup **hanya untuk menerima lamaran**; menu lain ditutup. Rekrutmen menjadi fitur tambahan pertama setelah v3 jadi (SIS-08); sesudah itu barulah sistem lama dimatikan. |

*Kenapa SIS-12:* slip, Buku Bonus, kasbon, upah ritase, dan Keuangan saling
menyambung lewat uang. Pindah sebagian memaksa sambungan sementara yang diketik
tangan dan melanggar aturan v3 sendiri (contoh: kasbon tidak diketik di slip),
dan KEU-08 sudah meminta semua aliran uang hidup pada hari yang sama.

Ditentukan saat menyiapkan tayang, tidak ditanyakan sekarang: bulan hari
pindah, periode mana yang dipakai uji banding, kapan sambungan kasir
dinyalakan, dan angka awal.

## 8. Data lama

Ditetapkan 13 Oktober 2026 dari jawaban pemilik (catatan 1C di akhir file).
Menutup keputusan terbuka 3 di `../work/WIP.md`.

| No | Aturan |
|---|---|
| SIS-23 | **Pegangan: yang dibawa ke v3 hanya yang masih hidup**, yaitu orang, pengaturan, dan utang yang masih berjalan. **Riwayat tidak dipindah:** absen, slip, trip, nota, bongkaran, dan buku kas lama tetap di sistem lama. v3 mulai bersih pada hari pindah (SIS-13). |
| SIS-24 | **Data karyawan diisi karyawan itu sendiri** saat daftar ulang (KAR-53, SIS-19); tidak ada data orang yang disalin dari sistem lama. Cabang, jabatan, dan status kerja tetap ditetapkan HR saat menyetujui (KAR-60), dan gaji diisi HR atau pemilik (buku Gaji). Tanggal bergabung yang diketik karyawan **dicocokkan HR** dengan lembar acuan dari sistem lama sebelum disetujui, karena menjadi dasar cuti (KEH-48) dan syarat kasbon (DRV-55). Orang yang punya slip bulanan dan upah ritase ditentukan slip utamanya saat itu (DRV-04). |
| SIS-25 | **Tidak ada tunggakan upah yang dibawa.** Ritase, upah kenek, dan bongkaran di sistem lama dinyatakan pemilik sudah dibayar semua; tanda "belum dibayar" di sana hanya tanda yang tidak diperbarui, dan dibiarkan apa adanya (WAJ-09). v3 mulai tanpa utang upah. |
| SIS-26 | **Cabang, departemen, dan jabatan diketik tangan** (7, 3, dan 11). **Pengaturan diketik dari buku aturan**, bagian "Pengaturan dan angka awalnya" tiap buku, bukan disalin dari database lama: tarif ritase, nominal denda, tingkat potongan, jam kerja cabang, persen bonus grooming dan ongkir, dan lainnya. Pengaturan grooming lainnya milik sistem kasir (LOG-89). |
| SIS-27 | **Menutup sistem lama bertahap** (pelapis SIS-20). Mulai hari pindah sistem lama **tidak menerima kejadian baru** (absen, trip, kasbon, pengajuan baru). Urusan periode terakhir tetap diselesaikan di sana: klarifikasi yang masih dalam batas waktunya, masa keberatan, menutup dan membayar slip terakhir, dan pengesahan bonus yang menunggu. Setelah slip terakhir dibayar, sistem lama **dikunci penuh** dan hanya bisa dilihat. |
| SIS-28 | **Sisa kasbon** adalah satu-satunya utang karyawan yang dibawa. Yang dibawa hanya **angka sisa per orang** pada hari pindah: diketik finance, disahkan GM atau Owner, bertanda "bawaan sistem lama". Jadwal potongnya ditetapkan ulang saat itu, paling banyak 3 kali potong. Sisa itu **mengurangi Dana Kasbon**, dan **tidak ditolak** walau melebihi batas per orang; orangnya hanya belum bisa mengajukan kasbon baru sampai sisanya di bawah batas (aturan kasbon: buku Gaji Driver–Bongkaran–Kasbon bagian 3). |
| SIS-29 | **Uang dan barang tidak dipindah dari sistem lama:** saldo dari hitung fisik (KEU-08), utang supplier dari tagihan (KEU-67), stok dan piutang toko dari sistem kasir (KEU-94). Daftar aset, Tagihan Rutin, dan Piutang Lain **diketik baru dari kenyataan** saat menyiapkan tayang. Cabang "Logistik" dan nota "Gudang" dan "Hammielion" sebagai utang supplier tidak dipindah. Kinerja tidak membawa apa pun. |
| SIS-33 | **Dana Disiplin dan Dana Tidak Hadir dimulai dengan saldo awal dari data lama** (keputusan pemilik 13 Oktober 2026; jenis: pengecualian SIS-23 dan pelapis GAJ-33 dan GAJ-35, yang menghitung dana hanya dari slip v3). Yang dibawa **satu angka saldo awal per dana**, bukan baris riwayatnya: dihitung satu kali dari slip sistem lama yang sudah ditutup, disahkan GM atau Owner, bertanggal hari pindah, dan bertanda "bawaan sistem lama". Setelah ada transaksi tidak diubah; koreksinya lewat baris penyesuaian beralasan. **Cara menghitung:** hanya dari **periode terakhir sistem lama** (yang berakhir tanggal 25 tepat sebelum hari pindah). Dana Disiplin = potongan telat dan denda disiplin yang terpotong di slip periode itu, **dikurangi** bonus disiplin dan bonus bersyarat yang dibayar periode itu. Dana Tidak Hadir = potongan alpha, izin, dan sakit periode itu, dikurangi lembur dan kompensasi libur periode itu. Angkanya hitungan terbaik dari data yang ada, bukan angka pasti. |
| SIS-30 | **Cuti tahunan mulai dengan jatah penuh** menurut tanggal bergabung (KEH-48), karena sistem lama tidak punya catatan cuti tahunan. **Foto lama tidak dipindah.** **Angka lama yang meragukan tidak dibawa dan tidak dikejar** (potongan kasbon tanpa catatan, baris gaji ketikan tangan, Kas Masuk tanpa rekening); hanya dipastikan kalau dipakai sebagai pembanding uji (SIS-14). |
| SIS-31 | **Tambahan data toko** (rute bawaan, nomor HP, alamat yang sudah terisi) adalah **satu-satunya yang disalin dengan mesin**, satu kali, lalu diperiksa Kepala Gudang. Daftar tokonya sendiri milik kasir (LOG-65). Titik lokasi toko tidak disalin; dipasang driver saat pertama mengantar. |
| SIS-32 | **Arsip sebelum sistem lama dimatikan** (SIS-22): seluruh data lama diunduh sebagai file cadangan yang dipegang GM dan Owner, dan slip lama tiap orang disimpan sebagai PDF. Riwayat lama **tidak ditampilkan di v3**; yang membutuhkan meminta ke HR. |

*Kenapa SIS-23:* riwayat lama dihitung dengan aturan lama dan memuat angka
yang tidak bisa ditelusuri. Kalau dicampur ke v3, laporan v3 tidak bisa lagi
dipercaya sejak hari pertama.

Ditentukan saat menyiapkan tayang, tidak ditanyakan sekarang: angka saldo awal
tiap dana dan tiap tempat uang, dan isi lembar acuan SIS-24.

## 9. Alat dan server

Ditetapkan 13 Oktober 2026 dari jawaban pemilik (catatan 1D di akhir file).
Menutup keputusan terbuka 1 dan 2 di `../work/WIP.md`. Rincian teknisnya di
`../teknis.md`.

| No | Aturan |
|---|---|
| SIS-34 | **Alat satu keluarga dengan sistem lama:** Next.js, TypeScript, dan database PostgreSQL. Yang diganti adalah cara memakainya (SIS-35, 36), bukan alatnya. |
| SIS-35 | **Semua rumus di satu tempat: kode server** (pelaksanaan WAJ-04). Tidak ada rumus di layar dan tidak ada rumus di database (trigger). Database hanya menyimpan dan menolak yang mustahil: nominal minus, baris dobel, data tanpa induk. |
| SIS-36 | **Handphone dan PC tidak pernah bicara langsung ke database.** Satu-satunya pintu adalah server, dan server memeriksa hak dari satu daftar hak (KEU-120, PRI-31 butir 4). Mesin pengaman hak akses (WAJ-06) menguji pintu ini. |
| SIS-37 | **Tidak terkunci di satu penyedia.** Login, penyimpanan foto, dan mesin terjadwal masing-masing dipasang lewat satu pintu di kode, supaya pindah server cukup mengganti isi pintu itu. Cara login diputuskan di Tahap 3B: email dan password tanpa akun Google, lupa password lewat email, nomor HP, dan tanggal lahir (KAR-69, KAR-70). |
| SIS-38 | **Dua tahap tempat.** *Masa membangun dan menguji:* data di **Supabase baru** yang dibuat pemilik, web di **satu project Vercel baru** di akun yang sekarang; isinya hanya data contoh dan bahan uji banding. *Sebelum hari pindah:* semuanya dipindah ke **VPS** sewaan. Data asli karyawan tidak pernah masuk ke Supabase gratis. Sistem lama dan project Supabase lain tidak dipakai untuk v3 (WAJ-09). |
| SIS-39 | **Urutan menjelang tayang:** (1) VPS disewa dan dipasang; (2) alamat web diarahkan ke sana (SIS-40); (3) cadangan harian jalan dan sudah sekali dicoba dipulihkan (SIS-42); (4) gladi bersih di VPS (SIS-16); (5) daftar ulang akun (SIS-19); (6) hari pindah (SIS-13). Tidak ada langkah yang dilompati. Claude membantu pemilik memasang VPS dan menuliskan langkahnya di `../teknis.md`. Setelah pindah, project Vercel dan Supabase masa uji dihapus. |
| SIS-40 | **Satu alamat web tetap milik sendiri**, berupa nama di bawah domain perusahaan (contoh: `hris.hammielion.com`; sistem kasir sudah memakai `admin.hammielion.com`). Alamat dipasang sejak masa uji dan **tidak berganti** saat pindah dari Vercel ke VPS; yang diganti hanya arah alamatnya. Wajib sudah terpasang sebelum karyawan pertama mendaftar ulang, karena aplikasi yang terpasang di handphone terikat pada alamatnya. Namanya ditentukan saat menyiapkan tayang. Sambungan selalu terkunci (https). |
| SIS-41 | **Dua tempat yang terpisah penuh: tempat uji dan tempat asli**, masing-masing dengan database sendiri. Tempat uji berisi data contoh dan akun per jabatan (KAR-52). Selama tempat uji memuat salinan data sistem lama untuk uji banding (SIS-14), **hanya GM dan Owner** yang bisa masuk. |
| SIS-42 | **Cadangan** (pelaksanaan PRI-27): seluruh database disalin otomatis tiap malam ke tempat di luar server dan disimpan 30 hari; foto ikut dicadangkan. Sebulan sekali salinan dicoba dipulihkan ke tempat uji. Berhasil atau gagalnya tampil di layar Kesehatan Mesin (PRI-33). |
| SIS-43 | **Foto dikecilkan otomatis sebelum disimpan dan disimpan di luar database**, tertutup (hanya terbuka lewat server untuk yang berhak). Masa simpan mengikuti buku aturan modulnya (foto absen 60 hari, KEH-15). |
| SIS-44 | **Kode disimpan di GitHub, repo baru yang tertutup.** Pagar mesin jalan di sana: main terkunci, dan perubahan ditolak otomatis kalau ada pemeriksaan yang gagal (WAJ-01, WAJ-06, `../teknis.md`). |
| SIS-45 | **Web yang bisa dipasang di handphone (PWA) sejak hari pertama** (PRI-25). **Notifikasi ke handphone bisa**, dan dinyalakan belakangan (SIS-09). Notifikasi adalah **pelengkap**: semua pengingat tetap tampil di dalam aplikasi, karena notifikasi bisa tidak sampai (izin ditolak, handphone menghemat baterai, iPhone yang webnya belum dipasang ke layar utama). Tidak ada aturan yang bergantung pada notifikasi sampai. |
| SIS-46 | **Tanpa layanan luar berbayar selain server dan domain.** Catatan error otomatis disimpan di database sendiri (TAM-05); mesin terjadwal jalan di server sendiri (PRI-33); titik lokasi memakai GPS handphone, tanpa layanan peta berbayar. Layanan luar baru hanya ditambah dengan izin pemilik. |
| SIS-47 | **Tempat uji: tamu, jam uji, dan masa sesudah pindah** (keputusan pemilik 13 Oktober 2026, Tahap 4B; jenis: pelapis atas SIS-39 dan SIS-41). (1) Tempat uji **tetap ada** setelah hari pindah, di VPS yang sama dengan database terpisah; yang dihapus hanya project Vercel dan Supabase masa uji (SIS-39). (2) Pemilik dan GM boleh membuat **akun tamu uji** yang berakhir sendiri setelah 7 hari dan hanya bisa melihat data contoh; selama salinan data lama terpasang untuk uji banding, akun tamu mati (SIS-41 tetap). (3) Di tempat uji ada **jam uji** (hanya maju) dan **Kembalikan data contoh**. (4) Rilis dilakukan di luar jam ramai kecuali perbaikan mendesak atas perintah pemilik. Alur lengkap: `../work/plans/2026-10-13-tempat-uji-dan-alur-rilis.md`. |

*Kenapa SIS-35 dan SIS-36:* di sistem lama rumus telat ditulis di 5 tempat, dan
layar bicara langsung ke database, sehingga akun karyawan pernah bisa mengganti
perannya sendiri menjadi Owner dan driver bisa mengubah baris trip-nya. Satu
pintu dan satu tempat rumus menutup celah itu dari pondasinya, dan membuat
pindah server tidak perlu memindah rumus.

*Kenapa SIS-38 dan SIS-39:* Supabase gratis tidak punya cadangan otomatis,
ruangnya kecil, dan project yang sepi dihentikan sementara. Memindah server
saat data gaji sudah hidup jauh lebih berisiko daripada memindah data contoh.

Ditentukan saat menyiapkan tayang, tidak ditanyakan sekarang: penyedia dan
ukuran VPS, nama alamat web, dan tempat menyimpan cadangan.

Catatan untuk fitur tambahan: posisi driver di peta (SIS-08) kemungkinan butuh
aplikasi Android dan layanan peta; itu diputuskan saat fiturnya dibuka, dan
tidak mengubah bab ini.

## Catatan jawaban pemilik (1A)

13 Oktober 2026. Butir 2–8 usulan Claude dijawab "ok". Butir 1 (adakah
pekerjaan di luar sistem yang ingin dimasukkan): "ya betul, paling soal sistem
kasir yang saya pakai untuk jual beli". **Bacaan Claude**, sudah disampaikan di
percakapan: tidak ada hal baru; sistem kasir tetap terpisah dan cukup dibaca
lewat Tarik Data Kasir (SIS-07). Kalau maksud pemilik ternyata menggabungkan
kasir ke v3, SIS-01 dan SIS-07 diubah dan itu bertabrakan dengan LOG-65.

## Catatan jawaban pemilik (1B)

13 Oktober 2026. Sembilan butir diajukan di percakapan.

| Butir | Jawaban pemilik | Menjadi |
|---|---|---|
| 1 Pindah berapa kali | "rencana saya di tanggal 26 bulan ini (pindah per modul ternyata tidak bisa jadi itu di batalkan) saran C, pindah ketika benar benar sudah pas" | SIS-12, 13 |
| 2 Siapa bekerja dobel | "tidak ada, pindah sekali jalan saja" | SIS-14 |
| 3 Halaman lamaran | A (sistem lama hidup hanya untuk lamaran) | SIS-22 |
| 4 Arti cocok | "yaa aturan itu, cukup di lihat oleh GM dan owner saja" | SIS-15 |
| 5–8 | ok | SIS-16 s.d. 19 |
| 9 Jalan mundur dan Kinerja | "bisakah ambil absenan saja nanti? jika ya maka ok" | SIS-20, 21 |

Yang disampaikan Claude di percakapan:

- **26 Oktober 2026 tidak terkejar.** Masih ada sisa Tahap 1, lalu Tahap 3, 4,
  5, dan pembangunan tujuh modul. Yang dipegang adalah kalimat kedua pemilik:
  pindah ketika sudah pas, pada sebuah tanggal 26.
- **Jawaban 2 bertabrakan dengan SIS-10 syarat 3 dan jawaban "ok" butir 5–6**
  (keduanya soal berdampingan). Bacaan Claude: kerja dobel dibuang, diganti
  uji banding dengan data lama yang disalin (SIS-14, 16). **Dijawab:** "ok, tapi saya yakin sistem baru akan lebih
  akurat". Selisih karena v3 lebih akurat masuk daftar beda (SIS-15).
- **Butir 9:** jawabannya **bisa**. Bacaan Claude atas "ambil absenan saja":
  data absen sistem lama diambil (dibaca, disalin) ke v3 sebagai bahan uji
  banding, tanpa karyawan absen dua kali. Kalau maksudnya data lama yang
  dibawa saat pindah cukup absen saja, itu diputuskan di bagian 1C. **Dijawab:**
  "a" (bahan uji banding).
- Butir 4 dan 7 tidak bertabrakan: daftar beda (perbandingan angka) hanya
  untuk GM dan Owner; aturan barunya sendiri tetap diumumkan ke karyawan.

## Catatan jawaban pemilik (1C)

13 Oktober 2026. Diajukan di percakapan: rangkuman A (sudah diputuskan), tujuh
usulan B, enam pertanyaan C.

| Butir | Jawaban pemilik | Menjadi |
|---|---|---|
| C1 Data karyawan diisi siapa | "data karyawan di isi karyawan itu sendiri" | SIS-24 |
| C2 Upah yang belum dibayar | "ritase di sistem lama semua sudah di bayar" | SIS-25 |
| C3 Slip periode terakhir | ok | SIS-27, catatan di SIS-20 |
| C4 Sisa kasbon | "ya ikuti saran anda" | SIS-28 |
| C5 Arsip | ok | SIS-32 |
| C6 Data toko | ok | SIS-31 |

Bacaan Claude yang **dikonfirmasi pemilik** (13 Oktober 2026):

- **C1** ("ya"). Karyawan mengisi semua data dirinya, termasuk tanggal
  bergabung. Cabang, jabatan, status kerja (KAR-60), dan gaji tetap diisi HR
  atau pemilik. HR mencocokkan tanggal bergabung dengan lembar acuan.
- **C2** ("ya"). "Semua sudah dibayar" mencakup juga upah kenek dan 19
  bongkaran; tidak ada yang dibereskan di sistem lama.
- **Usulan B1–B7 dijawab** (13 Oktober 2026): B1, B2, B3, B5, B6, B7 "ok"
  atau "ya" (SIS-23, 26, 29, 30). **B4 diubah pemilik:** "dana disiplin dan
  dana tidak hadir di mulai dengan mengambil data lama" → SIS-33.
- **Cara hitung B4 dijawab:** (a) sejak periode mana: "ok" atas saran hanya
  periode terakhir sistem lama; (b) bonus yang sudah dibayar mengurangi:
  "yaa". Sudah disampaikan: slip lama tidak menyimpan rincian potongan dan
  sebagian denda tidak tercatat, jadi angkanya hitungan terbaik yang
  disahkan pemilik.
- Tidak ada pertanyaan 1C yang menunggu.

## Catatan jawaban pemilik (1D)

13 Oktober 2026. Diajukan di percakapan: dua pertanyaan (P1, P2) dan sepuluh
usulan (T1–T10).

| Butir | Jawaban pemilik | Menjadi |
|---|---|---|
| P1 Kapan pindah ke VPS | "pakai vps sebelum pindah (ini tolong bantu saya, saya juga ingin sistemnya punya alamat sendiri, bagaimana caranya?) untuk awal pakai supabase" | SIS-38, 39, 40 |
| P2 Tempat web masa uji | "vercel saja" | SIS-38 |
| T1–T10 | "ok" | SIS-34 s.d. 37, 41 s.d. 46 |

- **P2 adalah pengganti** ucapan pemilik sebelumnya ("tidak menambah Supabase
  dan Vercel baru"): pertentangannya disampaikan dulu, dan pemilik memilih
  satu project Vercel baru untuk masa uji.
- **Pertanyaan pemilik:** bisakah ada notifikasi ke handphone setelah
  dijadikan PWA? Dijawab: bisa (SIS-45), dengan batasnya; dinyalakan
  belakangan sesuai SIS-09.
- **Alamat sendiri:** dijelaskan di percakapan bahwa cukup menambah satu nama
  di bawah domain `hammielion.com` yang sudah dimiliki, tanpa membeli domain
  baru; dikerjakan bersama saat menyiapkan tayang. Yang dibutuhkan saat itu:
  akses ke panel pengelola domain `hammielion.com`.
- Tidak ada pertanyaan 1D yang menunggu.
