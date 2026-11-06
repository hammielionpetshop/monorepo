# Spec — Bongkaran → Draft PO, Berat Satu Sumber (POS), Foto Surat Jalan ke PO

Tanggal: 2026-11-06 · Status: **disetujui owner 2026-11-06** ("ok", §9 butir 1–7 sesuai saran). Alur dan keputusan 1–6 + A/B sudah disetujui owner 2026-11-06 ("ok kerjakan sesuai saran").
Dasar: spec L8 Bongkaran (`2026-11-04-hris-l8-bongkaran-design.md`, lolos uji 4 Nov), PO Supplier backoffice (`app/api/bo/purchase-orders/**`, `lib/po-stage.ts`), pintu internal HRIS→backoffice (`app/api/internal/hris/*`, `lib/internal-gate.ts`, HRIS `modules/accounts/server/backoffice.ts`).
Aturan: HRIS tidak menulis tabel `petshop`; semua tulisan ke POS lewat pintu internal backoffice. Tanpa data ganda HRIS–POS (AGENTS.md).

**Masalahnya:** barang supplier kadang datang **sebelum PO dibuat**. Kepala Gudang sudah mengisi Laporan Bongkaran (barang + jumlah) di HRIS; kantor harus mengetik ulang barang yang sama di PO. Berat per satuan juga tersimpan dua kali (HRIS `unloading_unit_weights` kg, POS `weight_gram`).

---

## 1. Alur

**Laporan Baru bongkaran, langkah 1 — pilih asal barang:**

| Pilihan | Isi | Akibat di POS |
|---|---|---|
| **(a) Dari PO yang ada** | Pilih PO supplier itu yang sudah Disetujui / Dalam perjalanan / Diterima sebagian. Barang + jumlah PO terisi; Kepala Gudang mencocokkan jumlah yang benar-benar dibongkar. Beda ditandai **"Selisih dengan PO"** (DRV-39/106). Barang di luar PO boleh ditambah (tanda selisih) | PO ditautkan ke laporan; foto surat jalan masuk lampiran PO; form **Terima Barang** PO itu terisi jumlah dari bongkaran |
| **(b) Barang datang dulu** | Seperti L8 sekarang: pilih produk POS + satuan + jumlah; berat langsung muncul dari POS, bisa diubah (alasan) | Saat laporan Berlaku → **Draft PO otomatis** (status `DRAFT`, tab Rencana) + foto surat jalan sebagai lampiran |

**Kantor (esok hari), pilihan (b):** menu PO → tab Rencana → Draft "dari bongkaran LB-…" → periksa/ubah isi → isi harga (boleh kosong = Belum Ada Harga) → Setujui → Terima Barang (jumlah diterima terisi dari bongkaran) → stok masuk.

## 2. Keputusan owner (2026-11-06, sesuai saran)

1. Stok masuk **sesudah** kantor memeriksa (Draft tidak mengubah stok).
2. Pembuat PO = **akun kasir Kepala Gudang yang tertaut** (Akun & Tautan). Belum tertaut → laporan tetap tersimpan, Draft ditolak dengan pesan "Akun kasir belum tertaut — Draft PO tidak dibuat".
3. Laporan dikoreksi/dibatalkan: selama PO masih `DRAFT` → isi Draft ikut berubah / Draft batal; sesudah disetujui kantor → PO tidak diubah, diberi tanda **"Bongkaran berubah, periksa"**.
4. Kantor boleh mengubah isi Draft di POS. Upah bongkaran tidak ikut berubah.
5. Ubah berat di Master Produk POS tidak dicatat di riwayat HRIS.
6. Satu laporan = satu Draft PO (satu supplier).
A. "Tidak ada surat jalan" tetap ada; laporan tanpa surat jalan **tidak membuat Draft** sebelum Pemilik/GM menyetujui.
B. Foto surat jalan dikirim bersama Draft dan disimpan di POS sebagai lampiran PO.

**Berat satu sumber = POS** (`products.weight_gram` satuan dasar, `product_uom_conversions.weight_gram` satuan besar; gram bulat). HRIS membaca lewat view `hris.pos_product_units` (sudah ada); ubah berat di HRIS (alasan + riwayat `unloading_weight_changes` tetap) menulis ke POS lewat pintu internal. Laporan lama tidak berubah (berat disalin ke `unloading_items.weight_kg` saat simpan). kg HRIS 3 desimal = gram bulat, tidak ada pembulatan baru.

---

## 3. Bagian 1 — Backoffice/POS (dari `origin/main`, rilis produksi dulu)

### 3.1 Data (migrasi petshop **0054**)

| Tabel / kolom | Isi |
|---|---|
| `purchase_order_unloadings` (baru) | `po_id`, `hris_report_id`, `report_number`, `report_version`, `kind` (`DRAFT` = PO dibuat dari bongkaran / `MATCHED` = PO yang ada dicocokkan), `changed_after_approval_at` + `reviewed_at`/`reviewed_by_id`/`review_note` (tanda "Bongkaran berubah, periksa"), `created_at`. Unik (`hris_report_id`, `report_version`) = kunci idempoten |
| `purchase_order_items.qty_unloaded` (baru, int null) | jumlah dari bongkaran terakhir; dipakai mengisi form Terima Barang dan menampilkan selisih. Bukan stok |
| `purchase_order_attachments` (baru) | `po_id`, `url` (`/uploads/…`, pola foto bukti), `kind` `DELIVERY_NOTE`/`GOODS`, `source` `HRIS`, `hris_report_id`, `created_at`. Tidak dihapus |

### 3.2 Pintu internal (pola `provision`: `authorizeInternalRequest` + `Idempotency-Key` + sesi pelaku)

| Rute | Isi | Satu transaksi petshop |
|---|---|---|
| `POST /api/internal/hris/unloading-sync` (multipart: `data` JSON + foto) | `{reportId, number, version, mode: DRAFT\|MATCHED\|CANCEL, supplierId, poId?, items:[{productId, uomId, qty}], weights:[{productId, uomId, gram, expectedGram}]}` | berat → PO (buat Draft / ganti isi Draft / tautkan PO yang ada / batalkan Draft / tanda berubah) → lampiran → tautan |
| `POST /api/internal/hris/product-weights` | `{productId, uomId, gram, expectedGram}` — ubah berat dari layar Berat HRIS | ubah satu berat |

- **Pagar pelaku:** `authorizeInternalRequest` sekarang menolak selain Owner/GM. Dipecah: pagar layanan (host + kunci + sesi) tetap satu; pemeriksaan pelaku per rute. Rute bongkaran menerima akun kasir aktif yang punya hak baru **`po.unloading_sync`** (diberikan ke peran kasir Kepala Gudang + Owner/GM; §9 butir 3). Provisioning tetap Owner/GM.
- **`expectedGram`** = berat yang dilihat HRIS saat isian dibuat. Berbeda dengan nilai POS sekarang → ditolak "Berat [produk] baru saja diubah di POS (…→…), muat ulang" (mencegah saling timpa diam-diam).
- **Draft:** `status DRAFT`, `created_by_id` = akun kasir pelaku, `branch_id` = cabang kasir pelaku (§9 butir 4), `unit_cost` = 0, `qty_ordered = qty_unloaded` = jumlah bongkaran, `notes` "Dari bongkaran LB-…". Barang lain (tanpa produk POS) tidak masuk Draft; catatan PO menyebutkannya.
- **Koreksi laporan** (versi baru): PO `DRAFT` → isi diganti dengan isi versi baru (harga yang sudah diisi kantor untuk produk+satuan yang sama dipertahankan); PO sudah lewat Draft → isi tidak diubah, `qty_unloaded` tidak diubah, `changed_after_approval_at` diisi. **Batal laporan** → Draft `CANCELLED` (catatan "Laporan bongkaran dibatalkan"); sudah lewat Draft → tanda saja.
- **MATCHED:** PO harus milik supplier yang sama dan berstatus `APPROVED` / `IN_TRANSIT` / `PARTIALLY_RECEIVED`; `qty_unloaded` diisi per baris PO yang cocok; isi PO tidak diubah.
- Jawaban: `{poId, poNumber, status}`; kiriman ulang dengan kunci sama → jawaban yang sama.

### 3.3 Layar backoffice

| Layar | Perubahan |
|---|---|
| Daftar PO, tab Rencana | Draft tampil dengan label **Draft · dari bongkaran LB-…**; tanda **Bongkaran berubah, periksa** di semua tab |
| Rincian PO `DRAFT` | **Ubah isi**: tambah/hapus barang, ubah jumlah & harga (rute baru `PUT /api/bo/purchase-orders/[id]/items`, hanya `DRAFT`, hak `po.manage`); **Lampiran** (galeri foto surat jalan); tombol **Setujui** (hak `po.approve`, ambang Rp5 juta Owner tetap) dan **Batalkan** |
| Rincian PO bertautan bongkaran | Kotak "Bongkaran LB-… (versi n)": jumlah bongkaran vs PO per baris, selisih; tombol **Sudah diperiksa** (catatan) untuk tanda berubah |
| Terima Barang | Jumlah diterima terisi dari `qty_unloaded` bila ada (tetap bisa diubah), keterangan "dari bongkaran LB-…" |
| Persetujuan PO | `approve` dan `reject` hanya dari `DRAFT`/`PENDING_APPROVAL` (sekarang tidak memeriksa status) |

Tanda **Baru** di `lib/new-features.ts` untuk kotak bongkaran & lampiran; fragment `changelog.d`.

### 3.4 Tes (non-UI)

Rute `unloading-sync`: buat Draft; kirim ulang kunci sama = jawaban sama; koreksi saat Draft ganti isi + harga dipertahankan; koreksi sesudah disetujui → tanda saja; batal; MATCHED supplier beda ditolak; `expectedGram` beda ditolak; pelaku tanpa hak ditolak. `PUT items` hanya `DRAFT`. `approve` dari status lain ditolak.

---

## 4. Bagian 2 — HRIS (dari `origin/dev_hris`, ke staging)

### 4.1 Data (migrasi hris **0053**)

| Tabel / kolom | Isi |
|---|---|
| `unloading_reports` + | `source` (`PO` / `ARRIVED_FIRST`), `po_id`, `po_number`, `po_sync_status` (`NONE` Barang lain saja / `WAITING_APPROVAL` tanpa surat jalan / `PENDING` / `SYNCED` / `FAILED`), `po_sync_error`, `po_synced_version`, `draft_approved_by_account_id` + `draft_approved_at` |
| `unloading_items` + | `po_item_id`, `po_qty` (jumlah di PO saat dicocokkan; selisih = jumlah − po_qty) |
| view `hris.pos_purchase_orders`, `hris.pos_purchase_order_items` | PO supplier yang bisa dicocokkan (status §3.2 MATCHED) + barisnya — baca saja |
| `unloading_unit_weights` | **tidak dipakai lagi** (dibiarkan, tidak dihapus — pemicu `reject_change`); berat dibaca dari `hris.pos_product_units.weight_gram` |

### 4.2 Aturan

- **Jumlah bulat** untuk barang produk POS di pilihan (a) dan (b) (PO memakai jumlah bulat). Barang lain tetap kg diketik.
- Berat: ada di POS → dipakai; kosong → wajib diisi (tersimpan ke POS); diubah → alasan ≥ 15 huruf + riwayat HRIS + tanda > 10% seperti L8.
- **Urutan simpan:** (1) transaksi HRIS menyimpan laporan seperti L8 dengan `po_sync_status = PENDING` (atau `WAITING_APPROVAL` / `NONE`); (2) sesudah commit, panggil `unloading-sync` dengan sesi pembuat. Gagal (backoffice mati, akun belum tertaut, berat bentrok) → `FAILED` + pesan; laporan & upah **tetap berlaku**. Tombol **Kirim ulang ke POS** di Rincian (Kepala Gudang, Pemilik, GM) dengan kunci yang sama. Riwayat berat ditulis sesudah POS menerima.
- **Tanpa surat jalan:** `WAITING_APPROVAL`; Pemilik/GM menekan **Setujui buat Draft PO** di Rincian (bukan pembuat) → kirim. Kartu Beranda Pemilik/GM "Bongkaran tanpa surat jalan menunggu Draft PO".
- **Koreksi / Batalkan** (L8b) → kirim versi baru / `CANCEL` dengan cara yang sama.
- Pilihan (a): Rincian menampilkan "Selisih dengan PO" per baris; tanda laporan **Selisih dengan PO**.

### 4.3 Layar HRIS

| Layar | Perubahan |
|---|---|
| Laporan Baru | Langkah 1 pilih asal (a)/(b); (a) daftar PO supplier → barang terisi, isian jumlah dibongkar, selisih ditandai; (b) seperti sekarang, berat dari POS |
| Rincian | Kotak **PO**: nomor + status sinkron (Draft dibuat / gagal + pesan / menunggu persetujuan), **Kirim ulang ke POS**, **Setujui buat Draft PO** |
| Berat per Satuan | Membaca berat POS; Ubah berat → pintu internal, riwayat tetap; berat yang diubah di Master Produk tampil tanpa riwayat (keputusan 5) |

Fragment `apps/hris/changelog.d` + `<NewBadge>` untuk pilihan asal dan kotak PO.

### 4.4 Tes

Unit: selisih dengan PO, jumlah bulat. Integrasi (stub pintu internal): simpan → `PENDING` → sinkron sukses `SYNCED`; gagal → `FAILED`, laporan tetap Berlaku; kirim ulang; tanpa surat jalan menunggu persetujuan; koreksi mengirim versi baru; berat dibaca dari view POS.

---

## 5. Berat lama HRIS

HRIS **belum tayang produksi**, jadi di produksi tidak ada berat HRIS untuk dipindah. Di staging: sekali, sesudah Bagian 1 tayang staging, berat `unloading_unit_weights` disalin ke POS staging **hanya bila berat POS kosong**; yang berbeda didaftar ke owner (§9 butir 2). Tidak ada migrasi produksi.

## 6. Urutan kerja

1. Spec ini ok owner → klaim `docs/claim-unloading-draft-po` (path §3 + §4, kunci **petshop 0054** dan **hris 0053**), push staging.
2. `feat/po-unloading-draft` dari `origin/main` (Bagian 1) → merge lokal staging.
3. `feat/hris-unloading-po` dari `origin/dev_hris` (Bagian 2) → merge dev_hris → staging. Push staging sekali untuk 2+3.
4. Uji owner di staging (alur a, b, tanpa surat jalan, koreksi, gagal kirim). Lolos → PR rilis Bagian 1 ke main (backup prarilis). Bagian 2 ikut rilis HRIS.

---

## 9. Butir baru yang perlu ok owner

| # | Pertanyaan | Saran |
|---|---|---|
| 1 | PO memakai jumlah bulat; bongkaran sekarang boleh 3 desimal | Barang produk POS di bongkaran **wajib bulat**; Barang lain tetap kg |
| 2 | Berat HRIS staging berbeda dengan berat POS | Salin hanya yang POS kosong; yang beda saya daftarkan ke owner untuk dipilih |
| 3 | Siapa yang boleh membuat Draft / mengubah berat lewat pintu internal | Hak baru `po.unloading_sync` untuk peran kasir Kepala Gudang + Owner/GM (hak kasir lain tidak bertambah) |
| 4 | Draft PO masuk cabang mana | Cabang akun kasir Kepala Gudang (Gudang) |
| 5 | Pilihan (a) PO yang ada: form Terima Barang ikut terisi dari bongkaran? | **Ya**, sama seperti Draft (tetap bisa diubah) |
| 6 | Gagal kirim ke POS | Laporan & upah tetap jalan; status "Gagal kirim ke POS" + tombol Kirim ulang (tanpa mesin coba otomatis) |
| 7 | Persetujuan PO sekarang tidak memeriksa status (PO dari status apa pun bisa "disetujui") | Sekalian dibatasi: hanya dari Draft / Menunggu persetujuan |
