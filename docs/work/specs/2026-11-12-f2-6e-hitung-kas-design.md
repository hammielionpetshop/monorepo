# F2-6e Hitung Kas

PRD: `docs/hris_planning/PRD/fase_2/00-ringkasan-fase-2.md` §10 no. 6 ("Hitung fisik kas — mencocokkan saldo
sistem dengan uang nyata"), `07-modul-finance.md`. Rujukan buku v3:
`docs/hris_planning/reference_docs/docs/aturan/06-keuangan.md` KEU-07 (penyesuaian saldo), KEU-36 (hitung tanpa
melihat angka sistem), KEU-37 (Brankas seminggu sekali), KEU-99 (Posisi Kas: "terakhir dihitung nyata kapan").
Lanjutan F2-6a Saldo Tempat Uang (`2026-11-12-f2-6-modul-finance-design.md` §3.2, §5 "hitung fisik kas").

Status: **disetujui owner 2026-11-12** ("ok setuju, kerjakan semua sampai di push"; butir §0.1–11 mengikuti saran agent).

Prinsip Fase 2 tetap berlaku: uang dicatat sekali di modul kejadiannya (hitungan = Back Office), Finance hanya
membaca (role `finance_app` SELECT saja), setiap angka Finance punya **Cara membaca**, tidak ada hapus (batal
beralasan), rumus saldo hanya di satu tempat (modul `money` Finance).

## 0. Keputusan yang diminta (saran agent)

| No | Hal | Saran agent |
|---|---|---|
| 1 | Tempat yang dihitung | Tempat Uang **Tunai** (brankas, kas Finance, uang pegangan) dan **Rekening** (saldo dibaca dari mutasi/aplikasi bank). **Laci kasir tidak** — sudah dihitung tiap tutup shift |
| 2 | Tempat mencatat | Menu baru **Back Office › Keuangan › Hitung Kas** (BO yang bisa menulis; Finance hanya membaca). Isian: tempat, **tanggal hitung**, **jumlah uang nyata**, catatan, foto (dianjurkan). Back Office tidak menampilkan saldo sistem, jadi penghitung **tidak melihat angka sistem** saat mengetik (KEU-36) |
| 3 | Arti tanggal | Hitungan berarti **uang nyata pada akhir hari tanggal itu**. Hitung sesudah uang hari itu selesai keluar-masuk; bila sesudah dihitung masih ada uang keluar/masuk di hari yang sama, hitung ulang (batalkan hitungan lama, catat yang baru). Tanggal paling awal 1 Nov 2026, paling lambat hari ini |
| 4 | Rincian pecahan | **Tidak** — cukup jumlah total (boleh tulis rincian di catatan). Bisa ditambah belakangan |
| 5 | Selisih | Dihitung & ditampilkan di **web Finance** (Owner/GM): selisih = uang nyata − saldo sistem akhir hari itu. Selisih **hidup**: bila catatan yang terlupa diketik belakangan dengan tanggal uang ≤ tanggal hitung, selisihnya ikut mengecil. Hitungan **tidak mengubah saldo** |
| 6 | Penyesuaian saldo | Bila selisih tidak ketemu sebabnya, Owner/GM menekan **Catat penyesuaian** pada hitungan itu di Back Office (jumlah & arah terisi dari tautan Finance, alasan wajib). Ini menulis satu catatan **Arus Kas** bertanggal hitungan, kategori sistem **"Selisih kas kurang"** (keluar, jenis **Biaya**) atau **"Selisih kas lebih"** (masuk, jenis **Pendapatan lain**), di Tempat Uang & cabang pemilik tempat itu. Sesudahnya selisih hitungan itu menjadi 0 dan Laba Rugi membacanya otomatis lewat jenis kategori. Satu hitungan paling banyak satu penyesuaian aktif |
| 7 | Jadwal & tanda | Tunai & Rekening yang **belum dihitung lebih dari 7 hari** (atau belum pernah sejak 1 Nov) bertanda kuning di Finance dan Back Office. Tidak ada yang terkunci (KEU-37). Tanpa pengingat harian Kas Pegangan dulu |
| 8 | Salah ketik | Hitungan **tidak bisa diubah**. Salah = **Batalkan** (Owner/GM, alasan wajib), lalu catat ulang. Hitungan yang sudah punya penyesuaian aktif harus dibatalkan penyesuaiannya dulu (batal catatan Arus Kas-nya, pola biasa) |
| 9 | Hak | Catat hitungan: Owner, GM, Finance (hak `cashflow.record`). Batalkan hitungan & Catat penyesuaian: Owner, GM (lewat peran). Riwayat hitungan (tanpa saldo sistem) terlihat Owner, GM, Finance |
| 10 | Rilis | **F2-6e-1** Back Office (dasar `origin/main`, migrasi petshop `0069`) **boleh rilis produksi** sesudah lolos uji: kebiasaan hitung dan datanya mulai terkumpul, selisihnya terbaca begitu web Finance naik produksi. **F2-6e-2** web Finance (dasar `origin/dev_hris`, tanpa migrasi, khusus staging) |
| 11 | Di luar langkah ini | Hitung Kas Pegangan wajib tiap akhir hari kerja Finance (KEU-36 + jadwal libur), "Setoran di Finance harus kosong", saksi hitung, pencocokan mutasi bank per baris, tutup bulan (butir berikutnya), saldo Laci |

## 1. Back Office — Keuangan › Hitung Kas (F2-6e-1)

### 1.1 Daftar

- Menu **Keuangan › Hitung Kas** (Owner/GM/Finance), badge Baru (`/cash-counts`).
- Bagian atas: **Tempat Uang Tunai & Rekening aktif** per cabang pemilik: nama, jenis, **hitung terakhir**
  (tanggal + jumlah nyata + penghitung), tanda kuning **"Belum dihitung 7 hari"** / **"Belum pernah dihitung"**,
  tombol **Catat Hitungan**. Tidak ada kolom saldo sistem.
- Bagian bawah: **Riwayat Hitungan** (saringan tempat & bulan; bawaan bulan ini): tanggal, tempat, jumlah nyata,
  penghitung, waktu catat, catatan, foto, keadaan (Berlaku / Batal + alasan), penyesuaian (bila ada: jumlah,
  arah, tautan Arus Kas).

### 1.2 Catat Hitungan

| Isian | Aturan |
|---|---|
| Tempat Uang | Tunai/Rekening aktif; Laci ditolak server |
| Tanggal hitung | Bawaan hari ini WIB; 1 Nov 2026 s.d. hari ini. Kalimat bantu: "Uang nyata pada akhir hari tanggal ini — hitung sesudah uang hari itu selesai keluar-masuk" |
| Jumlah uang nyata | Bulat ≥ 0 (Rekening: saldo akhir hari dari mutasi) |
| Catatan | Boleh kosong (mis. rincian pecahan, siapa yang menyaksikan) |
| Foto | Dianjurkan (foto uang/mutasi); tanpa foto bertanda "tanpa bukti" |

- Dua hitungan berlaku untuk tempat & tanggal yang sama **ditolak** ("sudah ada hitungan tanggal ini; batalkan
  dulu bila salah").
- Sesudah simpan tampil "Hitungan tercatat" — **tanpa** saldo sistem atau selisih.

### 1.3 Batalkan (Owner/GM)

Alasan wajib, tanpa batas waktu. Ditolak bila penyesuaiannya masih aktif. Yang batal tetap tampil di riwayat.

### 1.4 Catat penyesuaian (Owner/GM)

- Tombol pada hitungan Berlaku tanpa penyesuaian aktif. Dibuka dari tautan Finance
  (`/cash-counts?adjust=<id>&direction=OUT&amount=<n>`) atau langsung.
- Isian: arah (**Kurang** = uang nyata lebih sedikit / **Lebih**), jumlah (> 0), alasan wajib. Kalimat:
  "Penyesuaian membuat saldo sistem sama dengan uang nyata pada tanggal hitung. Pastikan tidak ada catatan yang
  terlupa lebih dulu."
- Simpan (satu transaksi DB): catatan Arus Kas `occurred_on` = tanggal hitung, `for_month` = bulannya, Tempat
  Uang = tempat hitungan, cabang = cabang pemilik tempat, kategori sistem "Selisih kas kurang"/"Selisih kas
  lebih", catatan "Penyesuaian Hitung Kas #id: <alasan>"; hitungan menyimpan tautannya.
- Membatalkan penyesuaian = batalkan catatan Arus Kas itu (alur batal Arus Kas yang sudah ada, `cashflow.cancel`);
  hitungan kembali "tanpa penyesuaian".

### 1.5 Data (migrasi petshop `0069`)

- Tabel `petshop.cash_counts`: `id`, `money_place_id` (FK), `counted_on date`, `amount integer ≥ 0`, `note`,
  `photo_url`, `created_by`, `created_at`, `adjustment_cash_flow_entry_id` (FK `cash_flow_entries`, boleh kosong),
  `cancelled_at`, `cancelled_by`, `cancel_reason`.
- Indeks unik (`money_place_id`, `counted_on`) untuk yang belum batal. CHECK `counted_on >= '2026-11-01'`.
- Trigger tolak hapus, dan tolak ubah selain pengisian kolom batal dan kolom tautan penyesuaian (pola Arus Kas /
  saldo awal). Penolakan Laci & tanggal masa depan di service.
- Kategori sistem `cash_flow_categories`: ("Selisih kas kurang", EXPENSE, COST, `is_system`) dan
  ("Selisih kas lebih", INCOME, INCOME, `is_system`) — tidak bisa dipilih langsung di Arus Kas (pola "Beli aset").
- `finance_app` mendapat SELECT lewat `packages/db-roles` (apply-roles) seperti tabel petshop lain; dicek saat implementasi.

## 2. Web Finance (F2-6e-2, khusus staging)

- Modul `money`: pembaca `loadCashCounts(sql, to)` + aturan murni `countVariance(count, saldoAkhirHari)`. Saldo
  sistem memakai rumus saldo yang sudah ada (satu tempat).
- **Saldo** (beranda): kolom baru **Hitung terakhir** (tanggal, uang nyata) dan **Selisih** pada tanggal itu
  (merah bila kurang, biru bila lebih, "cocok" bila 0), tanda kuning "Belum dihitung 7 hari / belum pernah".
  Dihitung terhadap tanggal pilihan halaman (hitungan terakhir ≤ tanggal pilihan).
- Halaman baru **Hitung Kas**: semua hitungan (saringan tempat & bulan): tanggal, tempat, saldo sistem akhir
  hari, uang nyata, selisih, penyesuaian (bila ada), tautan **Catat penyesuaian di Back Office** (terisi arah &
  jumlah) untuk selisih ≠ 0 tanpa penyesuaian.
- **Mutasi** satu tempat: baris penanda "Dihitung nyata: Rp… (selisih Rp…)" di tanggal hitungan (bukan baris uang,
  tidak mengubah saldo berjalan); baris penyesuaian tampil seperti catatan Arus Kas biasa.
- **Laba Rugi / Setoran vs Laba**: tanpa perubahan kode — penyesuaian terbaca lewat jenis kategori (Biaya /
  Pendapatan lain). Dicek di tes.
- **Cara membaca**: selisih hidup, arti tanggal hitung, kapan menekan penyesuaian.

## 3. Tes

- BO aturan (unit): Laci ditolak, tanggal < 1 Nov / masa depan ditolak, dua hitungan berlaku satu tanggal ditolak,
  batal ditolak bila penyesuaian aktif, arah & jumlah penyesuaian, hak per peran.
- BO integrasi DB: catat → penyesuaian menulis Arus Kas kategori sistem bertanggal hitungan; batal catatan Arus
  Kas membuat hitungan bisa disesuaikan lagi; trigger tolak hapus/ubah.
- Finance aturan: selisih (kurang/lebih/cocok), tanda 7 hari, hitungan terakhir ≤ tanggal pilihan.
- Finance integrasi (sebagai `finance_app`): selisih menjadi 0 sesudah penyesuaian; penyesuaian kurang masuk Biaya
  di Laba Rugi.
- Typecheck root sekali pada kandidat akhir.

## 4. Langkah uji owner (staging)

1. BO › Keuangan › Hitung Kas: semua Tunai & Rekening tampil, Laci tidak; yang belum dihitung bertanda kuning.
2. Catat Hitungan untuk satu Tunai hari ini dengan jumlah **berbeda** dari saldonya — layar tidak menampilkan saldo
   sistem. Coba catat lagi tanggal yang sama → ditolak.
3. Finance › Saldo: tempat itu menunjukkan hitung terakhir & selisih yang benar; Finance › Hitung Kas sama.
4. Catat di BO Arus Kas pengeluaran yang "terlupa" di tempat itu bertanggal hari ini → selisih di Finance berubah.
5. Dari Finance tekan **Catat penyesuaian di Back Office** → isian terisi; simpan dengan alasan → selisih 0, Laba
   Rugi bulan ini memuat "Selisih kas kurang"/"lebih".
6. Batalkan hitungan → ditolak (masih ada penyesuaian); batalkan catatan Arus Kas penyesuaiannya, lalu batalkan
   hitungan → berhasil, tampil Batal di riwayat.
7. Masuk sebagai Finance: bisa Catat Hitungan, tidak melihat tombol Batalkan/Catat penyesuaian.

## 5. Klaim & kunci

- `feat/cash-counts` (dasar `origin/main`, F2-6e-1): `apps/backoffice/app/(dashboard)/cash-counts/**`,
  `apps/backoffice/app/api/bo/cash-counts/**`, `apps/backoffice/lib/services/cash-count*`,
  `packages/db/src/schema/cash_counts.ts`, migrasi `0069`, tambahan seperlunya di `sidebar.tsx`,
  `lib/new-features.ts`, `packages/db/src/schema/index.ts`; changelog fragment. **Kunci `petshop`.**
- `feat/finance-cash-counts` (dasar `origin/dev_hris` + `feat/cash-counts`, F2-6e-2): `apps/finance/modules/money/**`,
  `apps/finance/app/page.tsx`, `apps/finance/app/hitung-kas/**`, `apps/finance/app/mutasi/**`, navigasi Finance.
- Urutan: spec disetujui → klaim terpublikasi di `origin/staging` → 6e-1 → merge lokal staging → 6e-2 → merge lokal
  dev_hris & staging → push sekali → uji owner → (6e-1) PR rilis Back Office.

## 6. Catatan implementasi (2026-11-12)

- Arus Kas menolak membatalkan catatan berkategori sistem ("dibatalkan lewat asalnya"), jadi penyesuaian **dibatalkan
  dari Hitung Kas**: tombol **Batalkan penyesuaian** (Owner/GM, alasan wajib) menandai catatan Arus Kas-nya Batal;
  hitungan bisa disesuaikan lagi (kolom tautan boleh berganti selama hitungan belum batal — dijaga trigger).
- **Batalkan hitungan** yang punya penyesuaian aktif tidak ditolak, tetapi ikut membatalkan penyesuaiannya (pola Aset),
  agar satu langkah cukup. Langkah uji §4 no. 6 menjadi: Batalkan penyesuaian → Catat penyesuaian lagi → Batalkan
  hitungan (penyesuaian ikut batal) → catat ulang tanggal yang sama berhasil.
- Laba Rugi Finance membaca penyesuaian tanpa perubahan kode (jenis kategori COST/INCOME); di kolom cabang pemilik
  Tempat Uang.
- Tanda 7 hari di Finance dihitung terhadap tanggal pilihan halaman Saldo; di Back Office terhadap hari ini.
