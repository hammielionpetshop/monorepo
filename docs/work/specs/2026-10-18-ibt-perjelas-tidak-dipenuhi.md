# Spec: Perjelas "item tidak dipenuhi" di Transfer Internal (IBT)

**Tanggal:** 2026-10-18
**Pemohon:** Owner
**Status:** siap dikerjakan (belum mulai) — dirancang untuk dieksekusi **sekali jalan** di sesi baru.
**Kata kunci lanjut sesi:** `kerjakan IBT tidak dipenuhi`

---

## Masalah (kenapa dibuat)

Tim kantor salah paham pada kasus **IBT-20261015-0001** (Gudang → Toko Markas, diproses via Bulk Sale,
status akhir **FULLY_RECEIVED**). Dari 8 item, 2 item **tidak jadi dikirim** karena stok Gudang kosong:
`CRYSTAL KLG OCEANFISH` (req 1, ship 0, recv 0) dan `ORICAT KLG OF` (req 1, ship 0, recv 0).

Sudah diverifikasi ke nota penjualan (#28323): kedua produk **tidak ada** di nota → **stok Gudang memang
tidak pernah terpotong**, dan tidak ditagih (piutang internal hanya dari qty terima). **Datanya 100% benar.**

Yang keliru hanya **persepsi**, dipicu dua hal di tampilan:
1. Label status **"Diterima Penuh"** terbaca seolah semua yang *diminta* terpenuhi — padahal artinya hanya
   "semua yang *dikirim* sudah diterima". Item yang tak pernah dikirim ikut diam-diam ditutup.
2. 2 item itu tetap muncul di daftar item; tanda "Tidak diproses" kecil & tak menyebut stok → orang
   menyimpulkan sendiri "pasti sudah keluar dari gudang".

**Tujuan:** buat sistem *mengatakan* kebenaran yang sudah ada. **Tanpa** ubah skema/migrasi/logika
stok/penagihan. Murni kejelasan tampilan + satu tautan bukti.

---

## Aturan inti (dipakai di semua tempat)

Satu item dihitung **"diminta tapi tidak dikirim" (unfulfilled)** bila:

```
qtyRequested > 0  &&  qtyShipped === 0
```

dan **hanya bermakna** saat transfer sudah melewati tahap kirim, yaitu status ∈
`['IN_TRANSIT', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED']`.

Catatan:
- Item `qtyRequested === 0` = "tambahan di nota" → **bukan** unfulfilled.
- Item terkirim sebagian (`0 < qtyShipped < qtyRequested`) → stok *memang* berpindah sebagian →
  **bukan** unfulfilled; jangan kena pesan "stok tidak berpindah" (tetap pakai pewarnaan oranye yang ada).

---

## Perubahan per berkas

### 1. Helper murni + test (baru)

**`apps/backoffice/lib/ibt-fulfillment.ts`**
```ts
export const IBT_POST_SHIP_STATUSES = ['IN_TRANSIT', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'] as const

export interface FulfillmentItem {
  qtyRequested: number
  qtyShipped: number
}

/** Item diminta (>0) tapi tidak jadi dikirim (qtyShipped 0) — stok tak berpindah untuk item ini. */
export function isUnfulfilled(item: FulfillmentItem): boolean {
  return item.qtyRequested > 0 && item.qtyShipped === 0
}

/** Hanya bermakna setelah transfer melewati tahap kirim; selainnya 0. */
export function countUnfulfilled(items: FulfillmentItem[], status: string): number {
  if (!IBT_POST_SHIP_STATUSES.includes(status as (typeof IBT_POST_SHIP_STATUSES)[number])) return 0
  return items.filter(isUnfulfilled).length
}
```

**`apps/backoffice/lib/ibt-fulfillment.test.ts`** — Vitest. Kasus wajib:
- ship=0 & req>0 pada status FULLY_RECEIVED → dihitung 1.
- ship sebagian (req 2, ship 1) → tidak dihitung.
- req 0 (tambahan di nota) → tidak dihitung.
- status pra-kirim (APPROVED/PREPARING) walau ship=0 → **0** (belum waktunya).
- campuran banyak item → jumlah benar.

### 2. Detail transfer — `apps/backoffice/app/(dashboard)/purchase-orders/internal/[id]/_components/internal-transfer-detail-client.tsx`

Semua pure client (field `qtyRequested`, `qtyShipped`, `qtyReceived`, `productSku`, `bulkSaleQty` sudah ada).

a. Hitung di atas `return`:
```ts
import { countUnfulfilled, isUnfulfilled } from '@/lib/ibt-fulfillment'
import { NewBadge } from '@/components/ui/new-badge'
...
const unfulfilledItems = hasShipped ? transfer.items.filter(isUnfulfilled) : []
const unfulfilledCount = unfulfilledItems.length
```
(`hasShipped` sudah ada di komponen.)

b. **Sub-label status** — di baris header, tepat sesudah `{statusInfo.label}` badge:
```tsx
{unfulfilledCount > 0 && (
  <span className="text-xs text-muted-foreground">· {unfulfilledCount} item tidak dipenuhi</span>
)}
```

c. **Banner penegasan** — ganti isi banner `FULLY_RECEIVED` & `PARTIALLY_RECEIVED` (dua blok terpisah
di bawah "Actions"). Saat `unfulfilledCount > 0`, tampilkan kalimat + daftar + NewBadge:
```tsx
{unfulfilledCount > 0 && (
  <div className="mt-2 text-xs text-foreground/80">
    Sebanyak {unfulfilledCount} item yang diminta tidak jadi dikirim karena stok cabang pengirim
    kosong — stok kedua cabang <strong>tidak berubah</strong> untuk item ini, dan tidak ada yang
    ditagih: <NewBadge feature="fitur/ibt-tidak-dipenuhi" />
    <ul className="list-disc list-inside mt-1">
      {unfulfilledItems.map((i) => (
        <li key={i.id}>{i.productName ?? '-'} (diminta {i.qtyRequested} {i.uomCode ?? ''})</li>
      ))}
    </ul>
  </div>
)}
```
- Banner FULLY_RECEIVED: ubah kalimat utama jadi **"Transfer selesai. Semua barang yang dikirim sudah
  diterima penuh."** (hilangkan klaim "semua item ...").
- Banner PARTIALLY_RECEIVED: biarkan kalimatnya, tambahkan blok di atas bila ada unfulfilled.

d. **Chip baris item** — di sel Qty Kirim (sekitar baris `item.qtyShipped > 0 ? ... : isConvertedToBulkSale && (item.bulkSaleQty ?? 0) === 0 ? "Tidak diproses" : "-"`).
Ganti logikanya: untuk item `isUnfulfilled(item)` (berlaku IBT manual **maupun** bulk sale), tampilkan:
```tsx
<div className="flex flex-col items-end gap-0.5">
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
        title="Diminta tapi tidak jadi dikirim — stok cabang pengirim tidak berpindah untuk item ini">
    Tidak dikirim — stok tidak berpindah
  </span>
  <a href={stockLogsHref(item)} className="text-[11px] text-primary hover:underline">Lihat Mutasi Stok</a>
</div>
```
dengan helper lokal di komponen:
```ts
function stockLogsHref(item: TransferItem) {
  const params = new URLSearchParams()
  params.set('q', item.productSku || item.productName || '')
  params.set('branchId', String(transfer.sourceBranchId))
  // rentang: dari tanggal transfer s/d hari ini (WIB)
  const from = new Date(transfer.createdAt)
  params.set('from', new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(from))
  params.set('to', new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()))
  return `/inventory/stock-logs?${params.toString()}`
}
```
Chip ini hanya tampil pada status post-ship (karena pada pra-kirim `qtyShipped` memang masih 0 untuk semua —
jangan membuat alarm palsu). Gate dengan `hasShipped && isUnfulfilled(item)`; selain itu pakai render lama
(`qtyShipped > 0` → angka; else `-`).

### 3. Daftar transfer

**`apps/backoffice/app/(dashboard)/purchase-orders/internal/page.tsx`** — tambah field di `.select({...})`:
```ts
unfulfilledCount: sql<number>`(
  SELECT COUNT(*)::int FROM ${interBranchTransferItems} ii
  WHERE ii.transfer_id = ${interBranchTransfers.id}
    AND ii.qty_requested > 0 AND ii.qty_shipped = 0
)`,
```

**`apps/backoffice/app/(dashboard)/purchase-orders/internal/_components/types.ts`** — tambah ke
`InternalTransfer`: `unfulfilledCount: number`.

**`apps/backoffice/app/(dashboard)/purchase-orders/internal/_components/internal-transfer-list-client.tsx`**
— di sel kolom `status`, di bawah badge, saat post-ship & `unfulfilledCount > 0`:
```tsx
const POST_SHIP = ['IN_TRANSIT', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED']
...
{POST_SHIP.includes(row.original.status) && row.original.unfulfilledCount > 0 && (
  <div className="text-[11px] text-muted-foreground mt-0.5">
    {row.original.unfulfilledCount} item tidak dipenuhi
  </div>
)}
```

### 4. Mutasi Stok — baca parameter URL

**`apps/backoffice/app/(dashboard)/inventory/stock-logs/_components/stock-logs-client.tsx`**
- `import { useSearchParams } from 'next/navigation'`.
- Seed state awal dari URL: `q` ← `?q`, `branchId` ← `?branchId`, `from` ← `?from`, `to` ← `?to`
  (fallback ke `defaultFrom`/`defaultTo` bila kosong). Gunakan nilai URL sebagai initial `useState`.
- Pada mount, bila ada salah satu param URL, panggil `fetchData(...)` sekali dengan nilai itu
  (satu `useEffect([])`), supaya hasil langsung terfilter tanpa klik "Terapkan".
- **Caveat didokumentasikan:** filter `branchId` hanya berpengaruh untuk OWNER/GM (`isGlobal`); peran lain
  terkunci ke cabangnya sendiri di API — biarkan apa adanya, jangan paksa.
- (Opsional, kalau cepat) saat tabel kosong **dan** datang dari tautan IBT (mis. ada `?q` & `?branchId`),
  tampilkan satu kalimat di area kosong: "Tidak ada pergerakan stok untuk filter ini — inilah buktinya,
  stok item ini memang tidak bergerak." Boleh dilewati bila menambah kerumitan; tabel kosong sudah cukup.

### 5. Chore wajib (CLAUDE.md)

- **`apps/backoffice/lib/new-features.ts`** — tambah baris:
  `'fitur/ibt-tidak-dipenuhi': '<TANGGAL RILIS WIB saat merge, YYYY-MM-DD>',  // penegasan item tidak dipenuhi di Transfer Internal`
- **`apps/backoffice/changelog.d/feat-ibt-perjelas-tidak-dipenuhi.md`** — Bahasa Indonesia, tanpa heading versi:
  ```
  ### Changed
  - Transfer Internal: status "Diterima Penuh" kini disertai keterangan jumlah item yang diminta tapi tidak jadi dikirim, di daftar maupun detail.

  ### Added
  - Transfer Internal: baris penegasan di detail bahwa item yang tidak dikirim tidak memotong stok dan tidak ditagih, lengkap dengan tautan "Lihat Mutasi Stok" sebagai bukti.
  - Halaman Mutasi Stok kini bisa dibuka terfilter lewat parameter URL (produk, cabang, rentang tanggal).
  ```
- **`docs/glosarium-bisnis.md`** — tambah istilah **"item tidak dipenuhi"** dan klarifikasi: status
  **"Diterima Penuh"** = semua yang *dikirim* sudah diterima, **bukan** jaminan semua yang *diminta*
  terpenuhi; item yang stok pengirimnya kosong tidak dikirim, stok tidak berpindah, tidak ditagih.
- **`docs/work/WIP.md`** + **`docs/agents/claims.md`** — isi klaim di `main` sebelum branch; saat selesai,
  tulis **"tayang — menunggu uji coba owner"**, bukan "selesai".

---

## Yang TIDAK disentuh
- Skema DB, migrasi, logika stok/penagihan/ship/receive. **Tidak perlu kunci migrasi.**
- Jangan menghapus/menyembunyikan item ship=0 — jejak "diminta tapi stok kosong" tetap berguna.

## Verifikasi
```
pnpm typecheck
pnpm lint
pnpm test -- ibt-fulfillment          # + file terkait
pnpm changelog:check
```
Lalu jalankan backoffice (`pnpm dev:backoffice`), buka **IBT-20261015-0001** di salinan DB lokal
(lihat memori `db-akses-lokal`; refresh dulu bila perlu `node scripts/db-local-refresh.mjs`), cek:
daftar menampilkan "2 item tidak dipenuhi", detail menampilkan banner + chip + tautan, dan tautan
"Lihat Mutasi Stok" membuka halaman terfilter dengan tabel kosong untuk `CRYSTAL KLG OCEANFISH`.

## Eksekusi (urutan untuk sesi baru)
1. Baca spec ini + `CLAUDE.md`. Klaim di `docs/agents/claims.md` pada `main`.
2. `pnpm worktree:new feat/ibt-perjelas-tidak-dipenuhi` (folder pendek bila perlu `--dir C:\wt\ibt`).
3. Kerjakan berkas 1→5 sesuai urutan di atas.
4. Verifikasi (lihat atas). Perbaiki sampai hijau.
5. Commit (akhiri pesan dengan baris Co-Authored-By sesuai aturan sesi), update WIP + changelog, lepas klaim.
6. Laporkan ke owner: "tayang — menunggu uji coba owner" + ringkas apa yang berubah.
