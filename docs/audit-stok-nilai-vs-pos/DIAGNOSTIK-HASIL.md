# Diagnostik — Nilai Stok vs Stok POS tidak pernah sejajar

**Dijalankan:** 2026-09-04 · **Oleh:** Claude + cundus · **Sifat:** read-only DB produksi
**Query:** `D01_batch_vs_agg.sql`, `D02_pola.sql`, `D03_ibt_bypass_gudang.sql`,
`D04_gudang_asal_batch.sql`, `D05_oversell.sql` (+ `.out.txt`)

Dua menu membaca sumber berbeda:

| Menu | Sumber | Turun saat jual? |
|---|---|---|
| **Laporan Nilai Stok** (`getStockValuationReport`) | `SUM(product_stock_batches.qty_remaining)`, filter `> 0` | FIFO hanya potong sebanyak yang **tertutup batch**; tak pernah < 0 |
| **Stok di POS / master** | `product_stocks.qty` (satu baris per product+branch, selalu base UOM) | dipotong **penuh** `qtyBase`, bebas minus |

---

## Temuan utama

### 1. Selisihnya 100% satu arah: Nilai Stok ≥ Stok POS

Dari **1.781** pasangan (produk × cabang): **1.007 selisih (57%)**, dan **semuanya** ke arah
`batch_qty > agg_qty`. **Nol** kasus sebaliknya. Persis gejala yang dilaporkan.

| Cabang | pasangan | selisih | agg minus | net gap (unit) |
|---|--:|--:|--:|--:|
| Gudang | 425 | 282 | 187 | +112.420 |
| Toko Pusat | 754 | 391 | 39 | +23.298 |
| Toko Depan | 596 | 329 | 23 | +6.952 |
| HQ | 6 | 5 | 0 | +8 |
| Toko Raja / Gudang / Markas (id 5–7) | 0 | — | — | kosong |

Estimasi nilai rupiah selisih (arah Nilai-Stok-lebih): **± Rp 1,40 miliar**
— **Rp 1,12 M (80%) ada di Gudang**.

### 2. Tiga pola penyebab

| Pola | Arti | Σ pasangan | Nilai est. | Sebaran |
|---|---|--:|--:|---|
| **3 — utang oversell murni** (`batch=0`, `agg` minus) | dijual / dikeluarkan tanpa batch masuk pernah tercatat | 222 | **~Rp 1,06 M** | Gudang 176 · Pusat 27 · Depan 19 |
| **2 — dua-duanya positif tapi beda** | agregat & batch sama-sama > 0, angkanya tak sinkron | 632 | **~Rp 279 jt** | Pusat 306 · Depan 238 · Gudang 87 |
| **1 — agregat tak pernah dinaikkan** (`batch>0`, `agg ≤ 0`) | batch ditambah (impor / SO / PO) tapi `product_stocks` tak ikut naik | 153 | **~Rp 65 jt** | Depan 72 · Pusat 58 · Gudang 19 |

### 3. Gudang bukan toko jual — ini sumber 80% angka

`n_trx = 415`, **IBT keluar = 159, IBT masuk = 1**, 343 batch, 187 produk agregat minus
(total −105.022 unit). Barang **keluar** Gudang (ke toko) tercatat sebagai pengurang stok;
barang **masuk** ke Gudang nyaris tak pernah dicatat. Ini kelanjutan
`project-stok-produksi-rusak` — bukan bug baru, tapi memperbesar semua agregat lintas cabang.

### 4. Di dua toko nyata

| | pasangan | selisih | Nilai Stok batch | selisih (Nilai-Stok-lebih) | % tak didukung POS |
|---|--:|--:|--:|--:|--:|
| Toko Pusat | 754 | 391 | Rp 464 jt | ~Rp 213 jt | **46%** |
| Toko Depan | 596 | 329 | Rp 120 jt | ~Rp 67 jt | **56%** |

Mayoritas pola 2. 46 (Pusat) / 68 (Depan) produk malah `batch > 0` sementara `agg = 0` persis.
Agregat minus di toko kecil saja (Pusat −2.393, Depan −66).

---

## Akar penyebab (kode)

1. **`deductStock` memisahkan dua ledger di tiap oversell** —
   `lib/services/stock-service.ts:302–332`. `qty_remaining` batch tak bisa turun di bawah 0
   (FIFO hanya potong yang ada); `product_stocks.qty` dipotong **penuh** `qtyBase` dan bebas minus.
   Tiap penjualan melebihi stok tercatat **memperlebar `batch − agg` secara permanen**. Ini mesin
   utama drift satu-arah.
2. **Stok masuk yang tak menyentuh agregat** — impor massal 2026-08-23 (lihat audit HPP Fase 4)
   & batch "Stok awal" Juli tampaknya di-`INSERT` langsung ke `product_stock_batches` tanpa lewat
   `addStock`, jadi `product_stocks` tak pernah dapat kreditnya. Agregat mulai dari lubang, batch tidak.
3. **Gudang tak pernah mencatat penerimaan** — 159 IBT keluar / 1 masuk. ~Rp 1,06 M headline.
4. **Tak ada titik rekonvergensi rutin** — satu-satunya yang menyamakan `batch` ↔ `agg` adalah
   `applySOStockAdjustment` (approval Stock Opname), yang menarget `aggBefore + variance` lalu
   membangun ulang batch. Di luar SO penuh, tak ada.
5. **Tak ada UI** untuk melihat batch FIFO per produk atau merekonsiliasi `batch ↔ agregat`
   tanpa SO penuh.

## Hipotesis yang gugur

- ❌ Baris agregat ber-UOM non-base (dugaan Fase 4.2C): **0 baris** di produksi `uom_id <> base_uom_id`.
- ❌ Batch tanpa baris `product_stocks` pasangannya: **0**.
- ❌ Arah sebaliknya (POS > Nilai Stok): **0 kasus**.

---

---

## Verifikasi 2026-09-04 — dari mana lubang agregat Gudang (−54.672)?

`D03`–`D05`. Semua 7 jalur stok-masuk sudah dipetakan (lihat memori
[[project-stok-nilai-vs-pos-drift]]). Yang menulis agregat **minus tanpa batch**:

### Rekonstruksi lubang Gudang

Gudang **tak pernah punya PO** (0 item PO). Seluruh stoknya masuk lewat **satu bulk-load
via approval Stock Opname 23–26 Juli 2026** (330 `STOCK_OPNAME_ADJUSTMENT`, ~108rb unit) —
`applySOStockAdjustment` menyamakan batch = agregat saat itu. Sejak itu:

| Komponen | Unit | Sentuh batch? |
|---|--:|---|
| `batch_received` total | +113.029 | — |
| `batch_consumed` (jual/IBT/rusak yang tertutup batch) | −55.281 | ✅ simetris |
| **`OVERSELL` — jual melebihi batch** (audit `action='OVERSELL'`) | **−92.615** | ❌ agregat saja |
| **IBT-kirim bypass owner** (`INTERNAL_TRANSFER_SHIP_STOCK_BYPASS`) | **−17.228** | ❌ agregat saja |
| Penyesuaian manual (net) | +5.184 | ✅ |
| **Agregat sekarang** | **−54.672** | (model ≈ −46.911, sisa ~8rb = rusak/void/pembulatan) |
| Batch sisa sekarang | +57.748 | |

### Verdict hipotesis IBT-bypass: **BENAR sebagian — tapi sekunder (~14%)**

- IBT-bypass Gudang: **61 kejadian, −17.228 unit**, 2026-07-06 → **2026-08-18 (berhenti)**.
  Hanya 88 dari 187 produk agg-minus yang punya jejak bypass; 99 tak ada sama sekali.
  Per-produk kecil (BOLT DRY IKAN FRESPACK agg −7.625, bypass cuma −1.575).
- **Pendorong utama = `OVERSELL` (~74%).** `deductStock` mengurangi `product_stocks.qty`
  sebesar qty penuh saat batch tak cukup; batch mentok di 0. Tiap oversell melebarkan
  `agg − batch` permanen.

### `OVERSELL` sistemik & masih berjalan

`D05`: **12.426 baris item oversell** sepanjang riwayat, total **−138.671 unit base**.

| Cabang | baris | short base |
|---|--:|--:|
| Gudang | 1.604 | −92.615 |
| Toko Pusat | 9.147 | −43.303 |
| Toko Depan | 1.669 | −2.744 |

- Per bulan: 2026-07 −42.259 · 2026-08 −89.784 · **2026-09 (berjalan) −6.628**.
- **0 dari 6.264 audit `authorizedOversell = true`.** POS meloloskan semua penjualan
  melebihi stok tanpa PIN; agregat jadi minus diam-diam. Ini bukan sisa migrasi — masih terjadi.

### Konsekuensi untuk rencana perbaikan

1. Perbaikan kode `deductStock` **wajib**: oversell harus diblok atau minimal butuh
   otorisasi + tak boleh membuat agregat melenceng dari batch tanpa jejak yang bisa dibalik.
2. Rekonsiliasi data: untuk **Gudang**, batch (`+57.748`, Rp 522 jt) lebih dipercaya
   daripada agregat (`−54.672`) — agregat Gudang praktis sampah. Untuk **toko**,
   mayoritas pola 2 (dua-duanya > 0) perlu keputusan acuan per produk.
3. IBT-kirim bypass: hentikan pola "insert `product_stocks` qty negatif tanpa batch" —
   entah blok, entah buat batch koreksi negatif yang bisa dilacak.

---

## Rekomendasi langkah berikut

**A. Perbaikan data (sekali jalan).** Rekonsiliasi `product_stocks.qty` ↔ `SUM(batch)` per
produk/cabang — putuskan mana yang jadi acuan (untuk toko: kemungkinan `SUM(batch)` untuk yang
pola 1 & agg=0; untuk Gudang: perlu keputusan owner apakah stok Gudang di-nol-kan / di-SO).
Pola 3 di toko (46 pasangan) kecil, bisa ikut.

**B. Perbaikan kode (cegah drift lagi).**
- `deductStock`: saat oversell (`shortfallQty > 0`) — entah blokir (tak boleh jual di bawah stok
  batch) atau catat "utang stok" eksplisit, jangan diam-diam bikin agregat minus lepas dari batch.
- Semua jalur stok-masuk **wajib** lewat `addStock` (yang menaikkan agregat), termasuk alat impor.
- Pertimbangkan menjadikan `SUM(batch)` sebagai sumber tunggal stok (buang `product_stocks.qty`
  sebagai angka independen, jadikan turunan) — perubahan besar, perlu desain.

**C. UI Kelola Stok.**
- View batch FIFO per produk+cabang: daftar batch (qty_received, qty_remaining, cost, received_at),
  bisa koreksi cost/qty batch dengan audit.
- View "stok sesungguhnya": bandingkan `SUM(batch)` vs `product_stocks.qty` vs hitungan fisik,
  dengan tombol rekonsiliasi per baris (pakai ulang mekanik `applySOStockAdjustment`).
- Indikator selisih di Laporan Nilai Stok.

**Belum diputuskan:** acuan rekonsiliasi per pola, nasib stok Gudang (owner), perilaku oversell
di `deductStock`, sejauh mana UI dibangun sekarang.
