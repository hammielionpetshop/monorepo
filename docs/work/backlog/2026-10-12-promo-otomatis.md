# Backlog — Promo Otomatis, Diskon per Barang & Laporan Diskon

**Status:** P0 ✅ · P1a ✅ · P1b ✅ · P1c ✅ · P1d bagian 1 ✅ · P1d bagian 2 ✅ · P1e ✅ · P1f ✅ · P1g ✅ — **P1 tayang 1.107.75 (2026-10-13), menunggu uji coba owner** · **P2 dimulai 2026-10-13 atas perintah owner**: P2a ✅ · P2b bagian 1 ✅ · P2b bagian 2 ✅ · P2c ✅ · P2d ✅ · P2e ✅ · P2f ✅ · P2g ✅ — **P2 tayang 1.107.78 (2026-10-15), menunggu uji coba owner** · **P3 dimulai 2026-10-18 atas perintah owner** (lingkup diperluas owner: kuota per cabang & syarat stok — lihat spec "Keputusan owner 2026-10-18"): P3a ✅ · P3b ✅ · P3c ✅ · berikutnya P3d (layar kasir)
**Tanggal:** 2026-10-12
**Sumber rencana:** [`docs/work/specs/2026-10-12-promo-otomatis-design.md`](../specs/2026-10-12-promo-otomatis-design.md)
**Istilah:** [`docs/glosarium-bisnis.md`](../../glosarium-bisnis.md)
**Scope:** `apps/backoffice` (POS web + Back Office) + `packages/db`

Satu item = satu branch = satu rilis. Tiap item mengikuti alur baku: `klaim: <branch>` di `main`
(+ **kunci migrasi** bila ada migrasi) → worktree → kode + tes → typecheck/lint/test/
`changelog:check`/`migrations:check` → lapor owner (bahasa sederhana + risiko) → **izin push per
item** → backup DB produksi → rilis → `klaim: lepas <branch>`. Status sesudah rilis: **"tayang —
menunggu uji coba owner"**.

**Setiap pertanyaan bisnis baru atau temuan yang bertentangan dengan spec/keputusan** dilaporkan ke
owner dan dicatat di spec/glosarium **sebelum** item itu dilanjutkan — tidak diputuskan sendiri.

## Urutan pengerjaan

```
P0 → P1a..g → P2a..g → P3a → P3b → P3c → P3d → P3e → P4 → P5          (promo di portal pesanan: dibahas terpisah)
                       (kuota & syarat stok)        (beli X gratis Y)  (grooming gratis)
```

---

## P0 — Dokumen

- [x] Spec promo otomatis
- [x] Backlog ini
- [x] Glosarium & daftar bahas diperbarui dengan keputusan owner 2026-10-12

## P1 — Diskon manual per barang, retur mengikuti nilai dibayar, Laporan Riwayat Diskon

**Migrasi:** ya (kunci migrasi) · **Risiko:** sedang–tinggi (layar bayar kasir, retur)

**Dipecah menjadi sesi kecil (permintaan owner 2026-10-12, supaya hemat):** satu sesi = satu butir
di bawah = satu branch bertumpuk di atas butir sebelumnya (pola RI/Jasa), **tanpa push per sesi**.
Tiap sesi ditutup dengan laporan + perintah clear chat. **Pertanyaan dan permintaan pandangan
owner tidak ditanyakan di tengah sesi** — dicatat di "Pertanyaan untuk sesi berikutnya" di bawah
dan ditanyakan di AWAL sesi berikutnya. Bila pertanyaannya menghalangi butir yang sedang
dikerjakan, butir itu berhenti di titik aman (commit) dan sesi ditutup.

### P1a — Tabel catatan potongan + mesin (tanpa perubahan perilaku)

**Branch:** `feat/diskon-per-barang-mesin` (di atas `docs/promo-rancangan`)

- [x] Klaim + kunci migrasi di `main` (2026-10-13, sesuai aturan dev — dikirim owner)
- [x] Migrasi `0043`: tabel `transaction_item_discounts` — catatan potongan per baris nota (jenis MANUAL/PROMO, nilai, alasan, salinan promo, pelaku, waktu)
- [x] Mesin diskon manual (`lib/manual-discount.ts`) + tes; batas diskon = tanpa batas (bawaan)
- [x] Mesin nilai bersih baris (`lib/line-net-value.ts`; satu rumus; nota lama berdiskon total dibagi sebanding) + tes; bonus groomer/pengantar memakai rumus yang sama (dipindah, hasil tidak berubah)

### P1b — Server menerima & memeriksa diskon per baris

**Branch:** `feat/diskon-per-barang-server` (di atas `feat/diskon-per-barang-mesin`) · tanpa migrasi

- [x] Simpan nota: diskon per baris diperiksa ulang oleh mesin, dicatat ke tabel catatan potongan
- [x] Layar lama (diskon total nota) masih diterima sampai P1d — tidak ada perubahan di kasir
- [x] Batal nota membalik seperti biasa — tes DB

### P1c — Retur mengikuti nilai yang benar-benar dibayar

**Branch:** `feat/diskon-per-barang-retur` (di atas `feat/diskon-per-barang-server`) · tanpa migrasi

- [x] Uang kembali retur memakai mesin nilai bersih baris (nota baru & nota lama)
- [x] Potong piutang, batal retur, laporan retur tetap cocok — tes DB
- [x] Layar retur Back Office: perkiraan uang kembali memakai rumus yang sama + keterangan "dibayar Rp … (sesudah diskon)"
- [x] Perbaikan ikutan: retur yang sudah dibatalkan tidak lagi dihitung "sudah diretur" oleh server (dulu layar bilang masih bisa diretur, server menolak)

### P1d — Layar kasir

Dipecah dua sesi (layar bayar & struk sama-sama besar): bagian 1 = keranjang + layar bayar + tab
Grooming; bagian 2 = struk.

**Bagian 1 — Branch:** `feat/diskon-per-barang-layar` (di atas `feat/diskon-per-barang-retur`) · tanpa migrasi

- [x] Keranjang: tombol Diskon per baris + popup wajib pilih (potongan per pcs / untuk barang itu, alasan)
- [x] Layar bayar: tombol "+ Diskon" total nota dihapus; tab Grooming memakai diskon per baris (tombol di tiap kucing pada daftar)
- [x] **Tidak bisa diskon ganda** (permintaan owner 2026-10-12): barang yang sudah didiskon tidak bisa didiskon lagi di langkah pembayaran — di layar tidak ada lagi tombolnya (kiriman layar selalu membawa diskon total nota 0), dan server sudah menolak sejak P1b ("Diskon per barang tidak bisa digabung dengan diskon total nota"); tes kiriman layar + tes DB (P1b)
- [x] Daftar tunggu membawa diskon per barang (tes); ongkir & keranjang PO Internal tanpa tombol diskon

**Bagian 2 — Branch:** `feat/diskon-per-barang-struk` (di atas `feat/diskon-per-barang-layar`) · tanpa migrasi

- [x] Struk cetak baru (printer kasir, cetak browser, gambar WhatsApp): potongan di bawah barangnya + "Anda hemat" (digabung dengan gratis ongkir; aturannya di satu mesin baru `lib/receipt-lines.ts`, dijaga `lib/ongkir-guard.test.ts` + tes penjaga di `lib/receipt-lines.test.ts`)
- [x] Cetak ulang dari Riwayat (kasir) & detail nota Back Office menampilkan hal yang sama (memakai penyusun struk yang sama; potongan baris sudah ikut terbaca dari nota)
- [x] Sesuaikan tanggal `fitur/diskon-per-barang` di `lib/new-features.ts` saat rilis

### P1e — Jalur lain tetap benar

**Branch:** `feat/diskon-per-barang-jalur-lain` (di atas `feat/diskon-per-barang-struk`) · tanpa migrasi

- [x] Koreksi nota: baris berdiskon per barang dikunci (seperti baris jasa); koreksi tidak bisa menambah diskon; cara tulis kepala nota dipertahankan — tes DB
- [x] Daftar tunggu: diskon ikut dipulihkan, potongannya dihitung ulang oleh mesin (isian tak sah dilepas) — tes
- [x] Settlement shift: "Total Diskon" (tutup shift, pratinjau, rekap estafet, Riwayat Shift Back Office) = diskon nota + diskon per barang — tes DB
- [x] Bonus groomer/pengantar: potongan di baris jasa menurunkan bonus, potongan di barang lain tidak — tes DB
- [x] Penjualan per Produk dan Laba Rugi tetap cocok (selisihnya hanya diskon total nota) — tes DB pembanding

### P1f — Laporan Riwayat Diskon

**Branch:** `feat/diskon-per-barang-laporan` (di atas `feat/diskon-per-barang-jalur-lain`) · tanpa migrasi · hanya membaca

- [x] Halaman laporan per produk → popup nota (kapan, kasir, cabang, alasan) + tanda "Baru" — Laporan → **Riwayat Diskon**
- [x] Nota lama tampil sebagai "diskon nota (tidak per barang)"
- [x] Potongan per barang di Penjualan Grosir (Bulk Sale) ikut tampil (keputusan owner butir 15)
- [x] Sesuaikan tanggal `/reports/discount-history` di `lib/new-features.ts` saat rilis

### P1g — Pemeriksaan menyeluruh

**Branch:** `feat/diskon-per-barang-periksa` (di atas `feat/diskon-per-barang-laporan`)

- [x] Semua cek + `next build` + uji asap halaman; laporan ke owner untuk uji laptop / keputusan rilis
- [x] Temuan uji asap diperbaiki: Riwayat Diskon gagal dibuka bila tanggal di alamat halaman bukan
      tanggal kalender (mis. bulan 13)
- [ ] **Belum:** owner melihat & mengklik sendiri di browser (keranjang kasir, popup diskon, struk di
      printer toko, retur nota berdiskon, Koreksi nota, Riwayat Diskon)

**Catatan di luar P1 — tayang 1.107.76 (2026-10-13, atas perintah owner "perbaiki hal kecil"),
menunggu uji coba owner:** Laporan Grooming & Bonus yang sudah tayang punya kelemahan yang sama — tanggal ngawur di
alamat halaman menampilkan pesan "Terjadi kesalahan". Hanya terjadi bila alamat halaman diketik
tangan; pemilih tanggal di layar selalu mengirim tanggal yang benar. Diperbaiki di branch
`fix/laporan-grooming-tanggal` (dari `main`; saringan tanggal memakai `isCalendarDay` yang sama
dengan Riwayat Diskon). Tanpa migrasi, hanya halaman laporan.

### Pertanyaan untuk sesi berikutnya

Empat pertanyaan lama (struk & Koreksi) **sudah dijawab owner 2026-10-13** — semuanya sama dengan
bawaan, tidak ada kode yang diubah (spec "Keputusan owner" butir 17–20).

Tidak ada pertanyaan terbuka. Yang terakhir:

1. ~~Siapa yang boleh membuka Laporan Riwayat Diskon?~~ **Dijawab owner 2026-10-13: hanya Owner
   dan GM.** Sudah diterapkan (halaman + menu).

## P2 — Mesin promo + layar Promo + potongan per barang / minimal pcs / flash sale

**Migrasi:** ya · **Risiko:** tinggi (harga di kasir) · **Dimulai 2026-10-13 atas perintah owner
("lanjut p2")**

Dipecah menjadi sesi kecil seperti P1: satu sesi = satu butir = satu branch bertumpuk di atas butir
sebelumnya, **tanpa push per sesi**, satu rilis di akhir (P2g) atas izin owner. Pertanyaan untuk
owner dicatat di "Pertanyaan untuk sesi berikutnya (P2)" dan ditanyakan di AWAL sesi berikutnya.
Sampai P2c tidak ada yang berubah di kasir; promo baru bisa mengenai nota sesudah P2c + P2d.

### P2a — Tabel promo + mesin promo (tanpa perubahan perilaku)

**Branch:** `feat/promo-mesin` (dari `main` 1.107.76)

- [x] Klaim + kunci migrasi (dicatat di branch; masuk main saat rilis)
- [x] Migrasi `0044`: tabel `promos`, `promo_branches`, `promo_conditions`, `promo_rewards`
- [x] Mesin promo (`lib/promo/promo-engine.ts`) + tes: satu barang satu promo, pilih termurah
      untuk pelanggan, kelipatan, maksimal per nota, hanya Retail, jam server (WIB), saklar darurat,
      nota PO Internal di luar promo
- [x] Pemeriksaan bentuk promo (`checkPromoRule`) — dipakai layar Promo & server di P2b

### P2b — Back Office: layar Promo + saklar darurat

**Branch:** `feat/promo-layar-bo` (di atas `feat/promo-mesin`) · tanpa migrasi (kecuali ternyata perlu)

Dipecah dua (keputusan Claude 2026-10-13, supaya satu sesi tetap kecil — pola P1d):

**Bagian 1 — server** (branch `feat/promo-layar-bo`)

- [x] Layanan + rute: daftar, buat, nonaktifkan promo (Owner/GM); tanpa edit/hapus — hanya
      dinonaktifkan (`lib/services/promo-service.ts`, `api/bo/promos`, `api/bo/promos/[id]/deactivate`)
- [x] Hanya bentuk P2 yang bisa dibuat (potongan per barang / mulai N pcs / beli A potong B / flash
      sale); barang tidak aktif, ongkos kirim, dan satuan yang bukan milik barangnya ditolak
- [x] Peringatan jual rugi di server: harga sesudah promo di bawah modal (per cabang, harga Retail)
      → ditolak (409 + daftar barangnya) sampai pembuat memilih "tetap buat"; pilihan itu berjejak
- [x] Saklar darurat "matikan semua promo": pengaturan + rute `api/bo/settings/promo-switch` (Owner/GM)

**Bagian 2 — layar** (branch yang sama `feat/promo-layar-bo` — klaimnya di `main` sudah mencakup layar Promo & saklar darurat, jadi tidak dibuat branch/klaim baru)

- [x] Layar Promo (Master Data → Promo + tanda "Baru"): daftar + keadaan, buat (hanya bentuk P2), nonaktifkan
- [x] Popup peringatan jual rugi (wajib pilih: batal / tetap buat)
- [x] Saklar darurat (Owner/GM) + tanda "Baru" — ditaruh di **atas halaman Promo**, bukan di menu Pengaturan (tidak ada halaman Pengaturan umum; owner ingin aksi penting di atas halaman)

### P2c — Server sebagai hakim

**Branch:** `feat/promo-server` (di atas `feat/promo-layar-bo`)

Klaim `feat/promo-server` di-commit ke `main` sebelum branch dibuat (2026-10-13; push ke server menunggu owner).

- [x] Simpan nota: server menghitung ulang promo dengan mesin, menolak bila berbeda dari layar,
      mencatat potongan `PROMO` + salinan aturan ke `transaction_item_discounts`
- [x] Baris promo tidak boleh membawa diskon manual; Penjualan Grosir & PO Internal di luar promo
- [x] Rute "promo yang sedang berlaku" untuk layar kasir (jam server) — tes DB

**Penting:** sejak P2c, selama ada promo berjalan, nota dari layar kasir yang belum mengirim promo
ditolak. Karena itu **P2c tidak boleh dirilis tanpa P2d** (satu rilis di akhir P2, sesuai rencana).

### P2d — Layar kasir ✅ (dikoding, belum tayang)

**Branch:** `feat/promo-layar-kasir` (di atas `feat/promo-server`)

- [x] Promo berlaku otomatis di keranjang; baris bertanda nama promo, tanpa tombol Diskon
- [x] Layar bayar memisahkan "Diskon manual" dan "Promo"; nota ditolak server → layar menghitung ulang
- [x] Daftar tunggu dihitung ulang saat dibuka / dibayar (promo tidak disimpan di nota tahan; dihitung ulang dari isi keranjang + promo terbaru)
- Catatan: struk & cetak ulang (nama promo + "Anda hemat") sengaja ditunda ke **P2e**; sampai P2 dirilis bersama, struk masih menampilkan subtotal sebelum promo.

### P2e — Struk + jalur lain

**Branch:** `feat/promo-struk-jalur-lain` (di atas `feat/promo-kasir`)

- [x] Struk (printer, cetak browser, gambar, cetak ulang): nama promo di bawah barangnya + "Anda hemat"
- [x] Koreksi nota mengunci baris promo; retur, "Total Diskon" shift, bonus groomer, Riwayat Diskon
      (jenis Promo) tetap benar — tes DB

### P2f — Laporan Promo

**Branch:** `feat/promo-laporan` (di atas `feat/promo-struk-jalur-lain`) · hanya membaca

- [x] Per promo: jumlah nota, qty, omzet, total potongan, laba; pembanding masa sebelum promo
- [x] Peringkat toko

### P2g — Pemeriksaan menyeluruh

- [x] Semua cek + `next build` + uji asap halaman; laporan ke owner untuk uji laptop / keputusan rilis

### Pertanyaan untuk sesi berikutnya (P2)

**Dijawab owner 2026-10-13 di awal sesi P2b — semuanya sesuai bawaan** (spec butir 21–23). Belum ada pertanyaan baru.

(Riwayat pertanyaan:)

1. **Satu barang, dua promo.** Sekarang satu barang hanya boleh ikut satu promo — baik sebagai
   barang syarat maupun barang yang dipotong. Contoh: "beli A, B lebih murah" dan "A dipotong"
   tidak bisa berlaku bersama untuk A yang sama; dipilih yang paling murah untuk pelanggan.
   Setuju? (bawaan: YA, satu barang satu promo dalam peran apa pun)
2. **Pelanggan Reseller / Grosir yang harganya jatuh ke harga Retail** (karena barang itu belum
   punya harga Reseller): tetap tidak kena promo? (bawaan: TIDAK kena — mengikuti golongan
   pelanggan, bukan harga barisnya)
3. **Siapa yang boleh membuat & mematikan promo:** cukup peran Owner dan GM (seperti Riwayat
   Diskon), tanpa izin baru yang bisa dibagi ke peran lain? (bawaan: Owner & GM saja)

## P3 — Kuota per cabang & syarat stok

**Migrasi:** ya (kunci migrasi) · **Risiko:** tinggi (P3c menyentuh jalur simpan nota + rebutan jatah)
· **Dimulai 2026-10-18 atas perintah owner.** Lingkup diperluas owner sebelum beli-X-gratis-Y: promo
bisa dibatasi **kuota per cabang** (pilih jatah pcs / jatah nota) dan **syarat stok** (promo berhenti
bila stok hadiah habis). Berlaku untuk **semua** bentuk promo (termasuk potongan & flash sale yang
sudah tayang). Keputusan lengkap: spec "Keputusan owner 2026-10-18". Bertumpuk seperti P2, satu
rilis di akhir (P3c menolak promo berjatah bila layar kasir lama → P3a–P3e wajib tayang bersama).

### P3a — Tabel + mesin (tanpa perubahan perilaku) ✅

**Branch:** `feat/promo-kuota-mesin` (dari `main`)

- [x] Klaim + kunci migrasi `0045` di `main`
- [x] Migrasi `0045`: kolom `quota_kind` / `quota_per_branch` / `require_stock` di `promos` + tabel `promo_branch_usage` (`used_pcs`, `used_notes` per promo × cabang)
- [x] Mesin promo (`promo-engine.ts`): `PromoRule` dapat `quotaKind`/`quotaPerBranch`/`requireStock`; `PromoContext` dapat `remainingQuota` + `stock`; `buildCandidate` memotong sebagian (kuota pcs), utuh/tidak sama sekali (kuota nota), dan melewati barang hadiah berstok 0 (syarat stok); `checkPromoRule` memvalidasi kuota. Masih murni, belum dipanggil.
- [x] Tes mesin (`promo-engine.test.ts`: +5 = 28); typecheck db + backoffice bersih; migrations/changelog check lulus

### P3b — Layar Promo: isi kuota & syarat stok ✅

**Branch:** `feat/promo-kuota-layar-bo` (di atas `feat/promo-kuota-mesin`) · tanpa migrasi

- [x] Form buat promo: kotak "Batas kuota & stok" (tanpa / jatah pcs / jatah nota) + jatah per cabang + centang "hanya bila stok ada"; `promo-form.ts` (`PromoFormState`/`PromoPayload`/`buildPromoPayload`/`describePromo`) + `newPromoSchema` + `createPromo` menyimpan `quota_kind`/`quota_per_branch`/`require_stock`; `NewBadge feature="fitur/promo-kuota"`
- [x] Daftar promo menampilkan sisa jatah per cabang (`listPromos` baca `promo_branch_usage` → `quotaUsage`; `promo-client.tsx` tampilkan "Sisa jatah: Cabang N remaining/jatah")
- [x] Tes `promo-form.test.ts` +3 (12 total); typecheck backoffice bersih; `changelog:check` lulus

### P3c — Server sebagai hakim (inti)

**Branch:** `feat/promo-kuota-server` (di atas `feat/promo-kuota-layar-bo`) · tanpa migrasi

- [x] `promo-sale-service.ts`: baca sisa jatah per promo + stok barang hadiah cabang → suplai ke mesin (`remainingQuota`, `stock`) lewat `loadPromoUsageContext`
- [x] Saat simpan nota: **kunci baris `promo_branch_usage`** (SELECT … FOR UPDATE, baris disisipkan dulu agar bisa dikunci), hitung ulang dengan sisa terbaru, beda dari layar → `PROMO_CHANGED`; lalu `recordPromoUsageInTx` menambah `used_pcs`/`used_notes` di transaksi yang sama. Judge dipindah KE DALAM `db.transaction` (sesudah `lockProductStocks`) supaya kuncinya tahan sampai commit.
- [x] **Batal nota kurangi pemakaian** (`reversePromoUsageInTx` di `void-service`, dari salinan aturan di `transaction_item_discounts`); **retur tidak** — tes DB termasuk rebutan dua kasir (satu lolos, satu ditolak, jatah tidak jebol)
- [x] `GET /api/pos/promos` mengirim `remainingQuota` + `stock` untuk layar

### P3d — Layar kasir

**Branch:** `feat/promo-kuota-layar-kasir` (di atas `feat/promo-kuota-server`) · tanpa migrasi

- [ ] Hitung promo di layar pakai sisa jatah & stok dari server; promo berhenti sendiri saat jatah/stok habis
- [ ] Nota ditolak (`PROMO_CHANGED`) → muat ulang & hitung ulang (seperti P2d)

### P3e — Jalur lain + Laporan + pemeriksaan menyeluruh

**Branch:** `feat/promo-kuota-jalur-lain` (di atas `feat/promo-kuota-layar-kasir`) · tanpa migrasi

- [ ] Laporan Promo menampilkan jatah terpakai / sisa per cabang
- [ ] Semua cek + `next build` + uji asap (di worktree path tanpa spasi agar `pnpm test` jalan penuh) → laporan ke owner untuk keputusan rilis

## P4 — Beli X gratis Y & bundling

**Risiko:** sedang

- [ ] Barang gratis otomatis masuk keranjang; ikut hilang bila syaratnya dihapus
- [ ] Bundling: potongan pada barang yang ditentukan owner
- [ ] Retur promo paket hanya satu paket utuh; koreksi nota mengunci baris promo

## P5 — Grooming gratis makanan pilihan

**Risiko:** sedang (tab Grooming)

- [ ] Hadiah berupa daftar pilihan → kasir memilih satu
- [ ] Bonus groomer tidak berubah (potongan jatuh di makanan, bukan di jasa) — tes

## Dibahas terpisah

- Isi aturan batas diskon kasir (mesinnya ada sejak P1)
- Daftar alasan diskon manual
- Promo "minimal belanja" untuk seluruh nota
- Promo di portal pesanan

## Catatan kerja (log)

| Tanggal | Tahap | Catatan |
|---|---|---|
| 2026-10-18 | P3c | **Server sebagai hakim kuota & stok.** Branch `feat/promo-kuota-server` (di atas `feat/promo-kuota-layar-bo`), tanpa migrasi. `promo-sale-service.ts`: `loadPromoUsageContext(executor, branchId, rules, {lock})` membaca sisa jatah per promo (`remainingQuota`) + stok barang hadiah (`stock`); dengan `lock` (saat simpan nota) baris `promo_branch_usage` disisipkan lalu dikunci `FOR UPDATE`. `judgeSalePromos` kini menerima `executor` dan **dipanggil DI DALAM `db.transaction`** (sesudah `lockProductStocks`) — kunci tahan sampai commit. `recordPromoUsageInTx` menambah `used_pcs` (sebanyak pcs hadiah kena promo) / `used_notes` (+1 per promo nota). `reversePromoUsageInTx` di `void-service` mengembalikan jatah saat **batal** (dari salinan aturan di `transaction_item_discounts`); **retur tidak** (owner 2026-10-18). `GET /api/pos/promos` ikut kirim `remainingQuota` + `stock` (dipakai layar di P3d). Reads sekuensial (bukan Promise.all) karena satu koneksi tx. Tes `promo-kuota.integration.test.ts` **6** (kuota pcs bertambah; jatah mepet potong sebagian & habis → berhenti; kuota nota 1/nota & habis; batal mengembalikan pcs & nota; rebutan dua kasir `Promise.allSettled` → 1 lolos 1 ditolak, jatah tidak jebol; syarat stok 0 → berhenti, ada stok → jalan). **Dijalankan sungguhan** di DB lokal `petshop_wt_kuota` (Docker, TEMPLATE petshop_db + 0045): suite integrasi penuh **28 berkas / 198 tes lulus**; typecheck backoffice 0; lint 0 galat (1 warning baseline `amountPaid`); `migrations:check` 0..45; `changelog:check` 3 potongan. Belum dibuka di browser; layar kasir (promo berhenti sendiri saat jatah/stok habis) = P3d. |
| 2026-10-18 | P3b | **Layar Promo isi kuota & syarat stok.** Branch `feat/promo-kuota-layar-bo` (di atas `feat/promo-kuota-mesin`), tanpa migrasi. Form buat promo dapat kotak **"Batas kuota & stok"**: pilih tanpa kuota / jatah pcs hadiah / jatah nota + isi jatah per cabang, dan centang "hanya tawarkan bila stok barang hadiah ada". `promo-form.ts` (`PromoFormState`/`PromoPayload`/`buildPromoPayload`/`describePromo` + `quotaStockLines`), `newPromoSchema` (`quotaKind`/`quotaPerBranch`/`requireStock`), `createPromo` menyimpan ketiganya, `loadPromoRules` & `listPromos` membacanya kembali. **Daftar promo** menampilkan sisa jatah per cabang (`listPromos` baca `promo_branch_usage` → `quotaUsage`; untuk sekarang semua masih penuh karena belum ada yang menambah pemakaian — itu tugas P3c). `NewBadge feature="fitur/promo-kuota"` (tanggal 2026-10-18 di `new-features.ts`, **samakan dengan tanggal rilis P3**). Tes `promo-form.test.ts` +3 (12 total) + `promo-engine.test.ts` 28 lulus; typecheck backoffice bersih (exit 0); `changelog:check` 2 potongan valid. Belum dibuka di browser. Tanpa perubahan perilaku kasir. |
| 2026-10-18 | P3a | Owner memerintahkan "lanjut p3" lalu meminta cek apakah promo bisa membatasi produk (mis. "hanya 25 pcs"). Hasil cek: **belum** — `max_per_note` hanya per nota, mesin promo murni tak membaca stok. Owner memutuskan menambah **kuota per cabang** (pilih jatah pcs / jatah nota; jatah mepet dipotong sebagian) + **syarat stok** (stok > 0 saja), jatah per cabang tidak dicampur, **batal balik / retur hangus**. Lingkup ini jadi **P3 baru** (beli-X-gratis-Y geser ke P4, grooming ke P5). Keputusan dicatat di spec + glosarium sebelum koding. **P3a:** migrasi `0045` (kolom kuota/stok di `promos` + `promo_branch_usage`) + mesin promo (`promo-engine.ts`) menerima `remainingQuota`/`stock` dan membatasi hitungan (`buildCandidate`), `checkPromoRule` validasi kuota. Masih murni, belum dipanggil. Tes `promo-engine.test.ts` +5 (28 total) lulus; typecheck db+backoffice bersih; `migrations:check` 0..45 & `changelog:check` lulus. **Catatan env:** `pnpm test` penuh tak bisa jalan dari folder utama berspasi (alias `@` vitest jadi `%20` → 223 tes `@/` gagal, termasuk file yang tak disentuh) — jalankan suite penuh di worktree path tanpa spasi (mis. `C:\wt\...`); P3a diverifikasi lewat typecheck penuh + tes mesin (impor relatif). Klaim + kunci migrasi `0045` di `main`. |
| 2026-10-15 | Rilis P2 | Owner memilih "Rilis P2 sekarang". Stack promo (base lama 1.107.76) **di-rebase ke `origin/main` 1.107.77** tanpa tabrakan; typecheck + 1499 tes unit + 192 tes DB lulus ulang sesudah rebase; migrasi 0..44. `klaim: lepas` (5 baris klaim promo di cabang + kunci migrasi 0044 → `—`, baris susulan rilis), tanggal new-features promo disesuaikan ke 2026-10-15, `changelog:release` → **1.107.78**. Migrasi `0044` (empat tabel promo) dijalankan pipeline. **P2a–P2g tayang bersama** (wajib, karena P2c menolak promo bila layar kasir lama). Status: **tayang — menunggu uji coba owner** (belum diklik di layar; promo baru berpengaruh setelah owner membuat promo pertama). |
| 2026-10-15 | P2g | **Pemeriksaan menyeluruh P2 (P2a–P2f).** Branch `feat/promo-periksa` dari `feat/promo-laporan`; klaim di `main` lokal. Hasil: `typecheck` lulus; `lint` 0 error / 51 warning (baseline); `pnpm test` **1499 tes unit (189 berkas) + 29 shared** lulus (tidak ada kegagalan, termasuk tes yang sebelumnya kadang timeout karena laptop sibuk); tes DB **192 tes (27 berkas)** lulus; `changelog:check` 6 potongan valid; `migrations:check` idx 0..44 rapi. `next build` **kompilasi sukses (2,2 menit, 44 halaman ter-generate)**, gagal hanya di langkah salin standalone (EPERM symlink Windows = wajar, `next start` tetap jalan). **Uji asap** `next start -p 7272` dengan token Owner uji lokal: 28 halaman (Laporan Promo `/reports/promo`, layar Promo `/promos`, Riwayat Diskon, kasir `/pos`, `api/bo/promos`, `api/pos/promos`, dll.) semua **HTTP 200** (hanya `/` 307 ke login = normal), log server 0 galat runtime. Tidak ada temuan yang perlu diperbaiki (berbeda dari P1g yang sempat menemukan bug tanggal). Belum ada migrasi baru. Sesudah ini: rilis P2 bersama atas izin owner. |
| 2026-10-15 | P2e | **Struk + jalur lain.** Struk kini menampilkan **nama promo** di bawah barang berpromo (menggantikan "Diskon") dan menghitungnya di "Anda hemat", untuk cetak pertama & cetak ulang. Mesin baris struk `lib/receipt-lines.ts` dapat label potongan (`discountLabel`); `lib/receipt-data.ts` melapisi potongan promo ke baris struk (`toReceiptItem(item, promo)`, `ReceiptSource.promos`); `escpos-receipt.ts` & `components/pos/receipt-print.tsx` meneruskan label. Cetak pertama (`checkout-modal.tsx`) mengirim potongan promo dari hasil hitung layar — **sekaligus memperbaiki** struk pertama yang dulu masih menampilkan harga sebelum promo (baris tidak menjumlah ke total). Cetak ulang membawa nama promo dari database lewat `lib/promo/promo-server.ts` (`promoNameOfItemSql`): Riwayat kasir (`history/page.tsx` + `transaction-history-client.tsx`) dan detail nota Back Office (rute `detail` + `transaction-detail-modal.tsx`, termasuk ekspor PNG). **Jalur lain** terbukti tetap benar lewat tes DB `promo-jalur-lain.integration.test.ts` (5): Riwayat Diskon menampilkan potongan sebagai jenis **Promo** dengan nama promonya; "Total Diskon" tutup shift ikut menghitung promo; Koreksi nota **mengunci** baris promo (`DISCOUNT_ITEM_LOCKED`) sementara baris lain tetap bisa dikoreksi; retur mengembalikan nilai **sesudah** promo; bonus groomer dihitung dari harga grooming sesudah promo. Semua ini jalan sendiri karena potongan promo tercatat di `transaction_item_discounts` yang sama dengan diskon manual (P2c) — tidak ada kode jalur lain yang perlu diubah. Tanpa migrasi. Tes unit: `receipt-lines.test.ts` +3 (label promo di baris, struk printer & cetak browser). Belum dibuka di browser. |
| 2026-10-15 | P2f | **Laporan Promo.** Halaman baru **Laporan → Laporan Promo** (Owner & GM), hanya membaca nota. Per promo: jumlah nota, qty barang terjual, omzet (nilai sesudah potongan), total potongan, dan **laba** (omzet − modal; modal memakai rumus yang sama dengan Laporan Laba Rugi). **Pembanding:** penjualan barang hadiah promo pada periode yang dipilih dibanding periode sama panjang **tepat sebelumnya** (naik/turun qty + persen). **Peringkat toko:** cabang diurutkan dari potongan promo terbesar. Nota yang dibatalkan tidak dihitung; Owner/GM lihat semua cabang + saringan cabang, peran lain hanya cabangnya. Berkas: `lib/promo/promo-report.ts` (penyusunan & hitungan murni), `lib/services/promo-report-service.ts` (pembacaan DB), `app/(dashboard)/reports/promo/**` (halaman + klien), menu sidebar Laporan + `new-features.ts` `/reports/promo`. Tanpa migrasi. Tes: `promo-report.test.ts` (5 murni) + `promo-report.integration.test.ts` (4 DB: agregat per promo, nota batal tak dihitung, peringkat & saringan cabang, pembanding sebelum/sesudah). Belum dibuka di browser. |
| 2026-10-13 | P2c | **Server sebagai hakim promo.** Pemeriksa murni `lib/promo/promo-judge.ts` (`judgePromos`: hitung ulang dengan mesin promo lalu bandingkan per baris; beda → `PROMO_CHANGED` 409 supaya layar menghitung ulang; baris promo + diskon manual, angka baris tak cocok, diskon total nota, total tak cocok → `PROMO_INVALID` 400). Pintu DB `lib/services/promo-sale-service.ts` (`judgeSalePromos` memakai jam server, saklar darurat, promo cabang, golongan pelanggan `customers.default_tier_type`, ongkir dikecualikan; `recordPromoDiscountInTx` mencatat `PROMO` + salinan aturan + jumlah pcs). Dipanggil `TransactionService` sebelum apa pun ditulis. Di luar promo: Penjualan Grosir (`saleType` BULK), PO Internal, pesanan portal, nota sinkron offline (`createdOffline`) — kiriman promo di nota itu ditolak. Diskon manual menganggap baris berpromo sebagai "sudah mendapat promo". Rute `POST /api/pos/transactions` menerima `items[].promo {promoId, amount}` dan membalas `{error, code}`; rute baru `GET /api/pos/promos` (promo aktif cabang yang belum berakhir + `serverNow` + saklar). `loadPromoRules` di promo-service. Tanpa migrasi. Tes: `promo-judge.test.ts` (10), `promo-sale.integration.test.ts` (7 tes DB). **Sejak P2c, promo berjalan + layar lama = nota ditolak → jangan rilis tanpa P2d.** Klaim di `main` dulu (sesuai aturan dev). |
| 2026-10-13 | P2a | Owner memerintahkan "lanjut p2 dan perbaiki hal kecil". **Hal kecil:** saringan tanggal Riwayat Grooming & Bonus (branch `fix/laporan-grooming-tanggal`, dari `main`). **P2 dipecah** P2a–P2g (lihat di atas). **P2a:** migrasi `0044` — empat tabel promo (`promos`, `promo_branches`, `promo_conditions`, `promo_rewards`; hanya menambah tabel, dijalankan di DB uji) dan **mesin promo** `lib/promo/promo-engine.ts` (hitungan murni, 20 tes): syarat + hadiah + batas; "satu kali pakai", kelipatan, maksimal per nota; hadiah sekian pcs per pakai atau semua pcs; potong per pcs / harga jadi; hanya Retail; cabang, masa berlaku, jam WIB (termasuk melewati tengah malam); satu barang satu promo dengan pemilihan gabungan termurah untuk pelanggan; saklar darurat & PO Internal = tanpa promo. Promo barang gratis (P3/P4) sengaja dilewati mesin sampai tahapnya. Belum ada kode yang memanggil mesin atau menulis ke tabel baru — kasir, struk, laporan tidak berubah. Tiga pertanyaan dicatat untuk awal sesi P2b (tidak menghalangi). |
| 2026-10-13 | Rilis P1 | Owner menjawab: Riwayat Diskon **hanya Owner & GM** (diterapkan di halaman + menu); P1 dirilis tanpa menunggu P2 dan **tanpa uji klik di layar** (keputusan owner sesudah diberi tahu batas pemeriksaan). Rilis **1.107.75** — satu rilis untuk P0 + P1a–P1g, migrasi `0043`. Status: **tayang — menunggu uji coba owner**. Yang harus diberitahukan ke kasir: diskon kini per barang (tombol diskon total nota hilang), dan retur nota berdiskon mengembalikan nilai yang benar-benar dibayar. |
| 2026-10-13 | P1g | Pemeriksaan menyeluruh P1a–P1f. Lulus: typecheck, lint (0 galat / 51 peringatan bawaan), 1.439 tes unit (183 berkas), 169 tes DB di salinan data toko, `changelog:check`, `migrations:check` (0..43), `next build` (hanya gagal di langkah salin standalone/EPERM Windows — wajar). Uji asap `next start` lokal dengan akun Owner uji: Riwayat Diskon (bulan ini, setahun, tiap jenis, cabang + cari, isian ngawur), Kasir, tab Grooming, Riwayat kasir, Shift, Retur (kasir & Back Office), Transaksi, Riwayat Shift, Penjualan per Produk, Laba Rugi, Laporan Grooming — semua terbuka, 0 galat di log; Tutup Shift dialihkan ke Kasir karena tidak ada shift terbuka (wajar); tanpa login dialihkan ke halaman masuk. Detail nota (diskon nota lama, diskon per barang, gratis ongkir) dan rincian shift dibaca lewat rutenya — angka cocok. **Satu temuan, diperbaiki:** Riwayat Diskon menampilkan "Terjadi kesalahan" bila tanggal di alamat halaman bukan tanggal kalender → `isCalendarDay` di `lib/discount-history.ts` (+2 tes), kembali ke bawaan bulan berjalan. Kelemahan yang sama ada di Laporan Grooming yang sudah tayang — dicatat, tidak disentuh. Belum: owner mengklik sendiri di browser. |
| 2026-10-12 | P1e | Jalur lain. **Koreksi nota:** baris yang punya catatan potongan dikunci (`DISCOUNT_ITEM_LOCKED`), koreksi tidak bisa menambah potongan (`DISCOUNT_NOT_ALLOWED`), dan cara tulis kepala nota dipertahankan lewat `noteHeaderDiscount` (`lib/line-net-value.ts`, dipakai server & layar Koreksi) — dulu koreksi mengubah kepala nota kasir ke cara Penjualan Grosir, dan pada nota "gratis ongkir + diskon total nota" diskon notanya hilang (tagihan naik diam-diam; bug lama, diperbaiki). **Tutup shift:** "Total Diskon" di lima tempat kini = diskon kepala nota + potongan per barang yang tercatat (`recordedLineDiscountByTransaction` / `shiftDiscountOf` di `line-discount-service`); tanpa ini diskon per barang tampil Rp 0. Gratis ongkir tetap tidak dihitung diskon; uang kas yang diharapkan tidak berubah (dari pembayaran). **Daftar tunggu:** `restoreCart` menghitung ulang potongan baris berdiskon. **Bonus & laporan:** tidak perlu diubah — dibuktikan dengan tes. Tes: `line-discount-paths.integration.test.ts` (6), +1 di `grooming-report`, tes mesin & keranjang. Cek: typecheck, lint 0/51, unit, 161 tes DB. Pertanyaan baru no. 4 (tidak menghalangi). |
| 2026-10-13 | P1f | Owner menjawab empat pertanyaan lama di awal sesi — semuanya sama dengan bawaan (alasan diskon tidak dicetak di struk; struk Penjualan Grosir tetap mencetak potongan per barang + "Anda hemat"; diskon total nota lama tidak dihitung di "Anda hemat"; barang berdiskon tetap dikunci di Koreksi) → dicatat di spec butir 17–20, tanpa perubahan kode. **Laporan Riwayat Diskon** (Laporan → Riwayat Diskon): daftar barang yang dipotong harganya (berapa kali, total, jenis, alasan), diklik → popup nota-notanya (kapan, nota, cabang, oleh siapa, qty × harga, potongan, alasan). Empat jenis dipisah: diskon kasir (beralasan), promo (mulai P2), potongan tanpa alasan (Penjualan Grosir / nota lama), dan diskon nota (tidak per barang). Nota batal, baris yang dikeluarkan lewat Koreksi, dan gratis ongkir tidak dihitung. Hanya membaca nota — tidak ada jalur tulis, tanpa migrasi, tanpa izin baru (dibatasi peran Owner/GM/Manager + batas cabang). Aturan pengelompokan di `lib/discount-history.ts`, pembaca di `lib/services/discount-history-service.ts`. Tes: 5 unit + `discount-history.integration.test.ts` (8 tes DB). Belum dibuka di browser. Satu pertanyaan baru (siapa yang boleh membuka; tidak menghalangi). |
| 2026-10-12 | P0 | Analisa kode + keputusan owner (14 butir di spec) ditulis; belum ada kode. |
| 2026-10-12 | P1a | Migrasi `0043` (hanya menambah tabel, dijalankan di DB uji), mesin diskon manual, mesin nilai bersih baris + uang kembali retur (`netRefundAmount`, belum dipakai — P1c). Belum ada kode yang menulis ke tabel baru; kasir, retur, dan laporan tidak berubah. Daftar alasan diskon di mesin masih SEMENTARA. Cek otomatis lulus. Tidak ada pertanyaan baru. |
| 2026-10-12 | P1b | Server kasir (`api/pos/transactions` → `TransactionService`) menerima `manualDiscount` per baris, memeriksanya dengan mesin diskon manual sebelum nota ditulis, dan mencatatnya di `transaction_item_discounts`. Nota berdiskon per barang ditolak bila angka baris/total tidak cocok atau digabung diskon total nota. Nota cara lama (diskon total nota) tetap diterima apa adanya. Layar kasir belum mengirim diskon per barang → belum ada perubahan yang terlihat. Batal nota: stok kembali, catatan potongan tetap ada (tes DB). Tanpa migrasi. Dua pertanyaan baru untuk owner (lihat di atas). Ikut dirapikan: satu tes DB delivery grooming yang sesekali gagal karena urutan jejak tidak ditetapkan (hanya tes, bukan kode toko). |
| 2026-10-12 | P1b | Owner menjawab dua pertanyaan: (1) potongan per barang Penjualan Grosir **perlu** tampil di Laporan Riwayat Diskon → masuk P1f; (2) nota PO Internal **tidak** boleh didiskon per barang → mesin diskon manual kini menolaknya (tes mesin + tes DB). |
| 2026-10-12 | P1c | `retur-service` menghitung uang kembali dengan mesin nilai bersih baris: bagian dari yang benar-benar dibayar untuk baris itu (sesudah potongan baris dan bagian diskon total nota), retur terakhir mengembalikan sisa sehingga total retur satu baris = yang dibayar. **Perilaku berubah untuk nota berdiskon yang sudah ada** (nota lama berdiskon total, gratis ongkir, Penjualan Grosir berpotongan): dulu harga penuh, kini nilai dibayar. Nota tanpa diskon tidak berubah. Jumlah baris dihitung dari baris nota, bukan kepala nota (kepala Penjualan Grosir = sebelum potongan baris). Potong piutang & batal retur mengikuti (tes DB 8 kasus). Laporan memakai `refund_amount` yang tersimpan → ikut benar sendiri. Harga satuan di catatan retur tetap harga nota. Tanpa migrasi. Tidak ada pertanyaan baru. |
| 2026-10-12 | P1d-2 | Struk. Mesin baru `lib/receipt-lines.ts` (mesin baris struk) dipakai tiga penyusun struk (printer kasir, cetak browser, gambar): baris barang memuat nilai **sebelum** potongan, "Diskon -x" tepat di bawahnya, "Subtotal / Diskon" hanya untuk diskon nota, dan "Anda hemat Rp … (diskon / gratis ongkir / diskon + gratis ongkir)". Cetak ulang dari Riwayat kasir & detail nota Back Office memakai penyusun yang sama. Diperbaiki ikutan: cetak browser & gambar dulu tidak menampilkan potongan per barang sama sekali, dan struk Penjualan Grosir di printer kasir mencetak potongan barisnya dua kali (di bawah barang **dan** di "Diskon" bawah) — kini sekali. Nota lama berdiskon total tercetak persis seperti dulu (tes). Tanpa migrasi, belum dibuka di browser, belum dicoba di printer. Tiga pertanyaan dicatat untuk sesi berikutnya. |
| 2026-10-12 | P1d-1 | Layar kasir. Tiap barang di keranjang punya tombol **+ Diskon** → popup wajib pilih (potongan per pcs / untuk barang itu + alasan; "Lainnya" wajib diketik). Isian disimpan di baris keranjang, potongan selalu dihitung ulang lewat mesin diskon manual (qty berubah, ganti golongan harga, baris digabung); isian yang tidak sah lagi **dilepas**, tidak pernah menjadi minus. Tombol "+ Diskon" total nota di layar bayar **dihapus** — kiriman layar selalu `discountTotal: 0`. Tab Grooming: tombol Diskon di tiap kucing. Ongkir (pakai Gratis ongkir) dan keranjang PO Internal tanpa tombol diskon. Daftar tunggu membawa diskonnya. Struk belum diubah (bagian 2). Tanpa migrasi, belum dibuka di browser. Tidak ada pertanyaan baru. |
| 2026-10-13 | P2b bagian 2 | Layar Promo di Back Office (Master Data → Promo, Owner & GM): daftar + saringan keadaan, form buat promo dalam popup (empat bentuk P2: potongan satu barang, harga khusus mulai N pcs, beli A → B lebih murah, flash sale; masa berlaku WIB + jam tiap hari; potong per pcs / harga jadi dengan pratinjau harga), popup jual rugi (wajib pilih, kirim ulang dengan `acceptLoss`), nonaktifkan (wajib pilih), saklar darurat di atas halaman. Isian form → aturan promo lewat `lib/promo/promo-form.ts` (murni, diperiksa ulang `checkNewPromo`); pilihan barang lewat `listPromoItemOptions` (barang aktif bukan ongkir, satuan dasar + konversi, harga Retail cabang pembuat). Bentuk potongan / mulai N / flash sale = satu barang per promo. Dikerjakan di branch `feat/promo-layar-bo` (bukan branch baru — klaimnya sudah mencakup layar). Tanpa migrasi; kasir belum memakai promo. Tes: `promo-form.test.ts` (9), +1 tes DB. Belum dibuka di browser. |
| 2026-10-13 | P2b bagian 1 | Owner menjawab tiga pertanyaan P2 = bawaan (satu barang satu promo; Reseller/Grosir tidak kena promo walau harganya jatuh ke Retail; pembuat promo Owner & GM tanpa izin baru). P2b dipecah: bagian 1 server, bagian 2 layar. **Bagian 1:** layanan promo (buat / daftar / nonaktifkan, tanpa ubah & hapus), pemeriksaan barang & cabang, peringatan jual rugi di server (harga promo < modal per cabang → 409 sampai "tetap buat", berjejak), saklar darurat (`app_settings` `promo_enabled`, bawaan menyala, berjejak); mesin promo ditambah `checkNewPromo`, `promoUnitPrice`, `promoStatus`. Tanpa migrasi; belum ada layar yang memakainya — kasir tidak berubah. Tes: 3 mesin, 3 HTTP, 6 DB. |
| 2026-10-14 | P2d | Layar kasir mengenal promo otomatis. Promo yang berlaku diambil dari `GET /api/pos/promos` (saklar darurat, jam server, promo aktif belum berakhir) lalu dihitung di layar dengan mesin promo yang sama (`lib/promo/promo-engine.ts`) — modul baru `components/pos/promo-store.ts` (simpan promo + selisih jam server, di-tik 30 dtk untuk flash sale) & `components/pos/promo-cart.ts` (hitung potongan per baris keranjang + hook). Panel keranjang menandai baris berpromo (🎁 nama promo −Rp…), menyembunyikan tombol "+ Diskon" di baris itu (promo menang; tidak bisa digabung diskon manual), dan total sudah termasuk promo. Layar bayar mengirim `items[].promo {promoId, amount}`; bila server menolak (`PROMO_CHANGED`/`PROMO_INVALID`) layar memuat ulang promo & menghitung ulang. Daftar tunggu tetap menyimpan harga mentah → promo dihitung ulang saat dibuka/dibayar. Tab Grooming ("Bayar saat ambil") ikut memuat promo. Tanpa migrasi; belum dibuka di browser. Struk (nama promo + "Anda hemat") ditunda ke P2e. Tes: `promo-cart.test.ts` (5) + 2 tes di `checkout-payload.test.ts` (kiriman promo lolos hakim server; promo menang atas diskon manual). |
