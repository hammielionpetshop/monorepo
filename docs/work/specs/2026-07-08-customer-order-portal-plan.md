# Rencana: Customer Order Portal (`order.hammielion.com`)

> Status: **DRAFT / PLANNING** — belum ada kode. Dibuat 2026-07-08.
> Tujuan: halaman order self-service untuk customer (reseller/grosir), hasilnya masuk ke sistem sebagai **bulk sale**.
>
> 📋 **Backlog eksekusi:** [`docs/work/backlog/2026-07-08-customer-order-portal.md`](../backlog/2026-07-08-customer-order-portal.md)
> — rencana ini dipecah jadi item `C0–C7` (+ gate `C-UX`) yang bisa dikerjakan per sesi.
> **Urutan global: inisiatif #3** (setelah RBAC & Staff Dashboard). Detail milestone di §11.

---

## 1. Ringkasan & Keputusan yang Sudah Diambil

Halaman order mandiri untuk customer, dengan UX ala marketplace (Tokopedia/Shopee/Blibli) karena target user **minim melek teknologi tapi terbiasa marketplace**. Hasil input customer menjadi **transaksi bulk** di backoffice, dengan **stok & harga real-time dari DB**.

Keputusan yang sudah disepakati:

| Topik | Keputusan |
|---|---|
| **Login customer** | OTP WhatsApp (dengan abstraksi provider — lihat §5) |
| **Alur order** | Order masuk sebagai **PENDING** → staff/owner review → dikonversi jadi bulk sale. **Staff/owner boleh ubah harga & stok** saat konfirmasi |
| **Sumber katalog & harga** | **Satu cabang tetap** (mis. Gudang/Pusat) — ditentukan via env |
| **Deployment** | **App Next.js baru terpisah**: `apps/order-web`, subdomain `order.hammielion.com` |
| **Metode pembayaran** | **Staff yang tentukan saat konfirmasi** — customer tidak memilih metode bayar |
| **Registrasi customer** | **Whitelist oleh owner** — hanya customer `canOrderOnline=true` yang bisa login; nomor asing ditolak |
| **Foto produk** | Tambah kolom `imageUrl` (nullable) sejak awal; tampil bila ada, upload UI menyusul |

Pola preseden yang ditiru: **Internal PO (IBT) → dikonversi jadi bulk sale** (`sourceIbtId` di `transactions`, konversi di `TransactionService.createTransaction`). Order customer memakai pola serupa: entitas order sendiri yang dikonversi jadi bulk sale.

---

## 2. Arsitektur High-Level

```
                    order.hammielion.com                 admin.hammielion.com (backoffice)
                    ┌────────────────────┐               ┌────────────────────────────┐
  Customer  ──────► │  apps/order-web     │               │  apps/backoffice           │
  (HP, awam)        │  (Next.js 15)       │               │  - Halaman "Order Masuk"    │
                    │  - OTP login        │               │  - Review & konversi        │
                    │  - Katalog          │               │    → bulk sale (harga/stok  │
                    │  - Keranjang        │               │      bisa diubah)           │
                    │  - Checkout → order │               └────────────┬───────────────┘
                    └─────────┬───────────┘                            │
                              │  tulis customer_orders (PENDING)       │
                              ▼                                        ▼
                    ┌──────────────────────────────────────────────────────────┐
                    │  PostgreSQL (petshop)  — packages/@petshop/db (shared)     │
                    │  products, productPrices, productStocks, customers, …      │
                    │  + BARU: customer_auth, customer_orders, customer_order_*  │
                    └──────────────────────────────────────────────────────────┘
```

**Prinsip:**
- `apps/order-web` **hanya menulis order berstatus PENDING** — TIDAK pernah membuat transaksi/potong stok/atur pembayaran. Semua finalisasi terjadi di backoffice oleh staff (aman: shift, kasir, metode bayar, harga final ditentukan manusia).
- Kedua app **share** `@petshop/db` (schema Drizzle) & `@petshop/shared` (types/zod). Tidak ada duplikasi schema.
- Bundle `order-web` **tidak** membawa kode admin (isolasi sesuai pilihan app terpisah).

### Kenapa app terpisah (bukan route group)
- Isolasi keamanan: kode & auth admin tidak ikut ter-bundle ke publik.
- Auth berbeda total (JWT customer vs JWT staff) — pemisahan mengurangi risiko kebocoran permission.
- Deploy & scaling independen.
- Konsekuensi: perlu setup auth/db/lib sendiri + pipeline deploy baru (di-cover di §11).

---

## 3. Perubahan Skema Database

File baru: `packages/db/src/schema/customer_portal.ts` (didaftarkan di `schema/index.ts`).

### 3.1 Tambahan kolom di `customers` (master.ts)
Customer online butuh **tier harga tetap** agar tidak bisa "memilih" tier sendiri:

```ts
// tambahan di customers:
defaultTierType: varchar('default_tier_type', { length: 20 }).default('RETAIL').notNull(),
// tier harga yang otomatis dipakai untuk order online (RETAIL/RESELLER/GROSIR).
// Menentukan harga yang DILIHAT customer di katalog.
canOrderOnline: boolean('can_order_online').default(false).notNull(),
// gate: hanya customer yang di-approve boleh akses portal.
```

### 3.1b Tambahan kolom di `products` (products.ts)
Katalog marketplace butuh foto (ditambah dari awal agar tak migrasi ulang; upload UI menyusul):
```ts
imageUrl: varchar('image_url', { length: 500 }), // nullable — URL foto produk, tampil bila ada
```

### 3.2 `customer_auth` — kredensial & sesi OTP
```ts
customerAuth = petshop.table('customer_auth', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').references(() => customers.id).notNull().unique(),
  phone: varchar('phone', { length: 20 }).notNull().unique(), // nomor login (normalisasi E.164)
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

customerOtpCodes = petshop.table('customer_otp_codes', {
  id: serial('id').primaryKey(),
  phone: varchar('phone', { length: 20 }).notNull(),
  codeHash: varchar('code_hash', { length: 255 }).notNull(), // argon2 hash OTP, jangan plain
  expiresAt: timestamp('expires_at').notNull(),         // TTL 5 menit
  attempts: integer('attempts').default(0).notNull(),   // rate-limit verifikasi
  consumedAt: timestamp('consumed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [ index('idx_customer_otp_phone').on(t.phone) ])
```

### 3.2b `customer_cart_items` — keranjang server-side (keputusan C-UX, masuk scope C3)
```ts
customerCartItems = petshop.table('customer_cart_items', {
  id: serial('id').primaryKey(),
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  qty: integer('qty').notNull(), // diupdate in-place, bukan insert baris baru per perubahan
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  unique('uq_customer_cart_item').on(t.customerId, t.productId, t.uomId),
  index('idx_customer_cart_items_customer').on(t.customerId),
])
```
1 customer = 1 keranjang aktif implisit (query by `customerId`), tanpa tabel header `customer_carts` terpisah. Item difilter saat render bila produk sudah nonaktif — tak perlu cleanup job.

### 3.3 `customer_orders` + `customer_order_items` — order pending
```ts
customerOrders = petshop.table('customer_orders', {
  id: serial('id').primaryKey(),
  orderNumber: varchar('order_number', { length: 50 }).notNull().unique(), // ORD-YYYYMMDD-xxxx
  customerId: integer('customer_id').references(() => customers.id).notNull(),
  branchId: integer('branch_id').references(() => branches.id).notNull(), // cabang penjual (tetap)
  status: varchar('status', { length: 20 }).default('PENDING').notNull(),
  // PENDING → CONFIRMED (jadi bulk sale) | REJECTED | CANCELLED
  note: text('note'),                    // catatan customer (mis. alamat kirim, permintaan)
  estimatedTotal: integer('estimated_total').notNull(), // total snapshot HARGA SAAT ORDER (indikatif)
  convertedTransactionId: integer('converted_transaction_id').references(() => transactions.id),
  processedById: integer('processed_by_id').references(() => users.id), // staff yang konfirmasi
  processedAt: timestamp('processed_at'),
  rejectReason: text('reject_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('idx_customer_orders_status_created').on(t.status, t.createdAt),
  index('idx_customer_orders_customer').on(t.customerId),
])

customerOrderItems = petshop.table('customer_order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => customerOrders.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  productName: varchar('product_name', { length: 255 }).notNull(), // snapshot
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  uomCode: varchar('uom_code', { length: 10 }).notNull(),
  qty: integer('qty').notNull(),
  priceTier: varchar('price_tier', { length: 20 }).notNull(),   // dari customer.defaultTierType
  unitPriceSnapshot: integer('unit_price_snapshot').notNull(),  // harga saat order (indikatif)
  subtotalSnapshot: integer('subtotal_snapshot').notNull(),
}, (t) => [ index('idx_customer_order_items_order').on(t.orderId) ])
```

**Catatan penting soal harga snapshot:** harga & subtotal di `customer_orders` bersifat **indikatif** (harga saat customer order). **Harga final = yang divalidasi/di-set staff** saat konfirmasi (staff bisa ubah). Ini mencegah masalah kalau harga DB berubah antara saat order dan saat diproses. Di UI customer harus tertulis jelas: *"Harga bersifat estimasi, total final dikonfirmasi admin."*

---

## 4. API `apps/order-web`

Semua route customer-facing, auth via **JWT customer** (cookie HTTP-only `customerToken`), bukan `accessToken` staff.

| Route | Method | Fungsi |
|---|---|---|
| `/api/auth/request-otp` | POST | Input phone → generate OTP, kirim via `OtpChannel`, simpan hash. Rate-limit per nomor. |
| `/api/auth/verify-otp` | POST | Input phone + code → verifikasi hash, set cookie `customerToken`. **Whitelist**: hanya nomor yang sudah ada di `customers` + `canOrderOnline=true`; nomor asing ditolak ("Nomor belum terdaftar, hubungi admin"). **Tanpa auto-registrasi.** |
| `/api/auth/logout` | POST | Hapus cookie. |
| `/api/catalog` | GET | Daftar produk cabang tetap + harga sesuai `customer.defaultTierType` + stok. Search & pagination. |
| `/api/catalog/[id]` | GET | Detail 1 produk (uom, harga tier, stok). |
| `/api/orders` | POST | Buat `customer_orders` PENDING dari keranjang. Validasi ulang produk aktif & harga server-side. |
| `/api/orders` | GET | Riwayat order milik customer (status tracking). |
| `/api/orders/[id]` | GET | Detail 1 order + status. |
| `/api/me` | GET | Profil customer terautentikasi. |

**Catalog API** = varian dari `bo/bulk-sale-products/route.ts` **tanpa gating role staff**, tapi:
- `branchId` **dipaksa dari env** (`ORDER_BRANCH_ID`), tidak dari query — customer tak bisa intip cabang lain.
- Hanya expose **satu tier** (`customer.defaultTierType`), **jangan** kirim semua tier (bocor harga reseller ke retail).
- Expose stok sebagai indikator ketersediaan ("Tersedia" / "Stok menipis" / "Kosong"), bukan angka mentah jika mau. (Keputusan UI, lihat §7.)

**Order POST** memvalidasi ulang di server (jangan percaya harga dari client): ambil harga terbaru `productPrices` (branch tetap + uom + `defaultTierType`), hitung subtotal server-side, simpan sebagai snapshot indikatif. Produk nonaktif ditolak.

---

## 5. Auth OTP WhatsApp — Desain Provider-Agnostic

**Masalah:** tidak ada solusi yang sekaligus *gratis* & *minim config*. Solusi: abstraksi channel agar bisa mulai murah lalu pindah tanpa ubah alur.

```ts
// packages/shared atau apps/order-web/lib/otp/channel.ts
export interface OtpChannel {
  send(phoneE164: string, code: string): Promise<{ ok: boolean; error?: string }>
}
```

Implementasi (pilih via env `OTP_PROVIDER`):
- `ConsoleOtpChannel` — dev/local: OTP hanya di-log. **Wajib ada** biar dev tak perlu WA.
- `FonnteOtpChannel` — produksi awal (dipakai C2, sudah diimplementasi): 1 HTTP POST ke gateway SaaS, konfigurasi paling ringan (scan QR nomor sendiri, ~Rp 50–150rb/bln). Risiko: nomor unofficial bisa kena banned.
- `WahaOtpChannel` — **keputusan final untuk produksi (2026-07-10), diimplementasikan setelah C5**: [WAHA](https://waha.devlike.pro) self-host (Docker), gratis selain biaya server sendiri. Sama seperti Fonnte, tetap **unofficial** (mem-puppeteer WhatsApp Web multi-device, bukan Meta Cloud API) — risiko banned & kebutuhan scan ulang QR bila sesi logout tetap ada, tapi tanpa biaya bulanan SaaS. Endpoint `POST {WAHA_BASE_URL}/api/sendText` (`chatId`, `text`, `session`), header `X-Api-Key` opsional. Perlu instance WAHA berjalan + sesi WhatsApp yang sudah login (di-setup saat C6 — Deployment).
- `WhatsAppCloudApiChannel` — jangka panjang/resmi (belum diimplementasikan, opsi cadangan bila WAHA di-banned): Meta Cloud API, ~Rp 300–500/OTP, tidak kena banned. Config lebih berat (Meta Business, verifikasi nomor, permanent token).

**Perbandingan (untuk keputusan biaya):**

| Provider | Biaya | Config | Risiko banned |
|---|---|---|---|
| Fonnte/Wablas/Watzap | ~Rp 50–150rb/bln | **Ringan** | Ada (unofficial) |
| WA Cloud API (resmi) | ~Rp 300–500/OTP | Sedang | Tidak |
| **WAHA (self-host)** | **Gratis** (+ biaya server) | Sedang (Docker + scan QR sesi) | Ada (unofficial) + beban ops sesi |

**Keputusan final (2026-07-10):** produksi memakai `WahaOtpChannel` (self-host WAHA) — hemat biaya SaaS bulanan, trade-off menerima risiko banned yang sama dengan Fonnte/Wablas plus tanggung jawab menjaga instance & sesi tetap hidup. `FonnteOtpChannel` tetap ada di kode sebagai fallback/opsi tanpa perlu hosting sendiri. Simpan OTP sebagai **hash argon2** (bukan plain), TTL 5 menit, max 5 percobaan verifikasi, rate-limit request (mis. 1 OTP / 60 detik / nomor, max 5 / jam).

**JWT customer** (reuse pola `jose` HS256 dari `lib/auth.ts`, **secret berbeda** `CUSTOMER_JWT_SECRET`):
```ts
{ customerId, name, phone, tierType, branchId }  // exp 7d, cookie HTTP-only
```

---

## 6. Sisi Backoffice — Halaman "Order Masuk"

Halaman baru: `apps/backoffice/app/(dashboard)/orders/` (atau di bawah `transactions/`).

Alur staff/owner:
1. **Daftar order** berstatus PENDING (badge notifikasi jumlah baru).
2. **Detail order** — lihat item, qty, harga indikatif customer, catatan, stok terkini.
3. **Edit sebelum konfirmasi** (sesuai permintaan: "staff/owner bisa ubah harga/stok"):
   - Ubah harga per item (dengan guard tier yang sudah ada: role non-global tak boleh di bawah tier — reuse logika `bulk-sales/route.ts`).
   - Ubah/hapus qty (mis. stok tak cukup).
   - Sesuaikan stok bila perlu (via stock adjustment yang sudah ada).
4. **Konfirmasi** → panggil pipeline bulk sale yang sudah ada (`TransactionService.createTransaction` `saleType: 'BULK'`) dengan `customerId`, item final, shift OPEN aktif, kasir = user yang konfirmasi, metode bayar (mis. kredit/hutang atau sesuai kesepakatan). Set `customer_orders.status = CONFIRMED`, `convertedTransactionId`.
5. **Tolak** → status REJECTED + `rejectReason` (tampil ke customer).

**Reuse maksimal:** komponen review & kalkulasi bulk sale (`bulk-sale-review-dialog.tsx`, `bulk-sale-calculations.ts`) bisa dipakai ulang untuk layar konfirmasi order.

**Guard baru di `bulk-sales/route.ts`:** tambahkan `sourceOrderId` (analog `sourceIbtId`) agar order tertaut ke transaksi & tak bisa dikonversi dobel (cek `convertedTransactionId IS NULL`).

---

## 7. UX Portal Customer (target: user awam, terbiasa marketplace)

Prinsip desain — **mirip Tokopedia/Shopee, sesederhana mungkin**:
- **Onboarding 1 layar**: input no HP besar-besar → terima OTP → masuk. Tanpa form panjang.
- **Katalog grid** ala marketplace: foto produk (jika ada), nama, harga per satuan, tombol **+ Keranjang** besar. Search bar menonjol di atas.
- **Kategori/brand** sebagai filter chip horizontal (scroll).
- **Satuan (UOM)**: dropdown jelas (mis. "per Dus" / "per Pcs") karena reseller beli grosir — tampilkan harga per satuan yang dipilih.
- **Keranjang** ala marketplace: qty stepper (− / angka / +), subtotal live, tombol **Checkout** sticky di bawah.
- **Checkout minimal**: konfirmasi item + catatan (alamat/permintaan) → tombol **Kirim Pesanan**. Tegaskan *"Harga estimasi, admin akan konfirmasi via WhatsApp."*
- **Status order** ala "lacak pesanan": PENDING (Menunggu konfirmasi) → CONFIRMED (Diproses) / REJECTED (Ditolak + alasan).
- **Bahasa Indonesia**, tombol besar, kontras tinggi, mobile-first (mayoritas akses HP).
- **Stok**: tampilkan sebagai **status kualitatif** ("Tersedia"/"Menipis"/"Kosong") — tanpa angka. Produk "Kosong" **tetap bisa diorder** (indent); staff yang atur saat konfirmasi.
- **Pengiriman**: tanpa pilihan ongkir (ditanggung owner). Alamat diambil dari `customers.address`; customer bisa menuliskan catatan pengiriman di field catatan checkout.

Styling: Tailwind v4 + Lucide (konsisten dengan stack repo).

---

## 8. Keamanan

- **Jangan bocorkan tier harga lain**: catalog hanya expose `customer.defaultTierType`.
- **Validasi harga & produk selalu server-side** saat order & saat konfirmasi (client tak dipercaya).
- **branchId dari env**, bukan input customer.
- **Rate-limit OTP** (request & verify) + hash OTP argon2 + TTL.
- **JWT customer** secret terpisah dari staff; scope minimal (tak ada akses BO API).
- **`canOrderOnline` gate** — hanya customer yang di-approve owner boleh order.
- **CORS/subdomain**: cookie customer di-scope ke `order.hammielion.com`.
- Order tidak memotong stok / tidak buat transaksi → tak ada dampak finansial sampai staff konfirmasi.

---

## 9. Environment Variables Baru

```
# apps/order-web
CUSTOMER_JWT_SECRET      # secret JWT customer (min 32 char, beda dari JWT_SECRET)
ORDER_BRANCH_ID          # id cabang penjual tetap (Gudang/Pusat)
ORDER_MIN_AMOUNT         # minimum order (Rupiah, integer) — keputusan C-UX; 0/unset = tanpa minimum
OTP_PROVIDER             # console | fonnte | wablas | wa_cloud | waha (waha = keputusan final produksi)
OTP_TTL_SECONDS=300
FONNTE_TOKEN             # bila OTP_PROVIDER=fonnte
WAHA_BASE_URL            # bila OTP_PROVIDER=waha — URL instance WAHA self-host, mis. http://localhost:3000
WAHA_API_KEY             # bila OTP_PROVIDER=waha — opsional, isi jika WAHA_API_KEY diaktifkan di instance
WAHA_SESSION             # bila OTP_PROVIDER=waha — nama sesi WAHA (default: "default")
# WA_CLOUD_* bila pakai Cloud API
DATABASE_URL             # sama dengan backoffice (share DB)
```

---

## 10. Dependensi & Prasyarat Data
- Pastikan cabang penjual (`ORDER_BRANCH_ID`) punya **`productPrices` lengkap** untuk tier target di semua produk yang mau dijual online (kalau tidak, produk ditolak `INVALID_PRICE`).
- Set `customer.defaultTierType` & `canOrderOnline` untuk customer yang diizinkan.
- Nomor HP customer harus dinormalisasi (E.164) agar login konsisten.

---

## 11. Rencana Bertahap (Milestone)

**Fase 0 — Fondasi (schema + shared)**
- Schema baru (`customer_portal.ts`), kolom tambahan `customers`, migrasi.
- Interface `OtpChannel` + `ConsoleOtpChannel`.

**Fase 1 — Scaffold `apps/order-web`**
- Next.js 15 app baru di monorepo, wiring `@petshop/db` & `@petshop/shared`, Tailwind v4.
- JWT customer + middleware.

**Fase 2 — Auth OTP**
- Request/verify OTP, registrasi/login, `FonnteOtpChannel`.

**Fase 3 — Katalog & Keranjang**
- Catalog API (branch tetap, 1 tier, stok), UI grid marketplace, keranjang.

**Fase 4 — Checkout & Order**
- POST order (validasi server-side), riwayat & status order.

**Fase 5 — Backoffice "Order Masuk"**
- Daftar/detail order, edit harga/qty, konfirmasi → bulk sale (`sourceOrderId`), tolak.

**Fase 6 — Deployment**
- Subdomain `order.hammielion.com`, env produksi, pilih provider OTP final.

**Fase 7 — Polish**
- Notifikasi WA ke customer saat order dikonfirmasi/ditolak (reuse `OtpChannel`/gateway), foto produk, dsb.

---

## 12. Pertanyaan Terbuka

### Sudah diputuskan (2026-07-08)
- ✅ **Metode pembayaran**: staff yang tentukan saat konfirmasi; customer tidak memilih. (default reseller kemungkinan kredit/tempo — keputusan per-order oleh staff)
- ✅ **Registrasi customer**: whitelist oleh owner (`canOrderOnline`), tanpa auto-registrasi. Nomor asing ditolak saat login.
- ✅ **Foto produk**: tambah kolom `imageUrl` nullable sejak awal; upload UI menyusul (fase polish). Storage (Cloudflare R2/MinIO/server dir) diputuskan saat upload dibangun.
- ✅ **Produk stok 0**: **tetap boleh diorder** (indent), diberi label jujur. Staff kurangi qty/tolak saat konfirmasi. Konsisten dg sistem oversell.
- ✅ **Tampilan stok**: **status kualitatif** ("Tersedia"/"Menipis"/"Kosong"), tanpa angka. Ambang "Menipis" default sederhana (mis. < 10 satuan dasar; bisa dikonfigurasi nanti).
- ✅ **Ongkir & alamat**: **ongkir ditanggung owner** → tidak dimodelkan di order (tanpa field ongkir). **Alamat pengiriman pakai `customers.address`** yang sudah ada (tidak ada field alamat baru). Catatan khusus pengiriman lewat field `note` di `customer_orders`. `delivery_orders` tetap dipakai staff cetak surat jalan setelah order jadi transaksi.
- ✅ **Notifikasi WA**: **tanpa notif otomatis untuk MVP**. Customer cek status di portal; staff kontak manual. Infra `OtpChannel` siap bila mau diaktifkan (fast-follow bernilai tinggi utk user awam).

### Masih terbuka
- **Ambil sendiri vs dikirim**: apakah perlu flag `fulfillmentType` di order? Untuk MVP diasumsikan mayoritas dikirim (ongkir owner); flag bisa ditambah kalau ada customer yang rutin ambil di tempat.
- **Storage foto**: solusi konkret (Cloudflare R2 / MinIO / server static dir) — diputuskan saat upload UI dibangun.

---

## 13. UX — Keputusan Final (C-UX, selesai 2026-07-10)

Prinsip umum di §7 (marketplace-like, mobile-first, Bahasa Indonesia, tombol besar) tetap berlaku. Berikut keputusan final per area, cukup untuk mulai C3.

**Login & onboarding**
- Layar 1: input no HP (besar, satu field, keyboard numerik) → tombol "Kirim OTP".
- Layar 2: **6 kotak digit terpisah**, auto-focus kotak berikutnya saat isi, auto-submit begitu kotak ke-6 terisi (tanpa tombol "Verifikasi" terpisah). Tombol "Kirim ulang OTP" muncul sebagai teks + **countdown 60 detik** (selaras cooldown backend), disabled selama countdown.
- Error state: nomor belum terdaftar → pesan "Nomor belum terdaftar, hubungi admin" + tombol kembali ke input HP (tanpa retry OTP karena `request-otp` sengaja generik — baru ketahuan di `verify-otp`); OTP salah → pesan inline di bawah kotak + kotak di-reset & fokus ulang ke kotak pertama, sisa percobaan **tidak** ditampilkan eksplisit (hindari membantu brute-force secara visual); OTP kedaluwarsa → pesan "Kode sudah kedaluwarsa, minta kode baru" + tombol kirim ulang langsung aktif; rate-limit (429) → pesan "Terlalu banyak percobaan, coba lagi dalam X menit".
- Sesi valid (cookie `customerToken` belum expired) → middleware langsung lempar ke katalog, tanpa lewat `/login` lagi.

**Katalog**
- Grid **2 kolom** di HP (kartu ramping ala Shopee/Tokopedia), 3–4 kolom di layar lebih lebar (tablet/desktop, meski target utama HP).
- Isi kartu: foto (atau placeholder ikon kategori bila `imageUrl` kosong — bukan inisial, supaya konsisten visual), nama produk (maks 2 baris, truncate `...`), harga per satuan default (UOM dasar/terkecil), badge status stok pojok (Tersedia = hijau, Menipis = kuning, Kosong = abu-abu tapi tetap bisa diorder), tombol **+ Keranjang** full-width di bawah kartu.
- Search: **live/debounced** (300ms) by nama & SKU, tanpa perlu tombol submit. Empty state: ilustrasi/ikon sederhana + teks "Produk tidak ditemukan, coba kata kunci lain".
- Filter kategori/brand: **chip horizontal scroll** di atas grid (bukan bottom-sheet — lebih cepat diakses & konsisten dengan pola search-first marketplace). Sorting **tidak** masuk MVP (katalog per cabang biasanya tak terlalu besar) — fast-follow bila dibutuhkan.

**Pemilihan satuan (UOM) & harga**
- Di kartu katalog: harga default pakai UOM dasar. Di halaman/detail produk & saat "+ Keranjang": **pill selector** horizontal per UOM tersedia (mis. "Pcs" / "Dus"), harga di atas pill berubah langsung saat dipilih.
- **Tidak** menampilkan badge "hemat X%" antar UOM di MVP (perlu kalkulasi tambahan, nilai tak krusial) — fast-follow.

**Keranjang & qty**
- Stepper (−/angka/+) dengan input manual diperbolehkan (tap angka → keyboard numerik), batas maksimal **9999** per baris item (guard input, bukan validasi stok — stok 0 tetap boleh diorder sesuai keputusan §12).
- **Minimum order: ada, berbasis nilai Rupiah.** Ambang disimpan sebagai **env var `ORDER_MIN_AMOUNT`** (konsisten pola `ORDER_BRANCH_ID`) untuk MVP — cukup untuk 1 cabang tetap; migrasi ke setting yang bisa diubah owner tanpa redeploy jadi **fast-follow** (mis. masuk `apps/backoffice` Settings) bila owner sering ganti ambang. Selama subtotal < ambang: tombol Checkout **disabled** + banner "Tambah belanja Rp X lagi untuk mencapai minimum order Rp {ambang}" (progress bar opsional, non-blocking untuk C3 awal).
- **Keranjang server-side** (bukan localStorage) — sinkron lintas sesi/device. Butuh tabel baru (masuk scope **C3**, bukan revisi C0): `customer_cart_items` (satu baris per `customerId` + `productId` + `uomId`; qty diupdate in-place; **tanpa** tabel header `customer_carts` terpisah — 1 customer = 1 keranjang aktif implisit, cukup query by `customerId`). Item hilang sendiri kalau produk dinonaktifkan (filter saat render, tak perlu cleanup job).
- Empty cart state: ilustrasi + teks "Keranjang kosong" + tombol "Mulai belanja" → katalog.

**Checkout**
- Ringkasan item (nama, qty, UOM, subtotal per baris) + total estimasi, dengan garis tebal teks **"Harga bersifat estimasi, total final dikonfirmasi admin via WhatsApp."** selalu terlihat (bukan cuma disclaimer kecil).
- Validasi minimum order diulang di sisi ini (guard ganda, konsisten pola "jangan percaya client" di §8).
- Alamat: tampilkan `customers.address` **read-only** (bukan form edit — data alamat tetap dikelola staff/owner di backoffice agar konsisten dengan data pengiriman/surat jalan). Kalau customer mau koreksi/tambahan, pakai field **catatan** (placeholder: "Alamat pengiriman berbeda? Detail lokasi? Tulis di sini").
- Tombol "Kirim Pesanan" → layar sukses: "Pesanan terkirim! Nomor pesanan ORD-xxxx. Tunggu konfirmasi admin, cek status di halaman Pesanan Saya."

**Status / lacak pesanan**
- Badge warna: PENDING = kuning "Menunggu Konfirmasi", CONFIRMED = hijau "Dikonfirmasi", REJECTED = merah "Ditolak" (+ `rejectReason` ditampilkan di bawah badge), CANCELLED = abu "Dibatalkan".
- List riwayat flat (tanpa timeline bertahap — status portal cuma 1 transisi PENDING→CONFIRMED/REJECTED, timeline berlebihan untuk MVP). Tap order → detail read-only.
- **"Pesan lagi"**: tombol di detail order lama → isi ulang keranjang server-side dengan item yang sama (harga diambil ulang real-time, bukan snapshot lama) lalu redirect ke keranjang untuk review.
- Kalau `status = CONFIRMED`, tampilkan **harga/qty final** (dari `convertedTransactionId` → item transaksi) berdampingan dengan estimasi awal jika berbeda, supaya customer tahu ada penyesuaian staff — cukup teks kecil "Disesuaikan admin" tanpa perlu diff visual detail.

**Umum**
- Branding: nama toko dari `branches.receiptName` (cabang `ORDER_BRANCH_ID`) di header; warna pakai **token Tailwind existing** (`bg-primary` dst, sama seperti `/login` yang sudah dibangun di C2) — tanpa theming per-cabang baru, karena portal ini memang 1 cabang tetap.
- Loading: skeleton grid untuk katalog, spinner sederhana untuk aksi checkout/OTP. Error koneksi: banner retry generik ("Gagal memuat, coba lagi" + tombol ulang).
- **PWA: ditunda ke C7 (fast-follow).** MVP cukup web responsif mobile-first; manifest/service worker menyusul kalau sudah ada traksi pemakaian nyata — mengurangi scope C3 tanpa mengorbankan pengalaman inti.
- Notifikasi dalam-portal (badge order baru dikonfirmasi): **tidak** di MVP (selaras keputusan §12 "tanpa notif otomatis") — customer cek manual di "Pesanan Saya".

---

## 14. Catatan Wajib
- Setiap perubahan → **update `apps/backoffice/CHANGELOG.md`** (aturan repo). Untuk `apps/order-web`, pertimbangkan CHANGELOG terpisah atau tetap di backoffice sebagai satu produk.
- Semua pesan error/label/komentar **Bahasa Indonesia**.
- Harga: **big.js**, simpan **integer** (konsisten dg repo).
- Reuse pola auth (`jose` HS256), response shape, & Drizzle query style yang ada.
