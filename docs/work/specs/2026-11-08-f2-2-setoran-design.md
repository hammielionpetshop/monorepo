# F2-2 Setoran (Tunai & Non-Tunai)

Tanggal: 2026-11-08 · Status: **draf — menunggu persetujuan owner** · PRD:
[`fase_2/03-verifikasi-non-tunai.md`](../../hris_planning/PRD/fase_2/03-verifikasi-non-tunai.md)
(**§8 keputusan owner 2026-11-08 mengikat**) · Dasar: [F2-1 Tempat Uang](2026-11-08-f2-1-tempat-uang-design.md)

| Bagian | Branch (dasar) | Migrasi | Isi |
|---|---|---|---|
| **F2-2** Back Office + POS | `feat/deposits` (`origin/main`) | petshop `0056` | Setor Tunai (POS), menu Setoran (BO), verifikasi non-tunai per shift, catatan perpindahan uang, Minus Kasir membaca sebab selisih |

Satu branch: POS aktif ada di `apps/backoffice/app/pos/`, jadi POS dan Back Office satu app.
HRIS tidak disentuh. Pelunasan otomatis (F2-3) **tidak** di sini; F2-2 hanya menyiapkan Setoran
terverifikasi yang nanti dibaca F2-3.

## 1. Keadaan sekarang (diperiksa di kode 2026-11-08)

- Verifikasi setoran = satu angka tunai per shift di Riwayat Shift
  (`POST /api/bo/shifts/[id]/deposit`, hak `shift.deposit.verify` OWNER/GM/FINANCE): kolom
  `shifts.deposit_received_cash/variance/verified_by_id/verified_at/notes`. Pembanding = hitungan
  kasir `total_closing_cash_real` (tutup paksa: `total_closing_cash_expected`). Koreksi oleh
  Owner/GM **menimpa** kolom itu (jejak di Audit Log).
- Kas shift **di luar modal**: penjualan tunai bersih kembalian − pengeluaran shift + pelunasan
  piutang tunai shift itu. Modal tetap di laci.
- Non-tunai shift berasal dari `transaction_payments` (nota `COMPLETED` shift itu) per
  `payment_methods`, ditambah `debt_payments` non-tunai yang kebetulan menempel ke shift. Pelunasan
  non-tunai dari Back Office bisa **tanpa shift** (`shift_id` kosong). Tidak ada pencocokan sama
  sekali.
- Shift Bulk Sale (`origin = BACKOFFICE`) tidak punya laci dan ditolak verifikasi.
- Minus Kasir (`cashier-variance-service`) = `deposit_received_cash − total_closing_cash_expected`
  per shift, dibagi ke kasir menurut porsi kas tunai, dengan toleransi di `app_settings`.
- F2-1a sudah menyediakan `money_places` (Laci otomatis per cabang, Tunai, Rekening) dan
  `payment_method_money_places` (metode non-tunai per cabang → rekening). Tunai belum punya tujuan.

## 2. Gambaran alur

```
Shift tutup ──► Tunai: masuk "Tunai belum disetor" cabang itu
            │        └─ tim cabang (POS › Setor Tunai) atau Finance (BO) membuat SETORAN TUNAI
            │           berisi ≥1 shift utuh → tujuan Rekening / Brankas → Menunggu Verifikasi
            │           └─ Finance cocokkan mutasi/hitung uang → ketik diterima → Verifikasi
            │              → perpindahan uang Laci → tujuan tercatat otomatis
            └─► Non-tunai: per shift per metode → Finance ketik diterima dari mutasi → Verifikasi
                     → perpindahan uang ke rekening tautan metode tercatat otomatis
```

Tunai dan non-tunai berjalan **terpisah**: non-tunai boleh diverifikasi kapan saja tanpa menunggu
tunai (PRD 03 §8 no.4). Shift **tidak pernah terkunci** oleh verifikasi yang menunggu (§8 no.9).

## 3. Data (migrasi petshop `0056`)

### 3.1 `petshop.cash_deposits` — Setoran Tunai

| Kolom | Isi |
|---|---|
| `id`, `deposit_number` | nomor `STN-<kode cabang>-<YYMMDD>-<urut>` |
| `branch_id` | cabang penyetor; semua shift di dalamnya harus cabang ini |
| `destination_money_place_id` | tujuan: `BANK` aktif (setor bank) atau `CASH` aktif (mis. Brankas, diantar ke kantor); **bukan** `DRAWER` |
| `deposit_date` | tanggal setor/antar (dari pelapor) |
| `reported_amount` | nominal menurut pelapor |
| `slip_photo_url` | foto slip, **opsional** ✅ |
| `reported_by`, `reported_at`, `report_channel` | `POS` atau `BACKOFFICE` (dibuat Finance) |
| `status` | `PENDING` menunggu verifikasi · `VERIFIED` · `CANCELLED` |
| `received_amount` | diketik Finance saat verifikasi |
| `verified_by`, `verified_at`, `verified_held_by` | siapa memverifikasi + salinan `held_by` tujuan saat itu (spec F2-1 §2.3) |
| `notes` | catatan |
| `cancelled_by/at/reason` | batal hanya selama `PENDING`, alasan wajib |
| `corrects_deposit_id` | diisi bila setoran ini koreksi atas setoran terverifikasi (§6) |

`petshop.cash_deposit_shifts` (`deposit_id`, `shift_id`, `cash_amount` salinan kas shift saat
dimasukkan, `released_at`). **Satu shift hanya di satu setoran aktif** ✅ (unique parsial
`shift_id` where `released_at IS NULL`); batal setoran mengisi `released_at` sehingga shift kembali
ke "belum disetor" — baris tidak dihapus.

`petshop.cash_deposit_variances` — rincian selisih (`received − Σ cash_amount`), boleh beberapa
baris yang jumlahnya harus sama dengan selisih:

| Kolom | Isi |
|---|---|
| `deposit_id`, `amount` (± rupiah) | |
| `cause` | `BANK_FEE` biaya setor bank · `CASHIER_SHORT` kurang dari kasir · `CASHIER_OVER` lebih dari kasir · `OTHER` lainnya |
| `shift_id`, `cashier_id` | wajib untuk `CASHIER_SHORT/OVER` (Finance memilih shift & kasir) ✅ §8 no.8 |
| `note` | wajib untuk `OTHER` |

### 3.2 `petshop.noncash_verifications` — verifikasi non-tunai per shift per metode

| Kolom | Isi |
|---|---|
| `shift_id`, `payment_method_id` | satu baris aktif per pasangan |
| `expected_amount` | salinan angka sistem saat verifikasi (nota `COMPLETED` + pelunasan menempel shift) |
| `money_place_id`, `held_by` | salinan rekening tautan metode × cabang + pemegangnya saat itu |
| `status` | `AWAITING_FUNDS` dana belum cair · `VERIFIED` |
| `received_amount` | **wajib diketik** dari mutasi, tidak terisi otomatis ✅ (PRD 03 §3) |
| `variance`, `cause`, `note` | sebab wajib bila selisih ≠ 0: `BANK_FEE` potongan bank · `AWAITING_FUNDS` · `CASHIER_INPUT` salah input kasir · `OTHER` |
| `verified_by`, `verified_at` | |
| `superseded_by_id` | koreksi = baris baru, baris lama ditandai digantikan (§6) |

Metode yang belum ditautkan ke rekening di cabang itu → verifikasi ditolak dengan pesan "Tautkan
dulu di Pengaturan › Tempat Uang" (spec F2-1 §5).

### 3.3 `petshop.money_movements` — catatan perpindahan uang (dipakai lagi oleh F2-3/F2-4)

| Kolom | Isi |
|---|---|
| `from_money_place_id` | Laci cabang (tunai) atau kosong (= uang masuk dari pembeli, non-tunai) |
| `to_money_place_id` | tujuan |
| `amount` | **sebesar yang diketik Finance** ✅ §8 no.2 |
| `occurred_on` | tanggal setor (tunai) / tanggal shift (non-tunai) |
| `source_type`, `source_id` | `CASH_DEPOSIT` / `NONCASH_VERIFICATION` |
| `reversal_of_id` | pembalikan saat koreksi; tidak pernah dihapus/diubah |
| `created_by`, `created_at` | |

Dibuat otomatis di transaksi DB yang sama dengan tombol Verifikasi; **tidak ada catat manual**.
Pindah Dana manual menyusul di F2-4.

### 3.4 Pengaturan

- Tujuan bawaan setoran tunai per cabang: tabel kecil `petshop.cash_deposit_defaults`
  (`branch_id` PK, `money_place_id` `BANK`/`CASH`), diatur di Tempat Uang › Metode Bayar per
  Cabang sebagai **baris Tunai** ✅ (§8 no.4). Bisa diganti saat melapor/verifikasi.
- `app_settings` kunci `deposit_settings`: peringatan tunai belum disetor **5 hari atau
  Rp25.000.000** mana lebih dulu ✅ (§8 no.7); batas dana belum cair (usul **2 hari**, §10 no.1);
  **tanggal mulai Setoran** (§7).

Kolom lama `shifts.deposit_*` dibiarkan untuk shift sebelum tanggal mulai; tidak ditulis lagi.

## 4. Layar

### 4.1 POS › **Setor Tunai** (menu baru, tim cabang) ✅ §8 no.5

- Daftar shift tunai cabang ini yang belum masuk setoran: tanggal, nomor shift, kas, umur hari.
  Kepala daftar: jumlah shift, total, tanda jingga/merah bila lewat 5 hari atau Rp25 juta.
- **Laporkan Setoran**: centang shift (bawaan semua, tertua dulu), tujuan (bawaan cabang; pilihan
  Rekening / Antar ke kantor), nominal (terisi total shift tercentang, boleh diubah), tanggal,
  foto slip opsional → status **Menunggu verifikasi Finance**; Finance mendapat pemberitahuan
  Back Office.
- Daftar setoran cabang ini (menunggu / terverifikasi / batal). Batal hanya selama menunggu.
- Hak baru `deposit.report` (OWNER, GM, MANAGER, KASIR) dibatasi ke cabang sendiri.

### 4.2 Back Office › Shift › **Setoran** (menu baru + tanda Baru) — 4 tab ✅ §8 no.5

1. **Menunggu Verifikasi** — setoran tunai `PENDING`: cabang, shift di dalamnya, tujuan, nominal
   pelapor, foto. Finance mengetik **diterima** (tidak terisi otomatis), mengisi rincian sebab bila
   selisih, bisa ganti tujuan, lalu **Verifikasi**. Tombol **Buat Setoran** untuk cabang yang
   uangnya diantar tanpa melapor di POS (§10 no.3).
2. **Non-tunai** — per shift per metode: angka sistem, rekening tujuan, kolom diterima, sebab.
   Saringan cabang/tanggal/metode/status. Bisa simpan **Dana belum cair** lalu diselesaikan
   kemudian; merah bila lewat batas hari.
3. **Tunai belum disetor** — pantauan per cabang: jumlah shift, total, shift tertua, tanda
   peringatan; klik → daftar shift.
4. **Riwayat** — setoran terverifikasi/batal & verifikasi non-tunai, dengan siapa memverifikasi.

Hak: lihat/verifikasi memakai `shift.deposit.verify` yang ada (OWNER, GM, FINANCE). Finance libur
→ setoran menunggu atau diverifikasi GM/Owner ✅ §8 no.9.

### 4.3 Riwayat Shift & Detail Shift

- Tombol verifikasi lama diganti tautan ke Setoran (untuk shift sejak tanggal mulai).
- Detail Shift: status **tunai** (belum disetor / menunggu verifikasi / terverifikasi + nomor
  setoran) dan **non-tunai per metode** (menunggu / dana belum cair / terverifikasi + selisih).
- Shift sebelum tanggal mulai tetap memakai tampilan verifikasi lama (baca saja untuk yang sudah
  diverifikasi).

## 5. Selisih & Minus Kasir ✅ §8 no.8, PRD 03 §4

- Selisih dicatat di tingkat Setoran. `BANK_FEE` → **Biaya Bank** (dibaca Finance F2-6, masuk laba
  rugi), **tidak** masuk Minus Kasir. `CASHIER_SHORT/OVER` → masuk Minus Kasir untuk shift & kasir
  yang dipilih Finance. `OTHER` → tampil di Riwayat, tidak dibebankan.
- Non-tunai: hanya sebab `CASHIER_INPUT` yang masuk Minus Kasir (dibagi porsi kas seperti sekarang
  bila kasir tidak dipilih); potongan bank = Biaya Bank.
- Laporan Minus Kasir: shift sejak tanggal mulai membaca rincian sebab di atas; shift sebelumnya
  tetap rumus lama. Toleransi & batas tak wajar tetap berlaku. Daftar "belum diverifikasi" =
  shift yang tunainya belum masuk setoran terverifikasi.

## 6. Aturan

1. Shift masuk antrean bila sudah tutup (`CLOSED`/`FORCE_CLOSED`) dan ditutup sejak tanggal
   mulai. Kas tunai shift = hitungan kasir (tutup paksa: kas sistem), sama dengan sekarang.
2. Satu setoran = satu cabang, ≥1 shift **utuh**; satu shift tidak boleh terbagi ✅ §8 no.6.
3. Verifikasi tunai wajib: diterima diketik, rincian sebab menutup seluruh selisih.
4. **Tidak ada hapus/timpa.** Setoran menunggu boleh dibatalkan (beralasan). Setoran terverifikasi
   hanya bisa **dikoreksi Owner/GM**: membuat pembalikan perpindahan uang + setoran koreksi baru
   yang menautkan setoran lama; Audit Log mencatat keduanya. Hal yang sama untuk non-tunai
   (`superseded_by_id`).
5. Nota yang dibatalkan **sesudah** verifikasi non-tunai tidak mengubah baris terverifikasi;
   Detail Shift menandai "angka sistem berubah sesudah diverifikasi" untuk diperiksa Finance.
6. Semua angka uang integer rupiah; penjumlahan/pembagian memakai `big.js` dan helper
   `allocateByCashShare` yang ada.

## 7. Peralihan dari verifikasi lama

- **Tanggal mulai Setoran** (pengaturan, bawaan = tanggal rilis F2-2 di produksi). Shift yang
  ditutup sebelum tanggal itu **tidak** masuk antrean tunai/non-tunai baru; yang sudah diverifikasi
  dengan cara lama tetap sah dan tetap dibaca Minus Kasir seperti sekarang.
- ❓ Shift lama yang **belum** diverifikasi (sebelum tanggal mulai): usul agent — boleh dimasukkan
  ke Setoran Tunai juga (muncul di "Tunai belum disetor" bertanda *lama*), supaya tidak ada dua
  cara verifikasi. Non-tunai shift lama tidak diantrekan.
- Tidak ada koreksi data produksi; migrasi hanya menambah tabel, hak, dan pengaturan.

## 8. Tes (non-UI)

- Layanan setoran: shift lain cabang ditolak, shift ganda ditolak, shift terbuka ditolak, batal
  membebaskan shift, rincian sebab harus menutup selisih, tujuan Laci ditolak.
- Verifikasi tunai & non-tunai membuat `money_movements` sebesar angka diketik, di transaksi yang
  sama; koreksi membuat pembalikan, tidak mengubah baris lama.
- Non-tunai: angka sistem = nota `COMPLETED` + pelunasan menempel shift; metode belum ditautkan
  ditolak; dana belum cair lalu diselesaikan.
- Minus Kasir: `BANK_FEE` tidak masuk, `CASHIER_SHORT` masuk ke kasir terpilih, shift lama tetap
  rumus lama.
- `pnpm migrations:check`, `pnpm typecheck`. UI diuji owner di staging.

## 9. Langkah uji owner (staging)

1. Tempat Uang › Metode Bayar per Cabang: baris Tunai Toko Raja → rekening; Toko B → Brankas.
2. Buka & tutup 2 shift Toko Raja (tunai + QRIS). POS › Setor Tunai: dua shift muncul, Laporkan
   Setoran ke rekening dengan foto slip.
3. BO › Setoran › Menunggu Verifikasi: ketik nominal kurang Rp5.000, sebab biaya setor bank →
   Verifikasi. Minus Kasir tidak bertambah.
4. Tab Non-tunai: shift QRIS → simpan Dana belum cair, lalu verifikasi dengan potongan bank.
5. Toko B: Finance **Buat Setoran** dari BO (antar ke kantor → Brankas), selisih kurang dari kasir
   dipilih kasirnya → muncul di Minus Kasir.
6. Detail Shift menampilkan status tunai & non-tunai; Riwayat menampilkan siapa memverifikasi.

## 10. Pertanyaan untuk owner ❓

1. **Batas dana belum cair** sebelum merah: usul **2 hari** (diatur di Pengaturan).
2. **Ketik dua kali** untuk non-tunai? Usul **tidak** — Finance menyalin dari mutasi dan selisih
   wajib bersebab; ketik dua kali tetap di tutup shift kasir (1.107.90).
3. Toko yang **tidak pernah setor bank**: usul **keduanya boleh** — tim toko melapor "Antar ke
   kantor" di POS, atau Finance membuat setorannya di BO saat uang diterima.
4. **Pelunasan non-tunai tanpa shift** (dicatat di Back Office): usul masuk tab Non-tunai sebagai
   baris "Pelunasan BO" per cabang per hari per metode, diverifikasi dengan cara yang sama.
5. **Bulk Sale** (shift Back Office tanpa laci): usul non-tunainya ikut tab Non-tunai; tunainya
   ikut Setoran Tunai cabang itu dengan angka kas sistem.
6. Shift lama belum diverifikasi (§7): ikut Setoran Tunai bertanda *lama*?
