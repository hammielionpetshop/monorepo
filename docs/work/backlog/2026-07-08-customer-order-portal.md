# Backlog — Customer Order Portal (`order.hammielion.com`)

**Tanggal:** 2026-07-08
**Sumber rencana:** `docs/work/specs/2026-07-08-customer-order-portal-plan.md`
**Scope:** app baru `apps/order-web` (Next.js 15) + `apps/backoffice` + `packages/db` + `packages/shared`
**Urutan global:** **INISIATIF #3** (paling akhir — terbesar, paling berisiko, UX belum final)

Portal self-service untuk customer reseller/grosir. Order masuk sebagai **PENDING** → staff review →
dikonversi jadi **bulk sale** (pola meniru IBT → bulk sale). `apps/order-web` **hanya menulis order
PENDING** — tidak pernah potong stok / buat transaksi / atur bayar. Semua finalisasi di backoffice.

> ⚠️ **Prasyarat sebelum front-end (C3+):** butuh **sesi UX tersendiri** — §13 rencana masih banyak
> pertanyaan terbuka (login, katalog, keranjang, minimum order, dll). Lihat C-UX.
> **Prasyarat data:** cabang `ORDER_BRANCH_ID` harus punya `productPrices` lengkap untuk tier target.

## Keputusan yang sudah dikunci
| Topik | Keputusan |
|---|---|
| Login | OTP WhatsApp, provider-agnostic (`OtpChannel`) |
| Alur | Order PENDING → staff konfirmasi → bulk sale. Staff boleh ubah harga & stok |
| Katalog/harga | Satu cabang tetap via `ORDER_BRANCH_ID`; hanya expose **1 tier** (`customer.defaultTierType`) |
| Deployment | App terpisah `apps/order-web`, subdomain `order.hammielion.com` |
| Metode bayar | Staff yang tentukan saat konfirmasi |
| Registrasi | Whitelist owner (`canOrderOnline=true`); nomor asing ditolak, tanpa auto-registrasi |
| Stok | Status kualitatif (Tersedia/Menipis/Kosong); stok 0 tetap boleh diorder (indent) |
| Ongkir/alamat | Ongkir ditanggung owner (tak dimodelkan); alamat pakai `customers.address` |
| Notif WA | Tanpa notif otomatis untuk MVP (fast-follow) |

## Urutan pengerjaan
`C0 → C1 → C2 → C-UX → C3 → C4 → C5 → C6 → C7`. C-UX (sesi desain) **wajib sebelum** C3.

---

## C0 — Fondasi (schema + shared + OtpChannel)
**Prioritas:** Tinggi · **Effort:** M · **Depends:** —

### Scope teknis
- File baru `packages/db/src/schema/customer_portal.ts` (daftarkan di `index.ts`):
  `customer_auth`, `customer_otp_codes`, `customer_orders`, `customer_order_items`.
- Tambah kolom `customers`: `defaultTierType` (varchar 20 default 'RETAIL'), `canOrderOnline` (boolean default false).
- Tambah kolom `products`: `imageUrl` (varchar 500 nullable).
- Guard baru untuk konversi: `sourceOrderId` di `transactions` (analog `sourceIbtId`).
- Interface `OtpChannel` + `ConsoleOtpChannel` (dev — OTP di-log, **wajib ada**).
- Migrasi + typecheck.

### Kriteria selesai
- [x] Semua tabel/kolom baru ada & terdaftar; migrasi ter-generate (`0006_salty_wolf_cub.sql`). ⚠️ belum di-`db:migrate` ke DB.
- [x] `OtpChannel` + `ConsoleOtpChannel` bisa dipakai (`packages/shared/src/otp/`).
- [x] Snapshot harga di order jelas ditandai **indikatif** (harga final = staff saat konfirmasi).

---

## C1 — Scaffold `apps/order-web`
**Prioritas:** Tinggi · **Effort:** M · **Depends:** C0

### Scope teknis
- Next.js 15 app baru di monorepo (Turbo), wiring `@petshop/db` & `@petshop/shared`, Tailwind v4 + Lucide.
- JWT customer (`jose` HS256, secret **terpisah** `CUSTOMER_JWT_SECRET`, cookie `customerToken` HTTP-only, exp 7d) + middleware.
- Bundle **tidak** membawa kode admin.

### Kriteria selesai
- [x] `apps/order-web` jalan lokal (verified: `pnpm --filter order-web dev`, port 7070, `/login` 200, `/` redirect 307→`/login`); share DB & shared types.
- [x] Auth JWT customer terpisah dari `accessToken` staff (`CUSTOMER_JWT_SECRET`, cookie `customerToken`).

---

## C2 — Auth OTP WhatsApp
**Prioritas:** Tinggi · **Effort:** M · **Depends:** C1

### Scope teknis
- Route: `/api/auth/request-otp` (rate-limit per nomor, hash argon2, TTL 5 menit, max 5 verify),
  `/api/auth/verify-otp` (**whitelist**: hanya nomor di `customers` + `canOrderOnline=true`; nomor asing ditolak), `/api/auth/logout`.
- `FonnteOtpChannel` (produksi awal, ~Rp 50–150rb/bln) + tetap dukung `ConsoleOtpChannel` via `OTP_PROVIDER`.
- Interface siap migrasi ke `WhatsAppCloudApiChannel` (jangka panjang).

### Kriteria selesai
- [x] Request/verify OTP berfungsi (diuji end-to-end via console channel, DB dev — migrasi 0006 diterapkan; customer test dibuat & dihapus lagi).
- [x] Nomor tak ter-whitelist ditolak ("Nomor belum terdaftar, hubungi admin") — verified 403 di `verify-otp`. `request-otp` sengaja balas generik utk nomor manapun (anti-enumeration), tapi OTP sungguhan hanya dikirim ke nomor ter-whitelist (hemat biaya gateway, verified via log).
- [x] Rate-limit (cooldown 60s + maks 5/jam) + hash argon2 + TTL aktif — verified 429 pada request kedua <60s.

---

## C-UX — Sesi desain UX (GATE sebelum front-end) ✅ selesai 2026-07-10
**Prioritas:** Tinggi · **Effort:** M · **Depends:** — · **Blocker untuk C3–C4**

Finalisasi §13 rencana sebelum bangun UI. Ringkasan keputusan (detail lengkap: `docs/work/specs/2026-07-08-customer-order-portal-plan.md` §13):
- **Login/onboarding:** 6 kotak OTP auto-focus/auto-submit, resend + countdown 60s, error state ramah per kasus (nomor asing/OTP salah/kedaluwarsa/rate-limit), sesi valid skip `/login`.
- **Katalog:** grid 2 kolom (HP), placeholder ikon kategori, badge stok warna, search live-debounced, filter chip horizontal, tanpa sorting di MVP.
- **UOM & harga:** pill selector di detail/tambah-keranjang, tanpa badge "hemat" di MVP.
- **Keranjang:** stepper + input manual (maks 9999/baris), **minimum order berbasis nilai Rupiah** (`ORDER_MIN_AMOUNT` env, fast-follow ke setting owner), **keranjang server-side** (tabel baru `customer_cart_items`, masuk scope C3 — lihat plan §3.2b).
- **Checkout:** ringkasan + disclaimer estimasi tegas, alamat read-only dari `customers.address` (koreksi via catatan), validasi minimum order diulang server-side.
- **Status order:** badge PENDING/CONFIRMED/REJECTED/CANCELLED, list flat tanpa timeline, "Pesan lagi" isi ulang keranjang dgn harga real-time, tampilkan penyesuaian admin bila `CONFIRMED`.
- **Umum:** branding dari `branches.receiptName` + token Tailwind existing, **PWA ditunda ke C7**, tanpa notif dalam-portal di MVP.

### Kriteria selesai
- [x] Keputusan UX di atas tercatat (plan §13 & §3.2b diperbarui).
- [x] Ada wireframe/spec cukup untuk mulai C3 — termasuk keputusan skema tambahan (`customer_cart_items`) & env var baru (`ORDER_MIN_AMOUNT`) yang perlu ditambahkan di C3.

---

## C3 — Katalog & Keranjang ✅ selesai 2026-07-10
**Prioritas:** Tinggi · **Effort:** L · **Depends:** C2, C-UX

### Scope teknis
- `/api/catalog` & `/api/catalog/[id]`: varian `bo/bulk-sale-products` **tanpa gating role**, tapi
  `branchId` **dipaksa dari `ORDER_BRANCH_ID`** (bukan query), hanya expose **1 tier**
  (`customer.defaultTierType` — jangan bocorkan tier lain), stok sebagai status kualitatif.
- **Baru (keputusan C-UX):** tabel `customer_cart_items` (schema di plan §3.2b) + `/api/cart` (GET/POST/PATCH/DELETE)
  untuk keranjang server-side per customer. Env var baru `ORDER_MIN_AMOUNT` (minimum order Rupiah) — validasi
  client (disable tombol checkout) + siap dipakai ulang saat validasi server di C4.
- UI grid marketplace (mobile-first, tombol besar, Bahasa Indonesia) 2 kolom HP, keranjang (stepper, subtotal live,
  banner minimum order, checkout sticky) — detail lengkap di plan §13.

### Kriteria selesai
- [x] Katalog hanya cabang tetap + 1 tier; tier lain tidak bocor (verified: hanya `defaultTierType` dari token yang dipakai query, produk tanpa harga tier tsb tak muncul).
- [x] Keranjang server-side berfungsi (persist lintas sesi) sesuai keputusan C-UX (`customer_cart_items`, migrasi `0007` diterapkan ke DB dev).
- [x] Minimum order (`ORDER_MIN_AMOUNT`) mem-block checkout di sisi UI ketika subtotal belum cukup (verified end-to-end: di bawah & di atas ambang).

---

## C4 — Checkout & Order
**Prioritas:** Tinggi · **Effort:** M · **Depends:** C3

### Scope teknis
- `POST /api/orders`: buat `customer_orders` PENDING. **Validasi ulang server-side** (jangan percaya
  harga client): ambil harga terbaru `productPrices` (branch tetap + uom + tier), hitung subtotal server, simpan snapshot indikatif. Produk nonaktif ditolak.
- `GET /api/orders` + `/api/orders/[id]`: riwayat & status. `GET /api/me`.

### Kriteria selesai
- [ ] Order tersimpan PENDING; harga dihitung ulang server-side.
- [ ] Customer bisa lihat riwayat & status order sendiri.
- [ ] Order **tidak** memotong stok / membuat transaksi.

---

## C5 — Backoffice "Order Masuk"
**Prioritas:** Tinggi · **Effort:** L · **Depends:** C4

### Scope teknis
- Halaman baru `apps/backoffice/app/(dashboard)/orders/`: daftar PENDING (badge notif), detail order.
- **Edit sebelum konfirmasi:** ubah harga per item (reuse guard tier `bulk-sales/route.ts`), ubah/hapus qty, sesuaikan stok.
- **Konfirmasi** → `TransactionService.createTransaction` (`saleType:'BULK'`) dengan shift OPEN aktif,
  kasir = user konfirmasi, metode bayar dipilih staff. Set `status=CONFIRMED`, `convertedTransactionId`.
- **Guard dobel-konversi:** `sourceOrderId` (analog `sourceIbtId`) + cek `convertedTransactionId IS NULL`.
- **Tolak** → `status=REJECTED` + `rejectReason` (tampil ke customer).
- Reuse `bulk-sale-review-dialog.tsx` & `bulk-sale-calculations.ts`.

### Kriteria selesai
- [ ] Staff bisa review, edit harga/qty, konfirmasi → bulk sale, atau tolak.
- [ ] Order tak bisa dikonversi dobel.
- [ ] `CHANGELOG.md` di-update.

---

## C6 — Deployment
**Prioritas:** Sedang · **Effort:** M · **Depends:** C5

### Scope teknis
- Subdomain `order.hammielion.com`, env produksi (`CUSTOMER_JWT_SECRET`, `ORDER_BRANCH_ID`,
  `OTP_PROVIDER`, `FONNTE_TOKEN`, dst.), pipeline deploy baru.
- Pilih provider OTP final; cookie di-scope ke subdomain.

### Kriteria selesai
- [ ] Portal live di subdomain; env & OTP produksi siap.

---

## C7 — Polish (fast-follow)
**Prioritas:** Rendah · **Effort:** M · **Depends:** C5

### Scope teknis
- Notifikasi WA ke customer saat order dikonfirmasi/ditolak (reuse `OtpChannel`/gateway).
- Upload foto produk (`imageUrl`) + pilih storage (Cloudflare R2 / MinIO / server dir).
- (Opsional) flag `fulfillmentType` (ambil sendiri vs dikirim) bila dibutuhkan.

### Kriteria selesai
- [ ] Minimal notif WA konfirmasi order aktif (nilai tinggi utk user awam).

---

## Pertanyaan masih terbuka (non-blocking)
- **Storage foto**: R2 / MinIO / server static dir — diputuskan saat C7.
- **`fulfillmentType`**: MVP asumsikan dikirim; tambah flag bila ada customer rutin ambil di tempat.
- **Minimum order** (khas grosir): diputuskan di C-UX.

## Catatan lintas-item
- Semua pesan error/label/komentar **Bahasa Indonesia**; harga **big.js** + integer.
- Keamanan: validasi harga/produk selalu server-side; `branchId` dari env; JWT customer scope minimal
  (tak ada akses BO API); `canOrderOnline` gate.
- CHANGELOG: untuk `apps/order-web` pertimbangkan CHANGELOG terpisah atau tetap di backoffice sebagai satu produk.
- Terkait: [[2026-07-08-rbac-permission-plumbing]] (auth matang), reuse pola IBT→bulk sale yang sudah ada.
