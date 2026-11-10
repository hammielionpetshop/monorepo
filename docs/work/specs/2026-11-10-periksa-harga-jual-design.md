# Periksa Harga Jual saat Modal Naik + Larangan Jual di Bawah Modal

Status: **disetujui owner** (2026-11-10) — Tahap 1 (Bagian B) dikerjakan dulu

## Masalah

Barang masuk (PO, transfer internal, revisi harga internal, penyesuaian stok) hanya mengubah
**harga modal** cabang tujuan (`syncCostFromInbound`). **Harga jual tidak pernah ikut berubah**, sehingga
kasir bisa menjual di bawah modal tanpa tahu. Modal yang naik ≥ 30% ditahan di Tinjauan Modal, tapi hanya
Owner/GM yang melihatnya. Contoh di produksi: modal Toko Depan 3.750 → 5.000 (IBT-20261001-0003) masih
menunggu sejak 3 Okt 2026. Admin penerima tidak tahu modal naik maupun tertahan.

## Keputusan owner (2026-11-10)

1. Harga jual diperiksa **jajaran manajemen**, bukan admin penerima. Cabang yang diproses = cabang tujuan
   PO/transfer (pilihan cabang yang sudah ada).
2. **Semua** barang yang modalnya naik wajib diperiksa dan dilihat manajemen, berapa pun kenaikannya.
3. Usulan harga dibulatkan **ke 100**.
4. Kasir **ditolak** menjual di bawah modal, dengan pesan untuk menghubungi kantor.
5. Harga jual **baru berubah setelah manajemen menyetujui** (blokir, bukan pasang otomatis), supaya ada
   konfirmasi. Persetujuan langsung menulis harga ke **Manajemen Harga** tanpa input ulang.
6. **Promo resmi** boleh membuat harga di bawah modal. Diskon manual / ubah harga di kasir tidak boleh.
7. **Bulk Sale** tidak diblokir, tetapi wajib **dua kali konfirmasi** berturut-turut ("di bawah modal,
   yakin?" lalu peringatan kedua).

## Istilah

- **Modal** = `product_uom_costs.cost_price` cabang itu, per satuan. Satuan tanpa baris modal memakai
  modal satuan dasar × rasio (aturan `currentCostPerBase`/`buildTargetCosts`).
- **Harga bersih per satuan** di kasir = (subtotal baris sesudah diskon manual dan diskon nota yang dibagi
  ke baris) ÷ qty. Diskon promo resmi tidak dihitung.
- **Pemeriksaan Harga Jual** = satu baris per (cabang, produk) yang modalnya naik dan belum diputuskan.

## Bagian A — Pemeriksaan Harga Jual (Back Office)

### A1. Kapan dibuat
Setiap `syncCostFromInbound` yang menghasilkan modal per satuan dasar **lebih tinggi** dari modal lama,
baik `APPLIED` (< 30%) maupun `PENDING` (≥ 30%), membuat/memperbarui satu Pemeriksaan untuk
(cabang, produk). Sumber: penerimaan PO, faktur PO, terima transfer internal, revisi harga internal,
penyesuaian stok. Modal turun atau sama tidak membuat Pemeriksaan.

Bila (cabang, produk) masih punya Pemeriksaan terbuka, barang masuk berikutnya memperbarui baris yang
sama (modal baru terbaru, sumber ditambah), bukan membuat baris kedua.

### A2. Usulan harga
Untuk setiap harga jual cabang itu (`product_prices`: tiap satuan × jenis harga):

    usulan = bulatkan_ke_atas_100( harga_lama × modal_baru_satuan ÷ modal_lama_satuan )

Persentase untung lama tetap. Dihitung dengan `big.js`, disimpan integer. Bila modal lama kosong/0, usulan
= harga lama (tidak ada pembanding) dan baris ditandai "tanpa pembanding".

### A3. Layar manajemen
Menu **Master Data › Tinjauan Modal & Margin** mendapat tab baru **Harga Jual** (paling depan), hak
Owner/GM (hak baru `price.review`, diberikan ke OWNER dan GM). Badge menu menjumlah Pemeriksaan terbuka +
modal tertahan.

Per barang: cabang, sumber (no. PO/IBT + tanggal), modal lama → baru (%), lalu tabel per satuan × jenis
harga: harga lama, margin dengan modal baru (merah bila ≤ 0), usulan, isian **harga baru** (terisi usulan).

Aksi per barang:
- **Setujui** — menulis harga baru ke `product_prices` lewat `applyPriceBulk` (riwayat harga sumber
  `COST_REVIEW`, referensi no. dokumen). Bila modalnya masih `PENDING` (≥ 30%), modal ikut disetujui dalam
  transaksi yang sama (`approveCostReview`).
- **Tetap harga lama** — alasan wajib; ditolak bila ada harga lama di bawah modal baru.
- **Tolak modal** (hanya bila modal masih `PENDING`) — memakai `rejectCostReview`; Pemeriksaan ditutup
  karena modal tidak berubah.

Setujui banyak sekaligus: centang beberapa barang → Setujui usulan.

### A4. Tanda untuk admin penerima
- Form Terima Barang PO dan terima transfer internal: sesudah disimpan/disetujui, tampil
  "X barang modalnya naik — harga jual menunggu diperiksa manajemen". Teks peringatan "Harga beda jauh"
  (≥ 30%) ditambah: "modal baru ditahan sampai disetujui Owner/GM".
- Detail PO / detail transfer: baris "X harga jual menunggu pemeriksaan" (tautan ke tab Harga Jual untuk
  Owner/GM).

## Bagian B — Larangan jual di bawah modal

### B1. Kasir (POS)
Saat bayar, setiap baris barang (bukan jasa, bukan PO Internal) dicek: harga bersih per satuan < modal
satuan itu di cabang kasir → **nota ditolak**:

> "Harga {produk} di bawah modal. Hubungi kantor untuk memeriksa harga."

- Berlaku untuk harga tier, ubah harga (override), diskon manual baris, dan diskon nota.
- **Promo resmi** (`promo` pada baris) dikecualikan: harga sebelum diskon promo yang dibandingkan.
- Modal kosong/0 → tidak dicek.
- Pemeriksaan di server (`transaction-service`, dalam transaksi yang sama, membaca modal saat itu) dan di
  layar kasir sebelum ke layar bayar (supaya kasir langsung tahu baris mana). Server adalah penentu.
- Jalur `api/pos/sync/batch` (antrean POS desktop yang dibekukan) tidak ditolak, hanya dicatat audit
  `BELOW_COST_SALE` — transaksi itu sudah terjadi di toko.

### B2. Bulk Sale (Back Office)
Saat Simpan, bila ada baris dengan harga bersih < modal: **dua jendela konfirmasi berturut-turut**.
1. "N barang di bawah modal" + daftar (produk, harga, modal, rugi per satuan) → **Lanjutkan** / Periksa lagi.
2. Peringatan kedua dengan teks berbeda: "Penjualan ini RUGI Rp X. Yakin tetap simpan?" → **Ya, simpan rugi**.

Server menerima tanda `belowCostConfirmed: true`; tanpa tanda itu baris di bawah modal ditolak. Penjualan
yang dikonfirmasi dicatat audit `BELOW_COST_SALE` (pengguna, baris, rugi).

## Tahapan

1. **B — Larangan jual di bawah modal** (kasir + Bulk Sale). Paling cepat melindungi; tanpa migrasi.
2. **A — Pemeriksaan Harga Jual** (tabel `price_reviews`, migrasi petshop, hak `price.review`, tab baru,
   pengait di `syncCostFromInbound`, tanda di form terima & detail).

Tahap 1 dulu berarti barang yang modalnya naik akan **diblokir di kasir** sampai harga jual dinaikkan
manual di Manajemen Harga; Tahap 2 menyusul untuk membuat alur itu cepat.

## Teknis (ringkas)

- Tahap 2 tabel `petshop.price_reviews`: `id`, `branch_id`, `product_id`, `status` (`OPEN`/`APPROVED`/
  `KEPT`/`CLOSED`), `old_cost_per_base`, `new_cost_per_base`, `cost_sync_id` (terakhir), `sources` (jsonb
  daftar no. dokumen), `resolved_by_id`, `resolved_at`, `note`, `created_at`, `updated_at`; unik parsial
  satu `OPEN` per (cabang, produk). Usulan dihitung saat dibaca (tidak disimpan) supaya selalu mengikuti
  harga & modal terkini.
- Fungsi murni: `suggestSellPrice`, `netUnitPrice`, `findBelowCostLines` + tes unit; tes integrasi untuk
  persetujuan (harga tertulis, modal `PENDING` ikut disetujui) dan penolakan nota kasir.
- Uji UI dilakukan owner di staging.

## Di luar lingkup

- Harga jual cabang lain selain cabang tujuan (diatur manual di Manajemen Harga seperti sekarang).
- Diskon/bonus barang di faktur supplier (Tahap 2 PO, spec terpisah).
- Mengubah ambang 30% Tinjauan Modal.

## Keputusan lanjutan (2026-11-10)

- Urutan: Tahap 1 (Bagian B) dulu, Tahap 2 (Bagian A) menyusul — owner: "ok".
- Hak `price.review` hanya OWNER dan GM.
