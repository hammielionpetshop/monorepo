# Spec: Branding per cabang — hentikan "Hammielion" di cabang

**Tanggal:** 2026-10-24
**Pemohon:** Owner (genting — "mendasar")
**Status:** rancangan, menunggu persetujuan owner (belum mulai koding)
**Kata kunci lanjut sesi:** `kerjakan branding per cabang`

---

## Masalah (kenapa dibuat)

Sistem menuliskan **"HAMMIELION" / "Hammielion"** di hampir semua tempat, padahal tiap cabang
punya nama sendiri (mis. **Raja**, **Markas**) yang **tidak boleh** memakai embel-embel "Hammielion".
Owner minta: (a) **layar** menyesuaikan nama cabang, (b) **semua kertas** (struk/nota/dokumen)
memakai nama cabang masing-masing — termasuk kertas yang keluar ke pihak luar.

## Keputusan owner (2026-10-24)

1. **Kertas ke pihak luar ikut nama cabang.** Dokumen PO ke supplier & surat jalan pun **tidak**
   "Hammielion" — pakai nama cabang. (Owner memilih "Ya, ikut nama cabang" tanpa kecuali.)
2. **Layar yang diganti: kasir (POS) _dan_ back office.** Back office mengikuti cabang akun yang
   login (di toko → nama toko; di HQ → "Hammielion Headquarter", karena HQ memang Hammielion).
3. **Cukup nama + alamat + telepon.** **Tanpa logo gambar** dulu (struk termal ESC/POS masih teks).
4. Tetap "Hammielion" di level perusahaan: **OTP SMS/WA, halaman panduan, changelog** — tidak diubah.

---

## Temuan kondisi sekarang

Pondasi sudah ada: tabel `petshop.branches` punya kolom **`receipt_name`** (`varchar(100)`,
default `'HAMMIELION'`), dan **Pengaturan → Cabang** sudah punya field **"Nama di Struk"**.

**Sudah per-cabang** (membaca `receipt_name` lewat `lib/receipt-info.ts → getReceiptStoreInfo`):

| Keluaran | Jalur |
|---|---|
| Struk penjualan | `components/pos/receipt-print.tsx`, `lib/receipt-data.ts` |
| Settlement kasir | `components/pos/settlement-client.tsx` → `escpos-settlement.ts` |
| Karcis grooming | `grooming/_components/grooming-client.tsx` → `grooming-ticket-print.tsx` |
| Nota grosir (Bulk Sale) | `transactions/bulk-sale/_components/bulk-sale-client.tsx` (pakai `receiptName`) |
| Detail transaksi | `transactions/_components/transaction-detail-modal.tsx` |
| Toko online | `apps/order-web/lib/shop-name.ts` (pakai `receiptName`) |

→ Keenam ini **sudah otomatis berubah** begitu tiap cabang diisi "Nama Tampil"-nya; dugaan masih
"HAMMIELION" karena kolomnya **belum diisi per cabang** (default masih "HAMMIELION").

**Masih hardcode "HAMMIELION" / "Hammielion":**

A. **Cetakan** yang belum dialiri nama cabang:
- `lib/po-document-layout.ts` → `const STORE_LABEL = 'HAMMIELION'` (dokumen PO ke supplier)
- `lib/delivery-note-layout.ts` → `const STORE_LABEL = 'HAMMIELION'` (surat jalan, dot-matrix & termal)
- `lib/escpos-goods-receipt.ts`, `lib/escpos-po-receipt.ts`, `incoming-transfers/.../receiving-note-print.tsx`,
  `purchase-orders/[id]/_components/po-receiving-note-print.tsx` → hanya fallback `|| 'HAMMIELION'`,
  caller belum tentu mengirim nama cabang (perlu dicek & dialiri)
- `components/supplier-returns/supplier-return-print.tsx` → `Hammielion Petshop · {branchName}`
- `components/internal-returns/internal-return-print.tsx` → `Hammielion Petshop`

B. **Layar:**
- Kasir (POS): `app/pos/login/page.tsx`, header POS
- Back office: `app/(dashboard)/_components/sidebar.tsx`, `app/(dashboard)/layout.tsx`, `app/(auth)/login/page.tsx`

C. **Tetap Hammielion** (jangan diubah): `packages/shared/src/otp/channel.ts`, `app/panduan/*`,
`app/(dashboard)/changelog/page.tsx`, metadata/manifest aplikasi.

---

## Konsep

**`receipt_name` dinaikkan perannya** dari "nama di struk" menjadi **"Nama Tampil Cabang"** —
sumber tunggal untuk semua yang dilihat orang (layar + semua kertas). `name` tetap nama manajemen
internal.

**Default berhenti "HAMMIELION".** Aturan resolusi nama tampil (satu helper):

```
namaTampil(branch) = branch.receiptName?.trim() || branch.name
```

Tidak ada lagi literal "HAMMIELION" sebagai fallback di kode produksi — kalau kolom kosong, jatuh ke
nama cabang, bukan ke "Hammielion". (Kolom DB tetap boleh punya default lama demi kompatibilitas
migrasi; yang diubah adalah perilaku pembacaan.)

---

## Perubahan per berkas

### 1. Sumber nama tampil (inti)
- **`lib/receipt-info.ts`** — ubah fallback `b?.receiptName || 'HAMMIELION'` → `b?.receiptName || b?.name`.
  Tambah `name` ke SELECT. Semua jalur yang sudah pakai `getReceiptStoreInfo` otomatis ikut.
- **(opsional, rapikan)** helper kecil `namaTampilCabang(branch)` dipakai di tempat non-struk.

### 2. Cetakan ke pihak luar
- **`lib/po-document-layout.ts`** — hapus konstanta `STORE_LABEL`; tambah `storeName: string` ke
  `PoDocumentData`; header pakai `data.storeName`. Caller mengisi dari `receipt_name` **cabang pembuat PO**.
- **`lib/delivery-note-layout.ts`** — sama: `storeName` masuk `DeliveryNoteData`, dipakai di baris header
  (`center(STORE_LABEL,…)` → `center(data.storeName,…)`), untuk jalur dot-matrix & termal. Caller isi dari
  **cabang pengirim**.
- Perbarui test `delivery-note-layout.test.ts` / `po-document-layout` agar `storeName` di-pass.

### 3. Cetakan penerimaan & retur
- **`escpos-goods-receipt.ts`, `escpos-po-receipt.ts`, `receiving-note-print.tsx`, `po-receiving-note-print.tsx`** —
  pastikan caller mengalirkan `storeName` dari `receipt_name` cabang terkait; ganti default `'HAMMIELION'`
  → nama cabang (atau biarkan prop wajib).
- **`supplier-return-print.tsx`** — `Hammielion Petshop · {branchName}` → `{storeName}` (atau `{branchName}`
  saja). Perlu `storeName`/`receiptName` di data baris retur.
- **`internal-return-print.tsx`** — `Hammielion Petshop` → nama cabang penerima/pembuat dokumen.

### 4. Layar kasir (POS)
- **`app/pos/login/page.tsx`** + header POS — tampilkan nama cabang terpilih. Alur POS: select-branch →
  login → shift; nama cabang sudah diketahui setelah pilih cabang (`getPosBranchName()` /
  `lib/pos-branch.ts`). Footer "Hammielion Group" boleh tetap (level perusahaan) atau diturunkan — konfirmasi.

### 5. Layar back office
- **`sidebar.tsx`, `(dashboard)/layout.tsx`** — ganti teks statis "Hammielion" → nama cabang akun login
  (`payload.branchName` dari JWT, lihat `CLAUDE.md` Auth Pattern). Di HQ tetap "Hammielion Headquarter".
- **`(auth)/login/page.tsx`** — login belum tahu cabang; **tetap "Hammielion"** (wajar, ini gerbang grup).

### 6. Pengaturan cabang (biar bisa diisi owner)
- **`branch-form.tsx`** — relabel "Nama di Struk" → **"Nama Tampil Cabang"**; teks bantu dijelaskan
  "dipakai di layar & semua cetakan". Pertimbangkan **wajib diisi** (sudah ada validasi `receiptName` wajib).
- Default form `'HAMMIELION'` → kosong (placeholder saja), supaya owner sadar mengisinya.

---

## Di luar lingkup
- **Logo gambar** di struk/dokumen (owner tunda).
- **OTP, panduan, changelog, metadata aplikasi** — tetap "Hammielion".
- **Back office saat owner keliling cabang**: nama di layar baru ikut berpindah setelah **permintaan no. 2**
  (akun level tinggi keluar-masuk cabang) jadi. Untuk sekarang nama back office = cabang akun login.

## Data
- Tidak ada migrasi baru (kolom `receipt_name` sudah ada). Hanya perubahan perilaku baca + UI.
- **Langkah data manual owner:** isi "Nama Tampil Cabang" tiap cabang di Pengaturan → Cabang.

## Changelog & tanda Baru
- Tulis potongan di `apps/backoffice/changelog.d/` (Bahasa Indonesia).
- Daftarkan di `lib/new-features.ts` + pasang `<NewBadge>` di field "Nama Tampil Cabang" pada form cabang.

## Uji
- `getReceiptStoreInfo` jatuh ke `name` saat `receipt_name` kosong (bukan "HAMMIELION").
- Test layout PO & surat jalan memakai `storeName` yang dikirim, bukan konstanta.
- Cek manual: struk, settlement, karcis, PO, surat jalan, nota terima, retur supplier, retur internal,
  header POS, sidebar back office — semuanya menampilkan nama cabang, bukan "Hammielion".
