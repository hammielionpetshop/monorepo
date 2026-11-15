# Stock Opname Approval Review Modal Design

Tanggal: 2026-07-16
Scope: `apps/backoffice`
Status: Draft for review

## Ringkasan

Halaman persetujuan stock opname saat ini hanya menampilkan ringkasan header SO dan
langsung menawarkan aksi `Setujui` atau `Tolak`. Approver belum bisa melihat detail
item sebelum menyetujui. Perubahan ini menambahkan alur review detail berbasis modal
di halaman yang sama, tanpa mengubah logika approval server yang sudah ada.

## Tujuan

- Approver dapat meninjau detail item SO sebelum benar-benar menyetujui.
- Alur approve tetap ringkas dan tetap terjadi dari halaman approval yang sekarang.
- Perubahan server minimal: tambah endpoint detail baca-saja, tidak mengubah aturan
  approval yang sudah ada.

## Non-Goal

- Tidak membuat halaman detail SO terpisah.
- Tidak mengubah logika bisnis approve/reject.
- Tidak merombak layout halaman approval secara besar.
- Tidak menambah prefetch semua detail SO saat page load.

## UX yang Dipilih

Pendekatan yang dipakai adalah `modal + lazy fetch`.

### Tabel Approval

- Tambah tombol `Review` pada setiap baris SO.
- Tombol `Setujui` tetap tampil hanya untuk SO `PENDING`.
- Tombol `Tolak` tetap mengikuti perilaku sekarang.

### Modal Review

Saat user menekan `Review`, buka modal dengan tiga area:

1. Ringkasan header SO
   - No. SO
   - Tipe
   - Status
   - Cabang
   - Petugas pembuat
   - Tanggal dibuat
   - Catatan/header `notes`
   - Jumlah item

2. Tabel item SO
   - Produk
   - UOM
   - `systemQty`
   - `physicalQty`
   - `varianceQty`
   - `varianceCostValue`
   - `varianceReason`

3. Footer aksi
   - `Tutup`
   - `Setujui` untuk SO `PENDING`

Untuk iterasi ini, aksi reject tidak dipindah ke modal. Reject tetap memakai pola
yang sudah ada di tabel agar perubahan tetap sempit dan cepat dikirim.

## Data dan API

Tambahkan endpoint baru:

- `GET /api/bo/stock-opnames/[id]`

### Otorisasi

- Role yang boleh: `OWNER`, `GM`, `MANAGER`
- `OWNER` dan `GM` boleh membaca lintas cabang
- `MANAGER` hanya boleh membaca SO milik cabangnya

### Response

Response mengembalikan:

- Header SO
  - `id`
  - `soNumber`
  - `type`
  - `status`
  - `branchName`
  - `createdByName`
  - `createdAt`
  - `notes`
  - `itemCount`

- Items
  - `productId`
  - `productName`
  - `uomId`
  - `uomCode`
  - `systemQty`
  - `physicalQty`
  - `varianceQty`
  - `varianceCostValue`
  - `varianceReason`

### Query Shape

- Query header menggunakan pola yang sama dengan list approval sekarang:
  join `branches`, `users`, dan fallback `COALESCE(..., 'User dihapus')`.
- Query item join `stock_opname_items`, `products`, dan `units_of_measure`.
- `itemCount` dapat dihitung dari query item atau query agregasi kecil; pilih yang
  paling sederhana dan mudah dibaca.

## Frontend State

`SOClient` akan menambah state baru untuk modal:

- `reviewingId`
- `reviewOpen`
- `reviewLoading`
- `reviewError`
- `reviewData`

Alur:

1. User klik `Review`
2. Modal buka dalam state loading
3. Client fetch `GET /api/bo/stock-opnames/[id]`
4. Jika sukses, render header + tabel item
5. Jika gagal, tampilkan error dan tombol `Coba lagi`

## Error Handling

- `401`: tampilkan pesan sesi tidak valid
- `403`: tampilkan pesan akses ditolak
- `404`: tampilkan pesan SO tidak ditemukan
- `500`: tampilkan pesan umum gagal memuat detail

Jika status SO berubah di server saat modal masih terbuka:

- tombol `Setujui` tetap memanggil endpoint approve yang ada
- bila approve gagal karena status berubah, tampilkan pesan dari API
- setelah itu jalankan `router.refresh()` agar tabel approval sinkron lagi

## Testing

Tambahkan targeted tests untuk endpoint detail baru:

- approver valid dapat membaca detail
- `MANAGER` cabang lain ditolak
- SO tidak ditemukan mengembalikan `404`
- response memuat field header dan item yang dibutuhkan modal

Verifikasi minimum implementasi:

- `pnpm --filter backoffice exec tsc --noEmit`
- targeted `vitest` untuk route detail baru

## Rencana Implementasi

1. Tambah route `GET /api/bo/stock-opnames/[id]`
2. Tambah tipe data detail SO di halaman approval
3. Tambah tombol `Review` dan modal di `SOClient`
4. Hubungkan tombol `Setujui` dari modal ke handler approve yang sudah ada
5. Tambah test route dan jalankan verifikasi minimum
