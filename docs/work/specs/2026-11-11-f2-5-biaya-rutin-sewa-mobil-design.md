# F2-5 Biaya Rutin & Sewa Mobil per Ritase

PRD: `docs/hris_planning/PRD/fase_2/06-biaya-rutin-dan-sewa-mobil.md` (+ 02 Tempat Uang, 05 Arus Kas).
Status: **draf — menunggu persetujuan owner**. Sudah diputuskan owner 2026-11-11 ("saya setuju" atas usulan
agent): F2-5 dipecah **F2-5a Biaya Rutin** (Back Office, sampai produksi) dan **F2-5b Sewa Mobil** (Logistik,
sampai staging, ikut rilis HRIS); pengatur Biaya Rutin Owner/GM, pembayar Owner/GM/Finance; sewa setahun
sekaligus = satu kali bayar melunasi 12 tagihan; jumlah dibayar boleh beda dengan alasan wajib; pembelian aset
tidak masuk F2-5; 1 ritase sewa = 1 trip Selesai mobil itu; Bayar sewa mobil oleh Finance/Owner/GM, Kepala
Gudang hanya melihat.

## 1. Keadaan sekarang

- **Arus Kas** (F2-4b, `cash_flow_entries`) sudah punya Tanggal uang, **Untuk bulan** (`for_month`),
  **Dibayar dari** (`money_place_id`), foto bukti, cabang/**Bersama** (`branch_id` kosong), dan pembatalan
  beralasan. Hak `cashflow.record` (Owner/GM/Finance), `cashflow.cancel` (Owner/GM).
- Sewa sementara dicatat di Arus Kas kategori **"Sewa (sementara)"** (F2-4 §3.3), dengan janji: saat
  Biaya Rutin tayang, kategori itu dinonaktifkan untuk catatan baru dan catatan lama tetap terbaca.
- Logistik (`dev_hris`): `logistics.vehicles` (nama, plat, aktif) tanpa tanda milik/sewa;
  `logistics.trips` (status `DRAFT/RUNNING/DONE/CANCELLED`, `trip_date`, `vehicle_id`);
  `logistics.trip_wages` (ritase per **orang**, AUTO dari trip Selesai atau MANUAL "ritase tangan");
  `logistics.trip_rates` (tarif bertanggal per mobil + rute, pola Batal/Dibetulkan). HRIS membaca
  Tempat Uang Back Office lewat `apps/hris/lib/money-places.ts` (F2-1b).

## 2. F2-5a — Biaya Rutin (Back Office)

### 2.1 Pengaturan biaya rutin

Menu **Keuangan › Biaya Rutin** (Owner/GM/Finance melihat; **Owner/GM** mengatur — lewat peran, tanpa hak
baru, supaya tidak perlu keluar-masuk lagi).

| Isian | Aturan |
|---|---|
| Nama | Wajib, mis. "Sewa Toko C", "Sewa Mobil Box Pak Budi" |
| Kategori | Wajib, dari kategori Arus Kas jenis **Biaya** yang aktif. Migrasi menambah kategori sistem **Sewa toko**, **Sewa kendaraan**, **Sewa lain** (jenis Biaya, `is_system` — tidak bisa dipilih di Arus Kas biasa, supaya sewa hanya dicatat lewat Biaya Rutin) |
| Cabang yang menanggung | Satu cabang atau **Bersama** (sama dengan Arus Kas) |
| Jumlah per bulan | Bulat, > 0 |
| Tanggal jatuh tempo | 1–31; bila bulan itu lebih pendek, dipakai tanggal terakhir bulan |
| Berlaku mulai (bulan) | Wajib. Tagihan lahir mulai bulan ini |
| Berlaku sampai (bulan) | Boleh kosong (terus berjalan) |
| Catatan | Boleh kosong (mis. nama pemilik sewa, no. rekening tujuan) |

- **Tidak dihapus.** Biaya yang selesai diberi **Berlaku sampai**; salah buat sebelum ada pembayaran boleh
  **Nonaktif** (hilang dari daftar tagihan).
- **Ubah jumlah** = "jumlah baru mulai bulan X" (riwayat jumlah bertanggal), supaya tagihan bulan lalu tidak
  berubah. Nama, catatan, jatuh tempo, dan Berlaku sampai boleh diubah kapan saja; kategori dan cabang hanya
  selama belum ada pembayaran (sudah dibayar → akhiri lalu buat biaya baru).

### 2.2 Tagihan

- Tagihan **dihitung dari pengaturan** (tidak disimpan sampai dibayar): satu tagihan per biaya per bulan,
  dari Berlaku mulai sampai bulan berjalan (atau Berlaku sampai bila lebih dulu).
- Layar Biaya Rutin, tab **Tagihan**: daftar per bulan — nama, cabang, untuk bulan, jumlah, jatuh tempo,
  status **Belum dibayar** / **Sudah dibayar** (tanggal, dibayar dari, oleh). Saringan bulan, cabang, status.
- **Merah**: belum dibayar dan jatuh tempo sudah lewat. **Kuning**: jatuh tempo ≤ 3 hari lagi.
- Bulan berjalan dan bulan-bulan sebelumnya yang belum dibayar selalu tampil (tidak hilang sampai dibayar
  atau biayanya diakhiri sebelum bulan itu).
- Tab **Pengaturan**: daftar biaya rutin + Tambah / Ubah / Ubah jumlah / Akhiri.

### 2.3 Sudah dibayar

Tombol **Sudah dibayar** pada tagihan (Owner/GM/Finance, hak `cashflow.record` yang sudah ada):

| Isian | Aturan |
|---|---|
| Tagihan | Satu tagihan, atau **beberapa bulan sekaligus** untuk biaya yang sama (bayar di muka / setahun: pilih sampai bulan ke berapa, paling jauh 12 bulan ke depan) |
| Tanggal uang | Aturan Arus Kas: tidak masa depan, paling jauh 7 hari ke belakang, lebih lama hanya Owner |
| Dibayar dari | Tempat Uang aktif jenis Tunai/Rekening (bukan Laci), wajib |
| Jumlah dibayar | Bawaan = jumlah tagihan. Boleh diubah (> 0); bila beda, **alasan wajib** |
| Foto bukti | Dianjurkan; tanpa foto bertanda "tanpa bukti" |

- Hasilnya: **satu catatan Arus Kas per bulan tagihan** (jenis Uang keluar, kategori biaya itu, cabang biaya
  itu, **Untuk bulan = bulan tagihan**, tanggal uang dan Dibayar dari sama untuk semua). Contoh: sewa 2026
  dibayar 1 Desember Rp24.000.000 → 12 catatan Rp2.000.000 untuk bulan Jan–Des, semuanya bertanggal uang
  1 Desember. Uang keluar terbaca sekali (Desember), biaya terbaca per bulan.
- Catatan Arus Kas itu bertanda **"dari Biaya Rutin"**, tidak bisa dibatalkan dari layar Arus Kas.
- **Batalkan pembayaran** dari layar Biaya Rutin dengan alasan wajib, aturan sama dengan Arus Kas: pencatat
  sendiri di hari yang sama, sesudahnya hanya Owner/GM (`cashflow.cancel`). Bayar beberapa bulan sekaligus
  dibatalkan bersama. Catatan Arus Kas ikut bertanda Batal; tagihan kembali Belum dibayar.
- Satu tagihan hanya punya satu pembayaran berlaku (dijaga indeks unik).

### 2.4 "Sewa (sementara)"

- Saat F2-5a tayang produksi, kategori Arus Kas **"Sewa (sementara)"** dinonaktifkan (migrasi); catatan lama
  tetap terbaca dan tidak dipindah.
- Supaya sewa yang sudah dicatat lewat "Sewa (sementara)" tidak tertagih dua kali, owner mengisi **Berlaku
  mulai** pada bulan pertama yang **belum** dibayar. Form Tambah menampilkan pengingat ini dan daftar catatan
  "Sewa (sementara)" 3 bulan terakhir untuk cabang itu.

### 2.5 Data (migrasi petshop, satu)

- `recurring_costs`: nama, `category_id` (FK `cash_flow_categories`), `branch_id` (kosong = Bersama),
  `due_day`, `start_month`, `end_month`, `note`, `is_active`, pembuat/pengubah + waktu.
- `recurring_cost_amounts`: `recurring_cost_id`, `amount`, `effective_month` (unik per biaya + bulan),
  pembuat + waktu. Jumlah bulan X = baris dengan `effective_month` terbesar ≤ X.
- `recurring_cost_payments`: satu baris per bulan dibayar — `recurring_cost_id`, `for_month`, `billed_amount`,
  `amount`, `difference_reason`, `cash_flow_entry_id` (FK, unik), `batch_key` (bayar beberapa bulan bersama),
  pembatalan (`cancelled_at/by`, `cancel_reason`). Indeks unik (`recurring_cost_id`, `for_month`) bila belum
  batal.
- Tidak boleh dihapus (trigger, pola Arus Kas); pembayaran hanya boleh diisi kolom pembatalan.
- Kategori sistem **Sewa toko**, **Sewa kendaraan**, **Sewa lain** (Biaya, `is_system`) disisipkan bila
  belum ada; **Sewa (sementara)** dinonaktifkan.
- `cash_flow_entries` tidak berubah; tanda "dari Biaya Rutin" dibaca lewat `recurring_cost_payments`.

### 2.6 Tes (non-UI)

- Hitung tagihan: berlaku mulai/sampai, jatuh tempo tanggal 31 di Februari, jumlah berubah mulai bulan X
  (bulan sebelumnya tetap), biaya nonaktif tidak bertagihan.
- Bayar: satu bulan dan 12 bulan → catatan Arus Kas sesuai bulan & jumlah; bayar dua kali bulan yang sama
  ditolak; jumlah beda tanpa alasan ditolak; Laci/nonaktif/jenis tidak cocok ditolak; batas tanggal uang.
- Batal: pencatat hari sama boleh, besok ditolak (Finance), Owner/GM boleh; batal bersama untuk satu batch;
  catatan Arus Kas ikut Batal; tagihan kembali Belum dibayar; catatan "dari Biaya Rutin" ditolak dibatalkan
  lewat Arus Kas.
- Ubah kategori/cabang setelah ada pembayaran ditolak.

### 2.7 Langkah uji owner (staging)

1. Tambah **Sewa Toko C** Rp2.000.000, jatuh tempo tanggal 5, berlaku mulai bulan lalu → muncul dua tagihan
   (bulan lalu merah, bulan ini).
2. Bayar tagihan bulan lalu dari rekening dengan foto → tagihan Sudah dibayar; di Pendapatan & Pengeluaran ada
   catatan Sewa toko untuk bulan lalu, bertanggal hari ini.
3. Bayar bulan ini sampai 12 bulan ke depan sekaligus → 12 catatan per bulan.
4. Batalkan pembayaran yang baru → semua bulannya kembali Belum dibayar, catatan Arus Kas bertanda Batal.
5. Ubah jumlah mulai bulan depan → tagihan bulan ini tetap, bulan depan jumlah baru.
6. Pastikan "Sewa (sementara)" tidak bisa dipilih lagi di Arus Kas, catatan lamanya tetap terlihat.

## 3. F2-5b — Sewa Mobil per Ritase (Logistik)

### 3.1 Mobil milik sendiri / sewa

- Di **Mobil & Rute**, tiap mobil punya **Kepemilikan**: Milik sendiri (bawaan semua mobil lama) / Sewa.
- Mobil sewa: **Pemilik sewa** (nama + catatan, mis. rekening) dan **Tarif sewa per ritase** bertanggal
  berlaku, pola sama dengan Tarif Ritase: kenaikan = baris baru mulai tanggal X; salah ketik = baris betulan
  dengan alasan; yang belum berlaku boleh dibatalkan; tidak dihapus.
- Yang mengatur: pemegang hak pengatur Tarif Ritase yang sudah ada.

### 3.2 Hitung ritase sewa

- **1 ritase sewa = 1 trip Selesai (`DONE`) mobil itu**, pada `trip_date` di bulan itu. Trip Batal tidak
  dihitung. Banyaknya orang (driver + kenek) dan banyaknya belanja di trip tidak menambah.
- **Ritase tangan** (MANUAL) dihitung 1 bila berperan **Driver**, kind Ritase, tidak batal, untuk mobil itu
  (ritase tangan kenek tidak menambah).
- Rupiah per ritase = tarif sewa yang berlaku pada **tanggal trip** (kenaikan tarif tidak mengubah trip lama).
  Trip pada tanggal tanpa tarif ditandai **"belum bertarif"** dan rekapnya belum bisa dibayar sampai tarif
  diisi.

### 3.3 Rekap & Bayar

- Menu Logistik › **Sewa Mobil**: rekap **per bulan per mobil** (pemilik, jumlah ritase, rincian per tanggal
  trip → nomor trip, tarif, jumlah), total, sudah dibayar, sisa.
- **Bayar** (Finance/Owner/GM, hak baru `logistics.vehicle_rental.pay`; Kepala Gudang hak lihat
  `logistics.vehicle_rental.view`): hanya untuk bulan yang **sudah lewat** (sewa Oktober dibayar mulai
  1 November). Isian: Tanggal uang, **Dibayar dari** (Tempat Uang Back Office, jenis Tunai/Rekening, bukan
  Laci), jumlah (bawaan = sisa; beda → alasan wajib), foto bukti (dianjurkan).
- Pembayaran menyimpan **potret** rekap saat dibayar (jumlah ritase, total). Bila rekap berubah sesudah dibayar
  (mis. ritase tangan ditambah / trip dibatalkan kantor), rekap menampilkan **"Berubah sesudah dibayar:
  kurang Rp X"** atau **"lebih Rp X"**; kekurangan dibayar sebagai **Bayar susulan** (baris pembayaran kedua),
  kelebihan dicatat sebagai catatan untuk ditagih/dipotong bulan berikutnya (tidak otomatis).
- Batalkan pembayaran dengan alasan wajib: pembayar sendiri di hari yang sama, sesudahnya Owner/GM.
- Pembayaran sewa mobil **tidak** dicatat di Arus Kas Back Office (dicatat sekali di Logistik); Finance (F2-6)
  membacanya dengan Untuk bulan = bulan rekap.

### 3.4 Data

- Migrasi **logistics**: `vehicles` + `ownership` (`OWNED`/`RENTED`, bawaan `OWNED`), `rental_owner_name`,
  `rental_owner_note`; tabel `vehicle_rental_rates` (pola `trip_rates`: `vehicle_id`, `effective_from`,
  `amount`, status `ACTIVE/CANCELLED/FIXED`, `fixes_id`, alasan); tabel `vehicle_rental_payments`
  (`vehicle_id`, `for_month`, `trip_count`, `billed_amount`, `amount`, `difference_reason`, `kind`
  `PAYMENT`/`TOP_UP`, `money_place_id` (angka biasa, tanpa FK lintas schema), `occurred_on`, foto, pembayar,
  pembatalan). Trigger tolak hapus.
- Migrasi **hris**: hak `logistics.vehicle_rental.pay`, `logistics.vehicle_rental.view` (pola hak Logistik
  yang ada).
- Changelog fragment HRIS + tanda **Baru** untuk menu Sewa Mobil (aturan HRIS 2026-11-01).

### 3.5 Tes (non-UI)

- Hitung: trip DONE dihitung, CANCELLED/DRAFT/RUNNING tidak; trip dengan 2 orang = 1; ritase tangan driver
  dihitung, kenek tidak; tarif naik di tengah bulan → trip lama tarif lama; tanggal tanpa tarif → belum
  bertarif dan Bayar ditolak.
- Bayar: bulan berjalan ditolak; Laci ditolak; jumlah beda tanpa alasan ditolak; rekap berubah sesudah
  dibayar → selisih benar; Bayar susulan; batal (aturan hari sama / Owner-GM).

### 3.6 Langkah uji owner (staging)

1. Tandai satu mobil **Sewa**, isi pemilik dan tarif Rp150.000 per ritase berlaku awal bulan lalu.
2. Buka Sewa Mobil bulan lalu → jumlah ritase = trip Selesai mobil itu, total = ritase × Rp150.000.
3. Bayar dari Brankas dengan foto. Tambah ritase tangan untuk bulan itu → muncul "kurang Rp150.000"; Bayar
   susulan.
4. Login sebagai Kepala Gudang → rekap terlihat, tombol Bayar tidak ada.

## 4. Di luar F2-5

- **Pembelian aset** (freezer, rak, mobil) dan penyusutan: dibahas tersendiri (PRD 00 §10 no. 4).
- Listrik, air, internet (angka berubah) tetap lewat Arus Kas.
- Pembagian biaya **Bersama** ke cabang: Finance (F2-6).

## 5. Urutan kerja

1. Spec ini disetujui owner → batch koordinasi: spec + klaim F2-5a (kunci `petshop`) di-push ke staging.
2. **F2-5a** `feat/recurring-costs` (dasar `origin/main`) → tayang staging → uji owner → PR rilis Back
   Office (backup prarilis dulu).
3. **F2-5b** `feat/hris-vehicle-rental` (dasar `origin/dev_hris`, kunci `logistics` + `hris`) → merge lokal
   `dev_hris` → staging → uji owner; ke produksi bersama rilis HRIS.
