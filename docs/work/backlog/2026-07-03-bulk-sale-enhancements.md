# Backlog — Penyempurnaan Halaman Bulk Sale

**Status:** ✅ **SELESAI** (B1–B7, rilis `1.37.1`). Checkbox disinkronkan pada audit backlog 2026-07-13.

**Tanggal:** 2026-07-03
**Halaman:** `apps/backoffice/app/(dashboard)/transactions/bulk-sale/`
**API:** `apps/backoffice/app/api/bo/bulk-sales/route.ts`

Backlog ini memecah 7 permintaan penyempurnaan UI/UX + fitur menjadi item independen yang bisa
dikerjakan satu per satu. Keputusan desain yang rancu sudah dikonfirmasi (lihat tiap item).

## Keputusan desain yang sudah dikunci
1. **Harga custom** → OWNER/GM bebas (harga > 0); MANAGER hanya boleh **menaikkan** (tidak boleh di
   bawah harga tier resmi). Semua override dicatat ke **audit log**.
2. **Diskon transaksi** → **hanya nominal (Rp)**, dihitung setelah diskon per-item, dialokasikan
   **proporsional** ke tiap item saat simpan.
3. **Metode bayar vs hutang** → **hapus checkbox** "Penjualan Kredit". "Hutang" menjadi salah satu
   opsi di dropdown metode pembayaran dan **default terpilih**. Saat Hutang terpilih → muncul field
   Uang Muka (DP), metode DP, dan jatuh tempo.

## Urutan pengerjaan yang disarankan
Quick wins dulu, lalu refactor pondasi, lalu fitur berat, terakhir review summary yang bergantung
pada bentuk final data.

`B4 → B3 → B7 → B5 → B2 → B1 → B6`

Alasan: B6 (review summary) harus dibuat terakhir karena menampilkan hasil final dari perubahan
harga (B1), diskon transaksi (B2), dan struktur pembayaran/hutang (B5).

---

## B1 — Input Harga Custom (tersimpan end-to-end) ✅ SELESAI (1.37.1)
**Prioritas:** Tinggi · **Effort:** L (frontend + backend + audit) · **Depends:** —
> Server berhenti menimpa harga; guard per-role (OWNER/GM bebas, lain hanya menaikkan); override dicatat ke `owner_price_overrides` di dalam transaksi DB. Indikator visual "custom" di baris. 3 test baru.

### Masalah
Input harga sudah bisa diketik di `bulk-sale-item-row.tsx`, tetapi server **menimpanya** dengan harga
DB (`route.ts:141` `const unitPrice = Number(price.price)`) lalu **menolak** transaksi karena total
tak cocok (`route.ts:265`). Jadi harga custom tidak pernah benar-benar tersimpan.

### Keputusan
- OWNER/GM: harga custom bebas selama `> 0`.
- MANAGER: hanya boleh `unitPrice >= harga tier resmi` (menaikkan). Jika lebih rendah → tolak 403/400.
- Setiap harga yang berbeda dari harga tier resmi dicatat ke audit (mis. `ownerPriceOverrides`
  di `packages/db/src/schema/audit.ts` — verifikasi kolom sebelum pakai).

### Scope teknis
- `route.ts` `buildTrustedItems`: jangan langsung timpa `unitPrice`. Ambil harga tier resmi sebagai
  `basePrice`, lalu tentukan `unitPrice` = harga dari client jika lolos aturan role; kalau tidak,
  tolak. Simpan flag `isPriceOverride` + `basePrice` untuk audit.
- Validasi total (`route.ts:265`) harus memakai `unitPrice` final (bisa custom), bukan harga DB.
- `TransactionService.createTransaction`: pastikan menyimpan harga final; catat override bila ada.
- Frontend: beri indikator visual pada baris saat harga ≠ harga tier (mis. teks kecil "harga custom").

### Kriteria selesai
- [x] OWNER/GM bisa simpan bulk sale dengan harga di bawah/atas harga tier.
- [x] MANAGER ditolak jika harga di bawah tier, diizinkan jika sama/di atas.
- [x] Override tercatat di audit log (customer, produk, harga lama→baru, user).
- [x] Test di `route.test.ts` untuk 3 skenario role.
- [x] Update `CHANGELOG.md`.

---

## B2 — Diskon Keseluruhan Transaksi (nominal) ✅ SELESAI (1.37.1)
**Prioritas:** Tinggi · **Effort:** M · **Depends:** —
> Diimplementasikan dengan **folding**: diskon transaksi dialokasikan proporsional ke `discountAmount` tiap item saat submit → tanpa perubahan skema/kontrak server. Fungsi murni `allocateTransactionDiscount` + unit test.

### Keputusan
Diskon transaksi = **nominal Rp**, diterapkan setelah semua diskon per-item, lalu **dialokasikan
proporsional** ke tiap item (karena DB menyimpan diskon per-item di `transactionItems`).

### Scope teknis
- `types.ts`: tambah `transactionDiscount: number` ke state totals.
- `bulk-sale-calculations.ts`: `calculateBulkSaleTotals` menerima `transactionDiscount`;
  `grandTotal = subtotal - discountItemTotal - transactionDiscount`. Guard: tidak boleh melebihi
  (subtotal − diskon item). Tambah unit test di `bulk-sale-calculations.test.ts`.
- `bulk-sale-client.tsx`: field input "Diskon Transaksi" di panel ringkasan; alokasi proporsional
  saat submit → distribusikan `transactionDiscount` ke `discountAmount` tiap item (jaga pembulatan
  integer, sisa pembulatan dibebankan ke item terakhir agar total tetap pas).
- `route.ts` `payloadSchema.totals`: terima `transactionDiscount`; validasi ulang alokasi + total.

### Kriteria selesai
- [x] Input diskon nominal transaksi berfungsi; grand total & kembalian ikut menyesuaikan.
- [x] Alokasi proporsional membuat `sum(item.subtotal) === grandTotal` (tanpa selisih pembulatan).
- [x] Diskon transaksi ditolak jika > (subtotal − diskon item).
- [x] Unit test kalkulasi + validasi server.
- [x] Update `CHANGELOG.md`.

---

## B3 — Hapus Produk via Hotkey ✅ SELESAI (1.37.1)
**Prioritas:** Sedang · **Effort:** S · **Depends:** —

### Keputusan (default, bisa disesuaikan)
Saat fokus ada di dalam baris item, tekan **`Alt+Delete`** untuk menghapus baris tersebut. Setelah
hapus, fokus pindah ke input search produk (perilaku `onRemove` sekarang sudah begitu).

### Scope teknis
- `bulk-sale-item-row.tsx`: tangani `onKeyDown` di input baris (qty/harga/diskon); jika
  `Alt+Delete` → panggil `onRemove()`. Cegah default.
- Tampilkan hint hotkey kecil di header tabel atau tooltip tombol "x".

### Kriteria selesai
- [x] `Alt+Delete` di baris menghapus baris itu; fokus kembali ke search.
- [x] Tidak mengganggu pengetikan angka normal.
- [x] Update `CHANGELOG.md`.

---

## B4 — Hotkey Fokus Search Produk ✅ SELESAI (1.37.1)
**Prioritas:** Sedang · **Effort:** S · **Depends:** —

### Keputusan (default, bisa disesuaikan)
**`F2`** memfokus + menyeleksi input "Cari Produk" dari mana saja di halaman. (Hindari "/" karena
bentrok saat mengetik.) Opsional: `F4` untuk fokus ke search Customer.

### Scope teknis
- `bulk-sale-client.tsx`: `useEffect` pasang listener `keydown` global; `F2` → `preventDefault` +
  `productSearchRef.current.focus()/select()`. Bersihkan listener saat unmount.
- Tampilkan hint kecil di label ("Cari Produk — F2").

### Kriteria selesai
- [x] `F2` memfokus search produk dari state manapun.
- [x] Tidak menimpa shortcut browser penting; tidak aktif saat submitting.
- [x] Update `CHANGELOG.md`.

---

## B5 — Sinkronisasi Metode Pembayaran & Hutang ✅ SELESAI (1.37.1)
**Prioritas:** Tinggi · **Effort:** M (refactor panel pembayaran) · **Depends:** —
> Bonus: menemukan & memperbaiki bug — klien mengirim `change` negatif untuk kredit → 400 (skema `change>=0`). Di-clamp `Math.max(0, ...)`.

### Masalah
Checkbox "Penjualan Kredit (Hutang)" terpisah dari dropdown metode → ambigu. Saat dicentang,
dropdown diam-diam menjadi metode DP tanpa penanda.

### Keputusan
- **Hapus** checkbox `isCredit`.
- "Hutang" menjadi item di **dropdown metode pembayaran** dan **default terpilih**.
- `isCredit` diturunkan dari `selectedPaymentMethod.type === 'DEBT'`.
- Saat metode = Hutang → tampilkan: **Uang Muka (DP)** (boleh 0 = full kredit), **Metode DP**
  (dropdown metode non-hutang), dan **Jatuh Tempo**.
- Saat metode = non-hutang → tampilan normal (Jumlah Bayar + Kembali).

### Scope teknis
- `bulk-sale-client.tsx`: hapus state `isCredit`; tambah derivasi dari metode terpilih. Default
  `paymentMethodId` = id metode `type === 'DEBT'` (fallback ke index 0 jika tak ada). Tambah state
  `dpMethodId` untuk metode DP saat kredit.
- Payload ke `/api/bo/bulk-sales`: saat kredit, kirim `paymentMethodId = dpMethodId` (non-hutang) &
  `amountPaid = DP`; server sudah menangani `isCredit` via metode DEBT + guard DP<total
  (`route.ts:282-317`). Sesuaikan agar tetap konsisten dengan model baru (kirim `isCredit` eksplisit
  atau turunkan dari metode di server).
- Pastikan validasi submit (`bulk-sale-client.tsx:396-404`) memakai logika kredit baru.

### Kriteria selesai
- [x] Tidak ada lagi checkbox; "Hutang" default terpilih di dropdown.
- [x] Pilih Hutang → muncul DP + metode DP + jatuh tempo; DP wajib < grand total (boleh 0).
- [x] Pilih non-hutang → alur bayar tunai/transfer normal + kembalian.
- [x] Metode DP tidak boleh "Hutang".
- [x] Test server tetap hijau untuk kredit & non-kredit.
- [x] Update `CHANGELOG.md`.

---

## B6 — Review Summary Sebelum Simpan ✅ SELESAI (1.37.1)
**Prioritas:** Tinggi · **Effort:** M · **Depends:** B1, B2, B5
> Komponen `bulk-sale-review-dialog.tsx`; validasi dipisah ke `validateSale()`, `openReview()` buka modal, konfirmasi memanggil `submitBulkSale()`. Esc/klik-luar/Kembali menutup, fokus ke tombol konfirmasi.

### Keputusan
Klik "Simpan Bulk Sale" membuka **modal konfirmasi** berisi ringkasan lengkap sebelum benar-benar
POST. Ada tombol "Kembali/Edit" dan "Konfirmasi & Simpan".

### Isi modal
- Customer + (info belanja 30 hari & sisa hutang dari B7).
- Cabang, metode pembayaran (atau Hutang + DP + jatuh tempo).
- Tabel item: produk, qty, uom, harga (tandai jika harga custom), diskon, subtotal.
- Subtotal, total diskon item, diskon transaksi, grand total, bayar/DP, kembali/sisa hutang.

### Scope teknis
- `bulk-sale-client.tsx`: `submitBulkSale` dipecah → `openReview()` (validasi lokal dulu) lalu
  `confirmSubmit()` (POST). Komponen modal baru `_components/bulk-sale-review-dialog.tsx`.
- Fokus awal ke tombol "Konfirmasi"; `Esc` menutup; `Enter` mengonfirmasi.

### Kriteria selesai
- [x] Simpan memunculkan modal; POST hanya terjadi setelah konfirmasi.
- [x] Modal menampilkan semua nilai final (termasuk harga custom & diskon transaksi).
- [x] Bisa batal/edit tanpa kehilangan data keranjang.
- [x] Update `CHANGELOG.md`.

---

## B7 — Info Belanja 30 Hari & Sisa Hutang Customer ✅ SELESAI (1.37.1)
**Prioritas:** Sedang · **Effort:** M · **Depends:** —

### Keputusan
Saat customer dipilih, tampilkan **total belanja 30 hari** dan **sisa hutang** di dekat field
customer / panel ringkasan.

### Scope teknis
- **Belanja 30 hari:** reuse `GET /api/customers/[id]/summary` (sudah menghitung total 30 hari,
  dipakai POS `cart-panel.tsx`). Panggil saat `selectCustomer`.
- **Sisa hutang:** belum ada endpoint agregat. Pilihan:
  - Tambahkan field `outstandingDebt` ke endpoint `/api/customers/[id]/summary`
    (`SUM(customerDebts.remainingAmount)` untuk status != LUNAS), **atau**
  - Buat `GET /api/customers/[id]/debts/summary` baru.
  Rekomendasi: perluas `summary` agar 1 kali fetch.
- Frontend: tampilkan dua chip info ("Belanja 30 hari: Rp …", "Sisa hutang: Rp …") + state loading;
  reset saat customer diganti/di-clear.

### Kriteria selesai
- [x] Pilih customer → tampil total belanja 30 hari & sisa hutang.
- [x] Nilai reset/kosong saat customer dihapus atau cabang diganti.
- [x] Info juga muncul di modal review (B6) jika sudah ada.
- [x] Update `CHANGELOG.md`.

---

## Catatan lintas-item
- Semua pesan error/label dalam **Bahasa Indonesia**.
- Kalkulasi harga pakai **big.js**, simpan **integer** (lihat `bulk-sale-calculations.ts`).
- Setiap item WAJIB menambah entry `apps/backoffice/CHANGELOG.md` saat diselesaikan.
- Test relevan: `bulk-sale-calculations.test.ts`, `bulk-sales/route.test.ts`.
