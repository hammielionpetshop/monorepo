# Spec HRIS L5 — Kasbon

Tanggal: 2026-11-03 · Status: **disetujui owner 2026-11-03** (§9 semua sesuai saran, "ok")
Cakupan: langkah **L5** di [PRD 07](../../hris_planning/PRD/fase_1/07-kasbon.md): 4G-4a (DRV-L23 s.d. L31) dan 4G-4b (DRV-L32 s.d. L39), keduanya "Masuk".
Sumber: v3 `05-gaji-driver-kasbon` DRV-54 s.d. 79, 82, 83, 85, **121 s.d. 142**; `gaji-driver-spec` §3.5 (4G-4a, keputusan K1 s.d. K7) dan §3.6 (4G-4b, keputusan C1 s.d. C7), disetujui 14 Oktober 2026. Penyimpangan PRD 07 §3 berlaku.
Dasar kode: L2e (pengaturan bertanggal), L2f (Mesin Pengajuan dengan tahap Diperiksa, Pemberitahuan, Beranda "perlu perhatian"), L4a (paket gaji, `position.pay_basis`, `salary_owner_only`), L4c (Potongan Lain: cicilan per periode), L4e (`computeSlip` kelompok (d), `deduction_carryovers`, tutup / buka kembali slip, slip terakhir, `other_receivables`), L4f (`payment_sources` Sumber Uang, `payslip_payments`, berkas bukti), L4g (Slip Saya, Pendapatan Saya, akses terbatas mantan karyawan).
Aliran migrasi: **`hris` 0029** (L5a) dan **0030** (L5b). Modul baru: `apps/hris/modules/advances` (aturan/server/ui, satu pintu `index.ts`), dipanggil Gaji hanya lewat fungsi "cicilan jatuh tempo", "tandai cicilan", dan "balik tanda".

## 1. Batas

**Pokoknya (DRV-54):** satu buku kasbon untuk semua orang. Diajukan di HP, diperiksa Finance, diputuskan Pemilik atau GM, uangnya diserahkan dengan sumber uang, lalu dicicil otomatis lewat slip utama orang itu. **Sisa kasbon tidak disimpan** (DRV-67): selalu nominal diberikan dikurangi catatan berkurang. **"Lunas" bukan tombol** (DRV-71). **Tidak ada yang dihapus** (DRV-83).

**Dikerjakan** (§9 butir 1: dua kali tayang staging):

| Tahap | Isi |
|---|---|
| **L5a** Ajukan sampai terpotong | 4G-4a utuh: Kasbon Saya, Ajukan (3 langkah), Isikan atas nama, daftar kantor Kasbon (tab Menunggu diperiksa / diputuskan / diberikan / Ditolak dan dibatalkan), Periksa dan Putuskan, Rincian, Serahkan Uang, Minta dibatalkan / Batalkan, Batal serah uang, "Uang belum saya terima", tanda Lewat 2 hari + pengingat. **Ditambah inti 4G-4b yang dibutuhkan supaya kasbon yang diserahkan langsung terpotong:** fungsi "sisa kasbon", "pasang jadwal", cicilan di slip kelompok (d), "tandai cicilan" saat tutup slip, sisa potongan kasbon dibawa, "balik tanda" saat buka kembali, keadaan Berjalan/Lunas, tampilan cicilan di Kasbon Saya, Slip Saya, dan cetak slip |
| **L5b** Sesudah diberikan | Tunda cicilan (minta + putuskan + gugur), Ubah jadwal, Terima pelunasan tunai, Hapus utang, Batalkan pelunasan atau hapus, Orang berhenti (slip terakhir → Piutang Lain, tanda "Akan berhenti"), Berganti slip utama, **Kasbon Khusus**, tab **Berjalan** dan **Selesai** (Kasbon Berjalan) + kepala Dana Kasbon, tab **Uang Kasbon** (§9 butir 4) |

**Tidak dikerjakan di L5:**

| Hal | Di mana | Akibat sementara |
|---|---|---|
| Slip mingguan (driver & kenek) | L7 | Orang berdasar gaji **Mingguan** belum bisa kasbon (PRD 07 §3, §9 butir 2); Dana Kasbon mingguan sudah ada sebagai pengaturan |
| Kasbon bawaan sistem lama (SIS-28) | L9 muat data | Jenis `LEGACY` sudah disiapkan di data dan di hitungan "terpakai"; belum ada layar isinya |
| Uji banding sisa kasbon dengan HRIS lama | L9 | — |
| Buku Kas, Catatan Cepat "Kasbon" (KEU-18, 32), biaya Untung Rugi | app Keuangan | Uang keluar, masuk, dan utang dihapus dicatat di HRIS (PRD 07 §3 ✅), dirangkum di tab Uang Kasbon (§9 butir 4); jalur Catatan Cepat diganti §9 butir 5 |

Tiap branch tetap membawa fragment `apps/hris/changelog.d` dan tanda Baru di `lib/new-features.ts`.

## 2. Data

Semua tabel: kolom perusahaan, jejak dibuat/diubah, tanpa hapus (PRI-02), indeks pada kolom cari.

| Tabel / perubahan | Isi | Tahap |
|---|---|---|
| `advances` (kasbon) | nomor `KB-0001` (§9 butir 7), orang, jenis (`REGULAR` / `SPECIAL` / `LEGACY`), pengajuan Mesin Pengajuan (kosong untuk Khusus dan bawaan), diisi oleh (akun), nominal + kali potong diajukan, alasan, **dana saat diajukan** (`MONTHLY` / `WEEKLY`), usulan Finance (nominal, kali potong, catatan, oleh, kapan), keputusan (nominal akhir, kali potong akhir, catatan, oleh, kapan, tanda "tanpa pemeriksaan Finance"), batal (alasan, oleh, kapan), jenis kejadian + dibuat oleh (Khusus). Keadaan sebelum diberikan dibaca dari status pengajuan (WAJ-03); sesudahnya dihitung (§3.9) | 0029 (Khusus: kolom sudah ada, dipakai L5b) |
| `advance_handovers` (serah uang) | kasbon, nominal, tanggal uang, jam catat (server), penyerah, Sumber Uang (`payment_sources` L4f), cara (tunai/transfer dari sumber), diserahkan kepada (langsung / satu karyawan), foto bukti (`files`), alasan tanggal, tanda "uang keluar sebelum disetujui", status `ACTIVE` / `CANCELLED` + alasan batal. **Unik satu `ACTIVE` per kasbon** (indeks sebagian) | 0029 |
| `advance_installments` (jadwal) | kasbon, **versi**, urutan, nominal, periode slip utama tujuan (`period_start`, kosong sebelum diserahkan), status `SCHEDULED` / `TAKEN` / `PARTIAL` / `REPLACED` / `CANCELLED` / `WAITING_WEEKLY` (§9 butir 3), sebab versi (`HANDOVER`, `POSTPONE`, `RESCHEDULE`, `PAY_TRACK`, `REPAY`, `WRITE_OFF`, `UNDO`) | 0029 |
| `advance_movements` (catatan berkurang) | kasbon, jenis (`SLIP` / `CASH` / `WRITE_OFF` / `TO_RECEIVABLE`), nominal, slip + cicilan (jenis SLIP), tanggal uang + Sumber Uang + bukti (CASH), alasan (WRITE_OFF), status `ACTIVE` / `REVERSED` + alasan/oleh/kapan dibalik | 0029 (SLIP), 0030 (lainnya) |
| jenis pengajuan `advance` | tahap Diperiksa (`advance.review`) lalu putuskan (`advance.decide`, ownerOnly); handler di `lib/request-handlers.ts` | 0029 |
| jenis pengajuan `advance_cancel` ("Minta dibatalkan"), `advance_not_received` ("Uang kasbon belum diterima") | ownerOnly | 0029 |
| jenis pengajuan `advance_postpone` ("Tunda cicilan kasbon") | ownerOnly | 0030 |
| `deduction_carryovers` | sisa potongan kasbon memakai kunci sumber `adv:<id cicilan>` (tanpa kolom baru) | 0029 |
| `other_receivables` | izinkan kelompok `d` (kasbon) untuk asal `SLIP` (DRV-139) | 0030 |
| Pengaturan (registry, bertanggal) | §3.12 | 0029 / 0030 |
| Hak | §5 | 0029 / 0030 |

## 3. Aturan

### 3.1 Siapa boleh kasbon dan "periksa kasbon" (DRV-55 s.d. 58, 121; L5a)

Satu fungsi server `checkAdvance(orang, nominal, hari ini)` dipakai pengajuan sendiri dan atas nama. Urutan tetap; gagal di satu langkah = tidak ada yang tersimpan:

0. **Bisa dicicil:** orang aktif, punya paket gaji berlaku, dan dasar gaji jabatannya **Bulanan** (§9 butir 2 dan 6). Mingguan: "Kasbon untuk driver dan kenek dibuka bersamaan dengan slip mingguan. Kalau mendesak, hubungi GM." Tanpa paket gaji: "Kasbon hanya untuk karyawan yang menerima slip gaji." Tanggal berhenti sudah tercatat (L5b, DRV-139): "Kasbon tidak bisa diajukan karena tanggal berhenti Anda sudah tercatat. Kalau mendesak, hubungi GM."
1. **Masa kerja:** hari ini ≥ tanggal bergabung + 6 bulan kalender (tanggal yang tak ada di bulan itu = hari terakhir bulan). "Kasbon baru bisa diajukan setelah 6 bulan bekerja. Kalau mendesak, hubungi GM."
2. **Batas orang:** terpakai orang itu + nominal ≤ batas (Rp250.000). Gagal: bila punya kasbon biasa bersisa atau pengajuan menunggu → "Pastikan Anda sudah membayar kasbon lama. Ditolak karena kasbon lama masih banyak."; selain itu kalimat langkah 3.
3. **Sisa Dana Kasbon** (dana = dasar gaji orang itu **hari mengajukan**): terpakai dana + nominal ≤ besar dana (Rp1.000.000). "Kasbon belum bisa diajukan saat ini. Silakan coba lagi setelah gajian."

- **Satu pengajuan menunggu per orang:** "Masih ada pengajuan kasbon yang menunggu. Batalkan dulu kalau ingin mengubahnya." (kunci kembar Mesin Pengajuan).
- **Terpakai** (satu fungsi, tidak disimpan): Menunggu/Diperiksa = nominal diajukan; Disetujui belum diberikan = nominal akhir; sudah diberikan = sisa; bawaan = sisa; ditolak/ditarik/batal/lunas/dialihkan = 0; **Kasbon Khusus tidak dihitung**.
- Angka pengaturan dibaca pada hari mengajukan; saat menyetujui tidak diperiksa ulang. **Angka batas dan sisa dana tidak pernah dikirim ke layar karyawan.**

### 3.2 Mengajukan dan diisikan atas nama (DRV-59, 60, 122, 123; L5a)

- Isi: nominal kelipatan **Rp10.000**, paling sedikit **Rp50.000**; kali potong 1–3; alasan ≥ 15 huruf. "Untuk siapa" diisi server dari sesi (isian layar diabaikan).
- Perkiraan cicilan tampil berjalan ("2 kali potong: Rp75.000 tiap gajian") + "Angka ini bisa diubah saat diperiksa. Yang berlaku adalah yang disetujui."
- Tersimpan → "Kasbon diproses paling cepat 2 hari setelah pengajuan, tidak bisa langsung cair." Finance diberi tahu.
- Tombol Ajukan redup dengan alasannya bila langkah 0/1 gagal atau ada pengajuan menunggu.
- **Atas nama:** HR, Admin HR, Pemilik, GM (`advance.fill_for`), **bukan untuk dirinya**; `checkAdvance` yang sama; tercatat "diisi oleh". Orangnya diberi tahu, melihat "diisi oleh …", boleh menarik; pengisi boleh membatalkan sebelum diputuskan.
- Pengajuan tidak bisa diubah; yang salah ditarik lalu diajukan baru.

### 3.3 Pemeriksaan Finance (DRV-61a, 124; L5a)

- Pemeriksa = `advance.review` (isi awal Finance). Boleh mengusulkan nominal lebih kecil (aturan kelipatan sama) dan kali potong 1–3; mengubah angka wajib catatan ≥ 15 huruf; lalu **Sudah diperiksa** → Diperiksa, Pemilik/GM diberi tahu.
- Finance **tidak menolak dan tidak menyetujui**; usulannya tidak tampil ke karyawan; **tidak memeriksa pengajuannya sendiri** (diperiksa Finance lain, bila tak ada langsung ke Pemilik/GM).
- Keterangan pembantu Finance: masa kerja, kasbon biasa yang berjalan + sisanya, pengajuan dan penolakan 6 bulan terakhir, Kasbon Khusus berjalan. **Tanpa gaji dan slip** (PRI-24).

### 3.4 Keputusan Pemilik atau GM (DRV-61b, 62, 125; L5a)

- `advance.decide`, ownerOnly, tidak bisa diberikan ke jabatan lain; **bukan kasbonnya sendiri** (GM diputuskan Pemilik, dan sebaliknya).
- Boleh memutuskan tanpa menunggu Finance: bertanda "Tanpa pemeriksaan Finance", Finance diberi tahu.
- Nominal akhir ≤ yang **diajukan** (boleh kembali ke angka pengaju), kelipatan dan minimum sama; kali potong 1–3; mengubah dari angka pengaju wajib catatan yang dibaca pengaju.
- **Setujui** (ditahan 3 detik) = satu transaksi: status Disetujui + nominal/kali potong akhir + baris cicilan versi 1 ("bagi cicilan": dibagi rata dibulatkan ke bawah, sisa di cicilan terakhir; Rp250.000 × 3 = 83.333, 83.333, 83.334), **tanpa slip tujuan**.
- **Tolak:** alasan wajib; pengaju boleh Ajukan ulang (syarat diperiksa lagi).
- Keterangan pembantu Pemilik/GM: semua milik Finance + usulan dan catatan Finance + sisa batas orang + sisa kedua dana + perkiraan bersih slip berikutnya (dibaca dari `computeSlip`, tidak dihitung ulang).
- Sesudah disetujui: pengaju diberi tahu (angka diajukan ikut disebut bila diturunkan); Finance diberi tahu untuk menyerahkan uang.

### 3.5 Serah uang (DRV-63, 126, 127; L5a)

Finance, Pemilik, GM (`advance.hand_over`), dari tab Menunggu diberikan atau Rincian. Satu transaksi:

1. Periksa: kasbon Disetujui belum diberikan; belum ada serah `ACTIVE` (**cair sekali**); tidak ada "Minta dibatalkan" yang menunggu; Sumber Uang dipilih. **Penyerah bukan penerima kasbon itu** ("Kasbon Anda sendiri diserahkan orang lain."); Pemilik/GM tetap boleh untuk dirinya, tercatat dan para pemilik diberi tahu.
2. Nominal = nominal akhir, penuh, tidak diketik.
3. **Tanggal uang:** awal hari ini; mundur s.d. 7 hari tanpa alasan (dibaca dari pengaturan tanggal uang Gaji, sama L4f), lebih jauh dengan alasan; tidak masa depan. Sebelum tanggal disetujui: §9 butir 5.
4. Diserahkan kepada: langsung ke orangnya, atau dititipkan lewat satu nama karyawan aktif. Foto bukti dianjurkan.
5. Simpan serah uang, lalu **pasang jadwal** (§3.8) di transaksi yang sama.
6. Orangnya diberi tahu: "Kasbon Rp150.000 sudah diberikan tanggal 4 November lewat tunai. Dipotong 2 kali mulai gajian 26 Oktober – 25 November."

**Uang belum saya terima (K5):** tombol di kartu Kasbon Saya selama **3 hari** sejak diberi tahu; tulisan ≥ 15 huruf; pengajuan `advance_not_received`, diputuskan Pemilik/GM (**Sudah diselesaikan** dengan catatan, atau **Tidak terbukti** dengan alasan); penyerah dan yang dititipi diberi tahu. Tidak ada akibat uang otomatis; jalan keluarnya Batal serah uang.

### 3.6 Menarik, minta dibatalkan, membatalkan, batal serah (DRV-72, 128, 129; L5a)

- **Menunggu / Diperiksa:** pengaju (atau pengisinya) **Batalkan** dengan alasan; terpakai langsung lepas.
- **Disetujui belum diberikan:** pengaju **Minta dibatalkan** (`advance_cancel`); selama menunggu, serah uang ditolak server; Pemilik/GM memutuskan **Batalkan** atau **Tetap berjalan**.
- **Batalkan kasbon** (Pemilik/GM, boleh tanpa diminta, alasan wajib, ditahan 3 detik): kasbon Dibatalkan, cicilan ikut `CANCELLED`, terpakai lepas, pengaju dan Finance diberi tahu. Tidak dihidupkan lagi.
- **Sudah diberikan:** kasbon tidak dibatalkan.
- **Batal serah uang** (Pemilik/GM, alasan wajib, ditahan 3 detik) untuk catatan penyerahan yang salah, **selama belum ada catatan berkurang `ACTIVE`** (terpotong, dilunasi, dihapus). Satu transaksi: serah `CANCELLED`, slip tujuan cicilan dilepas (versi baru tanpa periode), kasbon kembali Disetujui belum diberikan; orangnya, Finance, dan para pemilik diberi tahu.

### 3.7 Tanda 2 hari dan pengingat (DRV-64, 130; L5a)

- Pengajuan ikut pengingat berantai Mesin Pengajuan seperti jenis lain.
- Lewat **48 jam** sejak diajukan belum diputuskan → tanda **"Lewat 2 hari"** di perlu perhatian Finance, Pemilik, GM. Hari kalender.
- Disetujui belum diberikan → perlu perhatian Finance; mulai 07.00 keesokan harinya, tiap hari, pengingat ke Finance, Pemilik, GM: "Ada 2 kasbon disetujui belum diberikan, Rp300.000, paling lama sejak 3 November."
- Tidak ada yang ditolak, hangus, atau disetujui otomatis. Kasbon tidak masuk Jadwal Bayar.

### 3.8 Jadwal, cicilan di slip, sisa (DRV-65 s.d. 67, 71, 131 s.d. 133; L5a)

- **Pasang jadwal:** cicilan pertama di slip utama periode yang memuat **tanggal uang**; bila slip itu sudah Ditutup, slip berikutnya yang belum ditutup; lalu satu per periode berturut-turut. Tujuan = orang + periode (seperti cicilan Potongan Lain), jadi slip yang belum lahir tetap bisa dituju. Tiap pemasangan ulang menandai cicilan `SCHEDULED` lama `REPLACED` dan menulis versi baru; `TAKEN`/`PARTIAL` tidak disentuh. Tidak pernah ke slip Ditutup, tidak melewati slip terakhir orang yang tanggal berhentinya tercatat.
- **Cicilan di slip:** `computeSlip` kelompok (d) membaca cicilan `SCHEDULED` yang tujuannya periode slip itu, semua kasbon orang itu, **paling lama diberikan lebih dulu**, sesudah sisa potongan kasbon yang dibawa (GAJ-75). Baris: "Kasbon KB-0012, cicilan 2 dari 3: Rp75.000. Sisa sesudah ini Rp75.000." Teks sementara "Kasbon menyusul." di slip diganti.
- **Tutup slip → tandai cicilan:** catatan berkurang `SLIP` sebesar yang tertampung; cicilan `TAKEN` atau `PARTIAL`; kekurangannya menjadi `deduction_carryovers` kelompok d berkunci `adv:<id>`; saat sisa itu terpotong di slip berikutnya, catatan `SLIP` ditulis juga.
- **Buka kembali slip → balik tanda:** catatan `SLIP` dari slip itu `REVERSED`, cicilan kembali `SCHEDULED`, sisa dibawa dari slip itu dibatalkan (mekanisme L4e). Batal bayar slip tidak menyentuh cicilan.
- **Sisa = nominal diberikan − catatan berkurang `ACTIVE`.** Selalu = cicilan `SCHEDULED` + sisa kasbon dibawa; bila tidak sama → perlu perhatian GM (diperiksa mesin harian).
- **Keadaan sesudah diberikan** (dihitung): **Berjalan** (sisa > 0), **Lunas** (sisa 0; orangnya diberi tahu "Kasbon KB-0012 sudah lunas"), **Dialihkan** (L5b). Kembali Berjalan bila sebabnya dibalik.

### 3.9 Tunda cicilan (DRV-68, 134; L5b)

Minta oleh pemilik kasbon (HR/Admin HR boleh atas nama), alasan ≥ 15 huruf; syarat: kasbon Berjalan, jatah **1 kali per kasbon** belum terpakai, ada cicilan `SCHEDULED` di slip yang masih Perkiraan, tak ada permintaan tunda lain menunggu, belum ada tanggal berhenti. Diputuskan Pemilik/GM bukan miliknya. Disetujui: **semua** cicilan `SCHEDULED` bergeser satu periode (sisa dibawa tidak ikut); jatah terpakai. **Gugur** bila slip cicilan terdekat ditutup sebelum diputuskan (dikerjakan langkah tutup slip): cicilan dipotong biasa, jatah tidak terpakai, orangnya diberi tahu. Ditolak/gugur tidak memakai jatah. Bukan penahan slip.

### 3.10 Ubah jadwal, pelunasan, hapus, dan pembatalannya (DRV-69, 70, 135 s.d. 138; L5b)

- **Ubah jadwal** (Pemilik/GM, bukan miliknya, alasan wajib): jumlah tetap = cicilan `SCHEDULED`; banyaknya ≤ 3 (biasa) / ≤ 12 (Khusus); periode mulai belum ditutup, paling jauh 3 periode sesudah slip terbuka terdekat. Tidak memakai jatah tunda. Orangnya diberi tahu.
- **Terima pelunasan tunai** (Finance, Pemilik, GM; **penerima bukan pemilik kasbon**, Pemilik/GM boleh untuk dirinya + diberitahukan): > Rp0, ≤ sisa, tombol "Lunasi semua"; mengurangi sisa dibawa lebih dulu lalu cicilan terdekat (versi baru); Sumber Uang wajib; tanggal uang mundur s.d. 7 hari tanpa alasan, tidak sebelum tanggal diberikan, tidak masa depan; foto dianjurkan; satu transaksi. Ditolak bila slip cicilan terdekat sedang ditutup. Tidak untuk kasbon Dialihkan.
- **Hapus utang** (Pemilik/GM, bukan miliknya, alasan wajib, tidak bisa diberikan ke jabatan lain): seluruh atau sebagian, urutan pengurangan sama. Tidak ada uang bergerak; tercatat sebagai **biaya "Utang kasbon dihapus"** bertanggal dan bercabang (cabang orang itu) di tab Uang Kasbon. Orangnya dan para pemilik diberi tahu. Bukan pemberian (DRV-77).
- **Batalkan pelunasan atau hapus** (Pemilik/GM, alasan wajib): catatan `REVERSED`; jumlahnya kembali ke cicilan `SCHEDULED` terdekat, atau satu cicilan baru di slip terbuka berikutnya; sisa dibawa yang sempat dilunasi ikut jadwal. Ditolak bila kasbon Dialihkan.

### 3.11 Berhenti, ganti slip utama, Kasbon Khusus (DRV-73 s.d. 76, 139 s.d. 141; L5b)

- **Orang berhenti:** slip terakhir memuat **semua** cicilan `SCHEDULED` + sisa dibawa (seperti Potongan Lain, GAJ-82); kekurangannya → `other_receivables` kelompok d satu baris, tiap kasbon dapat catatan `TO_RECEIVABLE` dan menjadi **Dialihkan**; buka kembali slip terakhir membaliknya. Sejak tanggal berhenti tercatat: pengajuan baru ditolak (§3.1 langkah 0), pengajuan menunggu dan kasbon belum diberikan bertanda **"Akan berhenti"** (tidak batal otomatis), serah uang sesudah hari terakhir bekerja ditolak, tunda ditolak, ubah jadwal tidak melewati slip terakhir.
- **Ganti slip utama** (perubahan jabatan yang mengganti dasar gaji, berlaku tanggal 26): dijalankan saat perubahan tersimpan, dibatalkan, atau diubah tanggalnya. Bulanan → Mingguan sebelum L7: §9 butir 3. Dana mengikuti dasar gaji hari ini untuk kasbon yang sudah diberikan; tidak pernah ditolak walau dana tujuan penuh.
- **Kasbon Khusus** (Pemilik/GM, bukan untuk dirinya; karyawan aktif berslip bulanan): jenis kejadian (daftar pengaturan: Kecelakaan, Sakit, Duka, Lainnya), alasan ≥ 15 huruf, nominal kelipatan Rp10.000 tanpa batas atas, kali potong 1–12. Tanpa syarat 6 bulan, batas orang, dana, dan satu-menunggu; tidak dihitung di terpakai. Lahir **Disetujui, belum diberikan**, bertanda Khusus; para pemilik diberi tahu; tombol **Buat dan serahkan sekarang** langsung ke Serah Uang. Selebihnya sama dengan kasbon biasa.

### 3.12 Pengaturan (DRV-85; bertanggal, hanya Pemilik/GM mengubah)

| Kunci | Isi awal | Tahap |
|---|---|---|
| `advance.min_tenure_months` | 6 | L5a |
| `advance.person_limit` | Rp250.000 | L5a |
| `advance.fund_monthly`, `advance.fund_weekly` | Rp1.000.000, Rp1.000.000 | L5a |
| `advance.max_installments` | 3 | L5a |
| `advance.reason_min_chars` | 15 | L5a |
| `advance.amount_step`, `advance.amount_min` | Rp10.000, Rp50.000 | L5a |
| `advance.process_days` | 2 | L5a |
| `advance.not_received_days` | 3 | L5a |
| `advance.postpone_quota` | 1 | L5b |
| `advance.reschedule_max_ahead` | 3 slip | L5b |
| `advance.special_max_installments` | 12 | L5b |
| `advance.special_event_kinds` | Kecelakaan, Sakit, Duka, Lainnya | L5b |

Tanggal uang mundur 7 hari dibaca dari pengaturan Gaji yang sudah ada (L4f), tidak diduplikasi.

## 4. Layar

| Layar | Alamat | Menu | Tahap |
|---|---|---|---|
| Kasbon Saya (DRV-L23): tombol Ajukan, kartu per kasbon (status, diajukan → disetujui, "diisi oleh", riwayat, penyerahan tanpa nama sumber uang, **jadwal + sisa**), tombol menurut keadaan (Batalkan, Ajukan ulang, Minta dibatalkan, Uang belum saya terima; L5b: Minta tunda), bagian Selesai, "Mau melunasi lebih cepat? Bayar tunai ke Finance." | `/kasbon` | **Saya › Kasbon Saya** (HP) | L5a |
| Ajukan Kasbon (DRV-L24, 3 langkah) | `/kasbon/ajukan` | dari Kasbon Saya / Pengajuan Saya | L5a |
| Kasbon (DRV-L26): kepala dana (Pemilik/GM), tab Menunggu diperiksa / diputuskan / diberikan / Ditolak dan dibatalkan (L5b: + Berjalan, Selesai, Uang Kasbon), label, saring, cari | `/gaji/kasbon` | **Kantor › Gaji › Kasbon** | L5a |
| Isikan Kasbon atas Nama (DRV-L25, 4 langkah) | `/gaji/kasbon/isikan` | tombol di Kasbon | L5a |
| Periksa dan Putuskan (DRV-L27) | isi khas di `/persetujuan/[id]` | Persetujuan | L5a |
| Rincian Kasbon (DRV-L28): Pengajuan, Pemeriksaan, Keputusan, Cicilan (+ versi lama), Penyerahan, Catatan berkurang, Riwayat; tombol menurut hak | `/gaji/kasbon/[id]` | dari Kasbon | L5a |
| Serahkan Uang (DRV-L29, 3 langkah) | `/gaji/kasbon/[id]/serahkan` | dari Kasbon / Rincian | L5a |
| Batalkan Kasbon (DRV-L30), Batal Serah Uang (DRV-L31) | `/gaji/kasbon/[id]/batalkan`, `/gaji/kasbon/[id]/batal-serah` | dari Rincian | L5a |
| Uang belum saya terima | `/kasbon/[id]/belum-terima` | dari Kasbon Saya | L5a |
| Minta Tunda (DRV-L32) / Putuskan Tunda (DRV-L33) | `/kasbon/[id]/tunda`; isi khas `/persetujuan/[id]` | Kasbon Saya; Persetujuan | L5b |
| Terima Pelunasan (DRV-L34), Hapus Utang (DRV-L35), Ubah Jadwal (DRV-L36), Batalkan Pelunasan/Hapus (DRV-L39) | `/gaji/kasbon/[id]/{lunasi,hapus-utang,ubah-jadwal,batal-catatan/[m]}` | dari Rincian / Berjalan | L5b |
| Buat Kasbon Khusus (DRV-L37, 4 langkah) | `/gaji/kasbon/khusus` | tombol di Kasbon | L5b |
| Kasbon Berjalan (DRV-L38): tab Berjalan + Selesai, ringkasan per orang | `/gaji/kasbon?tab=berjalan` | — | L5b |
| Uang Kasbon (§9 butir 4) + CSV | `/gaji/kasbon?tab=uang` | — | L5b |
| Baris kasbon di Slip Saya, cetak slip, Pendapatan Saya tab Potongan | (sudah ada) | — | L5a |
| Kartu Beranda: "Kasbon menunggu diperiksa / diputuskan / diberikan", "Lewat 2 hari" | `/` | — | L5a |

## 5. Hak

| Tindakan | Karyawan | HR, Admin HR | Finance | Pemilik, GM |
|---|---|---|---|---|
| Ajukan / lihat kasbon sendiri, Uang belum saya terima, Minta tunda | ✓ dirinya | ✓ dirinya | ✓ dirinya | ✓ dirinya |
| `advance.fill_for` isikan atas nama; minta tunda atas nama (L5b) | — | ✓ bukan dirinya | — | ✓ bukan dirinya |
| `advance.view` daftar + rincian | — | ✓ tanpa Sumber Uang, tanpa usulan Finance, tanpa dana | ✓ tanpa dana, tanpa gaji/slip | ✓ semua |
| `advance.review` periksa | — | — | ✓ bukan miliknya | — |
| `advance.decide` setujui/tolak, putuskan batal & belum terima & tunda · ownerOnly | — | — | — | ✓ bukan miliknya |
| `advance.hand_over` serah uang | — | — | ✓ bukan miliknya | ✓ |
| `advance.cancel` batalkan kasbon, batal serah · ownerOnly | — | — | — | ✓ |
| `advance.repay` terima pelunasan (L5b) | — | — | ✓ bukan miliknya | ✓ |
| `advance.manage` ubah jadwal, hapus utang, batal pelunasan/hapus, Kasbon Khusus (L5b) · ownerOnly | — | — | — | ✓ bukan miliknya |
| `advance.funds.view` sisa Dana Kasbon · ownerOnly | — | — | — | ✓ |

Hak diberikan lewat migrasi ke jabatan HR, Admin HR, Finance (pola L4). Kasbon Pemilik/GM sendiri hanya terlihat dirinya dan pemilik lain (`salary_owner_only` tidak dipakai; kasbon bukan gaji). Penolakan server yang dites: mengajukan untuk orang lain lewat isian; atas nama untuk diri sendiri; Finance memeriksa miliknya / menolak / menyetujui; memutuskan miliknya; nominal akhir > diajukan; serah dua kali / oleh penerima / saat Minta dibatalkan menunggu; batal serah sesudah ada catatan berkurang; karyawan membaca angka batas atau sisa dana lewat API; HR membuka Sumber Uang.

## 6. Mesin terjadwal

| Mesin | Kapan | Isi | Tahap |
|---|---|---|---|
| `advance-daily` | tiap hari 07.00 WIB | tanda "Lewat 2 hari"; pengingat kasbon disetujui belum diberikan; periksa sisa = terjadwal + dibawa (beda → perlu perhatian GM) | L5a |

Gugur tunda dikerjakan langkah tutup slip, bukan mesin (L5b).

## 7. Pemberitahuan

| Kapan | Ke siapa | Tahap |
|---|---|---|
| Diajukan / diisikan atas nama | Finance (pemeriksa); orangnya bila atas nama | L5a |
| Sudah diperiksa | Pemilik, GM | L5a |
| Disetujui (angka diajukan disebut bila diturunkan) / Ditolak | pengaju; Finance (disetujui, tanpa pemeriksaan) | L5a |
| Diserahkan | orangnya; para pemilik bila Pemilik/GM menyerahkan untuk dirinya | L5a |
| Dibatalkan / batal serah | pengaju, Finance, para pemilik | L5a |
| Uang belum diterima | Pemilik, GM, penyerah, yang dititipi | L5a |
| Lunas | orangnya | L5a |
| Tunda disetujui/ditolak/gugur, jadwal diubah, pelunasan, hapus utang, Kasbon Khusus dibuat, pindah slip utama | orangnya (+ para pemilik untuk hapus & Khusus) | L5b |

## 8. Tes

- **Unit (aturan, menyebut nomor DRV):** `checkAdvance` urutan + kalimat (DRV-55 s.d. 58, 121; Khusus tidak dihitung; batas tidak bocor); 6 bulan kalender (31 Agustus → 28/29 Februari); kelipatan & minimum; bagi cicilan (sisa di terakhir); pasang jadwal (tanggal uang di slip Ditutup → berikutnya); sisa & keadaan; urutan pengurangan pelunasan/hapus (L5b); tunda gugur/jatah (L5b); ubah jadwal batas (L5b).
- **Integrasi DB** (tanggal lampau, pola L4): ajukan → periksa → setujui → serahkan → slip ditutup terpotong sebagian → sisa dibawa → slip berikutnya → **Lunas**; buka kembali slip membalik; tanpa pemeriksaan Finance; minta batal menahan serah; batal serah; dua pengajuan menunggu ditolak; pagar hak §5. L5b: **kriteria PRD 07 §4** — satu kasbon lunas lewat dua slip bulanan termasuk tunda sekali dan sisa potongan terbawa; pelunasan sebagian + batal; hapus; slip terakhir → Piutang Lain → buka kembali; Kasbon Khusus melewati syarat.

## 9. Keputusan owner (2026-11-03: "ok", semua sesuai saran)

1. **Dua kali tayang.** **Saran: L5a** (ajukan sampai uang diberikan, **plus inti cicilan** supaya kasbon yang diserahkan langsung terpotong di slip dan bisa lunas) → **L5b** (tunda, ubah jadwal, pelunasan tunai, hapus utang, berhenti, ganti slip utama, Kasbon Khusus, Kasbon Berjalan). Diuji terpisah. Klaim + kunci hris 0029–0030 dipegang sampai L5b selesai, seperti L4e–L4g.
2. **Driver dan kenek sebelum slip mingguan ada.** PRD 07 §3: kasbon mereka dibuka setelah L7. **Saran:** pengajuan biasa dan Kasbon Khusus untuk orang berdasar gaji **Mingguan** ditolak dengan kalimat "Kasbon untuk driver dan kenek dibuka bersamaan dengan slip mingguan. Kalau mendesak, hubungi GM."; Dana Kasbon mingguan sudah ada sebagai pengaturan dan kepala daftar menulis "mulai dipakai bersama slip mingguan".
3. **Pindah Bulanan → Mingguan sebelum L7** (orang punya kasbon berjalan lalu jabatannya menjadi driver/kenek). Sesudah tanggal pindah tidak ada slip bulanan untuknya. **Saran:** cicilan yang jatuh sesudah tanggal pindah berstatus **"Menunggu slip mingguan"** dan masuk perlu perhatian Pemilik/GM; sementara itu bisa dilunasi tunai atau dihapus; L7 memasangnya ke slip mingguan otomatis (DRV-140).
4. **Pengganti Buku Kas.** Uang kasbon dicatat di HRIS (PRD 07 §3 ✅), memakai **Sumber Uang** yang sama dengan gaji (Brankas, Rekening Kantor). **Saran:** tab **Uang Kasbon** (Pemilik, GM, Finance) berisi per bulan: uang keluar (diberikan), uang masuk (pelunasan), dan utang dihapus (biaya), per cabang dan per Sumber Uang, dengan unduh CSV, supaya Finance bisa menyalin ke pembukuan sampai app Keuangan ada.
5. **Uang yang terlanjur keluar sebelum disetujui.** v3 menampungnya lewat Catatan Cepat Keuangan (belum ada). **Saran:** di Serah Uang, tanggal uang **boleh sebelum tanggal disetujui** (tetap dalam batas mundur, lebih jauh dengan alasan), dengan alasan wajib dan tanda **"Uang keluar sebelum disetujui"** yang terlihat Pemilik/GM. Kasbonnya tetap harus diajukan (atau diisikan HR) dan disetujui dulu, atau dibuat sebagai Kasbon Khusus.
6. **Siapa bisa kasbon.** **Saran: ikut v3:** semua orang aktif yang menerima slip gaji bulanan (punya paket gaji berlaku), termasuk Pemilik dan GM (diputuskan pemilik yang lain). Yang tidak punya paket gaji ditolak: "Kasbon hanya untuk karyawan yang menerima slip gaji."
7. **Nomor kasbon.** **Saran:** `KB-0001` dan seterusnya, urut satu perusahaan, tidak diulang per bulan (kasbon bisa berjalan beberapa bulan).

## 10. Catatan untuk tahap berikutnya

- **L7:** buka kasbon untuk berdasar gaji Mingguan; cicilan "Menunggu slip mingguan" dipasang ke slip mingguan; Dana Kasbon mingguan mulai terpakai; contoh DRV-140 Mingguan → Bulanan.
- **L9:** isi kasbon bawaan sistem lama (jenis `LEGACY`, paling banyak 3 kali potong, tanpa baris uang) dan uji banding sisa per orang.
- **App Keuangan:** tab Uang Kasbon diganti baris Buku Kas (KEU-23, 25) dan pemasangan Catatan Cepat (KEU-18, 32).

## 11. Catatan implementasi L5a (2026-11-03)

- **Keadaan kasbon disimpan di `advances.state`** (OPEN, APPROVED, REJECTED, WITHDRAWN, CANCELLED), diselaraskan lewat `apply`/`close` jenis pengajuannya. Alasannya: Kasbon Khusus (L5b) tidak lewat Mesin Pengajuan, dan "dibatalkan sesudah disetujui" bukan perpindahan status pengajuan. "Sudah diberikan", Berjalan, Lunas, dan Dialihkan tetap dihitung, tidak disimpan.
- **Mesin Pengajuan mendapat tahap Diperiksa** yang selama ini belum dipakai: `reviewRequest` + `handler.review`; peran `canApprove` / `canReview` (pemeriksa tidak bisa menyetujui atau menolak). Pengajuan baru diberitahukan ke pemeriksa lebih dulu (Pemilik/GM bukan pemeriksa walau berhak penuh); bila tidak ada pemeriksa lain, ke penyetuju. Dua bendera jenis baru: `customDecision` (tombol umum disembunyikan, panel khas jenisnya yang memutuskan) dan `approveNoteMin` (Setujui wajib catatan, dipakai "Uang kasbon belum diterima").
- **Tabel tambahan `advance_followups`** (tidak tertulis di §2): tautan pengajuan "Minta dibatalkan" / "Uang belum diterima" (L5b: "Tunda cicilan") ke kasbonnya.
- **Tab Berjalan dan Selesai versi sederhana sudah ada di L5a** supaya kasbon yang sudah diberikan tetap terlihat di kantor (sisa, cicilan berikutnya). L5b menambah kolom, ringkasan per orang, dan tombolnya.
- **Inti DRV-139 ikut L5a** karena berada di langkah tutup slip yang sama: slip terakhir menagih semua cicilan Terjadwal, kekurangannya menjadi Piutang Lain kelompok `d` (`lastSlipLeftovers` + migrasi 0029 mengizinkan kelompok d), kasbonnya Dialihkan. Pengajuan baru ditolak bila tanggal berhenti tercatat, tanda "Akan berhenti" tampil, serah uang sesudah hari terakhir bekerja ditolak.
- **Siapa melihat kasbon Pemilik/GM (koreksi §5):** Finance tetap melihatnya karena Finance yang memeriksa dan menyerahkan uang; yang tidak melihat adalah HR dan Admin HR (pelihat saja).
- **Cicilan kasbon dipotong juga di slip Pemilik/GM**: GAJ-09 hanya membebaskan Pemilik/GM dari potongan, sedangkan kasbon utang yang mereka ajukan sendiri (§9 butir 6).
- Batas tanggal uang mundur 7 hari memakai konstanta yang sama dengan Gaji (`MONEY_DATE_FREE_DAYS`); di Gaji angka ini juga konstanta, bukan pengaturan.
- Modul `advances` membaca beberapa tabel milik Gaji dan Mesin Pengajuan secara langsung (`payslips`, `payslip_lines`, `deduction_carryovers`, `payment_sources`, `salary_changes`, `requests`) supaya Gaji bisa mengimpor `advances` tanpa saling impor. Pola ini sama dengan yang sudah dipakai Gaji; pemeriksa batas modul memang sudah melaporkan 8 butir sejenis di kode dasar.
- Belum ada status kerja Freelance di data karyawan, jadi syarat "bukan Freelance" (DRV-121) belum berlaku.
- Cicilan yang muncul di slip tetapi tidak terpotong sama sekali (pendapatan habis) juga berstatus Sebagian; seluruh nominalnya menjadi sisa potongan kasbon yang dibawa.
- Tes: unit 10 (aturan kasbon) + 1 (sisa kasbon slip terakhir), integrasi 7 (alur ajukan → periksa → setujui → serahkan → slip ditutup → dibuka kembali → batal serah; sebagian + sisa dibawa; minta dibatalkan; isikan atas nama; tidak memutuskan milik sendiri). Seluruh HRIS 561 tes lulus (`--no-file-parallelism`); `check:candidate` lulus.
