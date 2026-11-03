# Spec HRIS L8 — Bongkaran: Laporan Bongkaran dan Bayar Bongkaran

Tanggal: 2026-11-04 · Status: **§9 diputuskan sesuai saran atas perintah owner 2026-11-04** ("lakukan saja semuanya sesuai aturan ... tuntaskan L8 dengan baik selama saya tidur"); owner boleh mengubah butir mana pun sesudah membaca, perubahan dikerjakan sebagai koreksi · **L8a + L8b LOLOS uji owner 2026-11-04** ("sudah di test dan ok", staging a91a75d2; §9 dianggap diterima, skenario tidak dirinci) → L8 Bongkaran SELESAI
Cakupan: langkah **L8** di [PRD 09](../../hris_planning/PRD/fase_1/09-gaji-driver-dan-bongkaran.md) (4G-3a Laporan Bongkaran, 4G-3b Bayar Bongkaran) + layar Pekerja Lepas (KAR-L28, PRD 04: "dipakai bongkaran").
Sumber: v3 `aturan/05-gaji-driver-kasbon.md` DRV-31 s.d. 53, 82, 85, 101 s.d. 120; spec v3 `2026-10-14-gaji-driver-spec.md` §3.3–3.4 (disetujui penuh 14 Okt 2026, L1–L7, B1–B6). PRD 09 §2: aturan v3 yang sudah jelas dipakai tanpa diskusi ulang; spec ini menulis penyesuaiannya ke kode yang ada dan butir yang memang terbuka.
Dasar kode: Sumber Uang + Bayar Slip + Jadwal Bayar (L4f), Pendapatan Saya (L4g), Mesin Pengajuan + Persetujuan + Pemberitahuan + Beranda (L2f), Pengaturan bertanggal (L2e), status hari `dayStatusesOf` (L3/L4b), berkas foto (`files`), view kasir di schema `hris` (pola L4c `pos_*`).

**Pokoknya (v3):** Kepala Gudang mengisi **apa yang datang dan siapa yang membongkar**; server menghitung berat, upah (total kg × tarif per kg pada tanggal kerja), dan bagian rata tiap orang (sisa rupiah Rp1 per orang menurut abjad). Laporan langsung **Berlaku** dan dibayar **tunai hari itu oleh Finance**, sebesar hitungan server. Salah dikoreksi, bukan dihapus; kurang bayar disusulkan, lebih bayar diperhitungkan di bongkaran berikutnya orang itu.

---

## 1. Batas

| Dikerjakan | Bagian |
|---|---|
| View kasir: produk + satuan + berat kasir, supplier | L8a |
| Pekerja Lepas (KAR-L28): daftar, tambah, ubah, nonaktifkan; tambah langsung dari Laporan Baru | L8a |
| Laporan Bongkaran: daftar (DRV-L11), Laporan Baru 5 langkah (DRV-L12), Rincian (DRV-L13) | L8a |
| Berat per satuan + riwayat + "Berat berubah" (DRV-L14); Barang lain + Pasangkan (DRV-L15) | L8a |
| Laporan terlambat → pengajuan, Putuskan (DRV-L16); tarik | L8a |
| Fungsi `computeUnloading` (satu tempat); tanda laporan; Perlu dilihat HR (izin/sakit/cuti/alpha) | L8a |
| Pengaturan: tarif bongkaran, mundur tanggal kerja, cabang penanggung, ambang beda berat, batas lebih bayar | L8a (lebih bayar dipakai L8b) |
| Bayar Bongkaran (DRV-L17, beberapa laporan sekaligus), Tanyakan dulu / Jawab | L8b |
| Koreksi (DRV-L18) dan Batalkan (DRV-L19) sebelum & sesudah dibayar, versi, selisih per orang | L8b |
| Bayar susulan, Lebih bayar (DRV-L21: diperhitungkan, Tagih tunai, Terima pengembalian, Hapus), Batal bayar (DRV-L20) | L8b |
| Bongkaran per Orang (DRV-L22) + unduh CSV; kartu bongkaran di Pendapatan Saya + "Uang belum saya terima" | L8b |
| Mesin `unloading-daily` 07.00 (pengingat belum dibayar, lebih bayar lewat 30 hari) | L8b |

| Tidak dikerjakan | Sebab / di mana |
|---|---|
| Sambungan purchase order (DRV-39, 106) | PRD 09 §3: menyusul; kelak cukup view |
| Tambah supplier dari HRIS, tanda "supplier belum diperiksa" | PRD 09 §3: supplier dibuat di backoffice |
| Isian "Total kg diketik" selama daftar produk kosong (DRV-38, 109) | Daftar produk kasir sudah terisi (§9 butir 5) |
| Baris Buku Kas, Catatan Cepat (KEU-18, 25) | App Keuangan belum ada; pembayaran disimpan HRIS dengan uraian seperti gaji (L4f, §9 butir 7) |
| "Ikut bongkaran" di Catatan Hari Kerja (PRI-16) | Tanpa akibat uang; backlog (modul Kehadiran tidak membaca Gaji) |
| Pengumuman Papan Perubahan Aturan untuk tarif | Papan belum ada (sama L7 §9 butir 5); perubahan lewat Pengaturan bertanggal |

---

## 2. Data

Semua di schema **`hris`**, modul **`payroll`** (pemilik Buku Upah, Sumber Uang, Pendapatan Saya), kecuali pekerja lepas di modul **`employees`**. Migrasi hris **0036** (L8a) dan **0037** (L8b).

| Tabel / view | Isi | Bagian |
|---|---|---|
| `hris.pos_products` (view) | produk kasir jenis BARANG: id, kode (sku), nama, aktif | L8a |
| `hris.pos_product_units` (view) | per produk: satuan dasar + satuan konversi (id satuan, kode, nama, gram per satuan dari kasir bila ada) | L8a |
| `hris.pos_suppliers` (view) | id, nama, aktif | L8a |
| `casual_workers` (employees) | nama, HP (wajib, unik; juga tidak boleh sama dengan HP karyawan, dijaga server), aktif, dibuat oleh. Tidak dihapus | L8a |
| `unloading_unit_weights` | produk + satuan (kunci kasir) → berat kg (3 desimal, > 0) **yang berlaku sekarang**, diisi oleh/kapan | L8a |
| `unloading_weight_changes` | riwayat: produk + satuan, dari, ke, beda %, alasan, oleh, kapan, laporan asal, ditandai (> ambang), sudah dilihat (oleh, catatan) | L8a |
| `unloading_reports` | nomor `LB-YYYYMMDD-urut`, tanggal kerja, supplier (id + nama salinan), status `PENDING` / `ACTIVE` / `REJECTED` / `WITHDRAWN` / `PAID` / `CANCELLED`, versi berjalan, tarif + total kg + total upah (salinan versi berjalan), cabang penanggung (salinan), alasan terlambat, pengajuan, tanda serupa (laporan lain), tanpa surat jalan + alasan, dibuat oleh, ditanyakan (L8b) | L8a |
| `unloading_report_versions` | per versi: barang (jsonb salinan), peserta + bagian, total, alasan koreksi, oleh, kapan. Versi 1 = dibuat | L8a |
| `unloading_items` | per versi: produk + satuan (atau Barang lain: nama, alasan, dipasangkan ke produk), jumlah, berat dipakai, kg baris | L8a |
| `unloading_shares` (Buku Upah bongkaran) | per versi per peserta: karyawan **atau** pekerja lepas, nama salinan, bagian, +Rp1, status hari yang dibaca, Perlu dilihat + Sudah dilihat, status `ACTIVE` / `CANCELLED` (versi diganti). Kunci: laporan + orang + `ACTIVE` | L8a |
| `unloading_photos` | laporan + berkas (`files`), jenis surat jalan / foto barang | L8a |
| `unloading_payments` | laporan **atau** susulan, jenis `MONEY` / `NO_MONEY`, uang keluar, tanggal uang, alasan tanggal, Sumber Uang, cara, pembayar, diserahkan kepada (langsung / satu nama), foto bukti, uraian (jsonb), status `ACTIVE` / `CANCELLED`. Unik satu `ACTIVE` per sasaran | L8b |
| `unloading_payment_lines` | per pembayaran per orang: bagian, diperhitungkan lebih bayar, diterima | L8b |
| `unloading_top_ups` (susulan) | laporan, versi koreksi, status `WAITING` / `PAID` / `CANCELLED`; baris per orang | L8b |
| `unloading_overpayments` | orang, laporan asal, versi, nominal, status `OPEN` / `COLLECT` (ditagih tunai) / `WRITTEN_OFF`; **sisa dihitung** dari nominal − diperhitungkan − dikembalikan − dihapus | L8b |
| `unloading_overpayment_uses` | pemakaian lebih bayar: di pembayaran mana (dibatalkan ikut batal bayar), atau dikembalikan tunai (Sumber Uang, tanggal uang), atau dikurangi koreksi | L8b |

Angka uang integer rupiah; kg disimpan `numeric(12,3)`. Tidak ada yang dihapus (pemicu `reject_change`); angka versi tidak bisa diubah.

---

## 3. Aturan

### 3.1 Hitungan (DRV-35, 42, 43, 108)

Satu fungsi murni `computeUnloading({ items, participants, rate })` dipakai pratinjau, simpan, setujui laporan terlambat, dan koreksi:

1. kg baris = jumlah × berat, dibulatkan 3 desimal (setengah ke atas); Barang lain = kg diketik.
2. total kg = jumlah kg baris, harus > 0.
3. tarif = pengaturan `payroll.unloading_rate_per_kg` pada **tanggal kerja**; pengaturan tidak ada → ditolak "Tarif bongkaran untuk [tanggal] belum ada". Tidak ada angka cadangan di kode.
4. total upah = total kg × tarif, dibulatkan ke rupiah terdekat (setengah ke atas).
5. bagian = total upah ÷ jumlah peserta dibulatkan ke bawah; sisa Rp1 per orang menurut abjad nama lengkap (huruf besar/kecil diabaikan; sama persis: yang lebih dulu terdaftar). Jumlah bagian = total upah.

Hitungan memakai `big.js`. Layar hanya mengirim barang, jumlah, berat, peserta.

### 3.2 Laporan Baru (DRV-31 s.d. 37, 44, 45, 101 s.d. 105)

- **Supplier** dicari dari `pos_suppliers` aktif. **Tanggal kerja** bawaan hari ini (WIB server); tidak masa depan; mundur ≤ `payroll.unloading_backdate_days` (3) langsung Berlaku; lebih jauh → alasan ≥ 15 huruf dan laporan `PENDING` + pengajuan jenis `unloading_late` (kecuali pembuatnya Pemilik/GM: langsung Berlaku, alasan tetap wajib).
- **Barang**: cari ≥ 2 huruf (nama/kode) dari `pos_products`; pilih satuan; jumlah > 0 (3 desimal). Satu produk + satuan sekali per laporan. Berat:
  - sudah ada di HRIS → dipakai, tampil sebagai tulisan; **Ubah berat** wajib alasan ≥ 15 huruf;
  - belum ada → wajib diisi; berat kasir (gram per satuan) ditampilkan sebagai saran isian (§9 butir 3);
  - berat > 100 kg minta konfirmasi; perubahan > `payroll.unloading_weight_flag_percent` (10%) → tanda "Berat berubah" + daftar untuk Pemilik/GM. Berat baru disimpan saat laporan disimpan dan berlaku untuk laporan sesudahnya (DRV-33).
- **Barang lain** hanya bila pencarian ≥ 3 huruf tidak menemukan apa pun: nama, kg, alasan ≥ 15 huruf.
- **Peserta**: karyawan aktif pada tanggal kerja (cabang/jabatan mana pun) atau pekerja lepas aktif; ≥ 1; tidak dobel. "Sering ikut" = peserta 30 hari terakhir. Pekerja lepas baru bisa ditambah di langkah ini.
- **Foto**: 1–5 foto surat jalan, atau "Tidak ada surat jalan" → ≥ 1 foto barang + alasan ≥ 15 huruf.
- **Serupa**: laporan lain (bukan Ditolak/Ditarik/Dibatalkan) dengan tanggal kerja + supplier + total kg sama → wajib konfirmasi "Ini bongkaran lain"; tercatat sebagai tanda.
- **Simpan satu transaksi**: laporan, versi 1, barang, berat baru/berubah + riwayat, peserta + bagian (Buku Upah), foto. Status hari tiap karyawan dibaca sekali saat Berlaku: izin/sakit/cuti/alpha → baris bertanda **Perlu dilihat** (HR, tanpa nominal). Total upah Rp0 → langsung Dibayar "tanpa uang" (L8b; di L8a tampil Berlaku Rp0).
- **Tanda** (keterangan, bukan penahan): pembuat ikut jadi peserta, Barang lain, berat berubah, tanpa surat jalan, tanggal mundur, serupa dengan LB-…, dikoreksi n kali (L8b), ditanyakan Finance (L8b).
- Berlaku → Finance (pemegang `unloading.pay`) diberi tahu "Laporan LB-… Rp… siap dibayar".

### 3.3 Laporan terlambat (DRV-104)

Pengajuan `unloading_late` di Mesin Pengajuan; diputuskan Pemilik/GM yang **bukan pembuat dan bukan peserta**. Isi khas di `/persetujuan/[id]`: rincian, alasan, berapa hari terlambat, laporan lain di tanggal itu, pratinjau upah. Setujui → Berlaku (tarif tanggal kerja, status hari dibaca saat itu); Tolak → `REJECTED`; pembuat boleh menarik (`WITHDRAWN`). Selama `PENDING` tidak ada Buku Upah dan tidak bisa dibayar/dikoreksi.

### 3.4 Bayar (DRV-47, 48, 50, 51, 111 s.d. 114) — L8b

- Finance, Pemilik, GM (`unloading.pay`); beberapa laporan/susulan sekaligus dari **satu Sumber Uang**; tiap sasaran satu pembayaran dan satu transaksi tersendiri (yang gagal tidak membatalkan yang lain).
- Ditolak bila penekan **peserta atau pembuat** laporan itu, kecuali Pemilik/GM (boleh; pembayaran bertanda dan para pemilik diberi tahu).
- Diterima per orang = bagian − sisa lebih bayar orang itu (yang paling lama dulu, sampai habis atau bagian Rp0). Uang keluar = jumlah diterima; tanpa isian nominal; tanpa kasbon/denda/potongan lain.
- Tanggal uang: bawaan hari ini; mundur > 7 hari wajib alasan (angka 7 dibaca dari aturan tanggal uang Gaji, `MONEY_DATE_FREE_DAYS`); tidak sebelum tanggal kerja; tidak masa depan.
- Diserahkan kepada: "Langsung ke tiap peserta" atau satu nama (peserta atau pembuat).
- Uang keluar Rp0 → pembayaran `NO_MONEY` tanpa Sumber Uang.
- Laporan → `PAID`; peserta berakun diberi tahu ("Upah bongkaran 3 November Rp44.800 sudah dibayar …, diserahkan lewat Hadi").
- **Tanyakan dulu**: pertanyaan ≥ 15 huruf → tanda "Ditanyakan Finance" + pembuat, Pemilik, GM diberi tahu; pembuat **Jawab** (tulisan) atau Koreksi → tanda padam, penanya diberi tahu. Bukan penahan.
- **Pengingat**: mesin 07.00 WIB tiap hari, untuk laporan Berlaku/susulan menunggu yang jatuh bayarnya (hari Berlaku) sudah lewat → satu pemberitahuan ke Finance, Pemilik, GM ("Ada 3 Laporan Bongkaran belum dibayar, Rp412.000, paling lama sejak 3 November"). Tab Belum dibayar tidak dibatasi umur.

### 3.5 Koreksi dan batal (DRV-49, 115 s.d. 119) — L8b

- **Sebelum dibayar**: pemegang `unloading.create` (Kepala Gudang), Pemilik, GM; alasan ≥ 15 huruf. Versi baru dihitung `computeUnloading` (tarif tanggal kerja); bagian versi lama `CANCELLED`, versi baru `ACTIVE`; tanda dihitung ulang. Tanggal kerja baru dibatasi 3 hari sebelum **hari laporan dibuat** (lebih jauh hanya Pemilik/GM). Centang "pakai berat ini juga untuk laporan berikutnya" = Ubah berat dengan alasan yang sama. **Batalkan** (Kepala Gudang, Pemilik, GM) → `CANCELLED`, tidak dihidupkan lagi.
- **Sesudah dibayar**: hanya Pemilik/GM (`unloading.correct_paid`, ownerOnly), tanpa batas waktu. Satu fungsi murni `unloadingDelta(lama, baru, keadaan)` per orang: selisih plus → kurangi dulu sisa lebih bayar orang itu dari laporan yang sama, sisanya **susulan**; selisih minus → kurangi dulu susulan menunggu orang itu di laporan yang sama, sisanya **lebih bayar**. Batalkan = semua bagian baru Rp0. Pembayaran pertama tidak diubah. Orangnya diberi tahu angka lama → baru dan akibatnya.
- **Susulan**: satu per koreksi per laporan (baris per orang), `WAITING` → `PAID` lewat langkah bayar yang sama, `CANCELLED` bila koreksi berikutnya menghabiskannya.
- **Lebih bayar**: satu baris per orang per koreksi; sisa dihitung. Diperhitungkan otomatis saat bongkaran berikutnya orang itu dibayar. Pemilik/GM: **Tagih tunai** (tanda; diperhitungkan tetap berjalan) atau **Hapus** (alasan). Finance/Pemilik/GM: **Terima pengembalian** (≤ sisa, Sumber Uang, tanggal uang). Lewat `payroll.unloading_overpay_flag_days` (30) → kartu Beranda Pemilik/GM.
- **Batal bayar**: Pemilik/GM, alasan; pembayaran `CANCELLED`, pemakaian lebih bayar di pembayaran itu ikut batal (hidup kembali), laporan kembali Berlaku / susulan kembali menunggu. Ditolak bila sudah ada koreksi atau batal sesudah pembayaran itu.
- **"Uang belum saya terima"**: peserta berakun, ≤ 3 hari sejak diberi tahu dibayar, tulisan ≥ 15 huruf → pengajuan `unloading_not_received`, diputuskan Pemilik/GM (Sudah diselesaikan / Tidak terbukti, catatan wajib); pembayar dan yang dititipi diberi tahu. Tanpa akibat uang. Untuk pekerja lepas: Pemilik/GM mengisikan dari Rincian.

### 3.6 Pengaturan (bertanggal, Pemilik/GM; DRV-85)

| Kunci | Isi awal | Catatan |
|---|---|---|
| `payroll.unloading_rate_per_kg` | Rp20, berlaku **26 Okt 2026** (§9 butir 6) | rupiah bulat; menyangkut uang (paling cepat besok) |
| `payroll.unloading_backdate_days` | 3 | DRV-36 |
| `payroll.unloading_cost_branch` | cabang **Gudang** | jenis pengaturan baru "cabang" (§9 butir 8) |
| `payroll.unloading_weight_flag_percent` | 10 | L5 |
| `payroll.unloading_overpay_flag_days` | 30 | DRV-49 |

Jumlah foto 1–5 dan masa "Uang belum saya terima" 3 hari ditulis sebagai konstanta aturan (seperti kasbon L5); tanggal uang 7 hari dibaca dari aturan Gaji.

---

## 4. Layar

| Layar | Alamat | Dipakai | Bagian |
|---|---|---|---|
| **Laporan Bongkaran** (tab Belum dibayar, Menunggu persetujuan, Semua, Barang lain; L8b + Lebih bayar, Per orang) | `/gaji/bongkaran` | Kepala Gudang (HP), Finance, Pemilik, GM (PC) | L8a/L8b |
| **Laporan Baru** (5 langkah, isian tersimpan di perangkat) | `/gaji/bongkaran/baru` | Kepala Gudang, Pemilik, GM | L8a |
| **Rincian** (+ Bayar, Tanyakan, Jawab, Koreksi, Batalkan, Batal bayar di L8b) | `/gaji/bongkaran/[id]` | sama | L8a/L8b |
| **Berat per Satuan** (Semua berat, Berat berubah, riwayat, Ubah berat, Sudah dilihat) | `/gaji/bongkaran/berat` | Kepala Gudang, Pemilik, GM mengubah; Finance lihat | L8a |
| Putuskan Laporan Terlambat | isi khas `/persetujuan/[id]` | Pemilik, GM | L8a |
| **Pekerja Lepas** (KAR-L28) | `/karyawan/pekerja-lepas` | HR, Kepala Gudang, Pemilik, GM | L8a |
| Bayar Bongkaran (3 langkah) | `/gaji/bongkaran/bayar?ids=…` | Finance, Pemilik, GM | L8b |
| Koreksi (3 langkah) / Batalkan / Batal bayar | dari Rincian | lihat §3.5 | L8b |
| Kartu **Upah bongkaran** + "Uang belum saya terima" | `/pendapatan-saya` | peserta berakun | L8b |
| Kartu Beranda | Beranda | Perlu dilihat (HR, Pemilik, GM); Belum dibayar (Finance, Pemilik, GM); Berat berubah (Pemilik, GM); lebih bayar lewat 30 hari (Pemilik, GM, L8b) | L8a/L8b |

Tiap bagian membawa fragment `apps/hris/changelog.d` + tanda **Baru** di `lib/new-features.ts`.

## 5. Hak

| Hak | Bawaan |
|---|---|
| `unloading.view` | Kepala Gudang, Finance (+ Pemilik, GM) — bukan HR (DRV-82, 120) |
| `unloading.create` (buat, koreksi sebelum dibayar, batalkan sebelum dibayar, ubah berat, tambah pekerja lepas) | Kepala Gudang |
| `unloading.decide` (laporan terlambat), `unloading.weight_review`, `unloading.other_item_link` | Pemilik, GM (ownerOnly) |
| `unloading.pay` (bayar, tanyakan, terima pengembalian) | Finance |
| `unloading.correct_paid`, `unloading.cancel_payment`, `unloading.overpay_decide` | Pemilik, GM (ownerOnly) |
| `unloading.review_day` (Sudah dilihat baris Perlu dilihat) | HR |
| Pekerja Lepas: hak lama `freelancer.manage` | HR, Admin HR, Kepala Gudang (migrasi 0001); Kepala Gudang juga lewat `unloading.create` |

## 6. Mesin terjadwal

| Mesin | Jam | Isi | Bagian |
|---|---|---|---|
| `unloading-daily` | 07.00 WIB | Pengingat belum dibayar (lewat hari Berlaku); lebih bayar sisa > 30 hari belum diputuskan → Pemilik/GM sekali | L8b |

## 7. Pemberitahuan

| Kejadian | Ke |
|---|---|
| Laporan Berlaku (dibuat / disetujui) | Pemegang `unloading.pay` |
| Laporan terlambat masuk | Kotak Persetujuan Pemilik/GM |
| Disetujui / ditolak | Pembuat |
| Berat berubah > 10% | Pemilik, GM |
| Dibayar / dikoreksi / dibatalkan / susulan dibayar | Peserta berakun |
| Ditanyakan / dijawab | Pembuat, Pemilik, GM / penanya |
| Pembayaran oleh Pemilik/GM yang peserta/pembuat; batal bayar | Para pemilik |
| Uang belum diterima | Persetujuan Pemilik/GM + pembayar + yang dititipi |

## 8. Tes

- **Unit:** `computeUnloading` (kg 3 desimal, setengah ke atas, sisa Rp1 menurut abjad + nama kembar, jumlah bagian = total, tarif tidak ada, total kg 0), batas tanggal kerja, beda berat %, tanda; L8b: `unloadingDelta` (plus/minus, lebih bayar laporan sama, susulan menunggu, batal), perhitungan lebih bayar paling lama dulu sampai bagian Rp0, sisa lebih bayar.
- **Integrasi (DB):** simpan laporan → Buku Upah per peserta, berat tersimpan + riwayat; peserta sakit → Perlu dilihat; laporan terlambat → pengajuan → setujui/tolak/tarik; serupa wajib konfirmasi; pekerja lepas HP kembar ditolak; L8b: bayar → pembayaran + baris per orang, pembayar peserta ditolak; koreksi sebelum; koreksi sesudah → susulan & lebih bayar; lebih bayar diperhitungkan di bayar berikutnya; batal bayar menghidupkan lebih bayar; tagih/terima/hapus; uang belum diterima.
- Tes integrasi memakai tanggal lampau; view kasir memakai stub `test-stubs/petshop-pos.sql`.

---

## 9. Keputusan (diputuskan sesuai saran atas perintah owner 2026-11-04)

| # | Pertanyaan | Saran (dipakai) |
|---|---|---|
| 1 | L8 dua urusan besar. Dipecah **L8a** Laporan Bongkaran → **L8b** Bayar Bongkaran? | **Ya.** Karena owner meminta L8 tuntas malam ini, keduanya dikerjakan berurutan dan ditayangkan staging; L8b dibangun di atas L8a yang belum diuji owner. Uji owner untuk keduanya sesudah owner bangun |
| 2 | Pekerja lepas (DRV-45: "orang berstatus Freelance, satu tempat"). Data karyawan HRIS mewajibkan cabang + jabatan dan dibaca semua modul (absen, jadwal, slip, kasbon) | **Tabel sendiri `casual_workers`** (nama + HP, tanpa akun/absen/slip) di modul Karyawan, layar KAR-L28. Tetap satu tempat; tidak ada modul lain yang perlu menyaring "Freelance". HP tidak boleh sama dengan HP karyawan atau pekerja lepas lain |
| 3 | PRD ❓: berat per satuan dari HRIS lama dibawa? | **Tidak dibawa** (HRIS lama tidak dibuka). Diisi saat bongkaran pertama; bila kasir sudah punya berat (gram) untuk satuan itu, ditampilkan sebagai **saran isian** yang tetap harus dikonfirmasi Kepala Gudang |
| 4 | Supplier dari mana? | Daftar supplier **kasir** yang aktif (PRD 09 §3), tanpa tambah supplier di HRIS |
| 5 | Isian "Total kg diketik" selama daftar produk kosong (DRV-38) | **Tidak dibangun**: daftar produk kasir sudah terisi; bila suatu saat kosong, pencarian tidak menemukan apa pun dan jalurnya Barang lain |
| 6 | Tarif awal Rp20/kg berlaku sejak kapan? | Staging: **26 Okt 2026** (awal periode berjalan) supaya laporan mundur 3 hari bisa diuji. Produksi: tanggal cutover. Perubahan tarif lewat Pengaturan bertanggal (paling cepat besok); aturan "7 hari bila turun" dan pengumuman menunggu Papan Perubahan Aturan (sama L7) |
| 7 | Buku Kas belum ada | Pembayaran, susulan, dan pengembalian lebih bayar disimpan HRIS dengan **Sumber Uang** + uraian (seperti gaji L4f), siap diteruskan ke app Keuangan kelak. Catatan Cepat tidak dibuat |
| 8 | Cabang penanggung biaya (DRV-51) | Pengaturan bertanggal jenis baru **cabang**, isi awal **Gudang**; disalin ke laporan saat Berlaku |

## 10. Urutan kerja

1. Merge `docs/hris-l7c-status` + spec ini ke `dev_hris` lalu `staging`; klaim `docs/claim-hris-l8` (payroll bongkaran, employees pekerja lepas, schema payroll/employees, settings registry jenis cabang, app/(app)/{gaji/bongkaran,karyawan/pekerja-lepas,persetujuan,pendapatan-saya,beranda}, app/api/unloading, nav, new-features, changelog.d, test-stubs, crontab/jobs; kunci **hris 0036–0037**). Push staging sekali.
2. `pnpm worktree:new feat/hris-l8a-unloading --from origin/dev_hris` → koding → tes → merge dev_hris → staging.
3. `feat/hris-l8b-unloading-pay` dari dev_hris sesudah L8a → koding → tes → merge → staging → lepas klaim + kunci → langkah uji owner.

## 11. Catatan implementasi L8a (2026-11-04)

- **Migrasi hris `0036`:** `casual_workers` (modul employees) dan `unloading_unit_weights`, `unloading_weight_changes`, `unloading_reports`, `unloading_report_versions`, `unloading_items`, `unloading_shares`, `unloading_photos` (modul payroll); view `hris.pos_products` (produk BARANG), `hris.pos_product_units` (satuan dasar + konversi, gram kasir), `hris.pos_suppliers`; pemicu: tidak ada hapus, versi/foto tidak diubah, barang hanya boleh diubah kolom pasangannya, Buku Upah terkunci sesudah Berlaku, laporan selesai tidak hidup lagi; 5 pengaturan §3.6; hak §5.
- **Pekerja Lepas memakai hak lama `freelancer.manage`** (HR, Admin HR, Kepala Gudang sejak migrasi 0001), bukan hak baru. Kepala Gudang juga bisa menambah lewat `unloading.create`. HP dibakukan (awalan 62 → 0) dan dibandingkan dengan HP karyawan.
- **Jenis pengaturan baru `branch`** di registry (dipakai `payroll.unloading_cost_branch`); cabang Gudang dicari dari nama saat migrasi. Bila tidak ada cabang bernama Gudang, laporan ditolak dengan pesan "Cabang penanggung belum diatur" sampai Pemilik/GM mengisinya.
- **Laporan terlambat** = pengajuan `unloading_late` lewat Mesin Pengajuan; laporan, barang, berat, dan peserta disimpan saat dikirim (bagian `PENDING`, belum Buku Upah). Disetujui: bagian menjadi `ACTIVE`, status hari dibaca saat itu. Penyetuju ditolak bila pembuat atau peserta. Bila tarif tanggal kerja berbeda dari saat dikirim (tidak mungkin selama pengaturan tidak berlaku mundur), persetujuan ditolak dan laporan dikirim ulang.
- **Urutan "lebih dulu terdaftar"** untuk nama kembar: karyawan menurut id, lalu pekerja lepas menurut id (pekerja lepas selalu sesudah karyawan bernama sama).
- **Belum (L8b):** tombol Bayar, Tanyakan dulu, Koreksi, Batalkan, Batal bayar di Rincian; tab Lebih bayar dan Per orang; kartu bongkaran di Pendapatan Saya; mesin `unloading-daily`. Laporan Rp0 (DRV kecil sekali) tampil Berlaku Rp0 sampai L8b.
- **Tes:** unit 9 (`rules/unloading`), integrasi 6 (`unloading.integration`: view kasir, simpan + Buku Upah + Finance diberi tahu + angka terkunci, berat tersimpan/berubah/serupa, Barang lain + pekerja lepas HP kembar, laporan terlambat setujui/tolak + Pemilik langsung, daftar + Beranda). Suite settings, requests, access, lib, batas modul lulus; batas modul tetap 16 temuan (sama dasar). Kunci jawaban db-roles `hris-access` ditambah hak L8a; dua tes db-roles yang sudah gagal sejak sebelum L6 tetap gagal (kunci belum memuat hak L3c–L5).

## 12. Catatan implementasi L8b (2026-11-04)

- **Migrasi hris `0037`:** kolom tanya/jawab dan batal di `unloading_reports`; tabel `unloading_top_ups` + `unloading_top_up_lines` (susulan), `unloading_payments` + `unloading_payment_lines` (satu `ACTIVE` per laporan/susulan, `MONEY`/`NO_MONEY`, Sumber Uang L4f, uraian jsonb), `unloading_overpayments` + `unloading_overpayment_uses` (`OFFSET`/`REFUND`/`CORRECTION`/`WRITE_OFF`; sisa dihitung), `unloading_receipt_claims`; pemicu: tidak dihapus, angka terkunci, hanya pembatalan yang mengubah pembayaran/pemakaian.
- **"Selisih bongkaran"** (`rules/unloading-pay.ts` `correctionDelta`) memakai *uang yang sudah dihitung diterima* per orang untuk laporan itu = bagian di pembayaran pertama + susulan dibayar − lebih bayar laporan itu yang masih utang (nominal − pengurangan koreksi − hapus). Susulan yang masih menunggu dibatalkan dan diganti hasil hitungan baru — itulah "lebih dulu mengurangi susulan yang masih menunggu".
- **Lebih bayar diperhitungkan** di pembayaran laporan/susulan berikutnya orang itu dari laporan mana pun, yang paling lama dulu, sampai habis atau bagian Rp0 (`offsetShare`). Terima pengembalian tidak menghentikan perhitungan otomatis.
- **Batal bayar ditolak** bila sesudah pembayaran itu sudah lahir susulan atau lebih bayar dari laporan yang sama, atau laporannya dibatalkan.
- **Yang dititipi** dipilih per laporan (peserta atau pembuat). Foto bukti satu untuk seluruh batch.
- **Belum:** "Uang belum saya terima" atas nama pekerja lepas (diisikan Pemilik/GM) belum ada tombolnya; Jadwal Bayar (L4f) belum memuat baris bongkaran — daftar bayar bongkaran ada di tab Belum dibayar; Catatan Cepat/Buku Kas menunggu app Keuangan.
- **Tes:** unit 6 (`rules/unloading-pay`); integrasi 5 (`unloading-pay.integration`: bayar + pembayar ditolak + dua kali ditolak, koreksi turun/naik sebagian/naik → susulan dibayar, batal sesudah bayar → diperhitungkan tanpa uang → batal bayar menghidupkan, pengembalian + hapus, tanyakan/jawab + uang belum diterima + per orang + Pendapatan Saya + pengingat 07.00). L8a tetap lulus; suite requests, settings, lib, shared, my-pay, payment lulus; batas modul 16 (sama dasar).
