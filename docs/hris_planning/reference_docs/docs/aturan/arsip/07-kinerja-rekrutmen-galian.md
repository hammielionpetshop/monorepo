# Galian Sistem Lama: Kinerja dan Rekrutmen

Status: selesai; Bab 7 ditetapkan 13 Oktober 2026 (rekrutmen ditangguhkan)
Digali dari sistem lama mulai: 12 Oktober 2026

Bab 7 dipecah menjadi empat bagian (disetujui pemilik, 12 Oktober 2026). Bagian 7C kemudian **ditangguhkan** pemilik pada hari yang sama, sehingga yang dikerjakan 7A, 7B, dan 7D:

| Bagian | Isi | Status |
|---|---|---|
| 7A | Penilaian dan target: KPI (kriteria, penilaian, target cabang, jatah rak), "Kinerja Saya" di portal, Ranking Disiplin, Penjualan Promo | **Sudah digali** (12 Oktober 2026), database sudah dicek. KIN-A01 s.d. A36. **Dijawab pemilik** (7A.9), 25 aturan di 7A.10, AP1–AP14 dibaca disetujui. Butir penutup A–D disetujui. **SELESAI dibahas** |
| 7B | Tugas Harian dan Catatan Meeting | **Sudah digali** (12 Oktober 2026), database sudah dicek. KIN-B01 s.d. B41. **Dijawab pemilik** (7B.9), 23 aturan di 7B.10, AQ1–AQ13 disetujui. **SELESAI dibahas** |
| 7C | Rekrutmen: lamaran, penyaringan, psikotes, interview, sampai menjadi karyawan | **Ditangguhkan** pemilik 12 Oktober 2026; tidak digali. Alur yang diinginkan dicatat di `../../work/backlog/2026-10-12-rekrutmen-ditangguhkan.md` |
| 7D | Penetapan menjadi `../07-kinerja-rekrutmen.md` (nomor KIN), tanpa rekrutmen | **Selesai** 13 Oktober 2026: KIN-01 s.d. 51 ditetapkan; kelima butir penutup dijawab (7D.2); melahirkan GAJ-58 dan KAR-68 |

Keputusan pemilik saat menyetujui pembagian (12 Oktober 2026, dijawab "ok"
atas saran Claude): di 7A yang dirinci hanya cara menilai KPI dan Bonus
KPI-nya. **Bonus Kinerja, Ranking Disiplin, dan Tabungan Loyalitas tetap
ditunda** sebagai fitur tambahan setelah v3 jadi (GAJ-31 tidak berubah untuk
ketiganya); Buku Bonus bisa menerima jenis baru kapan saja (GAJ-24, GAJ-25).

Halaman `karyawan/promosi-training` tidak digali di sini: sudah ditetapkan di
Bab 1 (KAR-20 s.d. 23).

Cara menutup tiap bagian: setelah satu bagian selesai dibahas, Claude memberi
pernyataan tegas "7X SELESAI", meminta `/clear`, dan bagian berikutnya
dikerjakan di sesi baru. Pertanyaan tiap bagian diajukan di percakapan.

Batas penggalian: kode aplikasi dan struktur database yang berjalan. Isi data
(nama orang, nama produk, nilai per orang) tidak dibuka; yang dihitung hanya
jumlah baris.

Nomor KIN di file ini adalah nomor **galian** (sementara). Nomor aturan v3
ditetapkan di 7D.

---

# Bagian 7A: Penilaian dan target

Sumber: `hris-app/app/(dashboard)/kpi/page.tsx` (403 baris), `kpi/setup/page.tsx`
(416), `portal/kpi-saya/page.tsx` (176), `ranking/page.tsx` (513),
`penjualan-promo/page.tsx` (1.001); fungsi database
`get_employee_kpi_breakdown`, `save_kpi_evaluation`, `save_kpi_manual_score`,
`save_kpi_criteria`, `kpi_criteria_visible`, tujuh fungsi penghitung per sumber
(`get_employee_task_completion_pct`, `get_employee_attendance_kpi`,
`get_branch_sales_target_pct`, `get_branch_stock_shrinkage_pct`,
`get_employee_cash_variance_pct`, `get_employee_rack_display_pct`,
`get_employee_promo_sales_pct`), `submit_promo_sales_report`,
`review_promo_sales_report`, `edit_promo_sales_report`, `save_promo_product`,
`get_my_promo_sales_progress`, `get_employee_promo_bonus`,
`sync_promo_bonus_to_payroll`; kebijakan akses tabel-tabelnya.

Yang sudah diputuskan dan tidak ditanyakan lagi:

- Uang bonus: satu Buku Bonus, satu halaman Persetujuan Bonus, pengesah HR dan
  pemilik, semua lewat slip, yang terlambat disahkan masuk slip berikutnya,
  angka aturan bertanggal berlaku, periode 26–25 menurut tanggal kejadian,
  bonus mengikuti cabang kejadian (GAJ-24 s.d. 28, GAJ-50).
- Cara hitung rupiah bonus promo di sistem lama sudah digali di 3C (GAJ-C17
  s.d. C23) dan Ranking Disiplin di GAJ-C30 s.d. C34; di sini hanya
  ditambahkan yang belum tercatat.
- Grooming lepas dari produk promo dan punya satu jalur sendiri (LOG-67,
  LOG-79).
- Minus kas: satu kasir satu tanggung jawab (KEU-55); kehilangan barang dibagi
  per jabatan (GAJ-17 dan sekitarnya).

## 7A.1 Bagian ini mengurus apa

Memberi nilai kepada tiap karyawan tiap periode dari beberapa ukuran (hadir,
tepat waktu, tugas, penjualan, dan nilai dari atasan), menyimpan target tiap
cabang, dan menerima laporan penjualan produk promo dari karyawan toko. Uang
yang lahir dari nilai dan laporan itu dicatat ke Buku Bonus milik modul Gaji.

## 7A.2 Data di sistem lama (dicek ke database, 12 Oktober 2026)

| Data | Isinya | Tabel | Jumlah baris |
|---|---|---|---|
| Kriteria KPI | Judul, penjelasan, sumber nilai, bobot, berlaku untuk siapa, aktif, angka toleransi, tugas rutin yang ditautkan | `kpi_criteria`, `kpi_criteria_audiences` | 3 kriteria (aktif semua), 5 baris sasaran |
| Nilai manual | Kriteria, orang, periode, nilai 0–100, pengisi | `kpi_manual_scores` | 0 |
| Rekap nilai | Orang, periode, nilai keseluruhan, nominal maksimal, bonus cair, penilai | `kpi_evaluations` | 0 |
| Nominal bonus KPI maksimal | Satu angka per orang | `employees.kpi_bonus_max` | 0 orang punya nominal |
| Target omset cabang | Satu angka per cabang | `branch_sales_targets` | 4 cabang terisi |
| Jatah rak cabang | Satu angka per cabang | `branch_racks` | 4 cabang terisi |
| Produk promo | Cabang, nama, target, periode, tarif per pcs atau persen, karyawan khusus, batas hari lapor | `promo_products` | 6, semuanya periode Oktober 2026 (4 per pcs; 2 persen, keduanya produk grooming khusus orang tertentu) |
| Laporan penjualan promo | Produk, orang, jumlah, tanggal struk, foto struk, status, alasan tolak, jejak koreksi | `promo_sales_reports` | 18, dari 3 orang, **semuanya menunggu**; belum ada satu pun yang pernah diperiksa |
| Siklus dan pencairan Ranking Disiplin | Tanggal mulai, pool, pemenang | `discipline_cycles`, `discipline_payouts` | 1 siklus berjalan sejak 26 April 2026, pool tercatat Rp1.664.000; 0 pencairan |

Keadaan data:

- **KPI baru dibuat 4 Oktober 2026** (8 hari sebelum digali). Tiga kriterianya:
  Kehadiran dan Tepat Waktu untuk semua karyawan, dan Kerapian Display untuk
  satu cabang, satu divisi, dan tiga orang. Ketiganya berbobot 100.
- **KPI belum pernah menghasilkan apa pun**: 0 nilai manual, 0 rekap disimpan,
  0 orang punya nominal bonus, 0 slip memuat bonus KPI.
- **Penjualan Promo baru berjalan sejak 6 Oktober 2026** dan belum pernah
  sampai ke uang: 18 laporan menunggu, 0 slip memuat bonus promo.
- Dari 18 laporan, 4 bertanggal struk sebelum 26 September (periode gaji
  September, slipnya sudah ditutup) tetapi menempel di produk periode Oktober,
  karena hanya produk Oktober yang ada. Ini memperhalus catatan 3C ("enam
  laporan September"): 6 laporan bertanggal September, 4 di antaranya periode
  September dan 2 periode Oktober.
- 7 pasang laporan sama persis orang, produk, tanggal struk, dan jumlahnya.
  Dari data tidak bisa dibedakan: dua penjualan di hari yang sama, atau satu
  struk dilaporkan dua kali.

## 7A.3 Aturan yang ditemukan

### Kriteria KPI

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| KIN-A01 | Kriteria berisi judul, penjelasan, sumber nilai, bobot, dan "berlaku untuk": semua karyawan, atau gabungan cabang, divisi, dan nama orang. Yang mengatur: pemilik dan HR. | `save_kpi_criteria` |
| KIN-A02 | Ada sembilan sumber nilai. Satu diisi tangan (nilai 0–100 tiap periode). Delapan dihitung sendiri oleh sistem dari modul lain: Tugas Rutin, Tepat Waktu, Kehadiran, Target Omset, Akurasi Stok, Selisih Kas, Kerapian Display, Penjualan Promo. | `get_employee_kpi_breakdown` |
| KIN-A03 | Nilai keseluruhan = rata-rata berbobot semua kriteria aktif yang berlaku untuk orang itu, dibatasi 0 sampai 100. Jumlah bobot tidak harus 100; sistem membaginya dengan jumlah bobot yang ada. Bobot lebih dari 100 hanya memunculkan peringatan, dan hanya untuk kriteria "semua karyawan". | `save_kpi_evaluation`, `kpi/setup/page.tsx` |
| KIN-A04 | Kriteria yang **belum ada datanya dihitung 0** dan tetap ikut menjadi pembagi. Satu kriteria kosong menjatuhkan nilai semua orang yang terkena. | `blendPct`, `save_kpi_evaluation` |
| KIN-A05 | Kriteria bisa diubah, dinonaktifkan, dan **dihapus** kapan saja, tanpa tanggal berlaku. Menghapus kriteria ikut menghapus semua nilai manualnya. Nilai periode lalu yang belum disimpan ikut berubah. | `handleDelete`, `toggleStatus` |
| KIN-A06 | Target omset dan jatah rak adalah **satu angka per cabang**: tanpa periode, tanpa tanggal berlaku, tanpa riwayat. Keduanya terbaca oleh siapa pun yang login. | `branch_sales_targets`, `branch_racks`, kebijakan `*_select` |

### Cara hitung tiap sumber

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| KIN-A07 | **Tepat Waktu** = hari hadir tanpa menit telat dibagi hari hadir. Telat satu menit sudah dihitung tidak tepat waktu; toleransi 5 menit tidak dipakai. | `get_employee_attendance_kpi` |
| KIN-A08 | **Kehadiran** = hari yang dianggap hadir dibagi hari wajib kerja. Hari wajib = hari dalam periode dikurangi libur terjadwal. Dianggap hadir: hadir, sakit bersurat dokter, cuti. Izin, sakit tanpa surat, dan alpha mengurangi. Masuk di hari libur menambah satu, sehingga nilainya bisa lewat 100. Orang yang masuk di tengah periode dihitung dari tanggal bergabung. | sama |
| KIN-A09 | Keterangan di layar pengaturan menyebut rumus Kehadiran yang lain ("100% dikurangi izin, sakit, alpha di luar jatah 4 kali per periode"). Panduan tidak sesuai kenyataan. | `SOURCE_HINT` |
| KIN-A10 | **Tugas Rutin** = jumlah jatah lapor yang dikerjakan dibagi semua jatah lapor, untuk tugas berulang yang ditugaskan ke orang itu. (Cara menghitung jatah digali di 7B.) | `get_employee_task_completion_pct` |
| KIN-A11 | **Target Omset** = Kas Masuk cabang yang sudah disetujui dalam periode dibagi target cabang, paling banyak 100. Nilainya sama untuk semua orang di cabang itu. | `get_branch_sales_target_pct` |
| KIN-A12 | **Akurasi Stok** = kehilangan barang cabang bulan itu dibandingkan toleransi (sekian persen dari target omset). Di bawah toleransi 100; turun lurus sampai 0 saat kehilangan dua kali toleransi. | `get_branch_stock_shrinkage_pct` |
| KIN-A13 | **Selisih Kas** = jumlah selisih (lebih maupun kurang) pada Kas Masuk yang **diketik orang itu**, dibandingkan toleransi rupiah kali jumlah transaksinya. Tidak membaca Laporan Kasir atau Minus Kas. | `get_employee_cash_variance_pct` |
| KIN-A14 | **Kerapian Display** = jumlah ronde selesai pada satu tugas rutin tertentu dibagi jatah rak orang itu. Jatah = rak cabang dibagi **semua** karyawan aktif cabang; sisa pembagian diberikan menurut urutan abjad nama. Cabang yang belum mengisi jatah rak: sekali lapor sudah 100. | `get_employee_rack_display_pct` |
| KIN-A15 | **Penjualan Promo** = jumlah terlapor yang disetujui **satu cabang** dibagi jumlah target semua produk aktif cabang itu (nilai sama untuk semua orang). Kalau cabang hanya punya produk tanpa target: 100 bila orang itu punya sedikitnya satu laporan disetujui, selain itu 0. | `get_employee_promo_sales_pct` |
| KIN-A16 | Dalam satu nilai ada **tiga arti "bulan"**: kehadiran, tugas, omset, dan selisih kas memakai periode 26–25; kehilangan barang memakai bulan isiannya; promo memakai periode pada produknya. Kehadiran dihitung sampai hari ini kalau periodenya belum selesai. | `get_employee_kpi_breakdown` |

### Menilai dan menyimpan

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| KIN-A17 | Nilai manual diisi pemilik atau HR, 0 sampai 100. Bisa ditimpa kapan saja; yang tersimpan hanya nilai dan pengisi terakhir. | `save_kpi_manual_score` |
| KIN-A18 | Sebelum "Simpan Rekap" ditekan, nilai dihitung langsung setiap halaman dibuka dan berubah dari hari ke hari. Tombol itu menyimpan nilai keseluruhan dan bonus cair satu orang untuk satu periode. **Rincian per kriteria tidak ikut disimpan.** | `handleSaveEvaluation`, `save_kpi_evaluation` |
| KIN-A19 | Rekap bisa disimpan ulang kapan saja dan menimpa yang lama, termasuk penilainya. Tidak ada tahap tutup, tidak ada kunci setelah slip dibuat atau dibayar. | `save_kpi_evaluation` |
| KIN-A20 | Bonus KPI = nominal maksimal orang itu kali nilai keseluruhan. Saat rekap disimpan, layar menulis angkanya ke slip draf (GAJ-C06, GAJ-C07). Nominal maksimal diisi per orang di data karyawan (KAR-19). | `kpi/page.tsx` |
| KIN-A21 | Yang masuk daftar penilaian: karyawan aktif berjenis tetap dan training. Driver tidak. | `fetchDashboardData` |
| KIN-A22 | Halaman KPI terbuka untuk semua akun selain karyawan biasa, termasuk kepala cabang dan finance. Tetapi server hanya melayani pemilik, HR, dan orang yang bersangkutan. Akibatnya kepala cabang dan finance membuka halaman berisi 0% tanpa pesan apa pun, dan kepala cabang tidak bisa menilai timnya. | `init`, `get_employee_kpi_breakdown` |
| KIN-A23 | Rumus nilai keseluruhan ditulis **tiga kali**: di halaman KPI, di halaman Kinerja Saya, dan di database. | `blendPct` (dua file), `save_kpi_evaluation` |

### Yang dilihat karyawan

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| KIN-A24 | Karyawan membuka "Kinerja Saya": nilai keseluruhan dan nilai tiap kriteria untuk periode berjalan atau periode lain. Yang tampil selalu hitungan langsung, bukan rekap yang disimpan, dan tidak ada tanda mana yang sudah final. | `portal/kpi-saya/page.tsx` |
| KIN-A25 | Karyawan hanya melihat persen. Angka di baliknya (hadir berapa dari berapa hari, berapa kali telat) dan rupiah bonusnya tidak tampil. | sama |

### Ranking Disiplin (tambahan atas GAJ-C30 s.d. C34)

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| KIN-A26 | Siklus berjalan sejak 26 April 2026 dan belum pernah dicairkan. Di database hanya pemilik yang bisa mencairkan; tombolnya tampil juga untuk HR. Fitur ini **tetap ditunda** (keputusan pemilik 12 Oktober 2026). | `discipline_cycles`, kebijakan `*_owner_only` |

### Penjualan Promo: produk dan target

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| KIN-A27 | Produk promo dibuat pemilik atau HR: **nama diketik bebas** (bukan dipilih dari daftar produk kasir), satu cabang, satu periode gaji. Memilih banyak cabang membuat salinan terpisah per cabang. Produk bisa dibatasi untuk karyawan tertentu. | `save_promo_product` |
| KIN-A28 | Dua cara bonus: per pcs dengan dua tarif (target cabang tercapai atau belum), dan persen dari harga layanan. Cara persen dibuat untuk grooming (GAJ-C18, C19; LOG-D02). | sama |
| KIN-A29 | Produk bisa diubah kapan saja, termasuk target dan tarifnya di tengah periode, tanpa jejak. Produk tidak dihapus dari layar, hanya dinonaktifkan; database mengizinkan pemilik dan HR menghapusnya. | `save_promo_product`, kebijakan `promo_products_write` |

### Penjualan Promo: melapor dan memeriksa

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| KIN-A30 | Karyawan hanya melihat produk cabangnya untuk periode gaji yang **sedang berjalan**. Melapor: jumlah, tanggal struk (tidak boleh di masa depan), foto struk wajib (paling banyak tiga), dan catatan. Harus dari cabang produk itu. | `get_my_promo_sales_progress`, `submit_promo_sales_report` |
| KIN-A31 | Tanggal struk **tidak dicocokkan dengan periode produk**. Struk bulan lalu bisa dilaporkan ke produk bulan ini dan dihitung di periode ini. | `submit_promo_sales_report` |
| KIN-A32 | Tidak ada penjaga laporan dobel: nomor struk tidak dicatat, dan struk yang sama bisa dilaporkan dua kali atau oleh dua orang. "Foto harus dari kamera" hanya tulisan di layar. | sama |
| KIN-A33 | Tanda "terlambat" muncul kalau lapor lebih dari 3 hari sejak tanggal struk (angka 3 ditulis di kode). Terpisah dari itu, bonus dipotong 50% kalau melewati batas hari pada produknya (GAJ-C21). | sama |
| KIN-A34 | Yang memeriksa: pemilik, HR, dan finance. Bisa menyetujui, menolak dengan alasan, mengubah jumlah (klaim awal tetap tersimpan), dan **mengembalikan ke "menunggu" kapan saja**, termasuk setelah bonusnya masuk slip. Tidak ada larangan memeriksa laporan sendiri, dan tidak ada batas waktu memeriksa. | `review_promo_sales_report`, `edit_promo_sales_report` |
| KIN-A35 | Database mengizinkan pemilik, HR, dan finance mengubah dan menghapus baris laporan secara langsung; layar tidak menyediakannya. | kebijakan `promo_sales_reports_write` |
| KIN-A36 | Karyawan melihat jumlah yang disetujui, jumlah yang menunggu, dan perkiraan bonusnya. Ia **tidak melihat daftar laporannya**, tidak tahu laporan mana yang ditolak dan kenapa, dan tidak bisa membatalkan atau membetulkan laporan yang salah ketik. | `penjualan-promo/page.tsx` |

## 7A.4 Menu di sistem lama

| Menu | Sub menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|---|
| SDM › KPI | Dashboard KPI, Setup Kriteria | Melihat nilai semua orang, mengisi nilai manual, menyimpan rekap; mengatur kriteria, target omset, jatah rak | Kehadiran dihitung juga di slip dan di Ranking |
| SDM › Ranking Disiplin | Ranking, Histori | Peringkat dan pencairan pool | Menilai disiplin, sama dengan dua kriteria KPI |
| SDM › Target Penjualan Promo | — | Produk dan target, memeriksa laporan, sinkron bonus ke slip | Sama-sama "bonus dari target" |
| Pekerjaan › Target Penjualan Promo | — | Karyawan melapor penjualan | Halaman yang sama, tampilan lain |
| Portal › Kinerja Saya | — | Karyawan melihat nilainya | — |

## 7A.5 Tumpang tindih

1. **Rumus nilai keseluruhan ditulis tiga kali** (KIN-A23).
2. **KPI menghitung ulang milik modul lain dengan rumus sendiri**: kehadiran
   (berbeda dari hitungan slip dan dari hitungan Ranking, jadi ada tiga
   hitungan kehadiran), omset (dari Kas Masuk), selisih kas (bukan dari Minus
   Kas), dan kehilangan barang.
3. **Disiplin dinilai di empat tempat**: potongan telat dan tidak hadir di
   slip, kriteria Tepat Waktu dan Kehadiran di KPI, Ranking Disiplin, dan
   bonus disiplin dari Dana Disiplin.
4. **Kehilangan barang dan selisih kas mengenai orang dua kali**: sekali
   sebagai potongan gaji, sekali lagi sebagai penurun nilai KPI.
5. **Tiga cara "bonus dari target"** yang tidak saling kenal (3C.5 butir 4).
6. **Tiga arti "bulan"** di dalam satu nilai (KIN-A16).
7. **Penjualan Promo dipakai untuk grooming** (sudah dilepas, LOG-67).

## 7A.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| Kriteria atau bobot diubah di tengah periode | Nilai semua orang langsung berubah | Tidak ada riwayat; nilai lama tidak bisa dilihat lagi |
| Target omset cabang diubah | Nilai periode lalu yang belum disimpan ikut berubah | Tidak |
| Cabang belum punya target atau datanya belum masuk | Kriteria itu dihitung 0 untuk semua orang | Tidak; hanya dengan menonaktifkan kriterianya |
| Karyawan pindah cabang di tengah periode | Seluruh periode dihitung dengan kriteria dan target cabang baru | Tidak |
| Rekap salah | Simpan ulang, menimpa | Ya, tanpa jejak |
| Rekap disimpan setelah slip tidak lagi draf | Bonus tidak masuk slip mana pun | Tidak (sudah dijawab GAJ-50) |
| Karyawan salah ketik jumlah di laporan promo | Tidak bisa dibetulkan sendiri | Hanya kalau pemeriksa mengubahnya |
| Laporan promo ditolak | Karyawan tidak diberi tahu | Tidak |
| Laporan promo tidak pernah diperiksa | Menunggu selamanya; tidak ada pengingat | Tidak (18 laporan sedang begini) |
| Struk yang sama dilaporkan dua kali | Tidak terdeteksi | Tidak |
| Struk bulan lalu baru dilaporkan | Masuk ke produk bulan ini | Tidak ada pilihan lain |

## 7A.7 Pertanyaan untuk pemilik (diajukan di percakapan, 12 Oktober 2026)

Butuh pandangan pemilik:

1. **Bentuk Bonus KPI dan sumber uangnya.** Nominal maksimal per orang
   (lama) atau per jabatan per cabang; dibayar dari Dana Disiplin atau uang
   kantor. Saran: per jabatan per cabang, bertanggal berlaku (sama dengan
   bonus bersyarat, GAJ-29); sumber dana Dana Disiplin (GAJ-34), sehingga
   bonus KPI ditolak kalau saldo dana tidak cukup.
2. **Satu kesalahan boleh mengenai orang dua kali atau tidak.** Saran: telat
   dan tidak hadir boleh (potongan di slip dan penurun nilai KPI), karena itu
   tujuan KPI disiplin; kehilangan barang dan minus kas tidak, karena itu
   ganti rugi yang sudah dibayar lunas lewat potongan. Akibatnya sumber
   "Akurasi Stok" dan "Selisih Kas" tidak dibawa.

Cukup setuju atau tidak:

3. **Siapa menilai.** Kepala cabang mengusulkan nilai manual untuk timnya; HR
   dan pemilik menetapkan. Finance tidak punya menu KPI.
4. **Kriteria tanpa data** tidak ikut dihitung dan ditandai "belum ada data",
   bukan dihitung 0. Nilai manual yang belum diisi menahan penetapan nilai
   orang itu.
5. **Target Omset** dibawa, tetapi membaca omzet dari sistem kasir (Tarik
   Data Kasir), bukan dari Kas Masuk. Baru menyala setelah sambungan kasir
   hidup.
6. **Promo: tercapai atau belum dihitung satu cabang** (semua orang di cabang
   mendapat tarif yang sama). Saran: tetap, karena menjual adalah kerja tim.
7. **Promo: cara "persen dari harga" dihapus**; promo hanya per pcs. Grooming
   sudah punya jalurnya sendiri (LOG-67).
8. **Promo: batas lapor 3 hari sejak tanggal struk**, lewat itu bonus laporan
   itu dipotong 50% (angka pengaturan); laporan yang menunggu diperiksa lebih
   dari 3 hari kerja ditandai untuk HR dan pemilik.

## 7A.8 Usulan untuk v3 (belum disetujui)

| No | Usulan | Dasar |
|---|---|---|
| AP1 | **Satu rumus nilai, di server.** Layar hanya menampilkan. | WAJ-04; KIN-A23 |
| AP2 | **KPI tidak menghitung ulang milik modul lain.** Ia membaca angka jadi dari pemiliknya: hadir dan tepat waktu dari Kehadiran dengan aturan yang sama dengan slip (termasuk toleransi 5 menit, KEH-22), tugas dari Tugas Harian, omzet dari Tarik Data Kasir. | WAJ-03; KIN-A07, A08, A11, A13 |
| AP3 | **Kriteria, bobot, target omset, dan jatah rak bertanggal berlaku** dan tidak dihapus, hanya dinonaktifkan. Mengubahnya tidak mengubah nilai periode yang sudah lewat. | WAJ-07, PRI-02; KIN-A05, A06 |
| AP4 | **Kriteria diatur per jabatan per cabang**, bukan per nama orang. | WAJ-05; sejalan GAJ-29 |
| AP5 | **Bobot satu kelompok kriteria harus berjumlah 100**; kalau tidak, pengaturan ditolak disimpan dengan menyebut selisihnya. | KIN-A03 |
| AP6 | **Semua kriteria memakai periode gaji 26–25.** | 3C.10 aturan 11; KIN-A16 |
| AP7 | **Nilai punya dua tahap: Perkiraan dan Ditetapkan.** Ditetapkan oleh HR atau pemilik sebelum slip ditutup. Saat ditetapkan, rinciannya disimpan: tiap kriteria, angka mentahnya, penilai, dan waktu. Setelah itu tidak berubah. | KIN-A18, A19 |
| AP8 | **Koreksi setelah ditetapkan** berupa catatan koreksi beralasan; selisih uangnya masuk slip berikutnya. Nilai yang belum ditetapkan saat slip ditutup: bonusnya masuk slip berikutnya. | GAJ-50 |
| AP9 | **Karyawan melihat nilainya utuh**: Perkiraan atau Ditetapkan, angka di balik tiap persen ("hadir 22 dari 24 hari"), dan rupiah bonusnya. | KIN-A24, A25 |
| AP10 | **Hak di satu daftar**: kepala cabang melihat nilai timnya; yang tidak berhak tidak melihat menunya, bukan melihat halaman kosong. | KIN-A22; peta modul bagian hak akses |
| AP11 | **Produk promo dipilih dari daftar produk kasir**, tidak diketik. Target per cabang per periode gaji; tarif dan target yang sudah berjalan tidak diubah, perubahan berlaku periode berikutnya. | KIN-A27, A29; DRV Laporan Bongkaran memakai daftar yang sama |
| AP12 | **Struk hanya bisa dilaporkan ke produk yang berlaku pada tanggal struknya.** Struk periode lalu tetap diterima, bonusnya masuk slip berikutnya dengan keterangan periode asal. | GAJ-50; KIN-A31 |
| AP13 | **Penjaga dobel:** nomor struk wajib diketik; nomor yang sama untuk produk yang sama ditolak. Setelah sambungan kasir hidup, laporan dicocokkan dengan transaksi kasir. | KIN-A32 |
| AP14 | **Laporan promo tidak diubah diam-diam dan tidak dihapus.** Karyawan melihat daftar laporannya beserta alasan penolakan, dan boleh membatalkan laporan yang belum diperiksa. Pemeriksa tidak boleh memeriksa laporannya sendiri. Keputusan yang sudah masuk slip tertutup tidak dibuka lagi; koreksinya baris baru. Pemeriksaan dilakukan di halaman Persetujuan Bonus oleh HR dan pemilik (GAJ-26); finance hanya melihat. | PRI-02, GAJ-26, GAJ-50; KIN-A34, A35, A36 |

## 7A.9 Jawaban pemilik (12 Oktober 2026)

| Pertanyaan | Jawaban pemilik | Dicatat sebagai |
|---|---|---|
| 1. Bentuk Bonus KPI dan sumber uang | "ok ikuti saran anda", lalu contoh: kasir dengan selisih laporan plus atau minus sekitar Rp2.000 sebagai batas toleransi berhak bonus Rp10.000 per hari; atau dalam satu periode selisihnya tidak lebih dari Rp10.000 berhak Rp150.000 ("seperti bonus ketepatan"); bonus disiplin kalau 3 bulan berturut-turut selalu masuk tanpa izin atau sakit; bonus kalau 1 bulan tidak pernah telat. "Untuk sumber dana nanti di tentukan saja, tapi kriteria nya ada banyak sesuai kebutuhan saya" | Aturan per jabatan per cabang. Bentuk yang dicontohkan adalah **syarat terukur → nominal tetap**, bukan nominal maksimal kali nilai; bacaan ini diajukan sebagai butir A. Sumber dana: pengaturan per aturan bonus, ditentukan pemilik belakangan (saran "Dana Disiplin" tidak dipakai sebagai isi awal). Angka di contoh bukan keputusan |
| 2. Satu kesalahan dua kali | "ok ikut saran" | Telat dan tidak hadir boleh; kehilangan barang tidak. Untuk selisih kas bertabrakan dengan contoh di jawaban 1: butir B |
| 3. Siapa menilai | "yang menilai GM (tapi ini agak susah, karena penilaian secara personal tanpa sistem itu sangat susah, karena berkaitan dengan emosional orang yang menilai, saya khawatir menjadi subjektif, saya ingin kpi ini bisa di ukur dan ada datanya" | **Tidak ada nilai yang diketik orang.** Semua kriteria harus terukur dari data. Siapa yang mengesahkan hasilnya: butir C |
| 4. Kriteria tanpa data | "ok" | Tidak dihitung dan ditandai |
| 5. Target Omset dari kasir | "ok" | Disetujui |
| 6. Promo: tercapai dihitung satu cabang | "ok" | Disetujui |
| 7. Promo: cara persen dihapus | "ok" | Disetujui |
| 8. Promo: batas lapor 3 hari, potong 50%, tanda 3 hari kerja | "ok" | Disetujui |
| AP1–AP14 | Tidak dijawab satu per satu; ditutup dengan "ok lanjutkan" | Dibaca disetujui semua (bacaan Claude, sudah disampaikan di percakapan) |

Keputusan lain di jawaban yang sama: **Rekrutmen ditangguhkan** ("di bangun
nanti saja... terlalu lama, saya bosan"). Bagian 7C tidak digali. Alur yang
disebut pemilik dicatat di `../../work/backlog/2026-10-12-rekrutmen-ditangguhkan.md`.

### Butir penutup (diajukan di percakapan, 12 Oktober 2026)

- **A. Bentuk bonus dari penilaian.** Contoh pemilik semuanya berbentuk
  "kalau ukuran X memenuhi syarat dalam rentang waktu tertentu, dapat nominal
  Y". Ini bentuk bonus bersyarat (GAJ-29), bukan Bonus KPI lama (nominal
  maksimal kali nilai). Saran Claude: satu mesin saja, **Bonus Terukur**, yang
  menggantikan rumus Bonus KPI lama dan melapisi GAJ-29 (syarat dinilai mesin
  dari data, bukan dicentang orang). Nilai persen tetap ada sebagai rapor,
  tanpa uang.
- **B. Pertentangan jawaban 1 dan 2 soal selisih kas.** Jawaban 2: minus kas
  tidak boleh mengenai orang dua kali. Contoh jawaban 1: kasir yang selisihnya
  kecil mendapat bonus ketepatan, artinya kasir yang minus mengganti uangnya
  (KEU-55) dan juga kehilangan bonus itu. Saran Claude: pakai jawaban 1 untuk
  kasir (bonus ketepatan boleh, dibaca dari Laporan Kasir, plus dan minus
  sama-sama dihitung); larangan "dua kali" tetap berlaku untuk kehilangan
  barang, karena ditanggung bersama dan bukan kesalahan satu orang.
- **C. Siapa yang mengesahkan.** Jawaban 3 menyebut GM. GAJ-26 menetapkan
  semua bonus disahkan HR dan pemilik (GM setara pemilik, KAR-67). Saran
  Claude: karena tidak ada lagi nilai yang diketik orang, pengesahan hanya
  memeriksa hasil hitungan mesin; tetap HR dan pemilik (termasuk GM) supaya
  satu aturan pengesah untuk semua bonus.
- **D. Bacaan atas contoh.** Angka Rp2.000, Rp10.000, dan Rp150.000 adalah
  contoh, diisi kelak di pengaturan. "Tidak lebih dari 10.000 dan minus lebih
  dari 10.000" dibaca: jumlah selisih dalam satu periode, plus maupun minus,
  tidak lebih dari Rp10.000. Akibat "harus ada datanya": hal yang belum
  tercatat di sistem (misalnya sikap ke pelanggan) belum bisa menjadi
  kriteria sampai ada datanya.

### Jawaban atas butir penutup (12 Oktober 2026)

| Butir | Jawaban pemilik | Dicatat sebagai |
|---|---|---|
| A. Satu mesin Bonus Terukur; rapor tanpa uang | "ok" | Aturan 6 dan 13 |
| B. Bonus ketepatan kasir boleh; larangan dua kali hanya untuk kehilangan barang | "ok" | Aturan 4, 14, 16. Jenis: jawaban 1 melapisi jawaban 2 untuk selisih kasir |
| C. Pengesah HR dan pemilik (termasuk GM) | "ok" | Aturan 9; GAJ-26 tidak berubah |
| D. Bacaan atas contoh; yang belum ada datanya belum bisa jadi kriteria | "ok (karena bagaimana saya menilainya? agak susah)" | Aturan 3 dan 14 |

**7A SELESAI dibahas** (25 aturan, 18 temuan dipetakan). Tidak ada pertanyaan
7A yang menunggu.

## 7A.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 7D)

Butir penutup A–D sudah disetujui pemilik; aturan di bawah berlaku apa adanya
(tidak ada lagi yang bertanda menunggu).

| No | Aturan | Asal |
|---|---|---|
| 1 | **Satu rumus, di server.** Nilai dan syarat bonus dihitung di satu tempat; layar hanya menampilkan. | AP1; WAJ-04 |
| 2 | **Kinerja tidak menghitung ulang milik modul lain.** Ia membaca angka jadi dari pemiliknya: hadir, tepat waktu, izin, sakit, dan alpha dari Kehadiran dengan aturan yang sama dengan slip (termasuk toleransi 5 menit, KEH-22); tugas dari Tugas Harian; omzet dari Tarik Data Kasir; selisih kasir dari Laporan Kasir (Keuangan). | AP2; WAJ-03 |
| 3 | **Semua kriteria terukur dari data. Tidak ada nilai yang diketik orang.** Sumber "manual" sistem lama tidak dibawa. Hal yang belum tercatat di sistem belum bisa menjadi kriteria. | J3; untuk kalimat terakhir |
| 4 | **Ukuran yang tersedia di awal:** kehadiran, tepat waktu, tugas rutin dan kerapian display (dirinci di 7B), penjualan promo, target omzet (menyala setelah sambungan kasir hidup), dan ketelitian kasir. "Akurasi Stok" tidak dibawa. Daftar ukuran bisa ditambah (PRI-20). | J2, J5; KIN-A02 |
| 5 | **Kriteria diatur per jabatan per cabang**, bukan per nama orang; bertanggal berlaku; tidak dihapus, hanya dinonaktifkan. Mengubahnya tidak mengubah periode yang sudah lewat. Target omzet dan jatah rak cabang juga bertanggal berlaku. *(Dilapisi 7B.10 aturan 17: "jatah rak cabang" menjadi daftar rak; KIN-43.)* | J1, AP3, AP4; WAJ-05, WAJ-07 |
| 6 | **Rapor:** tiap orang punya nilai persen per kriteria dan nilai keseluruhan (rata-rata berbobot). Jumlah bobot satu kelompok harus 100; kalau tidak, pengaturan ditolak disimpan dengan menyebut selisihnya. Rapor tidak membawa uang. | AP5; KIN-A03 |
| 7 | **Semua kriteria memakai periode gaji 26–25.** | AP6 |
| 8 | **Kriteria yang belum ada datanya tidak ikut dihitung** dan ditandai "belum ada data", bukan dihitung 0. | J4; pengganti KIN-A04 |
| 9 | **Nilai punya dua tahap: Perkiraan dan Ditetapkan.** Ditetapkan sebelum slip ditutup oleh HR atau pemilik. Saat ditetapkan, rinciannya disimpan (tiap kriteria, angka mentah, waktu, siapa) dan tidak berubah lagi. | AP7; pengganti KIN-A18, A19 |
| 10 | **Koreksi setelah ditetapkan** berupa catatan koreksi beralasan; selisih uangnya masuk slip berikutnya. Yang belum ditetapkan saat slip ditutup, bonusnya masuk slip berikutnya. | AP8; GAJ-50 |
| 11 | **Karyawan melihat rapornya utuh:** Perkiraan atau Ditetapkan, angka di balik tiap persen ("hadir 22 dari 24 hari"), dan bonus yang didapat beserta syaratnya. | AP9; pengganti KIN-A24, A25 |
| 12 | **Hak di satu daftar:** kepala cabang melihat rapor timnya (tidak menilai); HR dan pemilik melihat semua; finance tidak punya menu Kinerja. Yang tidak berhak tidak melihat menunya. | AP10, J3; pengganti KIN-A22 |
| 13 | **Bonus Terukur.** Satu aturan bonus berisi: ukuran (dari daftar aturan 4), syarat (batas angka), rentang (per hari, per periode, atau sekian periode berturut-turut), nominal, jabatan dan cabang penerima, dan sumber dana; bertanggal berlaku. Mesin menilai terpenuhi atau tidak dari data dan menyimpan angka buktinya. Hasilnya masuk halaman Persetujuan Bonus, lalu Buku Bonus (GAJ-24, GAJ-26). Pemilik boleh membuat aturan sebanyak yang dibutuhkan. | J1; pengganti KIN-A20 dan KAR-19 (nominal maksimal per orang); pelapis GAJ-29 (syarat dinilai mesin, bukan dicentang) |
| 14 | **Contoh aturan dari pemilik** (angkanya contoh, diisi di pengaturan): selisih kasir satu hari tidak lebih dari batas toleransi → bonus per hari; jumlah selisih satu periode tidak lebih dari batas → bonus per periode; tiga periode berturut-turut tanpa izin dan sakit → bonus; satu periode tanpa telat → bonus. | J1; untuk dua contoh kasir, untuk bacaannya |
| 15 | **Sumber dana tiap aturan bonus adalah pengaturan** (GAJ-25) dan ditentukan pemilik. Aturan bonus tidak bisa diaktifkan sebelum sumber dananya dipilih. Kalau sumbernya Dana Disiplin, pengesahan yang melebihi saldo ditolak (GAJ-34). | J1 |
| 16 | **Satu kesalahan mengenai dua kali:** telat dan tidak hadir boleh (potongan di slip dan syarat bonus). Kehilangan barang tidak menjadi kriteria. Selisih kasir boleh menjadi syarat bonus ketepatan. | J2 |
| 17 | **Bonus Kinerja (bertingkat per siklus), Ranking Disiplin, dan Tabungan Loyalitas tetap ditunda** sebagai fitur tambahan setelah v3 jadi. | keputusan pembagian Bab 7; GAJ-31 |
| 18 | **Produk promo dipilih dari daftar produk kasir**, tidak diketik. Target dibuat per cabang per periode gaji, boleh dibatasi untuk jabatan tertentu. Target dan tarif yang sudah berjalan tidak diubah; perubahan berlaku periode berikutnya. Produk tidak dihapus, hanya dinonaktifkan. | AP11; pengganti KIN-A27, A29 |
| 19 | **Bonus promo hanya per pcs, dengan dua tarif:** target cabang tercapai atau belum. Tercapai dihitung dari penjualan satu cabang; tiap orang dibayar menurut pcs yang ia laporkan sendiri. Cara persen tidak dibawa. | J6, J7; bawa GAJ-C18; pengganti GAJ-C19 |
| 20 | **Melapor:** jumlah, tanggal struk, nomor struk, dan foto struk. Batas lapor 3 hari sejak tanggal struk; lewat itu laporan tetap diterima dan bonusnya dipotong 50%. Angka 3 hari dan 50% adalah pengaturan bertanggal berlaku. Tanggal kelonggaran yang ditulis di kode tidak dibawa. | J8; pengganti KIN-A33, GAJ-C21 |
| 21 | **Struk hanya bisa dilaporkan ke produk yang berlaku pada tanggal struknya.** Struk periode lalu tetap diterima; bonusnya masuk slip berikutnya dengan keterangan periode asal. | AP12; GAJ-50; pengganti KIN-A31 |
| 22 | **Penjaga dobel:** nomor struk yang sama untuk produk yang sama ditolak. Setelah sambungan kasir hidup, laporan dicocokkan dengan transaksi kasir. | AP13; pengganti KIN-A32 |
| 23 | **Laporan promo tidak dihapus dan tidak diubah diam-diam.** Karyawan melihat daftar laporannya dan alasan penolakan, dan boleh membatalkan laporan yang belum diperiksa. Pemeriksa boleh mengoreksi jumlah dengan jejak; tidak boleh memeriksa laporannya sendiri. Keputusan yang sudah masuk slip tertutup tidak dibuka lagi; koreksinya baris baru. | AP14; PRI-02; pengganti KIN-A34, A35, A36 |
| 24 | **Yang memeriksa laporan promo: HR dan pemilik**, di halaman Persetujuan Bonus. Finance hanya melihat. Laporan yang menunggu lebih dari 3 hari kerja ditandai untuk HR dan pemilik. | AP14, J8; GAJ-26 |
| 25 | **Bonus promo menjadi baris Buku Bonus saat periode berakhir**, ketika tercapai atau tidaknya target sudah pasti. Sebelum itu karyawan melihatnya sebagai perkiraan dengan dua kemungkinan tarif. | akibat aturan 19 dan GAJ-24 (tambahan Claude, disampaikan di percakapan) |

### Temuan dan aturan yang mengatasinya

| Temuan di sistem lama | Diatasi oleh |
|---|---|
| Rumus nilai ditulis tiga kali | Aturan 1 |
| Kehadiran dihitung dengan rumus ketiga, tanpa toleransi; keterangan di layar berbeda dari rumus | Aturan 2 |
| Kriteria tanpa data dihitung 0 | Aturan 8 |
| Kriteria, target, dan jatah rak tanpa tanggal berlaku; bisa dihapus | Aturan 5 |
| Rekap bisa ditimpa kapan saja; rincian tidak disimpan | Aturan 9, 10 |
| Kepala cabang dan finance membuka halaman kosong | Aturan 12 |
| Nilai manual bergantung pada penilai | Aturan 3 |
| Kehilangan barang dan selisih kas mengenai orang dua kali | Aturan 4, 16 |
| Karyawan hanya melihat persen | Aturan 11 |
| Nominal bonus per nama orang | Aturan 5, 13 |
| Tiga arti "bulan" | Aturan 7 |
| Laporan promo tidak pernah diperiksa, tanpa pengingat | Aturan 24 |
| Nama produk diketik bebas; target dan tarif bisa diubah di tengah jalan | Aturan 18 |
| Tanggal struk tidak dicocokkan dengan periode | Aturan 21 |
| Tidak ada penjaga dobel | Aturan 22 |
| Laporan disetujui bisa dikembalikan kapan saja; baris bisa dihapus dari database | Aturan 23 |
| Karyawan tidak melihat laporannya dan alasan penolakan | Aturan 23 |
| Angka 3 hari, 50%, dan tanggal kelonggaran ditulis di kode | Aturan 20 |

Semua aturan yang menghasilkan uang di atas masuk daftar tes wajib (WAJ-06).

### Titipan dari 7A

- Untuk 7B: cara menghitung "tugas rutin" dan "kerapian display" sebagai
  ukuran (KIN-A10, KIN-A14); jatah rak dibagi ke siapa.
- Untuk 7D: GAJ-29 dan GAJ-31 diberi catatan pelapis (Bonus Terukur); KAR-19
  ditutup (nominal maksimal per orang tidak dibawa); kamus istilah: rapor,
  Bonus Terukur, ukuran, syarat, rentang.
- Untuk Bab 6 (sudah ditetapkan, hanya dibaca): selisih kasir per orang per
  hari dibaca dari Laporan Kasir (KEU-55).
- Terbuka dan tidak ditanyakan lagi sampai pemilik menyampaikannya: sumber
  dana tiap aturan bonus; daftar aturan bonus dan angkanya.
- Sistem lama (tidak disentuh, WAJ-09): 18 laporan promo menunggu diperiksa;
  4 di antaranya struk periode September.

---

# Bagian 7B: Tugas Harian dan Catatan Meeting

Ukuran: **sedang**. Digali 12 Oktober 2026, database sudah dicek.

Sumber: `hris-app/app/(dashboard)/tugas-harian/page.tsx` (701 baris),
`components/dailyTasks/` (4 file), `app/(dashboard)/catatan-meeting/page.tsx`
(101), `components/meeting/` (5 file), `lib/meeting.ts` (136); 20 fungsi
database tugas harian (antara lain `save_daily_task`, `submit_daily_task_log`,
`submit_daily_task_before`, `submit_daily_task_after`,
`cancel_daily_task_before`, `review_daily_task_log`, `daily_task_progress_row`,
`daily_task_workdays`, `daily_task_bucket_key`, `daily_task_visible`,
`get_employee_task_completion_pct`, `get_employee_rack_display_pct`) dan 8
fungsi meeting (`save_meeting_task`, `submit_meeting_task_report`,
`review_meeting_task_member`, `meeting_note_visible`, `mark_meeting_note_read`,
dan pendukungnya); kebijakan akses dan kunci hubung tabel-tabelnya.

Yang sudah diputuskan dan tidak ditanyakan lagi:

- Semua yang dinilai harus terukur dari data; tidak ada nilai yang diketik
  orang (7A.10 aturan 3). Tugas rutin dan kerapian display termasuk ukuran yang
  tersedia di awal (7A.10 aturan 4), dan Kinerja membaca angka jadinya dari
  Tugas Harian (7A.10 aturan 2).
- Kriteria dan jatah rak diatur per jabatan per cabang, bertanggal berlaku
  (7A.10 aturan 5); periode 26–25 (aturan 7).
- Semua jam dari server (PRI-01); data tidak dihapus, hanya dibatalkan
  (PRI-02); perubahan aturan yang menyangkut karyawan diumumkan di Papan
  Perubahan Aturan dengan tanda "sudah saya baca" (PRI-29); pengingat lewat
  aplikasi (PRI-25).

## 7B.1 Bagian ini mengurus apa

Dua hal. **Tugas & Laporan**: pemilik atau HR meminta laporan dari karyawan,
berulang (harian, mingguan, per periode) atau sekali jalan, dengan atau tanpa
foto; sistem menghitung berapa jatah lapor yang dikerjakan. **Catatan
Meeting**: hasil rapat ditulis, ditujukan ke orang tertentu, bisa diberi tanda
"sudah saya baca", dan bisa melahirkan tugas tindak lanjut yang dilaporkan lalu
diperiksa.

## 7B.2 Data di sistem lama (dicek ke database, 12 Oktober 2026)

| Data | Isinya | Tabel | Jumlah baris |
|---|---|---|---|
| Master judul tugas | Judul, penjelasan, kebutuhan foto (tanpa, satu foto, sebelum dan sesudah), aktif | `daily_task_templates` | 1 (sebelum dan sesudah) |
| Tugas | Judul dari master, pengulangan, mode (individu atau tim), tenggat, aktif | `daily_tasks` | 1: harian, individu, aktif, dibuat 2 Oktober 2026 |
| Sasaran tugas | Cabang, divisi, atau nama orang | `daily_task_audiences` | 5 (1 cabang, 1 divisi, 3 orang); mengenai 11 karyawan aktif |
| PIC tugas tim | Satu orang per cabang | `daily_task_pics` | 0 |
| Laporan tugas | Orang, tanggal, isi dan foto sebelum, isi dan foto sesudah, jam kirim, tahap, tanda tidak valid dan alasannya | `daily_task_logs` | 44, dari 9 orang, 2–12 Oktober 2026; 1 masih menunggu foto sesudah; **0 pernah ditandai tidak valid** |
| Catatan meeting | Judul, tanggal, jenis (pembahasan atau aturan/SOP), isi, tindak lanjut, draf atau terbit, internal, tanpa notifikasi, sasaran | `meeting_notes`, `meeting_note_audiences` | 10, **semuanya bertanggal 16 September 2026**, satu pembuat; 9 terbit dan kesembilannya "tanpa notifikasi"; 2 internal; 2 berjenis aturan/SOP; 4 diubah setelah terbit |
| Tanda sudah baca | Catatan, orang, waktu | `meeting_note_reads` | **0** |
| Tugas dari meeting | Judul, penjelasan, individu atau tim, lapor sekali atau berulang, tenggat, wajib foto | `meeting_tasks` | 2, keduanya tanpa tenggat |
| Anggota tugas meeting | Orang, kelompok cabang, PIC, status, laporan akhir pertama dan terakhir, disetujui, catatan revisi, jumlah revisi | `meeting_task_members` | 3 |
| Laporan tugas meeting | Progres atau akhir, isi, foto | `meeting_task_reports` | 1 (akhir, berfoto, sudah disetujui) |

Keadaan data:

- **Tugas & Laporan baru dipakai 11 hari dan isinya satu tugas saja**: tugas
  harian berfoto sebelum dan sesudah, dengan sasaran yang sama susunannya
  dengan kriteria KPI "Kerapian Display" (7A.2: satu cabang, satu divisi, tiga
  orang). Mode tim, mingguan, bulanan, sekali jalan, dan tugas tanpa foto
  **belum pernah dipakai**.
- **Catatan Meeting hampir tidak dipakai**: sepuluh catatan dimasukkan untuk
  satu tanggal rapat, semuanya diterbitkan tanpa notifikasi, sehingga tombol
  "Sudah Saya Baca" tidak pernah muncul untuk siapa pun. Sejak itu tidak ada
  catatan baru. Tugas dari meeting: dua, dengan satu laporan.
- Dari 43 rangkaian foto yang selesai, **24 dikirim sebelum dan sesudahnya
  berjarak kurang dari 2 menit** (paling cepat di menit yang sama; nilai
  tengah 2 menit). Dari data tidak bisa dibedakan: rak memang cepat dirapikan,
  atau kedua foto diambil setelah pekerjaan selesai.
- 8 rangkaian jumlah foto sebelum dan sesudahnya berbeda. 2 rangkaian foto
  sesudahnya dikirim di hari lain.
- 4 kali satu orang mengirim lebih dari satu rangkaian dalam sehari (paling
  banyak 3).
- Tidak ada laporan di hari libur terjadwal.

## 7B.3 Aturan yang ditemukan

### Tugas & Laporan: membuat tugas

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| KIN-B01 | Judul tugas tidak diketik saat membuat tugas; dipilih dari **Master Judul**. Master berisi judul, penjelasan, dan kebutuhan foto: tanpa foto, satu foto bebas, atau sebelum dan sesudah (dua tahap). | `save_daily_task_template`, `save_daily_task` |
| KIN-B02 | Master bisa diubah kapan saja, termasuk judul dan **kebutuhan fotonya**, dan perubahan itu langsung mengenai tugas yang sedang berjalan beserta riwayatnya. Master tidak bisa dihapus dari layar, hanya dinonaktifkan. | `save_daily_task_template` |
| KIN-B03 | Empat pengulangan: harian (tiap hari kerja), mingguan (Senin sampai Minggu), bulanan (per periode gaji 26–25), dan sekali jalan (wajib bertenggat). Tiga yang pertama "terhubung ke KPI"; sekali jalan tidak. | `CADENCE_HINT`, `save_daily_task` |
| KIN-B04 | Dua mode: **individu** (tiap orang melapor sendiri) dan **tim** (satu PIC per cabang melapor, hasilnya berlaku untuk semua orang cabang itu yang terkena tugas). PIC harus karyawan aktif cabang itu. | `save_daily_task`, `daily_task_reporter_for` |
| KIN-B05 | Sasaran: semua karyawan, atau gabungan cabang, divisi, dan nama orang. Yang membuat dan mengubah: **pemilik dan HR saja**. | `save_daily_task`, kebijakan `daily_tasks_write` |
| KIN-B06 | Layar menulis "daftar orang ditetapkan saat tugas dibuat". Kenyataannya sasaran cabang dan divisi **dihitung ulang setiap saat**: orang yang pindah ke cabang itu langsung terkena tugas, yang pindah keluar langsung lepas. Panduan tidak sesuai kenyataan. | `daily_task_visible`, `get_daily_task_progress_admin` |
| KIN-B07 | Setelah dibuat, yang bisa diubah hanya tenggat, aktif atau tidak, dan PIC. Mengganti sasaran: hapus lalu buat ulang. | `update_daily_task` |
| KIN-B08 | **Menghapus tugas menghapus semua laporannya** (termasuk yang sudah dihitung ke KPI). Menonaktifkan tugas menyembunyikannya dari karyawan dan membuatnya tidak dihitung lagi, juga untuk periode yang sudah lewat. | `handleDelete`, kunci hubung `daily_task_logs_task_id_fkey`, `get_employee_task_completion_pct` |

### Tugas & Laporan: melapor

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| KIN-B09 | Laporan berisi tulisan (minimal 5 huruf) dan foto (paling banyak 5) kalau diwajibkan. **Tanggal laporan selalu hari ini menurut jam server**; tidak bisa melapor untuk kemarin. | `submit_daily_task_log` |
| KIN-B10 | Tugas tanpa foto atau satu foto: satu laporan per hari, per minggu, atau per periode; laporan kedua ditolak. | sama |
| KIN-B11 | Tugas sebelum dan sesudah: kirim foto sebelum, kerjakan, lalu kirim foto sesudah. Selama foto sesudah belum dikirim, rangkaian baru tidak bisa dimulai. **Rangkaian boleh diulang berkali-kali dalam sehari.** | `submit_daily_task_before`, `submit_daily_task_after` |
| KIN-B12 | Tidak ada jarak waktu minimal antara foto sebelum dan sesudah, dan jumlah foto keduanya tidak harus sama. Foto dipilih dari berkas handphone (boleh dari galeri), bukan wajib dari kamera. | `ReportModal.tsx`, `submit_daily_task_after` |
| KIN-B13 | Foto sesudah yang baru dikirim di hari lain tetap dihitung untuk tanggal foto sebelumnya. | `submit_daily_task_after` |
| KIN-B14 | Foto sebelum yang belum diselesaikan boleh dibatalkan pelapornya; barisnya **dihapus**. | `cancel_daily_task_before` |
| KIN-B15 | Tugas sekali jalan yang dilaporkan setelah tenggat tetap diterima dan ditandai terlambat. | `daily_task_progress_row` |
| KIN-B16 | Karyawan melihat tugasnya, kemajuan periode berjalan ("7/9"), dan riwayat laporannya. Tugas yang belum dilapor memunculkan angka merah di menu. | `get_my_daily_task_progress`, `get_daily_task_badge_count` |

### Tugas & Laporan: menghitung jatah (titipan KIN-A10)

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| KIN-B17 | **Jatah harian** = jumlah hari kerja orang itu dalam periode, dihitung sampai hari ini. Yang bukan hari kerja: hari libur terjadwal, dan hari berstatus cuti, sakit, atau izin. **Hari alpha dan hari tanpa catatan absen tetap dihitung jatah.** Hari sebelum tanggal bergabung tidak dihitung. | `daily_task_workdays` |
| KIN-B18 | **Jatah mingguan** = jumlah minggu (Senin sampai Minggu) yang tersentuh periode sampai hari ini; minggu yang terpotong pergantian periode dihitung di kedua periode. **Jatah bulanan** = 1. | `daily_task_bucket_key`, `daily_task_progress_row` |
| KIN-B19 | Jatah dihitung mulai tanggal tugas dibuat. Untuk orang yang baru terkena tugas di tengah jalan (pindah cabang), jatahnya tetap dihitung dari tanggal tugas dibuat. | `daily_task_progress_row` |
| KIN-B20 | Yang dihitung "dikerjakan" = jumlah hari (atau minggu, atau periode) yang punya sedikitnya satu laporan selesai dan tidak ditandai tidak valid. Melapor di hari libur diterima tetapi tidak dihitung. | sama |
| KIN-B21 | Nilai **Tugas Rutin** di KPI = jumlah "dikerjakan" dibagi jumlah jatah dari semua tugas berulang yang **aktif saat dihitung**. Tugas tim: laporan PIC dihitung untuk semua anggota cabangnya. | `get_employee_task_completion_pct` |
| KIN-B22 | Nilai **Kerapian Display** di KPI menghitung **jumlah rangkaian** (bukan jumlah hari) orang itu pada satu judul tugas, dibagi jatah raknya (KIN-A14). Satu laporan yang sama bisa terhitung di dua kriteria (Tugas Rutin dan Kerapian Display). Rak tidak didaftar: sistem tidak tahu rak mana yang dirapikan, dan rak yang sama difoto dua kali terhitung dua. | `get_employee_rack_display_pct` |
| KIN-B23 | Hitungan tidak pernah disimpan. Semuanya dihitung ulang tiap halaman dibuka, sehingga angka periode lalu ikut berubah kalau jadwal libur, absen, atau tugasnya diubah belakangan. | semua fungsi di atas |

### Tugas & Laporan: memeriksa

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| KIN-B24 | **Laporan langsung dihitung tanpa diperiksa siapa pun.** Tidak ada tahap setuju. Yang ada hanya tombol "tandai tidak valid" (beralasan) untuk pemilik dan HR, dan tombol membatalkannya. | `review_daily_task_log` |
| KIN-B25 | Tanda tidak valid bisa dipasang dan dicabut kapan saja, termasuk untuk periode yang sudah lewat. Saat dicabut, alasan dan nama penandanya hilang. Karyawan melihat tandanya di riwayat, tetapi tidak diberi tahu. | sama |
| KIN-B26 | Yang melihat kemajuan semua orang: pemilik dan HR. **Kepala cabang tidak melihat kemajuan timnya** dan tidak bisa membuat tugas. | `get_daily_task_progress_admin` |
| KIN-B27 | Database mengizinkan pemilik dan HR mengubah isi baris laporan secara langsung (bukan hanya tandanya); layar tidak menyediakannya. | kebijakan `daily_task_logs_review` |

### Catatan Meeting

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| KIN-B28 | Catatan dibuat pemilik atau HR: judul, tanggal rapat, jenis (Pembahasan atau Aturan/SOP), isi, tindak lanjut (tulisan bebas), dan sasaran. HR hanya bisa mengubah dan menghapus catatan buatannya sendiri; pemilik semua. | `MeetingNotes.tsx`, kebijakan `meeting_notes_*` |
| KIN-B29 | Dua tahap: draf (hanya pemilik dan HR) dan terbit. Ada pilihan "Internal Owner/HR saja" dan "terbitkan tanpa notifikasi". | sama |
| KIN-B30 | Yang melihat catatan terbit: sasarannya, orang yang mendapat tugas dari catatan itu, dan **semua akun finance** (ditulis di kode, tanpa melihat sasaran). | `meeting_note_visible` |
| KIN-B31 | Karyawan menekan "Sudah Saya Baca"; pemilik dan HR melihat siapa yang belum. Tombol itu tidak muncul untuk catatan tanpa notifikasi. | `mark_meeting_note_read`, `get_meeting_note_read_status` |
| KIN-B32 | Catatan terbit **bisa diubah kapan saja tanpa jejak**; yang sudah menekan "sudah baca" tidak diminta membaca ulang. | `save` |
| KIN-B33 | Menyimpan catatan adalah tiga langkah lepas dari layar (catatan, hapus sasaran, isi sasaran); kalau langkah kedua atau ketiga gagal, catatan tersimpan dengan sasaran kosong. | `save` |
| KIN-B34 | **Menghapus catatan menghapus semua tugas dan laporannya.** | `handleDelete`, kunci hubung `meeting_tasks_note_id_fkey` |
| KIN-B35 | Jenis "Aturan/SOP" hanya label. Tidak ada tanggal berlaku, tidak ada "sebelumnya bagaimana", tidak ada riwayat. | `note_type` |

### Tugas dari meeting

| No | Aturan di sistem lama | Sumber |
|---|---|---|
| KIN-B36 | Dari satu catatan, pemilik atau HR membuat tugas: judul diketik, individu atau tim (satu PIC per cabang; PIC boleh dari cabang lain), lapor sekali atau berulang (boleh lapor progres berkali-kali lalu satu laporan akhir), tenggat (tidak wajib), wajib foto atau tidak. | `save_meeting_task` |
| KIN-B37 | Daftar orangnya **ditetapkan saat tugas dibuat** dan tidak berubah (berbeda dari KIN-B06). | sama |
| KIN-B38 | Lima status: belum dikerjakan, sedang dikerjakan, menunggu diperiksa, perlu revisi, selesai. Laporan akhir **diperiksa** pemilik atau HR: setuju, atau minta revisi dengan catatan. Jumlah revisi dihitung. | `submit_meeting_task_report`, `review_meeting_task_member` |
| KIN-B39 | Telat dihitung dari laporan akhir **pertama**, supaya revisi tidak menghapus catatan telat. Keterangan di kode menyebut "nanti dipakai untuk KPI"; KPI tidak pernah membacanya. | `lateInfo` |
| KIN-B40 | Judul, penjelasan, tenggat, dan wajib foto bisa diubah kapan saja tanpa jejak; memundurkan tenggat menghapus tanda telat. Tugas bisa dihapus beserta laporannya. Yang sudah disetujui tidak bisa dibuka lagi. | `TaskFormModal.tsx`, `deleteTask` |
| KIN-B41 | Tidak ada larangan memeriksa laporan sendiri, dan tidak ada batas waktu memeriksa. | `review_meeting_task_member` |

## 7B.4 Menu di sistem lama

| Menu | Sub menu | Dipakai untuk apa | Mirip dengan menu lain? |
|---|---|---|---|
| SDM › Tugas & Laporan | Master Judul, Tugas Baru, Lihat Progres | Membuat tugas, melihat kemajuan dan foto, menandai tidak valid | Tugas dari meeting |
| Pekerjaan › Tugas & Laporan | — | Karyawan melapor | Halaman yang sama, tampilan lain |
| Catatan Meeting | Catatan; Tugas & Laporan | Menulis hasil rapat; membuat, melihat, dan memeriksa tugas tindak lanjut | Tugas & Laporan; Papan Perubahan Aturan (PRI-29) |
| Pekerjaan › Catatan Meeting | Catatan; Tugas Saya | Karyawan membaca dan melapor | sama |

## 7B.5 Tumpang tindih

1. **Dua mesin tugas** yang tidak saling kenal: Tugas & Laporan, dan tugas di
   dalam Catatan Meeting. Keduanya punya individu atau tim, PIC per cabang,
   sasaran, tenggat, foto, dan jendela lapor sendiri-sendiri (dua
   `TaskFormModal`, dua `ReportModal`). "Sekali jalan" ada di keduanya.
2. **Dua cara memeriksa**: tugas meeting disetujui atau direvisi; tugas harian
   tidak diperiksa, hanya bisa ditandai tidak valid.
3. **Dua arti "daftar orang"**: dihitung ulang terus (tugas harian) dan
   ditetapkan saat dibuat (tugas meeting); layar memakai kalimat yang sama.
4. **Cara memperluas sasaran menjadi daftar orang ditulis empat kali**: dua di
   layar, dua di database.
5. **"Hari kerja" dihitung sendiri** oleh Tugas Harian (hitungan keempat, di
   samping slip, Ranking, dan KPI).
6. **Satu laporan terhitung di dua kriteria KPI** (KIN-B22).
7. **Catatan jenis Aturan/SOP dan tombol "Sudah Saya Baca"** adalah isi Papan
   Perubahan Aturan (PRI-29).
8. Foto tugas harian disimpan di map bernama `meeting_tasks`.

## 7B.6 Kejadian di lapangan dan jalan keluarnya

| Kejadian | Di sistem lama | Ada jalan keluar? |
|---|---|---|
| Lupa melapor kemarin | Tidak bisa lapor mundur; jatah hari itu hilang | Tidak |
| Tidak masuk tanpa izin (alpha) | Hari itu tetap dihitung jatah | Tidak (memang akibat alpha) |
| Sakit atau izin yang baru dicatat belakangan | Jatah berkurang setelah absennya dibetulkan; nilai periode itu berubah sendiri | Ya, tanpa jejak |
| Salah kirim foto sebelum | Batalkan; baris dihapus | Ya |
| Salah kirim laporan yang sudah selesai | Tidak bisa dibetulkan pelapor | Hanya kalau ditandai tidak valid lalu lapor ulang (tugas harian: hari itu juga) |
| Foto sesudah baru dikirim besoknya | Dihitung untuk kemarin | Ya, diam-diam |
| Laporan ditandai tidak valid | Karyawan tidak diberi tahu; untuk tugas harian tidak bisa lapor ulang di hari lain | Tidak |
| PIC tim libur, sakit, atau pindah cabang | Tidak ada yang bisa melapor sampai pemilik atau HR mengganti PIC | Hanya lewat pemilik atau HR |
| Karyawan pindah cabang | Langsung terkena tugas cabang baru, dengan jatah sejak tugas dibuat | Tidak |
| Tugas tidak lagi diperlukan | Nonaktifkan: hilang dari hitungan periode lalu juga. Hapus: laporan ikut hilang | Tidak ada "berhenti mulai tanggal" |
| Kebutuhan foto perlu diganti | Mengubah master mengubah tugas berjalan | Tidak ada versi |
| Catatan meeting salah setelah terbit | Diubah langsung, tanpa jejak | Ya, tanpa jejak |
| Laporan tugas meeting tidak pernah diperiksa | Menunggu selamanya | Tidak |
| Tenggat tugas meeting dimundurkan | Tanda telat hilang | Tanpa jejak |

## 7B.7 Pertanyaan untuk pemilik (diajukan di percakapan, 12 Oktober 2026)

Butuh pandangan pemilik:

1. **Catatan Meeting dibawa atau tidak, dan dalam bentuk apa.** Saran: dibawa
   dalam bentuk ringkas (arsip hasil rapat dan tugas tindak lanjutnya);
   catatan berjenis Aturan/SOP dan tombol "Sudah Saya Baca" pindah ke Papan
   Perubahan Aturan (PRI-29) supaya hanya ada satu tempat.
2. **Siapa yang boleh membuat tugas.** Sekarang hanya pemilik dan HR. Saran:
   kepala cabang (dan Kepala Gudang) boleh membuat tugas untuk timnya sendiri
   dan melihat kemajuannya; HR dan pemilik untuk semua.
3. **Laporan tugas perlu diperiksa atau tidak**, mengingat hasilnya akan
   menjadi syarat bonus. Saran: tetap dihitung otomatis tanpa persetujuan per
   laporan, tetapi dijaga mesin (foto dari kamera, jarak waktu minimal, tanda
   otomatis untuk yang janggal) dan bisa ditandai tidak sah dengan alasan.
4. **Kerapian display di lapangan.** Siapa merapikan rak mana, dan seberapa
   sering. Saran: rak didaftar per cabang, tiap rak punya penanggung jawab,
   lapor per rak; ukuran = rak tanggung jawabnya yang dirapikan sesuai jadwal.

## 7B.8 Usulan untuk v3 (disetujui pemilik, lihat 7B.9)

| No | Usulan | Dasar |
|---|---|---|
| AQ1 | **Satu mesin Tugas.** Tugas rutin, tugas sekali jalan, dan tugas tindak lanjut rapat memakai satu daftar, satu jendela lapor, dan satu cara memeriksa. Tugas dari rapat adalah tugas sekali jalan yang bertaut ke catatannya. | WAJ-04; 7B.5 butir 1–4 |
| AQ2 | **Sasaran tugas rutin per jabatan per cabang**, bukan nama orang. Tugas sekali jalan boleh ditujukan ke orang tertentu. Orang yang pindah cabang atau jabatan terkena tugas barunya **mulai tanggal pindah**, dengan jatah dihitung dari tanggal itu. | WAJ-05; KIN-B06, B19 |
| AQ3 | **Tugas dan master judul tidak dihapus dan bertanggal berlaku.** Tugas dihentikan "mulai tanggal"; periode sebelum itu tetap terhitung. Kebutuhan foto dan judul yang sudah punya laporan tidak diubah; perubahannya menjadi versi baru yang berlaku ke depan. | PRI-02, WAJ-07; KIN-B02, B08 |
| AQ4 | **Jatah lapor membaca hari kerja dari Kehadiran**, bukan menghitung sendiri: hari libur terjadwal, cuti, izin, sakit, dan hari tutup tidak dihitung; alpha tetap dihitung. Mingguan: Senin sampai Minggu, minggu yang terpotong dihitung di periode tempat hari Minggunya jatuh. Per periode: 26–25. | WAJ-03; KIN-B17, B18 |
| AQ5 | **Hitungan disimpan saat rapor ditetapkan** (jatah, dikerjakan, tidak sah) dan tidak berubah lagi; sebelum itu tampil sebagai perkiraan. | 7A.10 aturan 9; KIN-B23 |
| AQ6 | **Lapor hanya untuk hari ini, jam dari server; tidak ada lapor susulan.** Lupa lapor berarti jatah itu tidak dikerjakan. | PRI-01; KIN-B09 |
| AQ7 | **Penjaga foto:** foto diambil dari kamera saat itu, bukan dari galeri; jumlah foto sesudah sama dengan foto sebelum; jarak minimal sebelum ke sesudah adalah pengaturan (isi awal 5 menit); foto sesudah harus di hari yang sama, kalau tidak rangkaian itu gugur dan tercatat gugur. | KIN-B12, B13 |
| AQ8 | **Tidak ada yang dihapus:** foto sebelum yang dibatalkan tercatat "dibatalkan"; laporan salah dibatalkan pelapornya sebelum hari itu berakhir, lalu boleh lapor ulang. | PRI-02; KIN-B14 |
| AQ9 | **Tanda tidak sah** beralasan dan berjejak; pencabutannya juga berjejak. Karyawan diberi tahu dan melihat alasannya. Tidak bisa menandai laporan sendiri. Setelah rapor ditetapkan tidak bisa lagi; koreksinya lewat catatan koreksi (7A.10 aturan 10). | KIN-B24, B25, B27 |
| AQ10 | **Tugas tim punya jalan keluar:** kalau PIC tidak masuk hari itu, anggota tim cabang itu yang hadir boleh melapor, dan tercatat siapa yang melapor. | WAJ-11; 7B.6 |
| AQ11 | **Tugas sekali jalan:** tenggat wajib; laporan akhir diperiksa pembuat tugas, HR, atau pemilik (setuju atau revisi); telat dihitung dari laporan akhir pertama; mengubah tenggat berjejak; pemeriksa tidak memeriksa laporannya sendiri; yang menunggu diperiksa lebih dari 3 hari kerja ditandai. | KIN-B38 s.d. B41 |
| AQ12 | **Catatan rapat:** perubahan setelah terbit berjejak (versi lama bisa dilihat); tidak dihapus, hanya ditarik; disimpan dalam satu langkah; yang melihat hanya sasarannya dan yang berhak menurut daftar hak (tanpa pengecualian finance di kode). | PRI-02; KIN-B30, B32, B33, B34 |
| AQ13 | **Ukuran yang diserahkan ke Kinerja dari Tugas:** "tugas rutin dikerjakan" (dikerjakan dibagi jatah, per orang per periode) dan "kerapian display". Satu laporan hanya dihitung di satu ukuran. Tugas sekali jalan belum menjadi ukuran di awal. | 7A.10 aturan 2, 4; KIN-B21, B22 |

## 7B.9 Jawaban pemilik (12 Oktober 2026)

Perintah umum pemilik: "perbaiki semua temuan ini di sistem baru nanti".
Dicatat: semua temuan 7B diatasi di v3 (tabel "Temuan dan aturan yang
mengatasinya" di 7B.10); sistem lama tidak disentuh (WAJ-09).

| Pertanyaan | Jawaban pemilik | Dicatat sebagai |
|---|---|---|
| 1. Catatan Meeting dibawa atau tidak | "ok" | Dibawa dalam bentuk ringkas; Aturan/SOP dan "Sudah Saya Baca" pindah ke Papan Perubahan Aturan (aturan 20–22) |
| 2. Siapa boleh membuat tugas | "ok" | Kepala cabang dan Kepala Gudang untuk timnya; HR dan pemilik untuk semua (aturan 4) |
| 3. Laporan tugas diperiksa atau tidak | "bisakah ini di tangani mesin ? saya ikut saran anda" | Bisa. Laporan dihitung otomatis dan dijaga mesin; orang hanya memutuskan laporan yang ditandai (aturan 9–11) |
| 4. Kerapian display di lapangan | "ok" | Rak didaftar, tiap rak punya penanggung jawab, lapor per rak (aturan 17). Pemilik tidak menyebut siapa memegang rak mana dan seberapa sering; keduanya menjadi isi pengaturan |
| AQ1–AQ13 | "ok" | Disetujui semua |

Bacaan Claude yang disampaikan ke pemilik di percakapan (bukan pertanyaan
baru; diubah kalau pemilik mengoreksi):

- **Siapa menetapkan "tidak sah".** Di pertanyaan 3 Claude menyebut kepala
  cabang ikut bisa menandai tidak sah. Itu bertabrakan dengan keputusan 7A
  (kepala cabang melihat rapor timnya, **tidak menilai**; pengesah HR dan
  pemilik, GAJ-26), karena tanda tidak sah mengubah angka yang menjadi syarat
  bonus. Ditulis: kepala cabang **mengusulkan**, HR atau pemilik
  **menetapkan** (aturan 11).
- **Tugas buatan kepala cabang tidak otomatis masuk rapor.** Kalau tidak,
  kepala cabang bisa memengaruhi syarat bonus timnya lewat tugas yang ia buat
  sendiri. Yang masuk rapor ditandai HR atau pemilik (aturan 5).
- **Tanda "tidak sah" bukan nilai yang diketik orang** (7A.10 aturan 3): ia
  memutus sah atau tidaknya satu bukti, beralasan dan berjejak, bukan memberi
  angka.

**7B SELESAI dibahas** (23 aturan, 20 temuan dipetakan). Tidak ada pertanyaan
7B yang menunggu.

## 7B.10 Aturan yang dihasilkan (nomor v3 ditetapkan di 7D)

| No | Aturan | Asal |
|---|---|---|
| 1 | **Satu mesin Tugas.** Tugas rutin, tugas sekali jalan, dan tugas tindak lanjut rapat memakai satu daftar, satu jendela lapor, dan satu cara memperluas sasaran menjadi daftar orang, di server. | AQ1; WAJ-04 |
| 2 | **Jenis tugas:** rutin (harian, mingguan Senin sampai Minggu, per periode 26–25) dan sekali jalan (bertenggat). Tugas tindak lanjut rapat adalah tugas sekali jalan yang bertaut ke catatannya. Kebutuhan foto: tanpa foto, satu foto, atau sebelum dan sesudah. Mode: individu atau tim (satu PIC per cabang). | bawa KIN-B01, B03, B04, B36 |
| 3 | **Judul dipilih dari Master Judul. Master dan tugas tidak dihapus dan bertanggal berlaku.** Tugas dihentikan "mulai tanggal"; periode sebelum itu tetap terhitung. Judul dan kebutuhan foto yang sudah punya laporan tidak diubah; perubahannya menjadi versi baru yang berlaku ke depan. | AQ3; PRI-02, WAJ-07; pengganti KIN-B02, B08 |
| 4 | **Yang membuat tugas:** kepala cabang dan Kepala Gudang untuk timnya sendiri; HR dan pemilik (termasuk GM) untuk semua. Hak ini ada di daftar hak, bukan ditulis dengan nama jabatan di kode. | J2; WAJ-05; pengganti KIN-B05 |
| 5 | **Tugas yang menjadi ukuran rapor ditandai "masuk rapor" oleh HR atau pemilik.** Tugas buatan kepala cabang tidak otomatis masuk rapor. | bacaan Claude (7B.9) |
| 6 | **Sasaran tugas rutin per jabatan per cabang**, bukan nama orang. Tugas sekali jalan boleh ditujukan ke orang tertentu. Orang yang pindah cabang atau jabatan terkena tugas barunya mulai tanggal pindah, dengan jatah dihitung dari tanggal itu; layar menjelaskan hal ini apa adanya. | AQ2; WAJ-05, WAJ-10; pengganti KIN-B06, B19 |
| 7 | **Jatah lapor membaca hari kerja dari Kehadiran**, tidak menghitung sendiri: hari libur terjadwal, cuti, izin, sakit, dan hari tutup tidak dihitung; alpha tetap dihitung. Mingguan: minggu yang terpotong pergantian periode dihitung di periode tempat hari Minggunya jatuh. Jatah mulai dihitung sejak tugas berlaku dan sejak orang itu terkena tugas. | AQ4; WAJ-03; pengganti KIN-B17, B18 |
| 8 | **Lapor hanya untuk hari ini, jam dari server; tidak ada lapor susulan.** Lupa lapor berarti jatah itu tidak dikerjakan. Tugas sekali jalan yang lewat tenggat tetap bisa dilaporkan dan ditandai terlambat. | AQ6; PRI-01; bawa KIN-B09, B15 |
| 9 | **Penjaga foto (ditolak mesin kalau dilanggar):** foto diambil dari kamera saat itu, bukan dari galeri; jumlah foto sesudah sama dengan foto sebelum; jarak minimal dari foto sebelum ke sesudah (pengaturan, isi awal 5 menit); foto sesudah harus di hari yang sama, kalau tidak rangkaian itu gugur dan tercatat gugur. | AQ7, J3; PRI-32; pengganti KIN-B12, B13 |
| 10 | **Laporan dihitung otomatis; tidak disetujui satu per satu. Mesin menandai yang janggal** untuk dilihat orang: foto yang sama dipakai ulang, dikirim dari luar titik lokasi cabang, dikirim di luar jam kerja orang itu. Daftar tanda bisa ditambah dan batasnya adalah pengaturan. Tanda janggal tidak menggugurkan laporan; yang memutuskan orang (aturan 11). Mesin ini masuk layar Kesehatan Mesin. | J3; PRI-32, PRI-33; pengganti KIN-B24 |
| 11 | **Tanda "tidak sah":** diusulkan kepala cabang, ditetapkan HR atau pemilik; wajib beralasan dan berjejak, pencabutannya juga. Karyawan diberi tahu dan melihat alasannya. Tidak ada yang menetapkan untuk laporannya sendiri. Setelah rapor ditetapkan tidak bisa lagi; koreksinya lewat catatan koreksi (7A.10 aturan 10). Baris laporan tidak bisa diubah siapa pun. | AQ9, bacaan Claude (7B.9); pengganti KIN-B25, B27 |
| 12 | **Tidak ada yang dihapus.** Foto sebelum yang dibatalkan tercatat "dibatalkan". Laporan salah dibatalkan pelapornya sebelum hari itu berakhir, lalu boleh lapor ulang. | AQ8; PRI-02; pengganti KIN-B14 |
| 13 | **Tugas tim punya jalan keluar:** kalau PIC tidak masuk hari itu, anggota tim cabang itu yang hadir boleh melapor, dan tercatat siapa yang melapor. Laporan tim berlaku untuk anggota yang hari itu hari kerjanya. | AQ10; WAJ-11 |
| 14 | **Tugas sekali jalan:** tenggat wajib; lapor progres boleh, lalu satu laporan akhir; laporan akhir diperiksa pembuat tugas, HR, atau pemilik (setuju atau minta revisi dengan catatan); telat dihitung dari laporan akhir pertama; mengubah tenggat berjejak; pemeriksa tidak memeriksa laporannya sendiri; yang menunggu diperiksa lebih dari 3 hari kerja ditandai. | AQ11; bawa KIN-B38, B39; pengganti KIN-B40, B41 |
| 15 | **Hitungan disimpan saat rapor ditetapkan** (jatah, dikerjakan, tidak sah, gugur) dan tidak berubah lagi; sebelum itu tampil sebagai perkiraan. | AQ5; 7A.10 aturan 9; pengganti KIN-B23 |
| 16 | **Ukuran yang diserahkan ke Kinerja:** "tugas rutin dikerjakan" (dikerjakan dibagi jatah, per orang per periode, dari tugas bertanda masuk rapor) dan "kerapian display" (aturan 17). Satu laporan hanya dihitung di satu ukuran. Tugas sekali jalan belum menjadi ukuran di awal. | AQ13; 7A.10 aturan 2, 4; pengganti KIN-B21, B22 |
| 17 | **Kerapian display: rak didaftar per cabang**, tiap rak punya penanggung jawab dan jadwal (seberapa sering dirapikan), keduanya pengaturan bertanggal berlaku. Lapor per rak, foto sebelum dan sesudah. Ukuran = jatah rak tanggung jawabnya yang dirapikan sesuai jadwal dibagi seluruh jatahnya; jatah mengikuti hari kerja (aturan 7). Rak yang sama dilaporkan dua kali dalam satu jatah dihitung satu. Rak tanpa penanggung jawab ditandai untuk kepala cabang. Pembagian rata menurut abjad tidak dibawa. | J4; pengganti KIN-A14, KIN-B22; pelapis 7A.10 aturan 5 (jatah rak cabang menjadi daftar rak) |
| 18 | **Karyawan melihat** tugasnya, kemajuan periode berjalan, riwayat laporannya, dan laporan yang ditandai janggal, tidak sah, atau gugur beserta alasannya. Tugas yang belum dilapor memunculkan pengingat di aplikasi. | bawa KIN-B16; PRI-25 |
| 19 | **Kepala cabang melihat kemajuan timnya**; HR dan pemilik melihat semua. Yang tidak berhak tidak melihat menunya. | J2; 7A.10 aturan 12; pengganti KIN-B26 |
| 20 | **Catatan Rapat dibawa dalam bentuk ringkas:** judul, tanggal rapat, isi, sasaran, dan tugas tindak lanjutnya (aturan 2). Dua tahap: draf dan terbit. Dibuat HR dan pemilik. Catatan khusus HR dan pemilik tetap bisa dibuat (sasarannya hanya mereka). | J1; bawa KIN-B28, B29 |
| 21 | **Aturan dan SOP tidak ditulis di Catatan Rapat.** Tempatnya Papan Perubahan Aturan (PRI-29), yang punya tanggal berlaku, "sebelumnya bagaimana", riwayat, dan tanda "sudah saya baca". Jenis "Aturan/SOP", tombol "Sudah Saya Baca", dan pilihan "tanpa notifikasi" di Catatan Meeting tidak dibawa. | J1; PRI-29; pengganti KIN-B31, B35 |
| 22 | **Catatan Rapat tidak diubah diam-diam dan tidak dihapus:** perubahan setelah terbit berjejak (versi lama bisa dilihat); catatan hanya bisa ditarik, dan menariknya tidak menghapus tugas serta laporannya; disimpan dalam satu langkah; yang melihat hanya sasarannya dan yang berhak menurut daftar hak. | AQ12; PRI-02; pengganti KIN-B30, B32, B33, B34 |
| 23 | **Hitungan jatah, dikerjakan, dan kerapian display masuk daftar tes wajib**, karena menjadi syarat Bonus Terukur. | WAJ-06 |

### Temuan dan aturan yang mengatasinya

| Temuan di sistem lama | Diatasi oleh |
|---|---|
| Laporan dihitung tanpa diperiksa; tanda tidak valid tidak pernah dipakai | Aturan 9, 10, 11 |
| 24 dari 43 rangkaian foto berjarak kurang dari 2 menit; foto boleh dari galeri; jumlah foto berbeda | Aturan 9 |
| Foto sesudah dikirim di hari lain tetap dihitung | Aturan 9 |
| Menghapus tugas menghapus laporannya; menonaktifkan mengubah periode lalu | Aturan 3 |
| Master judul dan kebutuhan foto diubah di tengah jalan | Aturan 3 |
| Layar menyebut "daftar orang ditetapkan saat dibuat" padahal dihitung ulang terus | Aturan 6 |
| Orang pindah cabang mendapat jatah sejak tugas dibuat | Aturan 6, 7 |
| "Hari kerja" dihitung sendiri (hitungan keempat) | Aturan 7 |
| Minggu yang terpotong dihitung di dua periode | Aturan 7 |
| Hitungan tidak disimpan; angka periode lalu berubah sendiri | Aturan 15 |
| Satu laporan terhitung di dua kriteria | Aturan 16 |
| Rak tidak didaftar; jatah dibagi rata menurut abjad; rak yang sama terhitung dua | Aturan 17 |
| Foto sebelum yang dibatalkan dihapus; laporan salah tidak bisa dibetulkan | Aturan 12 |
| Tanda tidak valid tanpa jejak saat dicabut; karyawan tidak diberi tahu; baris bisa diubah dari database | Aturan 11 |
| Kepala cabang tidak melihat kemajuan timnya dan tidak bisa membuat tugas | Aturan 4, 19 |
| PIC tim tidak masuk, tidak ada yang bisa melapor | Aturan 13 |
| Dua mesin tugas, dua cara memeriksa, sasaran diperluas di empat tempat | Aturan 1, 2, 14 |
| Tugas meeting: tenggat tidak wajib dan bisa dimundurkan tanpa jejak; boleh memeriksa laporan sendiri; menunggu diperiksa selamanya | Aturan 14 |
| Catatan terbit diubah tanpa jejak; menghapus catatan menghapus tugasnya; simpan tiga langkah; finance melihat semua | Aturan 22 |
| Jenis Aturan/SOP hanya label; tanda "sudah baca" tidak pernah terpakai; bertumpuk dengan Papan Perubahan Aturan | Aturan 21 |

### Titipan dari 7B

- Untuk 7D: beri nomor KIN v3; kamus istilah (Tugas, Master Judul, jatah
  lapor, rangkaian, gugur, janggal, tidak sah, masuk rapor, daftar rak,
  Catatan Rapat); peta modul (Tugas membaca hari kerja, titik lokasi, dan
  jam kerja dari Kehadiran; menyerahkan dua ukuran ke Kinerja); 7A.10 aturan 5
  diberi catatan pelapis (jatah rak cabang menjadi daftar rak, aturan 17);
  PRI-29 diberi catatan bahwa aturan dan SOP dari rapat diumumkan di sana;
  `../../work/backlog/2026-10-11-susun-ulang-menu.md`: menu Catatan Meeting
  dan Tugas & Laporan menjadi satu kelompok.
- Terbuka dan tidak ditanyakan lagi sampai pemilik menyampaikannya (isi
  pengaturan saat menyiapkan tayang): daftar rak tiap cabang, penanggung
  jawabnya, dan seberapa sering tiap rak dirapikan; tugas mana yang masuk
  rapor.
- Sistem lama (tidak disentuh, WAJ-09): tugas kerapian display tetap berjalan
  apa adanya.

---

# Bagian 7D: Penetapan

Ukuran: **sedang**. Dikerjakan 12 Oktober 2026. Hasilnya
`../07-kinerja-rekrutmen.md` (KIN-01 s.d. 51), tanpa rekrutmen.

Ke-48 butir di 7A.10 dan 7B.10 dicocokkan satu per satu, antarbagian dan
dengan buku Karyawan, Kehadiran, Gaji, Logistik, Bab 5, Keuangan, dan PRI.
**Tidak ditemukan dua keputusan pemilik yang saling membatalkan.** Yang
ditemukan: satu usulan yang bertabrakan dengan aturan lain (butir 3) dan
empat hal yang belum diatur (butir 1, 2, 4, 5).

## 7D.1 Butir penutup (diajukan di percakapan, 12 Oktober 2026)

Semuanya "cukup ok atau tidak"; ditulis di buku aturan menurut saran Claude
dengan tanda ⏳.

1. **Orang yang pindah, masuk, atau berhenti di tengah periode.** Kriteria
   dan aturan bonus diatur per jabatan per cabang, tetapi belum ada aturan
   untuk orang yang berganti tempat di tengah periode (kejadian ini ada di
   7A.6 tanpa jalan keluar). Saran: rapor dan bonus per periode ikut tempat
   ia paling lama bekerja di periode itu; bonus per hari ikut tempat hari
   itu; hitungan berturut-turut tidak putus karena pindah; orang yang masuk
   atau berhenti di tengah periode baru dapat bonus per periode di periode
   yang dijalani penuh. (KIN-11)
2. **Kapan Bonus Terukur dinilai dan menjadi uang.** Belum diatur, padahal
   ada bonus per hari. Saran: mesin menghitung tiap hari sebagai perkiraan;
   diajukan ke Persetujuan Bonus sekali per periode setelah rapor
   ditetapkan; bonus per hari dijumlah menjadi satu baris dengan rincian
   harinya. (KIN-16)
3. **Finance dan laporan promo.** 7A.10 aturan 24 (dari AP14) menulis
   "finance hanya melihat". Itu bertabrakan dengan GAJ-46 (finance tidak
   melihat uang per orang, hanya total per periode) dan dengan 7A.10 aturan
   12 (finance tidak punya menu Kinerja). Saran: finance tidak melihat
   laporan promo per orang. (KIN-25)
4. **Siapa mengubah angka.** 7A.10 menyebut "pemilik" untuk aturan bonus dan
   sumber dana, tetapi tidak menyebut siapa mengatur kriteria rapor, target,
   dan tarif promo (di sistem lama: pemilik dan HR). Saran, mengikuti
   DRV-84 dan buku Keuangan: angka yang menyangkut uang (aturan Bonus
   Terukur, tarif promo, potongan telat lapor, sumber dana) hanya pemilik
   dan GM; HR mengatur yang tidak menyangkut uang. (KIN-48)
5. **Tidak ada yang memutuskan urusannya sendiri.** Sudah ada untuk laporan
   promo (7A.10 aturan 23) dan tanda tidak sah (7B.10 aturan 11), belum ada
   untuk menetapkan rapor dan mengesahkan bonus milik HR sendiri. Saran:
   berlaku untuk semuanya; milik HR diputuskan pemilik. (KIN-49)

## 7D.2 Jawaban pemilik

| Butir | Jawaban pemilik (12 Oktober 2026) | Dicatat sebagai |
|---|---|---|
| 1. Pindah, masuk, atau berhenti di tengah periode | "orang yang berhenti itu banyak faktor nya, jika dia tidak pamit baik2 dan tidak ikut aturan one month notice, maka semua nya hangus tidak perduli apapun (sisa gaji nya jadi tabungan untuk disiplin)" | **Belum dicatat sebagai aturan.** Bertabrakan dengan GAJ-02, 06, 30, 33, 53 dan menyangkut DRV-73; pertentangannya disampaikan dulu di percakapan beserta saran (lihat di bawah). Bagian pindah dan masuk tidak disebut pemilik; ditanyakan ulang. KIN-11 tetap bertanda ⏳ |
| 2. Bonus Terukur diajukan sekali per periode | "ok" | KIN-16 |
| 3. Finance tidak melihat laporan promo per orang | "ok" | KIN-25. Jenis: pengganti kalimat "finance hanya melihat" di 7A.10 aturan 24 |
| 4. Angka uang hanya pemilik dan GM; HR yang tidak menyangkut uang | "ok ikuti saran" | KIN-48 |
| 5. Tidak ada yang memutuskan urusannya sendiri | "ok" | KIN-49 |

Pertentangan pada jawaban 1 (disampaikan di percakapan, 12 Oktober 2026):

- GAJ-02 dan GAJ-53: orang yang berhenti tetap dibuatkan slip terakhir,
  dihitung sampai hari terakhirnya bekerja. GAJ-06: gajinya sebanding hari
  bekerja. GAJ-30: bonus yang sudah disahkan diterima di slip terakhir.
- GAJ-33: Dana Disiplin hanya berisi potongan telat dan denda disiplin.
- DRV-73 dan KEU-74: sisa kasbon ditagih dari slip terakhir; kalau gajinya
  hangus, belum jelas kasbonnya dibayar dari mana.
- Di luar buku aturan: menahan seluruh upah hari yang sudah dikerjakan
  berisiko secara hukum ketenagakerjaan. Claude bukan ahli hukum dan
  menyarankan hal ini dipastikan dulu.
- Saran Claude: (i) semua **bonus** yang belum dibayar hangus bagi yang
  berhenti tanpa pamit dan tanpa pemberitahuan sebulan; (ii) **gaji hari
  yang sudah dikerjakan tetap dihitung**, lalu dikenai **denda berhenti
  tanpa pemberitahuan** bernominal jelas (pengaturan, tertulis di perjanjian
  kerja) yang masuk Dana Disiplin, setelah kasbon ditagih; (iii) cara
  berhenti ("sesuai prosedur" atau "tanpa pemberitahuan") dipilih HR dan
  disahkan pemilik saat orangnya dinonaktifkan. Aturan ini tempatnya di buku
  Karyawan dan Gaji, bukan di buku Kinerja.

**Jawaban pemilik atas pertentangan itu (13 Oktober 2026):**

| Pertanyaan | Jawaban pemilik | Dicatat sebagai |
|---|---|---|
| Ikut saran (bonus hangus, gaji dikenai denda) atau semua gaji hangus | "aturan nya jelas, tidak mengikuti aturan one month notice = denda sebanyak gaji, biarkan saya memutuskan jika hal ini terjadi" dan "semua gaji jadi masuk ke dana denda" | **GAJ-58** (baru) dan **KAR-68** (baru): denda sebesar seluruh gaji yang belum dibayar, masuk Dana Disiplin; tidak otomatis, diputuskan pemilik tiap kejadian. Jenis: pengecualian atas GAJ-06, 30, 53; GAJ-33 ditambah. Risiko hukum sudah disampaikan Claude; keputusan pemilik tetap |
| Besar denda tersendiri | "tidak" | Tidak ada nominal denda terpisah; dendanya gaji itu sendiri |
| Pindah dan masuk di tengah periode (KIN-11 a–d) | "ok" | KIN-11 berlaku; tanda ⏳ dihapus; ditambah butir (e) yang merujuk GAJ-58 |
| "6." tanpa isi | "salah ketik" | Tidak ada butir 6 |

Bacaan Claude atas jawaban itu (disampaikan di percakapan; diubah kalau
pemilik mengoreksi): slip terakhir tetap dihitung supaya angkanya jelas;
bonus yang belum dibayar hangus dan uangnya tidak keluar (bukan masuk Dana
Disiplin); sisa kasbon dan Potongan Lain **tidak** diambil dari gaji itu dan
menjadi Piutang Lain (KEU-74); gaji yang sudah dibayar tidak ditarik
kembali; berlaku juga untuk slip mingguan.

**Koreksi pemilik (13 Oktober 2026):** "sisa kasbon nya harus terpotong dulu
dari gaji nya". Bacaan Claude soal kasbon di atas diganti: sisa kasbon dan
Potongan Lain dipotong lebih dulu, baru sisa gajinya menjadi denda (GAJ-58
butir b dan c). Yang tetap tidak tertutup menjadi Piutang Lain.

**7D SELESAI. Bab 7 ditetapkan 13 Oktober 2026.** Tidak ada pertanyaan Bab 7
yang menunggu.

## 7D.3 Asal aturan

| Nomor v3 | Asal |
|---|---|
| KIN-01 | 7A.10 aturan 1 |
| KIN-02 | 7A.10 aturan 2 |
| KIN-03 | 7A.10 aturan 3 |
| KIN-04 | 7A.10 aturan 4; 7B.10 aturan 16 |
| KIN-05 | 7A.10 aturan 5 (jatah rak dilapisi 7B.10 aturan 17) |
| KIN-06 | 7A.10 aturan 6 |
| KIN-07 | 7A.10 aturan 7 |
| KIN-08 | 7A.10 aturan 8 |
| KIN-09 | 7A.10 aturan 9; tanda "belum ditetapkan" tambahan 7D |
| KIN-10 | 7A.10 aturan 10 |
| KIN-11 | 7D.1 butir 1 |
| KIN-12 | 7A.10 aturan 11 |
| KIN-13 | 7A.10 aturan 13 |
| KIN-14 | 7A.10 aturan 14 |
| KIN-15 | 7A.10 aturan 15 |
| KIN-16 | 7D.1 butir 2 |
| KIN-17 | 7A.10 aturan 16; aturan 4 (Akurasi Stok tidak dibawa) |
| KIN-18 | 7A.10 aturan 17 |
| KIN-19 | 7A.10 aturan 18 |
| KIN-20 | 7A.10 aturan 19 |
| KIN-21 | 7A.10 aturan 20 |
| KIN-22 | 7A.10 aturan 21; GAJ-28 |
| KIN-23 | 7A.10 aturan 22 |
| KIN-24 | 7A.10 aturan 23 |
| KIN-25 | 7A.10 aturan 24; 7D.1 butir 3 |
| KIN-26 | 7A.10 aturan 25 |
| KIN-27 | 7B.10 aturan 1 |
| KIN-28 | 7B.10 aturan 2 |
| KIN-29 | 7B.10 aturan 3 |
| KIN-30 | 7B.10 aturan 4 |
| KIN-31 | 7B.10 aturan 5 |
| KIN-32 | 7B.10 aturan 6 |
| KIN-33 | 7B.10 aturan 7 |
| KIN-34 | 7B.10 aturan 8 |
| KIN-35 | 7B.10 aturan 9 |
| KIN-36 | 7B.10 aturan 12; aturan 11 (baris tidak bisa diubah) |
| KIN-37 | 7B.10 aturan 13 |
| KIN-38 | 7B.10 aturan 14; aturan 16 (belum menjadi ukuran) |
| KIN-39 | 7B.10 aturan 10 |
| KIN-40 | 7B.10 aturan 11 |
| KIN-41 | 7B.10 aturan 15 |
| KIN-42 | 7B.10 aturan 16; KIN-B20 dibawa |
| KIN-43 | 7B.10 aturan 17 |
| KIN-44 | 7B.10 aturan 18, 19 |
| KIN-45 | 7B.10 aturan 20 |
| KIN-46 | 7B.10 aturan 21 |
| KIN-47 | 7B.10 aturan 22 |
| KIN-48 | 7A.10 aturan 12; 7B.10 aturan 4, 19; 7D.1 butir 4 |
| KIN-49 | 7A.10 aturan 23; 7B.10 aturan 11, 14; 7D.1 butir 5 |
| KIN-50 | 7B.10 aturan 23; catatan tes 7A.10; PRI-02, PRI-33 |
| KIN-51 | angka pengaturan di 7A.10 dan 7B.10 |

Semua butir 7A.10 (1–25) dan 7B.10 (1–23) sudah bernomor.

## 7D.4 Yang dirapikan tanpa ditanyakan

Hanya menyambung keputusan yang sudah ada; diubah kalau pemilik mengoreksi.

- **Rapor yang belum ditetapkan ditandai** untuk HR dan pemilik saat masa
  keberatan slip dimulai (KIN-09), sama dengan tanda lain di semua buku.
- **Struk promo dilaporkan ke produk cabang tempat penjualannya terjadi**
  (KIN-22), mengikuti GAJ-28. Sistem lama mensyaratkan pelapor berasal dari
  cabang produk itu.
- **"Dikerjakan"** (KIN-42) memakai arti sistem lama (KIN-B20) ditambah
  keadaan baru: tidak gugur dan tidak dibatalkan.
- **Rumus persen tiap ukuran** tidak ditetapkan di buku aturan; dirinci di
  spec (bagian 6 butir 9 buku aturan), karena rapor tidak membawa uang dan
  syarat bonus ditentukan pemilik per aturan.
- **GAJ-31:** "Bonus KPI" tidak lagi ditunda, karena sudah menjadi Bonus
  Terukur (butir penutup A di 7A.9, disetujui pemilik).
