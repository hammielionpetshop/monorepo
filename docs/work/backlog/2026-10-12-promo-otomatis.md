# Backlog — Promo Otomatis, Diskon per Barang & Laporan Diskon

**Status:** P0 ✅ · P1a ✅ · P1b ✅ · P1c ✅ · P1d bagian 1 ✅ dikoding (belum di-push, belum tayang) · berikutnya **P1d bagian 2 (struk)**
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
P0 → P1a → P1b → P1c → P1d (1, 2) → P1e → P1f → P1g → P2 → P3 → P4          (promo di portal pesanan: dibahas terpisah)
     tinggi tinggi sedang sedang
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

- [x] Klaim + kunci migrasi (dicatat di branch; masuk main saat rilis)
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

- [ ] Struk cetak baru (printer kasir, cetak browser, gambar WhatsApp): potongan di bawah barangnya + "Anda hemat" (digabung dengan gratis ongkir; teksnya tetap dari satu mesin — lihat `lib/ongkir-guard.test.ts`)
- [ ] Cetak ulang dari Riwayat (kasir) & detail nota Back Office menampilkan hal yang sama
- [ ] Sesuaikan tanggal `fitur/diskon-per-barang` di `lib/new-features.ts` saat rilis

### P1e — Jalur lain tetap benar

- [ ] Koreksi nota, daftar tunggu, settlement shift, bonus groomer/pengantar — tes DB
- [ ] Penjualan per Produk dan Laba Rugi tetap cocok — tes pembanding kode lama vs baru

### P1f — Laporan Riwayat Diskon

- [ ] Halaman laporan per produk → popup nota (kapan, kasir, cabang, alasan) + tanda "Baru"
- [ ] Nota lama tampil sebagai "diskon nota (tidak per barang)"
- [ ] Potongan per barang di Penjualan Grosir (Bulk Sale) ikut tampil (keputusan owner butir 15)

### P1g — Pemeriksaan menyeluruh

- [ ] Semua cek + `next build` + uji asap halaman; laporan ke owner untuk uji laptop / keputusan rilis

### Pertanyaan untuk sesi berikutnya

_(kosong — dua pertanyaan P1b sudah dijawab owner 2026-10-12, lihat spec "Keputusan owner" butir 15–16)_

## P2 — Mesin promo + layar Promo + potongan per barang / minimal pcs / flash sale

**Migrasi:** ya · **Risiko:** tinggi (harga di kasir)

- [ ] Tabel promo (kepala, barang syarat, barang hadiah, cabang) + izin Owner/GM
- [ ] Mesin promo (`lib/promo/`) + tes: satu barang satu promo, pilih termurah untuk pelanggan,
      kelipatan, maksimal per nota, hanya Retail, jam server
- [ ] Back Office: daftar/buat/nonaktifkan promo; peringatan jual rugi; tanpa edit sesudah terpakai
- [ ] Kasir: promo berlaku otomatis, baris bertanda promo, tidak bisa didiskon manual
- [ ] Server sebagai hakim (hitung ulang, tolak bila berbeda); daftar tunggu dihitung ulang saat bayar
- [ ] Saklar darurat "matikan semua promo" di Pengaturan
- [ ] Struk: nama promo + "Anda hemat"
- [ ] Laporan Promo (efektivitas + peringkat toko)

## P3 — Beli X gratis Y & bundling

**Risiko:** sedang

- [ ] Barang gratis otomatis masuk keranjang; ikut hilang bila syaratnya dihapus
- [ ] Bundling: potongan pada barang yang ditentukan owner
- [ ] Retur promo paket hanya satu paket utuh; koreksi nota mengunci baris promo

## P4 — Grooming gratis makanan pilihan

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
| 2026-10-12 | P0 | Analisa kode + keputusan owner (14 butir di spec) ditulis; belum ada kode. |
| 2026-10-12 | P1a | Migrasi `0043` (hanya menambah tabel, dijalankan di DB uji), mesin diskon manual, mesin nilai bersih baris + uang kembali retur (`netRefundAmount`, belum dipakai — P1c). Belum ada kode yang menulis ke tabel baru; kasir, retur, dan laporan tidak berubah. Daftar alasan diskon di mesin masih SEMENTARA. Cek otomatis lulus. Tidak ada pertanyaan baru. |
| 2026-10-12 | P1b | Server kasir (`api/pos/transactions` → `TransactionService`) menerima `manualDiscount` per baris, memeriksanya dengan mesin diskon manual sebelum nota ditulis, dan mencatatnya di `transaction_item_discounts`. Nota berdiskon per barang ditolak bila angka baris/total tidak cocok atau digabung diskon total nota. Nota cara lama (diskon total nota) tetap diterima apa adanya. Layar kasir belum mengirim diskon per barang → belum ada perubahan yang terlihat. Batal nota: stok kembali, catatan potongan tetap ada (tes DB). Tanpa migrasi. Dua pertanyaan baru untuk owner (lihat di atas). Ikut dirapikan: satu tes DB delivery grooming yang sesekali gagal karena urutan jejak tidak ditetapkan (hanya tes, bukan kode toko). |
| 2026-10-12 | P1b | Owner menjawab dua pertanyaan: (1) potongan per barang Penjualan Grosir **perlu** tampil di Laporan Riwayat Diskon → masuk P1f; (2) nota PO Internal **tidak** boleh didiskon per barang → mesin diskon manual kini menolaknya (tes mesin + tes DB). |
| 2026-10-12 | P1c | `retur-service` menghitung uang kembali dengan mesin nilai bersih baris: bagian dari yang benar-benar dibayar untuk baris itu (sesudah potongan baris dan bagian diskon total nota), retur terakhir mengembalikan sisa sehingga total retur satu baris = yang dibayar. **Perilaku berubah untuk nota berdiskon yang sudah ada** (nota lama berdiskon total, gratis ongkir, Penjualan Grosir berpotongan): dulu harga penuh, kini nilai dibayar. Nota tanpa diskon tidak berubah. Jumlah baris dihitung dari baris nota, bukan kepala nota (kepala Penjualan Grosir = sebelum potongan baris). Potong piutang & batal retur mengikuti (tes DB 8 kasus). Laporan memakai `refund_amount` yang tersimpan → ikut benar sendiri. Harga satuan di catatan retur tetap harga nota. Tanpa migrasi. Tidak ada pertanyaan baru. |
| 2026-10-12 | P1d-1 | Layar kasir. Tiap barang di keranjang punya tombol **+ Diskon** → popup wajib pilih (potongan per pcs / untuk barang itu + alasan; "Lainnya" wajib diketik). Isian disimpan di baris keranjang, potongan selalu dihitung ulang lewat mesin diskon manual (qty berubah, ganti golongan harga, baris digabung); isian yang tidak sah lagi **dilepas**, tidak pernah menjadi minus. Tombol "+ Diskon" total nota di layar bayar **dihapus** — kiriman layar selalu `discountTotal: 0`. Tab Grooming: tombol Diskon di tiap kucing. Ongkir (pakai Gratis ongkir) dan keranjang PO Internal tanpa tombol diskon. Daftar tunggu membawa diskonnya. Struk belum diubah (bagian 2). Tanpa migrasi, belum dibuka di browser. Tidak ada pertanyaan baru. |
