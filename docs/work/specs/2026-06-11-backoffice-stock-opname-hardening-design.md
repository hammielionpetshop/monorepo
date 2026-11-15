# Desain Hardening Stock Opname Backoffice dan POS

Tanggal: 2026-06-11
Branch: `harden-po-payables`
Stage: 5

## Konteks

Stage sebelumnya sudah mengunci banyak alur POS dan purchase order agar branch,
aktor, dan mutasi stok tidak lagi bergantung pada payload yang bisa dipalsukan.
Alur stock opname masih punya beberapa route legacy yang belum mengikuti pola
tersebut.

Risiko utama ada di route POS stock opname. Route tersebut masih menerima
`branchId`, `createdById`, `cashierId`, `approvedById`, dan `rejectedById` dari
body atau query. Karena approval stock opname memanggil
`applySOStockAdjustment`, data item yang tidak terpercaya bisa berujung pada
mutasi stok lintas cabang, spoofing aktor, dan double-apply saat approval race.

Backoffice juga punya gap yang lebih kecil tetapi tetap penting: manager bisa
membuat stock opname untuk branch lain lewat `POST /api/bo/stock-opnames`,
history bisa dibaca lintas cabang lewat query, dan halaman pending stock opname
belum sejajar dengan scoping API.

## Tujuan

1. Semua route POS stock opname menggunakan identitas dan branch terpercaya dari
   cookie JWT dan helper POS branch.
2. Mutasi stok dari stock opname hanya bisa terjadi untuk stock opname milik
   branch session saat ini.
3. Approval dan reject stock opname tidak bisa dipanggil tanpa auth, tidak bisa
   spoof aktor, dan tidak bisa double-mutate.
4. Backoffice manager hanya bisa membuat dan melihat stock opname untuk branch
   miliknya.
5. Error response legacy diganti ke pesan Bahasa Indonesia yang aman tanpa
   membocorkan `error.message` mentah.

## Ruang Lingkup Route

Route POS yang masuk Stage 5:

- `POST /api/pos/stock-opnames`
- `PATCH /api/pos/stock-opnames/[id]/add-items`
- `PATCH /api/pos/stock-opnames/[id]/approve`
- `PATCH /api/pos/stock-opnames/[id]/reject`
- `POST /api/pos/stock-opname/skip`
- `GET /api/pos/stock-opnames/active-full`
- `GET /api/pos/stock-opname/suggestions`

Route dan surface backoffice yang masuk Stage 5:

- `POST /api/bo/stock-opnames`
- `GET /api/bo/stock-opnames/history`
- Halaman `/inventory/stock-opname` untuk pending stock opname awal.

## Batas Kepercayaan

Semua route POS stock opname harus memakai pola auth route-local:

- Ambil cookie dengan `cookies()`.
- Verifikasi token dengan `verifyAccessToken()`.
- Resolusi branch dengan `getPosBranchId(payload, cookieStore)`.
- Aktor selalu `payload.userId`.
- Branch selalu hasil `getPosBranchId` atau branch JWT yang sudah dianggap
  terpercaya oleh helper.

Field berikut tidak boleh lagi dipercaya sebagai sumber kebenaran:

- `branchId`
- `createdById`
- `cashierId`
- `approvedById`
- `rejectedById`

Jika field lama masih dikirim oleh POS client, server boleh mengabaikannya selama
kontrak response tetap kompatibel. Server tidak perlu menambahkan jalur backward
compatibility lain selain mengabaikan field spoofable tersebut.

## Desain Route POS

### Create Stock Opname

`POST /api/pos/stock-opnames` membuat stock opname dari session POS saat ini.
Branch header dan semua perhitungan `systemQty` serta FIFO memakai branch
terpercaya. `createdById` memakai `payload.userId`.

Body tetap memuat data bisnis seperti `shiftId`, `type`, `method`, `items`, dan
`notes`. Validasi memakai Zod. Jika `shiftId` dikirim, route harus memastikan
shift tersebut berada di branch session saat ini sebelum insert.

### Add Items

`PATCH /api/pos/stock-opnames/[id]/add-items` hanya boleh menambah atau
memperbarui item untuk stock opname `PENDING` yang `branchId`-nya sama dengan
branch session POS.

Route harus mengambil header stock opname dari database, memakai
`stockOpnames.branchId` untuk semua kalkulasi stok, dan tidak memakai `branchId`
dari body. Jika stock opname tidak ditemukan, bukan milik branch session, atau
bukan `PENDING`, response harus aman dan tidak mengungkap detail internal.

### Approve

`PATCH /api/pos/stock-opnames/[id]/approve` adalah jalur paling sensitif karena
memutasi stok. Route harus berjalan dalam transaksi, mengunci row stock opname
dengan `.for('update')`, memastikan status masih `PENDING`, memastikan branch
sama dengan branch session, dan memastikan item sudah ada sebelum memanggil
`applySOStockAdjustment`.

Approver selalu `payload.userId`. Route tidak boleh memakai `approvedById` dari
body. Setelah adjustment berhasil, header diupdate ke `APPROVED` dengan waktu
approval dan aktor terpercaya. Jika row sudah bukan `PENDING`, route
mengembalikan konflik atau bad request tanpa menjalankan adjustment.

### Reject

`PATCH /api/pos/stock-opnames/[id]/reject` mengikuti pola BO reject: auth wajib,
content-type JSON wajib, alasan divalidasi Zod, row stock opname dikunci dalam
transaksi, branch harus sama dengan session POS, dan rejector memakai
`payload.userId`.

### Skip Daily Stock Opname

`POST /api/pos/stock-opname/skip` tetap boleh membuat stock opname `DAILY` yang
`APPROVED` dan `isSkipped: true`, tetapi branch dan cashier berasal dari
session. `reason` wajib divalidasi. Jika `shiftId` dikirim, shift harus milik
branch session. Notification yang dibuat harus memakai branch dan cashier
terpercaya.

### Active Full

`GET /api/pos/stock-opnames/active-full` tidak lagi membaca `branchId` dari query
sebagai sumber scope. Route memakai branch session dan hanya mengembalikan
pending `FULL` stock opname untuk branch tersebut. Response harus tetap hanya
berisi field yang dibutuhkan POS.

### Suggestions

`GET /api/pos/stock-opname/suggestions` memakai branch session untuk filter stok
dan transaksi. Query `method`, `shiftId`, dan `q` divalidasi. Jika `shiftId`
ada, route memastikan shift berada di branch session. Error 500 harus berupa
pesan generik Bahasa Indonesia.

## Desain Backoffice

### Create BO Stock Opname

`POST /api/bo/stock-opnames` tetap boleh dipakai `OWNER` dan `MANAGER`, tetapi
branch target berbeda berdasarkan role:

- `OWNER` boleh membuat untuk `branchId` yang dikirim.
- `MANAGER` hanya boleh membuat untuk `payload.branchId`; `branchId` body selain
  branch manager ditolak.

Pengecekan pending stock opname dan insert sebaiknya dijalankan dalam transaksi
agar tidak ada celah antara check dan insert. Jika database belum punya unique
index pending-per-branch, Stage 5 tidak menambah migration; race tetap
diperkecil di level transaksi route.

### History BO Stock Opname

`GET /api/bo/stock-opnames/history` harus punya role gate dan branch scoping:

- `OWNER` dan `GM` boleh filter branch eksplisit.
- `MANAGER` hanya boleh melihat `payload.branchId`; query `branchId` lain
  diabaikan atau ditolak secara konsisten.
- Role lain ditolak jika tidak punya kebutuhan bisnis untuk membaca history
  stock opname.

Response error 500 diganti menjadi pesan generik Bahasa Indonesia.

### Halaman Pending Stock Opname

Halaman `/inventory/stock-opname` harus sejajar dengan API pending. Jika data
awal diambil langsung dari database, manager hanya menerima pending stock opname
branch miliknya. Owner tetap bisa melihat lintas branch sesuai kebutuhan
dashboard.

## Integritas Mutasi Stok

`applySOStockAdjustment` tetap dipakai sebagai helper mutasi stok. Stage 5 tidak
mengubah algoritme FIFO di helper tersebut. Fokus Stage 5 adalah memastikan
input helper hanya berasal dari stock opname dan item yang sudah dikunci oleh
auth, branch, status, dan transaksi.

Sebelum approval memanggil helper:

- Header stock opname harus dikunci.
- Status harus `PENDING`.
- Branch header harus sama dengan branch terpercaya.
- Item harus berasal dari stock opname tersebut.
- Variance `0` tetap dilewati seperti pola existing.
- Aktor audit memakai user JWT.

## Error Handling

Semua route yang disentuh harus mengikuti response error project:

```typescript
return NextResponse.json(
  { error: 'Pesan dalam Bahasa Indonesia' },
  { status: 4xx | 5xx }
)
```

Tidak boleh mengembalikan `error.message` mentah ke client. Error domain yang
sudah dipahami boleh dipetakan ke pesan spesifik, misalnya stock opname tidak
ditemukan, sesi tidak valid, role tidak punya akses, data tidak valid, atau
status stock opname sudah berubah.

## Test dan Verifikasi

Stage 5 dianggap selesai jika skenario berikut punya regression guard route-level:

1. POS create mengabaikan atau menolak spoofed `branchId` dan `createdById`;
   insert memakai branch dan user JWT.
2. POS add-items menolak stock opname branch lain dan menghitung stok dari
   branch header, bukan body.
3. POS approve tanpa auth gagal dan tidak memanggil stock adjustment.
4. POS approve stock opname branch lain gagal dan tidak memanggil stock adjustment.
5. POS approve stock opname yang sudah bukan `PENDING` gagal tanpa
   double-mutate.
6. POS reject memakai user JWT, bukan `rejectedById` body.
7. POS skip memakai branch dan cashier JWT, bukan body.
8. POS active-full dan suggestions tidak bisa membaca branch lain lewat query.
9. BO create menolak manager membuat stock opname untuk branch lain.
10. BO history menolak atau mengabaikan branch query lintas branch untuk
    manager.

Verifikasi minimum:

- `pnpm --filter backoffice exec tsc --noEmit`
- Route test terkait stock opname yang ditambahkan atau diubah.
- `apps/backoffice/CHANGELOG.md` diupdate karena implementasi Stage 5 adalah bug
  fix keamanan dan integritas stok.

## Di Luar Ruang Lingkup

Stage 5 tidak mencakup:

- Migration database untuk unique pending stock opname per branch.
- Refactor besar `applySOStockAdjustment`.
- Perubahan UI besar pada halaman stock opname.
- Perubahan kontrak sync POS yang tidak dibutuhkan untuk mengunci branch dan
  aktor.
- PR otomatis; user akan membuat PR manual.

## Keputusan Desain

Pendekatan yang dipilih adalah hardening POS stock opname terlebih dahulu, lalu
menutup gap branch-scope BO dalam stage yang sama. Pendekatan ini menjaga blast
radius tetap fokus pada jalur yang bisa membaca atau memutasi stok, tanpa
melakukan refactor besar yang tidak diperlukan untuk menutup risiko spoofing dan
cross-branch access.
