<!-- markdownlint-disable MD013 -->

# Backoffice Bulk Sale Transaction Design

## Ringkasan

Bulk sale adalah halaman transaksi backoffice untuk input banyak produk dengan klik minimum. Alurnya memakai data dan rules Web POS, tetapi UX mengikuti create internal PO: satu search produk cepat, tabel inline, keyboard-friendly, dan submit sekali untuk banyak baris.

Fitur ini dibuat di backoffice, bukan di layar `/pos`, karena user perlu memilih customer dan branch transaksi secara eksplisit. Setelah transaksi berhasil, user bisa mencetak struk dan surat jalan.

## Tujuan

- Membuat halaman `transactions/bulk-sale` untuk transaksi penjualan massal.
- Mewajibkan pilihan customer sebelum submit.
- Mewajibkan pilihan branch transaksi, dengan branch access mengikuti role JWT.
- Mempercepat input produk: search, Enter untuk tambah row, fokus otomatis ke qty, lalu Tab melalui UOM, tier harga, harga, diskon, dan kembali ke search.
- Mendukung UOM, price tier, harga satuan, qty, dan diskon nominal rupiah per item.
- Menyimpan transaksi melalui flow transaksi POS yang sudah mengurangi stok FIFO.
- Menyediakan tombol cetak struk dan cetak surat jalan setelah transaksi tersimpan.

## Scope

Masuk scope tahap pertama:

- Page server `apps/backoffice/app/(dashboard)/transactions/bulk-sale/page.tsx`.
- Client component dan helper lokal di `_components` untuk bulk sale.
- API backoffice baru di `apps/backoffice/app/api/bo/bulk-sales/route.ts`.
- Endpoint produk/customer/branch/supporting data yang diperlukan untuk branch selectable bila endpoint lama tidak cukup.
- Komponen print-only surat jalan penjualan.
- Link sidebar/menu transaksi.
- Entry `apps/backoffice/CHANGELOG.md` karena ini penambahan fitur.

Di luar scope tahap pertama:

- Mengubah schema transaksi agar `shiftId` nullable.
- Membuat delivery order tersimpan permanen di tabel `deliveryOrders`.
- Multi-payment kompleks seperti POS penuh.
- Open bill, retur, void, sync POS desktop, dan offline mode.
- Oversell authorization baru.

## Pendekatan Terpilih

Gunakan reuse maksimal dari POS dan internal order.

- Data harga, UOM, dan stok mengikuti bentuk response `/api/pos/products`.
- Persist transaksi memakai `TransactionService.createTransaction` agar stock deduction dan item/payment insert tetap satu jalur.
- UX row mengikuti `internal-order-client.tsx` dan `item-row.tsx`: search tunggal, keyboard navigation, table compact, dan focus handoff antar field.
- Struk memakai `components/pos/receipt-print.tsx` dengan mapping item bulk sale ke `CartItem`.
- Surat jalan dibuat sebagai print-only component baru, mengikuti gaya print detail internal transfer.

Pendekatan ini dipilih karena cepat, blast radius kecil, dan tidak membuat mekanisme transaksi paralel yang rawan beda rules dari POS.

## Arsitektur

### Page dan Client

`transactions/bulk-sale/page.tsx` melakukan fetch awal untuk branch yang boleh diakses, payment method default, dan data pendukung lain yang stabil. Client component menangani state transaksi, search produk, row editing, kalkulasi subtotal/grand total, validasi ringan, submit, dan print state.

State row minimal:

```typescript
type BulkSaleRow = {
  id: string
  productId: number
  productCode: string
  productName: string
  uomId: number
  uomCode: string
  availableUoms: BulkSaleUomOption[]
  priceTier: string
  availablePrices: BulkSalePriceOption[]
  qty: number
  unitPrice: number
  discountAmount: number
  subtotal: number
}
```

Baris boleh memiliki produk yang sama lebih dari sekali jika UOM atau tier berbeda. Key row memakai `id`, bukan hanya `productId`, agar tidak mengulang bug cart POS yang merge terlalu agresif.

### API

`POST /api/bo/bulk-sales` menerima payload:

- `branchId`
- `customerId`
- `items[]`
- `paymentMethodId`
- `amountPaid`
- `discountAmount` total hasil penjumlahan diskon item
- `totalAmount`, `payableAmount`, `changeAmount`

Route membaca `accessToken`, memverifikasi role, mengunci branch access, memvalidasi JSON dengan Zod, lalu memanggil `TransactionService.createTransaction`.

Role awal yang boleh membuat bulk sale: `OWNER`, `GM`, dan `MANAGER`. `OWNER` dan `GM` boleh memilih branch. `MANAGER` hanya boleh membuat transaksi untuk `payload.branchId`.

## Strategi Shift

Schema `transactions.shiftId` wajib `notNull`, jadi bulk sale tidak boleh membuat transaksi tanpa shift. Untuk tahap pertama, API auto-resolve shift aktif dengan aturan deterministic:

- Cari shift `OPEN` untuk `branchId` transaksi.
- Jika tidak ada, tolak dengan 400: `Tidak ada shift aktif untuk cabang transaksi`.
- Jika lebih dari satu, tolak dengan 409: `Ada lebih dari satu shift aktif, pilih shift di POS terlebih dahulu`.
- Jika tepat satu, pakai shift tersebut.

`cashierId` memakai `payload.userId`. Bulk sale tidak mensyaratkan cashier session POS karena ini transaksi backoffice, tetapi tetap menempel ke shift aktif agar schema dan laporan shift tetap konsisten. Jika setelah implementasi ditemukan laporan shift membutuhkan session cashier, scope berikutnya adalah menambahkan selector atau auto-join backoffice cashier session secara eksplisit, bukan menyimpan `shiftId` palsu.

## UX Detail

Header form berisi:

- Customer selector wajib.
- Branch selector wajib.
- Payment method sederhana.
- Summary total, total diskon, bayar, dan kembalian.

Input produk:

- Satu search box dengan debounce.
- ArrowUp/ArrowDown memilih hasil.
- Enter menambahkan produk ke row baru.
- Setelah tambah produk, search dikosongkan dan fokus pindah ke qty row baru.
- Escape menutup dropdown.

Tabel item:

- Kolom: Produk, Qty, UOM, Tier Harga, Harga, Diskon Rp, Subtotal, Hapus.
- Qty dan diskon memakai numeric input.
- UOM change memilih price tier pertama yang valid untuk UOM tersebut.
- Tier change memperbarui `unitPrice`.
- Harga tetap editable untuk kasus harga khusus, tetapi tetap integer rupiah.
- Tab dari field terakhir kembali ke search agar input produk berikutnya cepat.

Submit disabled jika customer belum dipilih, branch belum dipilih, item kosong, ada qty tidak valid, subtotal negatif, atau pembayaran kurang dari payable.

## Pricing dan Diskon

Semua kalkulasi nominal memakai integer rupiah dan `big.js` di helper kalkulasi agar konsisten dengan POS.

Rumus row:

```text
subtotal = qty * unitPrice - discountAmount
```

Aturan:

- `qty` integer positif.
- `unitPrice` integer positif.
- `discountAmount` integer minimal 0.
- `discountAmount` tidak boleh lebih besar dari `qty * unitPrice`.
- Total diskon transaksi adalah jumlah diskon semua row.
- `payableAmount` sama dengan jumlah subtotal row.
- `amountPaid` minimal sama dengan `payableAmount`.

Diskon nominal dipilih per item karena schema `transactionItems.discountAmount` sudah tersedia dan audit harga lebih jelas. Diskon header tidak dibuat pada tahap pertama.

## Data Produk dan Branch

Endpoint POS produk saat ini branch-aware melalui cookie POS branch. Karena bulk sale memilih branch di backoffice, implementasi perlu salah satu dari dua cara:

1. Tambah endpoint BO product search yang menerima `branchId` dan mengembalikan bentuk data sama seperti POS product search.
2. Ekstrak query produk POS menjadi helper bersama, lalu dipakai oleh endpoint POS dan BO.

Pilihan rekomendasi adalah opsi 2 bila perubahan tetap kecil. Jika ekstraksi memperbesar scope, pakai opsi 1 untuk tahap pertama dengan response shape yang sama.

Customer selector bisa memakai pola pencarian customer yang sudah ada, tetapi submit tetap wajib mengirim `customerId` valid.

## Printing

Setelah API berhasil, client menyimpan response transaksi dan menampilkan aksi:

- `Cetak Struk`: render `ReceiptPrint` dengan nomor transaksi, item, total, pembayaran, customer, branch, user backoffice sebagai cashier, dan payment method.
- `Cetak Surat Jalan`: render print-only delivery note berisi nomor transaksi, customer, branch asal, tanggal, daftar produk/UOM/qty, catatan kosong opsional, dan area tanda tangan.

Surat jalan tahap pertama bersifat print-only, memakai nomor transaksi sebagai referensi. Tidak membuat record `deliveryOrders` agar tidak menambah lifecycle baru sebelum user meminta tracking DO tersimpan.

## Validasi dan Error Handling

Semua error API memakai Bahasa Indonesia dan shape `{ error: string }`.

Status code:

- 400 untuk payload tidak valid, customer kosong, item kosong, diskon tidak valid, pembayaran kurang, atau tidak ada shift aktif.
- 401 untuk token tidak valid.
- 403 untuk role atau branch tidak boleh akses.
- 409 untuk lebih dari satu shift aktif atau konflik stok/transaksi.
- 415 untuk content-type bukan `application/json`.
- 500 untuk error internal generik.

Route tidak mempercayai `cashierId`, `role`, atau branch scope dari body. Actor selalu dari JWT. Branch body hanya boleh dipakai setelah role check.

## Testing

Minimal test tahap pertama:

- Helper kalkulasi row menolak diskon lebih besar dari gross row.
- Helper kalkulasi total menghasilkan `discountAmount`, `payableAmount`, dan `changeAmount` benar.
- API menolak request tanpa customer.
- API menolak item kosong atau subtotal negatif.
- API menolak pembayaran kurang.
- API menolak branch lain untuk role non-global.
- API menolak branch tanpa shift aktif dan branch dengan shift aktif ganda.

Jika test route penuh terlalu berat karena Next cookies/Drizzle, buat unit test untuk helper kalkulasi dan service resolver shift/branch access, lalu validasi typecheck untuk file route dan client.

## Acceptance Criteria

- Given user `OWNER` atau `GM`, when membuka bulk sale, then user bisa memilih branch transaksi.
- Given user `MANAGER`, when membuka bulk sale, then branch terkunci ke branch JWT.
- Given customer belum dipilih, when submit, then transaksi ditolak di UI dan API.
- Given satu produk dipilih dari search, when Enter ditekan, then row baru ditambahkan dan fokus pindah ke qty.
- Given user mengubah UOM atau tier harga, when row berubah, then harga dan subtotal diperbarui konsisten.
- Given diskon nominal lebih besar dari gross row, when submit, then transaksi ditolak.
- Given branch punya tepat satu shift aktif, when transaksi valid disubmit, then transaksi tersimpan melalui `TransactionService.createTransaction` dan stok berkurang.
- Given transaksi sukses, when user klik cetak struk atau surat jalan, then layout print yang sesuai muncul.

## Risiko dan Mitigasi

- `shiftId` wajib membuat bulk sale bergantung pada shift aktif. Mitigasi: fail fast dengan pesan jelas dan jangan membuat shift palsu.
- Endpoint produk POS bergantung cookie branch POS. Mitigasi: BO endpoint baru atau helper query bersama dengan `branchId` eksplisit.
- Reuse `ReceiptPrint` membutuhkan mapping item yang presisi. Mitigasi: tipe adapter kecil dari `BulkSaleRow` ke `CartItem`.
- Transaksi backoffice masuk laporan shift kasir. Mitigasi: actor dari JWT dan nomor transaksi tetap POS-style; bila butuh kategori khusus, tambah metadata pada tahap berikutnya.

## Rollout

Implementasi dilakukan bertahap:

1. Tambah helper kalkulasi dan tipe row.
2. Tambah endpoint produk BO bila diperlukan.
3. Tambah API bulk sale dengan auth, branch, shift, dan payload validation.
4. Tambah page/client bulk sale.
5. Tambah komponen print surat jalan dan reuse receipt print.
6. Tambah link sidebar dan changelog.
7. Jalankan diagnostics, targeted tests, dan typecheck sesuai scope.
