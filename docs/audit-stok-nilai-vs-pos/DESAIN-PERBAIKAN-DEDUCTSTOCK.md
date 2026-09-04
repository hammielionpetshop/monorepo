# Desain perbaikan `deductStock` / oversell

**Dibuat:** 2026-09-04 · **Oleh:** Claude + cundus · **Status:** usul — belum implementasi
**Terkait:** `DIAGNOSTIK-HASIL.md`, memori [[project-stok-nilai-vs-pos-drift]]

---

## 1. Perilaku sekarang

### 1.1 Inti `deductStock` (`lib/services/stock-service.ts:186–339`)

```
qtyBase          = qtyToDeduct × ratio
result           = fifoDeduct(batches, qtyBase, allowNegative)
coveredQty       = qtyBase − result.shortfallQty
                   ← porsi yang benar-benar tertutup batch

// 3. potong batch  (baris 302–308)
for deduction in result.deductions:
    batch.qty_remaining −= deduction.qtyDeducted     // total = coveredQty

// 4. potong agregat (baris 326–335)
if existingAgg:  product_stocks.qty −= qtyBase        // ← SELURUH qty, termasuk shortfall
else:            insert product_stocks(qty = −qtyBase) // ← baris minus tanpa batch
```

**Cacat:** batch turun `coveredQty`, agregat turun `qtyBase`. Selisih `shortfallQty`
**tidak diimbangi apa pun** — `product_stocks.qty` melenceng dari `SUM(qty_remaining)` **permanen**,
searah, tiap oversell. Tidak ada baris kompensasi yang bisa dibalik. `fifoDeduct` sendiri benar
(lihat `packages/shared/src/utils/fifo-costing.ts`) — `shortfallQty` sudah dilaporkan; pemanggil
yang salah memakainya.

### 1.2 `fifoDeduct` — `allowNegative`

| `allowNegative` | stok < permintaan |
|---|---|
| `false` | `success:false`, `error`, `shortfallQty` diisi → `deductStock` lempar `InsufficientStockError` |
| `true` | semua batch dikuras, `shortfallQty` = sisa, `success:true` |

### 1.3 Matriks pemanggil

| Pemanggil | `allowNegative` | Blokir saat stok kurang? | Efek shortfall |
|---|---|---|---|
| **Penjualan POS** `transaction-service.ts:235` | **`true`** (hardcoded) | **Tidak pernah** — komentar baris 21: "Validasi stok TIDAK memblokir" | agregat minus diam-diam; audit `OVERSELL` (`authorizedOversell` cuma label — tak pernah menolak transaksi) |
| **Koreksi nota — qty naik / item baru** `transaction-edit-service.ts:380,425` | `true` | Tidak | idem |
| **Retur — batalkan penambahan** `retur-service.ts:728` | `false` (default) | Ya, `InsufficientStockError` | — (mestinya selalu tertutup) |
| **Reverse receiving PO** `purchase-orders/[id]/reverse-receiving:135` | `false` | Ya | — |
| **Barang rusak** `pos/damaged-goods:84` | `false` (eksplisit) | Ya | — |
| **IBT kirim** `internal-transfers/[id]/status:~420` | jalur FIFO sendiri (bukan `deductStock`) | **Ya secara default** (`throw STOK_PERLU_PECAH`); bypass PIN owner → `product_stocks.qty −= short` **tanpa batch** | audit `INTERNAL_TRANSFER_SHIP_STOCK_BYPASS` |
| Penyesuaian manual (−) `stock-adjustment.ts:48–94` | loop FIFO sendiri | Ya (`totalAvailable < absChange` → throw) | — |
| Approval Stock Opname `stock-adjustment.ts:197+` | set agregat = `targetAgg` absolut, batch dibangun ulang | n/a | konsisten by construction |

Kesimpulan: **hanya jalur jual + koreksi nota** yang membuat agregat melenceng. Nilainya besar
(`OVERSELL` −138.671 unit total, masih jalan; IBT bypass −34.456 unit, berhenti Agu).

---

## 2. Invarian sasaran

> Untuk tiap `(product_id, branch_id)`: `product_stocks.qty` (baris base UOM) **=**
> `SUM(product_stock_batches.qty_remaining)`.

Semua jalur masuk/keluar harus menjaga ini. `product_stocks.qty` berhenti jadi angka independen —
ia cache dari jumlah batch. Oversell = fakta di `transaction_items` + audit, **bukan** stok minus.

Konsekuensi: setelah perbaikan, `product_stocks.qty` tak pernah < 0 dari penjualan. "Seberapa dalam
kita oversell" jadi **laporan turunan** dari audit `OVERSELL` − restock berikutnya, bukan kolom.
(Toko retail: barang sudah keluar, tak ada konsep backorder — posisi jujur setelah oversell memang
"stok 0", bukan "−5".)

---

## 3. Usulan perubahan

### Fix A — integritas ledger di `deductStock` (WAJIB, netral kebijakan)

`stock-service.ts` bagian "4. Update aggregate":

```diff
- if (existingAgg) {
-   await tx.update(productStocks)
-     .set({ qty: sql`${productStocks.qty} - ${qtyBase}` })
-     .where(eq(productStocks.id, existingAgg.id))
- } else {
-   const [newStock] = await tx.insert(productStocks)
-     .values({ productId, branchId, uomId: baseUomId, qty: -qtyBase }).returning()
-   ...
- }
+ // Agregat HANYA turun sebesar yang tertutup batch. Porsi shortfall (oversell)
+ // tidak mengurangi stok — sudah tercermin di transaction_items + audit OVERSELL.
+ const coveredQty = qtyBase - (result.shortfallQty ?? 0)
+ if (coveredQty > 0) {
+   if (existingAgg) {
+     await tx.update(productStocks)
+       .set({ qty: sql`GREATEST(${productStocks.qty} - ${coveredQty}, 0)` })
+       .where(eq(productStocks.id, existingAgg.id))
+   } else {
+     const [newStock] = await tx.insert(productStocks)
+       .values({ productId, branchId, uomId: baseUomId, qty: 0 }).returning()
+     prefetched?.onStockCreated?.(newStock)
+   }
+ }
```

- `GREATEST(… , 0)` menutup drift lama supaya baris yang sudah minus tak makin dalam; setelah
  rekonsiliasi satu-kali (§5) klausa ini jadi tak pernah aktif tapi tetap dipertahankan sebagai jaring.
- HPP (`totalCogs`) **tidak berubah** — porsi oversell tetap dihargai via `resolveFallbackCostPerBase`
  (baris 279–300). Yang berubah hanya kolom qty agregat.
- Return value `deductStock` tetap sama (`shortfallQty` dst) → pemanggil tak perlu diubah.

### Fix B — gerbang oversell di penjualan (KEBIJAKAN — butuh owner)

Saat ini `transaction-service` **tak pernah** menolak. Pilihan:

| Opsi | Perilaku | Catatan |
|---|---|---|
| **B0** biarkan | jual tembus stok 0 tanpa syarat | status quo; agregat aman berkat Fix A, tapi stok fisik makin kacau tanpa jejak niat |
| **B1** wajib PIN | oversell perlu `authorizedOversell` (PIN supervisor/owner), seperti IBT kirim | konsisten lintas modul; `qtyShortBase` + siapa yang meng-approve masuk audit |
| **B2** blok keras | tak boleh jual > stok, titik | paling ketat; berisiko menghambat kasir kalau data stok belum bersih |

Rekomendasi: **B1**, tapi baru diaktifkan **setelah** rekonsiliasi data (§5) — mengaktifkan B1/B2
di atas stok yang masih salah = kasir kejebak terus.

### Fix C — IBT kirim bypass (`internal-transfers/[id]/status`)

Ganti `product_stocks.qty −= shortInBase` (tanpa batch) menjadi: **jangan sentuh agregat untuk
porsi short** (samakan dgn Fix A — batch sudah dikuras ke 0, agregat ikut 0). `shortInBase` cukup
tercatat di audit `INTERNAL_TRANSFER_SHIP_STOCK_BYPASS` yang sudah ada. Hapus cabang `insert
product_stocks(qty negatif)`.

### Fix D — hardening kecil

- `deductStock` & `addStock`: lookup `existingAgg` sebaiknya tak hanya `uomId = baseUomId` tapi
  "baris mana pun untuk (product,branch)" lalu normalkan `uom_id` ke base — mencegah baris non-base
  liar dari `applyManualStockAdjustment (+)` (Fase 4.2C). Data sekarang bersih (0 baris), jadi
  prioritas rendah; cukup 1 test regresi.

---

## 4. Arah strategis (follow-up, bukan sekarang)

Setelah Fix A+C, `product_stocks.qty` **selalu** = `SUM(batch.qty_remaining)`. Artinya kolom itu
redundan. Langkah lanjut yang menghapus seluruh kelas bug ini:

1. Jadikan stok base = `SUM(qty_remaining)` lewat **view** / kolom terkomputasi, `product_stocks`
   jadi read-model yang di-rebuild, bukan ditulis 12+ tempat.
2. Atau: satu fungsi `applyStockDelta(tx, product, branch, delta, reason)` sebagai **satu-satunya**
   penulis kedua tabel, semua jalur (7 masuk + keluar) lewat sana.

Perlu desain terpisah; menyentuh setiap pembaca stok (POS bootstrap, laporan, SO).

---

## 5. Urutan eksekusi

1. **Fix A + Fix C + test** → merge. Drift berhenti bertambah.
2. **Rekonsiliasi data satu-kali** (fase "A" di DIAGNOSTIK-HASIL §rekomendasi):
   `UPDATE product_stocks SET qty = COALESCE(batch_sum, 0)` per (product,branch), guarded, per cabang.
   - Gudang: batch (`+57.748`) yang dipakai; agregat `−54.672` dibuang. Perlu konfirmasi owner
     bahwa stok Gudang = nilai batch.
   - Toko: mayoritas pola 2 — perlu keputusan acuan per produk (lihat daftar di diagnostik).
3. **Fix B** (kebijakan oversell) — aktifkan setelah data bersih, sesuai keputusan owner.
4. Follow-up strategis §4 kalau disetujui.

---

## 6. Rencana test

`stock-service.test.ts`:
- `deductStock` stok cukup → agregat & `SUM(batch)` turun sama, `shortfallQty = 0`.
- `deductStock` `allowNegative=true`, batch < permintaan → batch → 0, **agregat → 0** (bukan minus),
  `shortfallQty` benar, `totalCogs` termasuk fallback porsi short.
- `deductStock` agregat sudah minus (data lama) + deduct → tetap `GREATEST(…,0)`, tak makin minus.
- `deductStock` tanpa baris agregat + `allowNegative=true` → insert `qty = 0`, bukan `−qtyBase`.
- `deductStock` `allowNegative=false`, stok kurang → `InsufficientStockError`, tak ada tulisan.
- invarian: rangkaian addStock → deductStock (oversell) → addStock, cek `qty == SUM(qty_remaining)` tiap langkah.

`internal-transfers/[id]/status/route.test.ts`:
- ship dengan bypass owner & stok kurang → batch → 0, agregat → 0, audit bypass tercatat,
  **tak ada baris `product_stocks` qty negatif**.

---

## 7. Keputusan yang dibutuhkan

1. **Fix B**: B0 / B1 (PIN) / B2 (blok keras)? — rekomendasi B1, aktif pasca-rekonsiliasi.
2. **Gudang**: konfirmasi stok Gudang = nilai batch (`SUM(qty_remaining)`), agregat `−54.672` dibuang?
3. **Acuan rekonsiliasi toko** untuk pola 2 (batch>0 & agg>0 beda): batch selalu menang, atau per-produk?
4. Kerjakan follow-up strategis §4 (hapus `product_stocks.qty` sebagai angka independen) atau cukup Fix A/C?
