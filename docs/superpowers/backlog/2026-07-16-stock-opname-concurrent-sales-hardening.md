<!-- markdownlint-disable MD013 -->

# Backlog — Stock Opname: Race Penjualan Berjalan + Hak Akses Halaman

**Tanggal:** 2026-07-16
**Sumber:** Audit halaman `/inventory/stock-opname` (temuan sesi 2026-07-16)
**Scope:** `apps/backoffice` (halaman dashboard + API BO + API POS + klien Web POS) · `packages/db`
**Prasyarat bisnis:** **SO dijalankan saat toko buka.** Mitigasi prosedural ("SO saat toko tutup") **tidak tersedia** — race penjualan wajib diselesaikan di kode.

Audit ini melanjutkan hardening 2026-06-11 (`docs/superpowers/plans/2026-06-11-backoffice-stock-opname-hardening-implementation.md`)
yang mengunci **branch & aktor**. Stage itu tidak menyentuh **konsistensi angka stok saat ada mutasi
berjalan**, dan role guard halaman pending yang disebut di spec-nya ternyata tidak pernah terpasang
(lihat SO2).

## Prinsip yang dikunci

1. **Approve tetap menerapkan selisih (delta), bukan menimpa stok.** `applySOStockAdjustment`
   (`apps/backoffice/lib/stock-adjustment.ts:180-209`) sudah benar — penjualan **setelah** submit
   otomatis aman. **Jangan** diubah jadi `stok = physicalQty`; itu akan menelan penjualan.
2. **Variance harus dihitung terhadap stok saat MENGHITUNG, bukan saat submit.** Ini satu-satunya
   akar Lubang 1. Begitu variance benar, delta-at-approve menyelesaikan sisanya.
3. **Angka stok tidak boleh bersumber dari klien.** Konsisten dengan hardening 2026-06-11 (branch &
   aktor dari sesi tepercaya, bukan body).
4. **Fix cepat dulu, tanpa menyentuh keputusan desain terbuka.** SO1–SO5 tidak mengunci jawaban dari
   ketiga keputusan di bawah.

## Urutan pengerjaan

`SO1 → SO2 → SO3 → SO4 → SO5` (paket cepat, aman, tanpa keputusan) lalu **berhenti & review**
sebelum `SO6 → SO7` (pekerjaan inti). Sisanya (`SO8`–`SO12`) menyusul.

**Status 2026-07-16:** paket cepat **SO1–SO5 selesai** (rilis `1.75.3`), lalu pekerjaan inti
**SO6 + SO7 selesai** (rilis `1.76.0`) — 219 test backoffice hijau, `tsc` bersih. **K1 terjawab**,
tapi jawabannya berubah di tengah jalan: rekonstruksi server dibatalkan setelah ledger terbukti tak
bisa dipakai berhitung; dipakai snapshot bertanda tangan server (lihat SO6). Temuan sampingannya
dicatat sebagai **SO13** (bug Mutasi Stok).

Tersisa: **SO8, SO9 (butuh K2), SO10 (butuh K3), SO11, SO12, SO13**.

## Keputusan terbuka (blocker untuk SO6, SO9, SO10)

| # | Pertanyaan | Memblokir |
|---|---|---|
| ~~K1~~ | ~~SO6 pakai snapshot dari klien atau rekonstruksi di server?~~ → **Terjawab:** snapshot bertanda tangan server. Rekonstruksi dibatalkan (ledger tak bisa dipakai berhitung, lihat SO6 & SO13). | — |
| K2 | GM boleh menyetujui SO? | SO9 |
| K3 | Tambah status `DRAFT`/`IN_PROGRESS`, atau biarkan SO baru langsung `PENDING`? | SO10 |

---

## SO1 — `searchParams` di-await (Next.js 15) ✅ SELESAI (1.75.3)

**Prioritas:** Sedang · **Effort:** S · **Depends:** —

### Scope teknis

- `apps/backoffice/app/(dashboard)/inventory/stock-opname/page.tsx:22,29`: tipe jadi
  `Promise<{ success?: string }>`, lalu `const params = await searchParams`.
- Ini satu-satunya halaman di repo yang masih sinkron; ikuti pola `(dashboard)/transactions/page.tsx:20`.

### Kriteria selesai

- [x] Banner "Stock Opname Besar berhasil dibuat" muncul setelah redirect dari `/new?success=1`.
- [x] `pnpm typecheck` hijau.

---

## SO2 — Role guard halaman pending SO ✅ SELESAI (1.75.3)

**Prioritas:** **Tinggi** · **Effort:** S · **Depends:** —

Gap dari Stage 5 2026-06-11: filter cabang MANAGER terpasang, role guard tidak. Akibatnya
KASIR/GUDANG/FINANCE bisa membuka halaman dan melihat SO pending **semua cabang**.

### Scope teknis

- `apps/backoffice/app/(dashboard)/inventory/stock-opname/page.tsx:27`: tolak role di luar
  `['OWNER','GM','MANAGER']`. **Implementasi final:** panel "Akses Ditolak" (bukan redirect seperti
  draft awal) — mengikuti halaman persetujuan sejenis `(dashboard)/void-requests/page.tsx:17-28`.
- `page.tsx:36`: balik logikanya — filter cabang untuk **semua** role kecuali privileged
  (`['OWNER','GM']`), bukan hanya `MANAGER`. Pola: `isPrivileged` di `(dashboard)/transactions/page.tsx:21`.
- **Pertahankan status quo GM** (boleh lihat, belum tentu boleh approve) — jangan pre-empt K2.

### Kriteria selesai

- [x] KASIR/GUDANG/FINANCE ditolak, tidak melihat data SO cabang lain.
- [x] MANAGER hanya melihat SO cabangnya.
- [x] OWNER & GM tetap melihat semua cabang.

---

## SO3 — Entri sidebar Stock Opname di-gate per role ✅ SELESAI (1.75.3)

**Prioritas:** Sedang · **Effort:** S · **Depends:** SO2

### Scope teknis

- `apps/backoffice/app/(dashboard)/_components/sidebar.tsx:94`: tambah
  `roles: ['OWNER', 'GM', 'MANAGER']` — mekanismenya sudah ada dan dipakai
  "Persetujuan Void" (`sidebar.tsx:82`). Harus sinkron dengan guard SO2.

### Kriteria selesai

- [x] Menu Stock Opname tidak muncul untuk role di luar daftar (filter di `sidebar.tsx:306-307`;
      grup kosong ikut disembunyikan).
- [x] Daftar role identik dengan guard SO2.

---

## SO4 — Isi `completedAt` saat approve ✅ SELESAI (1.75.3)

**Prioritas:** Rendah · **Effort:** S · **Depends:** —

### Scope teknis

- `apps/backoffice/app/api/bo/stock-opnames/[id]/approve/route.ts:99-106`: `completedAt: new Date()`
  bersama `approvedAt`. Kolomnya ada (`packages/db/src/schema/stock_opnames.ts:29`) tapi tidak pernah terisi.
- Cek apakah `reject` juga seharusnya mengisi `completedAt` — kemungkinan tidak (SO tidak selesai, ditolak).

### Kriteria selesai

- [x] SO yang di-approve punya `completedAt` terisi (memakai timestamp yang sama dengan `approvedAt`).
- [x] `reject` **tidak** mengisi `completedAt` — SO ditolak bukan SO selesai.

---

## SO5 — Approve: petakan "stok tidak cukup" jadi 422 + nama produk ✅ SELESAI (1.75.3)

**Prioritas:** **Tinggi** · **Effort:** S–M · **Depends:** —

Skenario nyata saat toko buka: variance `−10` (barang hilang), lalu customer memborong sampai stok
tinggal 3. Approve memanggil `StockService.deductStock` tanpa `allowNegative` (default `false`,
`apps/backoffice/lib/services/stock-service.ts:170`) → throw `Stok tidak cukup. Dibutuhkan X, tersedia Y.`
(`packages/shared/src/utils/fifo-costing.ts:64`). Error itu tidak dipetakan di
`approve/route.ts:110-127` → approver hanya dapat **500 "Terjadi kesalahan"** tanpa tahu produk mana,
dan SO tersangkut `PENDING` selamanya.

### Scope teknis

- `approve/route.ts:70-97`: ambil nama produk (join `products`) di query item.
- Bungkus tiap `applySOStockAdjustment` dengan try/catch, lempar ulang error bertag yang membawa
  nama produk + pesan asli. **Jangan** pakai string-matching sebagai mekanisme kontrol alur.
- Handler: error stok kurang → **422** dengan nama produk; error lain → tetap 500 (log nama produk).
- **Atomicity dipertahankan** (all-or-nothing) — hanya pesannya yang diperbaiki. Ubah ini hanya jika
  ada keputusan eksplisit.

### Cara membedakan tanpa string-matching (implementasi final)

Tidak ada preseden di repo (string `Stok tidak cukup` hanya dipakai di test `fifo-costing.test.ts:68`).
Data terstruktur ternyata sudah tersedia di sumbernya: `fifoDeduct` mengembalikan `shortfallQty`
(`packages/shared/src/utils/fifo-costing.ts:63`) tapi `deductStock` membuangnya jadi `Error` generik.
Solusi: `deductStock` melempar `InsufficientStockError` (`lib/services/stock-service.ts`) yang membawa
`productId` + `shortfallQty`; route memakai `instanceof`. `message` dipertahankan identik sehingga
pemanggil lain (jalur penjualan POS dkk.) tidak berubah perilaku. Aman karena `success: false` di
`fifoDeduct` **hanya** punya satu asal — jalur `qtyToDeduct <= 0` mengembalikan `success: true`.

### Kriteria selesai

- [x] Approve dengan stok kurang → 422, pesan menyebut nama produk + butuh/tersedia.
- [x] Semua item lain tetap ikut rollback (tidak ada mutasi separuh jalan).
- [x] Bug non-stok tetap 500 (tidak tersamar jadi 422).
- [x] Test untuk jalur 422 — `app/api/bo/stock-opnames/[id]/approve/route.test.ts` (baru; route ini
      sebelumnya tanpa test sama sekali) + test `InsufficientStockError` di `stock-service.test.ts`.

---

## SO6 — `systemQty` di-snapshot saat menghitung, bukan saat submit ⭐ INTI ✅ SELESAI (1.76.0)

**Prioritas:** **Tinggi** · **Effort:** L · **Depends:** K1, disarankan setelah SO5

Akar Lubang 1. `systemQty` dihitung saat submit
(`apps/backoffice/app/api/pos/stock-opnames/[id]/add-items/route.ts:110`), sementara POS hanya
mengirim `physicalQty`. Urutan yang merusak:

1. Kasir hitung rak: 100. 2. Customer beli 5 → stok sistem 95, rak fisik 95.
3. Kasir submit `physicalQty:100` → server baca `systemQty:95` → variance **+5**.
4. Approve tambah +5 → stok 100, padahal rak 95. **Selisih hantu.**

Errornya selalu memihak kelebihan stok dan membesar seiring lamanya jeda hitung→submit — fatal untuk
SO Besar yang makan berjam-jam.

### Keputusan K1 — rekonstruksi DITOLAK setelah investigasi, dipakai snapshot server

Rencana awal (dan jawaban pertama K1) adalah **rekonstruksi di server**:
`systemQtyAtCount = qtySekarang + terjual sejak countedAt`, memakai ulang union di
`app/api/bo/inventory/stock-logs/route.ts`. **Ini dibatalkan** — union tersebut adalah ledger
**tampilan**, bukan ledger akuntansi, dan aritmetika di atasnya salah:

- **Void merusak saldo.** Transaksi `VOIDED` hanya menghasilkan **satu** baris `+qty` di
  `t.created_at` (`stock-logs/route.ts:100-101`) — baris `−qty` aslinya tidak ada. Penjualan yang
  di-void ter-net `+qty`, padahal kenyataannya nol.
- **Barang rusak tidak ada sama sekali** di union, padahal `api/pos/damaged-goods/route.ts:84`
  memanggil `StockService.deductStock` (stok berkurang tanpa jejak).
- **Timestamp transfer hanya perkiraan** — `TRANSFER_OUT` & `TRANSFER_IN` sama-sama memakai
  `ibt.updated_at`.

Rekonstruksi jadi salah secara halus tepat pada kasus yang paling sulit ditelusuri — kebalikan dari
tujuan SO6. Lihat SO13 untuk bug ledger-nya sendiri.

**Yang dipakai: snapshot bertanda tangan server.** Server membaca `systemQty` miliknya sendiri saat
kasir menghitung, menstempel `countedAt` dari jam server, menandatanganinya, dan klien mengirimkannya
balik saat submit. Tetap server-authoritative (maksud asli K1), tapi **tanpa rekonstruksi sejarah
sama sekali** — kebal dari ketidaklengkapan ledger, void, dan barang rusak.

Konteks lapangan yang mengunci pilihan ini (dikonfirmasi 2026-07-16): kasir **menghitung sambil jalan
sambil input**, sehingga jendela "isi qty → snapshot" hanya hitungan detik; dan barang rusak/transfer
**biasanya dilakukan setelah SO** — tapi "biasanya" bukan "tidak pernah", jadi pendekatan yang kebal
lebih dipilih daripada yang perlu mendeteksi pengecualian.

### Implementasi final

- `lib/so-count-snapshot.ts` — sign/verify + `resolveSnapshotQty` (mengikat token ke cabang+produk+UOM).
  Ditandatangani **kunci turunan** dari `JWT_SECRET`, bukan `JWT_SECRET` langsung: `verifyAccessToken`
  (`lib/auth.ts:32-34`) menerima JWT apa pun bertanda tangan `JWT_SECRET` dan meng-cast-nya jadi
  `JWTPayload` **tanpa memeriksa bentuk**, jadi kunci yang sama akan membuat token snapshot bisa
  dipakai sebagai access token di route yang hanya mengecek `!payload`.
- `app/api/pos/stock-opname/count-snapshot/route.ts` — endpoint snapshot.
- Klien POS: snapshot di-debounce 600ms tiap jumlah/UOM berubah; Review diblokir bila ada baris tanpa
  snapshot siap.

### Kriteria selesai

- [x] Penjualan antara hitung dan submit **tidak** lagi memunculkan variance palsu — test
      "memakai systemQty dari snapshot, bukan stok saat submit" (`add-items/route.test.ts`).
- [x] Penjualan **setelah** submit tetap aman — delta-at-approve tidak diubah.
- [x] Angka stok tidak bersumber dari klien (server yang membaca, menstempel, dan menandatangani).
- [x] Mutasi non-penjualan tidak lagi relevan: tidak ada rekonstruksi, jadi tidak ada yang bisa
      terlewat diam-diam.
- [x] Token tidak bisa dipakai lintas produk/UOM/cabang, tidak bisa dipalsukan, dan tidak bisa
      dipakai sebagai access token (`lib/so-count-snapshot.test.ts`, 9 test).

---

## SO7 — Preview & submit memakai basis `systemQty` yang sama ✅ SELESAI (1.76.0)

**Prioritas:** **Tinggi** · **Effort:** S (jika menyusul SO6) · **Depends:** SO6

`/api/pos/stock-opname/preview` dan `add-items` masing-masing menghitung `systemQty` sendiri
(klien memanggil preview di `stock-opname-client.tsx:231`, lalu submit terpisah). Kalau ada penjualan
di antara dua langkah, **angka variance yang dilihat kasir di layar review bukan angka yang tersimpan.**

### Implementasi final

Akar masalahnya ternyata lebih dalam dari dugaan: `add-items` **menyalin sendiri** seluruh logika
perhitungan selisih secara inline, padahal `lib/services/stock-opname.ts` sudah punya
`computeItemVariance` yang dipakai preview & submit harian — dua implementasi paralel yang wajib
berbeda hasil begitu stok bergerak. Salinan inline dihapus; ketiga jalur kini memakai
`computeItemVariance` yang sama, dan basisnya sama-sama `systemQtyOverride` dari token snapshot SO6.

### Kriteria selesai

- [x] Variance di layar review == variance tersimpan, walau ada penjualan di antaranya (keduanya
      memakai token snapshot yang sama, bukan stok saat request).
- [x] Tidak ada lagi dua implementasi perhitungan selisih.

---

## SO8 — `varianceCostValue` konsisten dengan HPP yang benar-benar dipotong

**Prioritas:** Rendah · **Effort:** M · **Depends:** SO6

`varianceCostValue` dihitung dari batch FIFO **saat submit** (`add-items/route.ts:116-146`). Kalau ada
penjualan sesudahnya, batch bergeser, sehingga nilai rupiah selisih di laporan bisa tidak sama dengan
HPP yang dipotong saat approve. **Hanya memengaruhi laporan, bukan angka stok** — karena itu prioritas rendah.

### Kriteria selesai

- [ ] Nilai rupiah variance di laporan konsisten dengan mutasi HPP saat approve, atau
      perbedaannya didokumentasikan sebagai keputusan sadar.

---

## SO9 — Anomali GM (butuh K2)

**Prioritas:** Sedang · **Effort:** S · **Depends:** K2

GM diperlakukan berbeda di tiga tempat yang saling bertabrakan:

| Tempat | GM boleh? |
|---|---|
| `POST /api/bo/stock-opnames` (`route.ts:9`) | Ya |
| Halaman `/new` (`new/page.tsx:31`) | Tidak — redirect |
| Approve & reject (`approve/route.ts:10`, `reject/route.ts:9`) | Tidak — 403 |

Menyimpang dari konvensi CLAUDE.md (`ALLOWED_MUTATE_ROLES = ['OWNER','GM']`). GM juga melihat daftar
pending beserta tombol yang pasti 403.

**Anomali ini sudah tercatat** di backlog RBAC ([[2026-07-08-rbac-permission-plumbing]] item R2) dan
dijadwalkan diputuskan saat migrasi domain stock-opname (R6, urutan #4). **Jangan diperbaiki ad hoc**
— koordinasikan ke sana supaya tidak dua kali kerja dan tidak bentrok dengan seed `role_permissions`.

### Kriteria selesai

- [ ] K2 terjawab dan ketiga tempat konsisten (atau sengaja dibiarkan, terdokumentasi).
- [ ] Tombol approve/tolak tidak tampil untuk role yang pasti ditolak API.

---

## SO10 — SO baru langsung `PENDING` dengan 0 item (butuh K3)

**Prioritas:** Sedang · **Effort:** M–L · **Depends:** K3

`POST` membuat SO dengan `status:'PENDING'` (`api/bo/stock-opnames/route.ts:80`) padahal itemnya baru
diisi belakangan lewat POS. Schema hanya punya `PENDING/APPROVED/REJECTED`
(`packages/db/src/schema/stock_opnames.ts:16`). Jadi SO Besar yang baru dibuat langsung nangkring di
tabel persetujuan tertulis "0 item", dan kalau ditekan Setujui pasti gagal `SO_HAS_NO_ITEMS` (400).
Approver tidak bisa membedakan "belum dihitung di POS" dari "siap disetujui".

### Scope teknis (jika K3 = tambah status)

- Tambah `DRAFT`/`IN_PROGRESS` ke schema + migrasi; sesuaikan guard `status !== 'PENDING'` di
  `add-items/route.ts:77`, `approve`, `reject`, dan cek `PENDING_EXISTS` di `route.ts:66-74`.
- Backfill SO lama yang `PENDING` tanpa item.

### Kriteria selesai

- [ ] Daftar persetujuan hanya berisi SO yang benar-benar siap disetujui.
- [ ] SO lama ter-backfill; tidak ada SO yang tersangkut status invalid.

---

## SO11 — `/pending` & `/history` tak terpakai; halaman riwayat SO belum ada

**Prioritas:** Rendah · **Effort:** M · **Depends:** —

`GET /api/bo/stock-opnames/pending` dan `/history` lengkap dengan test, tapi **tidak dipanggil kode
klien mana pun** — halaman list justru query langsung ke DB. `/pending` bahkan menduplikasi query
`page.tsx` dengan daftar role berbeda (`pending/route.ts:8` = `['OWNER','MANAGER']`), jadi berpotensi
jadi sumber kebenaran kedua yang menyimpang.

Perlu diputuskan: buat halaman Riwayat SO yang memakai `/history`, atau hapus route yang tak terpakai.
Kalau SO2 mengubah aturan role, **jangan lupa `pending/route.ts` ikut** selama ia masih ada.

### Kriteria selesai

- [ ] Tidak ada route stock opname yang tak terpakai, atau semuanya punya konsumen jelas.
- [ ] Tidak ada dua sumber kebenaran untuk aturan role yang sama.

---

## SO12 — `generateSONumber()` rawan tabrakan

**Prioritas:** Rendah · **Effort:** S · **Depends:** —

`api/bo/stock-opnames/route.ts:18-22` memakai 6 digit acak pada kolom `unique`
(`stock_opnames.ts:11`). Tabrakan muncul sebagai **500**, bukan retry — user diminta mencoba lagi
tanpa penjelasan. Pertimbangkan sequence harian per cabang atau retry pada unique violation.

### Kriteria selesai

- [ ] Tabrakan nomor SO tidak pernah tampil sebagai 500 ke user.

---

## SO13 — Halaman Mutasi Stok salah: void ter-net `+qty`, barang rusak tak tercatat 🆕

**Prioritas:** Sedang · **Effort:** M–L · **Depends:** —

Ditemukan saat menyelidiki SO6. **Bukan bug stock opname** — ini bug di halaman Mutasi Stok
(`/inventory/stock-logs`), dicatat di sini karena inilah alasan rekonstruksi ditolak di K1.

- **Void merusak saldo.** `app/api/bo/inventory/stock-logs/route.ts:100-101`: transaksi `VOIDED`
  hanya menghasilkan **satu** baris `+qty` di `t.created_at` — baris `−qty` penjualan aslinya tidak
  pernah muncul. Di layar, penjualan yang di-void tampak seolah **menambah** stok, dan penjualan
  aslinya hilang dari riwayat. Timestamp-nya juga jam penjualan, bukan jam void.
- **Barang rusak sama sekali tidak ada di union**, padahal `api/pos/damaged-goods/route.ts:84`
  memanggil `StockService.deductStock`. Stok berkurang tanpa jejak di Mutasi Stok.
- **Timestamp transfer perkiraan** — `TRANSFER_OUT` & `TRANSFER_IN` sama-sama `ibt.updated_at`,
  jadi jam kirim dan jam terima tampak identik.

Perbaikan sebenarnya = **tabel ledger mutasi stok** yang ditulis setiap jalur tulis stok (jual, void,
PO, transfer, retur, rusak, opname, break). Itu proyek tersendiri; kalau nanti ada, rekonstruksi jadi
eksak dan SO6 boleh disederhanakan (snapshot tidak lagi wajib). Sampai saat itu, **jangan ada fitur
baru yang berhitung di atas union `stock-logs`.**

### Kriteria selesai

- [ ] Penjualan yang di-void tampil sebagai pasangan `−qty` (saat jual) + `+qty` (saat void), bukan
      `+qty` tunggal.
- [ ] Barang rusak muncul di Mutasi Stok.
- [ ] Jumlah saldo mutasi cocok dengan `productStocks.qty` untuk sampel produk.

---

## Catatan lintas-item

- Semua pesan error/label/komentar **Bahasa Indonesia**.
- **Wajib** update `apps/backoffice/CHANGELOG.md` per perubahan (aturan CLAUDE.md). SO1–SO5 = `Fixed`.
- Angka/harga tetap `big.js`, disimpan **integer** — semua field SO sudah integer
  (`stock_opnames.ts:37-40`).
- SO2/SO3/SO9 bersinggungan dengan [[2026-07-08-rbac-permission-plumbing]]: SO2 & SO3 menutup
  kebocoran **sekarang** memakai konstanta role, dan nanti dimigrasikan ke `requirePermission` +
  `scopeFilter` di R6. SO9 sepenuhnya diserahkan ke sana.
- Pendahulu: `docs/superpowers/specs/2026-06-11-backoffice-stock-opname-hardening-design.md`
  (branch & aktor tepercaya). Backlog ini melanjutkan ke **konsistensi angka stok**.
