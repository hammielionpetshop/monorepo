# F2-3 Pelunasan Otomatis Antar Cabang

Tanggal: 2026-11-08 · Status: **disetujui owner 2026-11-08** ("ok saya ikuti semua saran anda") · PRD:
[`fase_2/04-pelunasan-otomatis.md`](../../hris_planning/PRD/fase_2/04-pelunasan-otomatis.md) ·
Dasar: [F2-1 Tempat Uang](2026-11-08-f2-1-tempat-uang-design.md),
[F2-2 Setoran](2026-11-08-f2-2-setoran-design.md) (tayang produksi 1.107.119)

| Bagian | Branch (dasar) | Migrasi | Isi |
|---|---|---|---|
| **F2-3** Back Office | `feat/auto-settlement` (`origin/main`) | petshop `0057` | Verifikasi setoran melunasi utang internal otomatis (berantai), setoran bebas, pembalikan saat koreksi, umur utang di Utang Internal |

HRIS tidak disentuh. ⚠️ **Utang lama (§8) wajib diputuskan owner sebelum F2-3 tayang produksi.**

## 1. Keadaan sekarang (diperiksa di kode 2026-11-08)

- Utang internal lahir saat kiriman PO Internal diterima (`inter_branch_payables`, satu per IBT:
  `debtor_branch_id` penerima, `creditor_branch_id` pengirim, `total_amount`, `paid_amount`,
  status `UNPAID`/`PARTIAL`/`PAID`/`WAIVED`).
- Pelunasan sekarang **manual**: Back Office › Utang Internal › Bayar (`POST
  /api/bo/inter-branch-payables/[id]/pay`, hak `payable.pay`) — baris `inter_branch_payments` +
  dua catatan Pendapatan & Pengeluaran ("Bayar Hutang Internal" / "Terima Piutang Internal").
- Baris otomatis yang sudah ada (bukan uang kas, tanpa catatan Pendapatan & Pengeluaran):
  `RETUR_INTERNAL`, `SALDO_INTERNAL`, `BATAL_RETUR` (negatif). Saldo Internal otomatis memotong
  tagihan tertua pasangan cabang yang sama.
- F2-2 menyediakan uang terverifikasi: `cash_deposits` `VERIFIED` (`received_amount`) dan
  `noncash_verifications` `VERIFIED` aktif (`received_amount`), masing-masing menyalin
  `held_by` Tempat Uang tujuan. Koreksi oleh Owner/GM sudah ada (`correctCashDeposit`,
  `correctNoncashVerification`): perpindahan uang lama dibalik, baris baru dibuat.
- Data cabang tidak punya "jenis" (Gudang/Toko Pusat); siapa pemasok siapa terbaca dari
  utang internal itu sendiri.

## 2. Alur ✅ (PRD 04 §2)

```
Finance memverifikasi setoran Toko A (tunai atau non-tunai), uang sampai di Tempat Uang dipegang Finance
  ① uang itu melunasi utang internal Toko A yang terbuka — PALING LAMA dulu, siapa pun pemasoknya
  ② setiap rupiah yang "diterima" pemasok di ① (mis. Toko Pusat) langsung melunasi utang pemasok itu
     (mis. Toko Pusat → Gudang), paling lama dulu; begitu seterusnya
  ③ sisa di tiap tingkat = SETORAN BEBAS cabang itu (bukan deposit, tidak dipakai untuk tagihan kemudian)
Setoran Toko Pusat sendiri → mulai dari ① untuk Toko Pusat (yaitu langsung ke utangnya ke Gudang)
```

Contoh: utang Toko A ke Toko Pusat Rp3 jt (Okt 30) dan ke Gudang Rp1 jt (Nov 2); utang Toko Pusat
ke Gudang Rp2 jt (Nov 1). Setoran Toko A terverifikasi Rp5 jt:
① Toko Pusat Rp3 jt (paling lama), Gudang Rp1 jt → sisa **Rp1 jt setoran bebas Toko A**;
② Rp3 jt yang diterima Toko Pusat → utang Toko Pusat ke Gudang Rp2 jt lunas → **Rp1 jt setoran
bebas Toko Pusat**; Gudang tidak punya utang internal → Rp1 jt + Rp2 jt yang diterima Gudang
menjadi setoran bebas Gudang.

## 3. Aturan

1. **Pemicu**: tombol Verifikasi setoran tunai, Terima Setoran, dan verifikasi non-tunai (termasuk
   baris "Pelunasan BO") — di **transaksi DB yang sama**. Dana belum cair (`AWAITING_FUNDS`) belum
   melunasi apa pun; pelunasan terjadi saat diverifikasi.
2. **Sampai di Finance** (PRD 02 §3): hanya setoran yang tujuannya `held_by = FINANCE` (salinan di
   baris verifikasi). Setoran ke tempat "dipegang toko/lainnya" tidak melunasi; tampil "belum sampai
   kantor". (Memindahkannya ke Finance lewat Pindah Dana menyusul di F2-4.)
3. **Nominal** = `received_amount` yang diketik Finance (sudah dipotong biaya bank). Tunai dan
   non-tunai masing-masing berdiri sendiri; tidak ditunggu lengkap satu hari.
4. **Urutan "paling lama"** = tanggal utang lahir (`created_at` utang internal), lalu nomor. Hanya
   utang `UNPAID`/`PARTIAL` yang ikut; `WAIVED` dilewati.
5. **Rantai berhenti** bila pemasok tidak punya utang internal terbuka, atau bila rantai kembali ke
   cabang yang sudah dilewati di setoran yang sama (penjaga putaran; sisanya setoran bebas cabang
   itu).
6. Setiap pelunasan = satu baris `inter_branch_payments` jenis **`SETORAN`** (bukan uang kas
   baru: uangnya sudah tercatat pindah di `money_movements` F2-2), nomor referensi = nomor setoran
   (`STN-…`) atau `NT-<id>` untuk non-tunai. **Tidak membuat catatan Pendapatan & Pengeluaran**
   (sama dengan `SALDO_INTERNAL`; sesuai keputusan owner 2026-10-11 menu itu belum jadi acuan).
7. Kunci tunggal `pg_advisory_xact_lock('deposit_settlement')` selama alokasi, supaya dua
   verifikasi bersamaan tidak melunasi tagihan yang sama.
8. Angka integer rupiah; penjumlahan memakai `big.js`. Tidak ada pembagian, jadi tidak ada pembulatan.
9. Bayar manual di Utang Internal **tetap ada** untuk pengecualian (mis. cabang membayar langsung ke
   rekening pemasok di luar Setoran). Formulir diberi keterangan: "Pelunasan biasa berjalan otomatis
   dari Setoran; bayar manual hanya untuk uang yang tidak lewat Setoran" — supaya uang tidak
   terhitung dua kali.
10. Retur Internal/Revisi Harga yang membuat utang yang sudah dilunasi Setoran menjadi lebih bayar
    tetap memakai Saldo Internal yang ada; tidak ada perubahan.

## 4. Koreksi ✅ (PRD 04 §4)

- Memakai tombol koreksi F2-2 yang sudah ada (Owner/GM, alasan wajib, Audit Log).
- Semua pelunasan dari verifikasi lama **dibalik** — termasuk rantainya — dengan baris negatif
  `BATAL_SETORAN` (tidak ada yang dihapus/diubah); `paid_amount` utang turun dan status dihitung
  ulang (`PAID` → `PARTIAL`/`UNPAID`; utang yang sementara itu `WAIVED` tetap `WAIVED`).
- Verifikasi pengganti lalu dialokasikan ulang dari tagihan paling lama saat itu.
- Akibatnya bisa berbeda dari alokasi pertama bila sementara itu setoran lain sudah melunasi
  tagihan lama; rincian di layar menunjukkan alokasi baru.

## 5. Data (migrasi petshop `0057`)

`petshop.deposit_settlements` — satu baris per potongan alokasi, dibaca Finance (F2-6):

| Kolom | Isi |
|---|---|
| `id` | |
| `source_type`, `source_id` | `CASH_DEPOSIT` / `NONCASH_VERIFICATION` + id baris F2-2 |
| `level` | 1 = cabang penyetor, 2 = pemasoknya, dst. |
| `parent_id` | baris tingkat atas yang uangnya diteruskan (kosong di tingkat 1) |
| `payer_branch_id` | cabang yang "membayar" di tingkat ini |
| `payable_id` | utang yang dilunasi; **kosong = setoran bebas** cabang itu |
| `payment_id` | baris `inter_branch_payments` (`SETORAN`/`BATAL_SETORAN`) |
| `amount` | rupiah (negatif untuk pembalikan) |
| `reversal_of_id` | pembalikan baris lain |
| `created_by`, `created_at` | |

Pengaturan di `app_settings` kunci `auto_settlement_settings`: **tanggal mulai pelunasan
otomatis** (§8) dan **batas umur merah** (usul 30 hari). Tidak ada perubahan pada tabel F2-2 dan
tidak ada koreksi data produksi.

## 6. Layar

1. **Back Office › Shift › Setoran** — di rincian setoran / verifikasi non-tunai (dan Riwayat):
   bagian **Pelunasan** berisi pohon kecil per tingkat: "Toko A → Toko Pusat IBT-… Rp3.000.000",
   "↳ Toko Pusat → Gudang IBT-… Rp2.000.000", dan baris **Setoran bebas** per cabang. Pesan
   sesudah Verifikasi menyebut ringkasannya ("Melunasi 3 tagihan, setoran bebas Rp1.000.000").
2. **Back Office › Utang Internal** (yang sudah ada): kolom **Umur** (0–7 / 8–30 / >30 hari) dan
   tanda merah lewat batas; riwayat bayar menampilkan label **SETORAN** / **BATAL SETORAN** dengan
   nomor setoran. Ringkasan atas per cabang: sisa utang + tanggal tagihan paling lama.
3. Finance › Utang Antar Cabang dan tampilan Kepala Toko = **F2-6/nanti**, tidak di sini.

## 7. Tes (non-UI)

- Alokasi: paling lama dulu lintas pemasok; rantai Toko A → Toko Pusat → Gudang; setoran bebas di
  tiap tingkat; penjaga putaran; utang `WAIVED` dilewati; tujuan bukan Finance tidak melunasi;
  `AWAITING_FUNDS` tidak melunasi, saat diverifikasi melunasi.
- Koreksi: semua baris (termasuk rantai) dibalik dengan baris negatif, status utang kembali, lalu
  dialokasi ulang; tidak ada baris yang diubah/dihapus.
- Dua verifikasi bersamaan tidak melunasi lebih dari sisa utang.
- Tagihan sebelum tanggal mulai tidak tersentuh (§8 pilihan A).
- `pnpm migrations:check`, `pnpm typecheck`. UI diuji owner di staging.

## 8. ⚠️ Utang lama — perlu keputusan owner sebelum produksi

"Utang lama" = utang internal terbuka yang lahir **sebelum** pelunasan otomatis berjalan. Pilihan:

| | Cara | Untung | Risiko |
|---|---|---|---|
| **A** (usul agent untuk rilis pertama) | Pelunasan otomatis hanya menyentuh utang yang lahir **sejak tanggal mulai**. Utang lama tetap terbuka, diselesaikan manual / lewat B atau C nanti | Aman: tidak ada uang yang terhitung dua kali; F2-3 bisa jalan sekarang | Utang lama tidak berkurang sendiri; tetap tampil merah di Utang Internal |
| **B** | Semua utang terbuka ikut "paling lama dulu" sejak tanggal mulai: setoran baru melunasi nota Oktober lebih dulu | Utang lama cepat habis | Bila sebagian sudah dibayar di luar sistem, uang baru terpakai untuk tagihan yang sebenarnya lunas; setoran bebas cabang tampak kecil |
| **C** (PRD 04 §7) | Laporan **pratinjau** (baca saja, Owner/GM) per cabang: utang lama terbuka, setoran terverifikasi sejak tanggal X, pelunasan manual yang ada, hasil bila dijalankan → owner memilih tanggal → dijalankan sekali bertanda "pelunasan susulan"; sisa diputuskan satu per satu | Paling teliti, owner melihat angka nyata | Langkah tambahan (F2-3b) dan butuh waktu owner |

Usul agent: rilis F2-3 dengan **A**, lalu buat **C** sebagai langkah F2-3b dan dibahas khusus
dengan angka produksi di layar pratinjau. Tanggal mulai bawaan = hari migrasi 0057 dijalankan.

## 9. Langkah uji owner (staging)

1. Siapkan: Toko Raja punya 2 utang internal (ke Toko Pusat lebih lama, ke Gudang lebih baru),
   Toko Pusat punya 1 utang ke Gudang.
2. Setoran tunai Toko Raja diverifikasi lebih besar dari total utangnya → kedua utang lunas sesuai
   urutan, utang Toko Pusat ke Gudang ikut berkurang, rincian Pelunasan menampilkan setoran bebas
   Toko Raja dan Toko Pusat.
3. Verifikasi non-tunai QRIS Toko Raja → bila masih ada utang, ikut melunasi.
4. Koreksi verifikasi (Owner/GM) dengan nominal lebih kecil → baris BATAL SETORAN muncul, utang
   kembali terbuka, lalu dilunasi ulang sebesar nominal baru.
5. Utang Internal menampilkan Umur, tanda merah, dan label SETORAN pada riwayat bayar.
6. Utang yang lahir sebelum tanggal mulai tidak berubah.
7. Sebelum rilis (PRD 00 §7): owner mencocokkan satu hari nyata setoran dua toko.

## 10. Keputusan owner 2026-11-08 (atas draf)

Owner: "ok saya ikuti semua saran anda kalau begitu" — semua usul agent disetujui:

1. ✅ Utang lama: **pilihan A** untuk rilis F2-3 (hanya utang yang lahir sejak tanggal mulai);
   **C** (pratinjau + pelunasan susulan) menjadi langkah **F2-3b** yang dibahas khusus dengan angka
   produksi.
2. ✅ Batas umur merah Utang Internal **30 hari** (bisa diubah di pengaturan).
3. ✅ Setoran ke tempat "dipegang toko/lainnya" tidak melunasi sampai dipindah ke Finance (F2-4).
4. ✅ Pelunasan otomatis **tidak** membuat catatan Pendapatan & Pengeluaran.
