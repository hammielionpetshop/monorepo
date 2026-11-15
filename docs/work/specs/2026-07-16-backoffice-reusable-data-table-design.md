# Reusable Data Table for Backoffice List Pages

> Status: `DRAFT / APPROVED FOR PLANNING`
> Date: 2026-07-16
> Scope: `apps/backoffice`

---

## 1. Ringkasan

Backoffice saat ini memiliki banyak halaman daftar yang merender `<table>` langsung dengan struktur yang hampir sama:

- wrapper card dengan border
- header kolom sederhana
- row mapping
- empty state text
- aksi per baris seperti `Edit`, `Detail`, `Nonaktifkan`

Duplikasi ini paling terlihat di halaman CRUD master data dan settings. Tujuan fase ini adalah membuat satu komponen `DataTable` reusable berbasis TanStack Table untuk menggantikan tabel daftar yang masih plain, tanpa mengubah logic bisnis halaman.

Fase ini sengaja tidak mencoba menstandarkan semua tabel sekaligus. Halaman yang sudah punya filter, search, tab, report formatting, dialog review, detail view, atau print layout tetap di luar scope awal.

---

## 2. Tujuan

- Menyediakan komponen `DataTable` reusable untuk daftar data plain di backoffice.
- Mengurangi duplikasi markup tabel pada halaman list CRUD.
- Menambahkan pagination client-side yang konsisten untuk halaman plain list.
- Menjaga action per row, modal form, refresh API, success/error message, dan logic domain tetap berada di parent page.
- Menyiapkan fondasi yang bisa dipakai ulang nanti untuk halaman berfilter, tanpa memindahkan filter logic ke komponen tabel pada fase 1.

---

## 3. Non-Goal

Berikut hal yang secara eksplisit tidak masuk fase ini:

- memindahkan filter/search/tab existing ke dalam `DataTable`
- mengubah server-side filtering atau URL-driven filtering menjadi client-side
- mengubah tabel report, audit, detail page, print layout, atau dialog review menjadi `DataTable`
- menambahkan sorting, column visibility, column pinning, row selection, atau bulk action
- merombak fetch strategy atau state management halaman list yang sudah ada

---

## 4. Scope Fase 1

### 4.1 In scope

Halaman target adalah plain list table yang saat ini:

- merender `<table>` langsung
- tidak punya filter/search/tab yang menjadi bagian perilaku halaman
- hanya butuh menampilkan data + empty state + action per row

Target awal yang sudah teridentifikasi:

- `apps/backoffice/app/(dashboard)/master-data/brands/_components/brand-client.tsx`
- `apps/backoffice/app/(dashboard)/master-data/categories/_components/category-client.tsx`
- `apps/backoffice/app/(dashboard)/master-data/uom/_components/uom-client.tsx`
- `apps/backoffice/app/(dashboard)/settings/branches/_components/branch-client.tsx`
- `apps/backoffice/app/(dashboard)/settings/users/_components/user-client.tsx`
- `apps/backoffice/app/(dashboard)/master-data/products/_components/product-table.tsx`

Halaman plain lain dengan pola identik boleh ikut dimigrasi dalam sesi implementasi yang sama jika setelah inspeksi strukturnya memang sejalan dengan boundary di atas.

### 4.2 Out of scope

Contoh tabel yang tidak disentuh pada fase 1:

- `supplier-client.tsx` karena sudah punya search
- `orders-list-client.tsx` karena punya tab filter status
- audit log, stock logs, receivables, dan report page
- tabel detail pada halaman entity
- tabel di modal, review dialog, dan print component

---

## 5. Desain Arsitektur

### 5.1 Dependency

Tambahkan `@tanstack/react-table` ke `apps/backoffice`.

Fitur TanStack yang dipakai pada fase 1 cukup:

- core row model
- pagination row model

Sorting dan feature lain tidak diaktifkan dulu.

### 5.2 Lokasi Komponen

Komponen reusable ditempatkan di:

- `apps/backoffice/components/ui/data-table.tsx`

Alasannya:

- reusable antar halaman
- sejalan dengan pola shared UI component di app
- tidak mengikat ke domain tertentu

### 5.3 Boundary Tanggung Jawab

`DataTable` bertanggung jawab untuk:

- render table wrapper, header, body, dan empty state
- menghubungkan data + `ColumnDef` ke TanStack Table
- pagination client-side
- styling dasar yang konsisten

Parent component tetap bertanggung jawab untuk:

- fetch dan refresh data
- success/error message
- loading state global halaman
- modal/dialog
- filter/search/tab logic bila ada
- action handler seperti edit, deactivate, toggle active, navigate, dan detail

Boundary ini penting agar migrasi aman dan tidak mengubah perilaku domain.

---

## 6. API Komponen

API awal `DataTable`:

```ts
type DataTableProps<TData> = {
  data: TData[]
  columns: ColumnDef<TData, unknown>[]
  emptyMessage: string
  pageSize?: number
}
```

Catatan:

- `columns` didefinisikan di parent atau wrapper domain component.
- Cell action tetap dibuat lewat `cell` renderer pada `ColumnDef`.
- `pageSize` default konservatif, misalnya `10`.

API sengaja kecil agar migrasi plain table cepat dan konsisten. Hook untuk sorting atau row click tidak dimasukkan dulu karena belum diperlukan oleh target fase 1.

---

## 7. UX dan Perilaku

### 7.1 Tampilan

`DataTable` harus mempertahankan bahasa visual existing:

- wrapper `border border-border rounded-lg`
- header dengan latar `bg-muted/50` atau setara
- text sizing `text-sm`
- row border dan hover state yang konsisten dengan tabel lama

Hasil migrasi tidak boleh terasa seperti desain baru yang asing.

### 7.2 Empty state

Jika tidak ada data, tampilkan satu row empty state dengan `colSpan` penuh dan text dari `emptyMessage`.

### 7.3 Pagination

Pagination bersifat client-side dan hanya berlaku pada `data` yang diterima komponen.

Perilaku yang diharapkan:

- default page size `10`
- tombol `Previous` dan `Next`
- informasi jumlah row yang sedang ditampilkan, misalnya `Menampilkan 1-10 dari 24 data`
- saat data berubah dan jumlah row berkurang, page index harus tetap valid; bila perlu kembali ke halaman terakhir yang valid

### 7.4 Accessibility

Komponen harus tetap merender elemen tabel semantik (`table`, `thead`, `tbody`, `th`, `td`) agar tidak menurunkan aksesibilitas dan kompatibilitas layout.

---

## 8. Strategi Migrasi

### 8.1 Pola migrasi inline table

Untuk file yang sekarang menulis markup `<table>` langsung di client component:

- definisikan `columns`
- ganti markup tabel dengan `<DataTable data={...} columns={...} emptyMessage={...} />`

### 8.2 Pola migrasi wrapper domain

Untuk file seperti `product-table.tsx`:

- pertahankan wrapper domain component
- ubah implementasi internalnya agar menggunakan `DataTable`
- tetap terima prop domain seperti `onEdit`, `onToggle`, `togglingId`

Ini menjaga API lokal halaman tetap stabil sambil memindahkan presentasi tabel ke shared component.

### 8.3 Aturan aman untuk fase berikutnya

Halaman dengan filter/search/tab tetap bisa memakai `DataTable` nanti, tetapi filter logic harus tetap berada di parent. `DataTable` hanya menerima hasil akhir yang sudah difilter. Fase 1 belum mencakup migrasi itu.

---

## 9. Risiko dan Mitigasi

### 9.1 Risiko: perubahan perilaku halaman

Jika `DataTable` terlalu banyak mengambil alih state, halaman yang tadinya sederhana bisa berubah perilaku.

Mitigasi:

- boundary komponen dijaga ketat
- hanya render + pagination
- semua logic domain tetap di parent

### 9.2 Risiko: mismatch styling

Migrasi banyak file sekaligus bisa membuat beberapa tabel tampak berbeda.

Mitigasi:

- komponen shared mengikuti gaya visual yang paling umum di codebase sekarang
- wrapper domain seperti `product-table.tsx` tetap bisa mengatur cell content yang spesifik

### 9.3 Risiko: pagination mengganggu hasil aksi

Setelah refresh data karena create/edit/deactivate, jumlah row bisa berubah dan halaman aktif bisa tidak valid.

Mitigasi:

- `DataTable` harus menjaga page index tetap valid ketika `data.length` berubah

---

## 10. Testing dan Verifikasi

Fase ini dominan perubahan UI composition dan type wiring.

Verifikasi minimum:

- `tsc --noEmit` untuk `apps/backoffice`

Verifikasi manual yang perlu diperhatikan saat implementasi:

- empty state tetap benar di tiap halaman migrasi
- action button per row tetap memicu handler yang sama
- link detail tetap benar
- label status/badge tetap tampil seperti sebelumnya
- pagination tidak memutus tabel ketika data berubah setelah refresh

Broad test suite tidak dijalankan secara default sesuai instruksi proyek.

---

## 11. Implementasi Bertahap

Urutan kerja yang disarankan:

1. Tambah dependency TanStack Table.
2. Buat `components/ui/data-table.tsx`.
3. Migrasi 1-2 halaman paling sederhana lebih dulu (`brand`, `category`) untuk memvalidasi API.
4. Migrasi halaman plain list lain (`uom`, `branch`, `user`, `product-table`, dan kandidat setara).
5. Jalankan verifikasi TypeScript.

Jika API komponen ternyata kurang untuk kebutuhan beberapa halaman plain list, perluas secukupnya tanpa memasukkan concern filter/search/sorting.

---

## 12. Kriteria Selesai

Fase 1 dianggap selesai bila:

- ada satu komponen `DataTable` reusable berbasis TanStack Table di `apps/backoffice`
- plain list table target tidak lagi menulis markup `<table>` duplikatif secara langsung
- pagination client-side tersedia dan konsisten pada tabel target
- tidak ada perubahan perilaku pada modal, refresh API, action row, dan messaging halaman
- `tsc --noEmit` untuk `apps/backoffice` lolos

---

## 13. Fase Lanjutan

Setelah fase 1 stabil, scope bisa diperluas ke tabel yang punya filter/search/tab dengan aturan berikut:

- filter logic tetap di parent
- `DataTable` menerima data hasil filter
- page index di-reset saat filter berubah
- server-driven filtering tidak diubah menjadi client-side tanpa keputusan eksplisit

Ekspansi ini harus menjadi perubahan terpisah setelah reusable component fase 1 terbukti stabil.
