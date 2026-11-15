# F2-3b Utang Antar Cabang Lama — Pratinjau & Pelunasan Susulan

Tanggal: 2026-11-08 · Status: **disetujui owner 2026-11-08** (§9) · PRD:
[`fase_2/04-pelunasan-otomatis.md`](../../hris_planning/PRD/fase_2/04-pelunasan-otomatis.md) §7 ·
Dasar: [F2-3 Pelunasan Otomatis](2026-11-08-f2-3-pelunasan-otomatis-design.md) §8 pilihan **C**
(tayang produksi 1.107.120)

| Bagian | Branch (dasar) | Migrasi | Isi |
|---|---|---|---|
| **F2-3b-1** Pratinjau | `feat/legacy-settlement-preview` (`origin/main`) | — (baca saja) | Layar pratinjau utang lama per cabang + simulasi "kalau dilunasi" |
| **F2-3b-2** Jalankan | `feat/legacy-settlement-run` (`origin/main`) | petshop `0058` | Tombol jalankan sekali (pelunasan susulan), pembatalan, penanda utang lama |

Usul agent: **F2-3b-1 tayang produksi lebih dulu** (tidak mengubah data apa pun), owner membaca
angka nyata, baru diputuskan isi F2-3b-2. Agent tidak bisa membaca data produksi langsung, jadi
angka nyata hanya terlihat lewat layar ini.

## 1. Keadaan sekarang (diperiksa di kode `origin/main` `ee5db069`)

- **Utang lama** = `inter_branch_payables` `UNPAID`/`PARTIAL` dengan `created_at` **sebelum
  2026-11-01** (`auto_settlement_settings.startDate`). F2-3 sengaja tidak menyentuhnya; hanya bisa
  dibayar manual (Utang Internal › Bayar, `payable.pay`) atau dihapus (`payable.waive`, Owner/GM,
  alasan wajib).
- **Uang lama yang terverifikasi** = verifikasi setoran cara lama di Riwayat Shift:
  `shifts.deposit_received_cash` (+ `deposit_verified_at`, `deposit_verified_by_id`) — hanya
  **tunai**, ada sejak 2026-10-04 (migrasi 0029), diketik dua kali sejak 2026-10-24 (1.107.90).
  Shift yang belum pernah diverifikasi tidak punya angka terverifikasi. Non-tunai lama tidak
  pernah diverifikasi (hanya angka sistem di `shift_cashier_breakdown`).
- **Pelunasan manual lama** = `inter_branch_payments` dengan `source_type` kosong (diketik orang)
  + dua catatan Pendapatan & Pengeluaran. Asal uangnya tidak tercatat; sangat mungkin dari setoran
  shift yang sama → inilah sumber risiko uang terhitung dua kali.
- Aturan alokasi berantai siap dipakai ulang: `planSettlement` (`deposit-settlement-rules.ts`).

## 2. Ide dasar (PRD 04 §7)

```
Per cabang penyetor, sejak tanggal mulai X s.d. 31 Okt:
  uang tersedia = kas shift terverifikasi cara lama
                − pelunasan manual utang internal yang sudah dicatat (dianggap memakai uang yang sama)
  uang tersedia → melunasi utang lama paling lama dulu, berantai (Toko → Toko Pusat → Gudang)
  sisa uang  = setoran bebas lama (hanya angka info)
  sisa utang = diputuskan owner satu per satu (bayar manual / hapus / biarkan)
```

Hanya utang lama yang ikut, termasuk di rantai: uang yang "diterima" Toko Pusat dalam simulasi
melunasi **utang lama** Toko Pusat ke Gudang, bukan utang November (itu urusan F2-3).

## 3. F2-3b-1 Layar Pratinjau (baca saja)

Letak: **Back Office › Utang Internal › tombol "Utang Lama (sebelum November)"**, hanya Owner/GM
(hak baru `payable.legacy_review`, peran OWNER, GM).

Isian di atas layar (hanya mengubah hitungan, tidak menyimpan apa pun):
- **Tanggal mulai X**, dengan tombol cepat: 4 Okt (awal verifikasi) · 24 Okt (verifikasi ketat) ·
  pilih sendiri.
- Centang **sumber uang**: ☑ kas shift terverifikasi · ☐ non-tunai (angka sistem, belum
  terverifikasi).
- Centang ☑ **kurangi pelunasan manual** yang sudah dicatat.

Tabel ringkas per cabang (berutang):

| Kolom | Isi |
|---|---|
| Utang lama terbuka | jumlah nota, sisa Rp, tanggal paling lama |
| Kas terverifikasi sejak X | Rp, jumlah shift |
| Kas belum terverifikasi | Rp angka sistem shift yang belum pernah diverifikasi (info saja, tidak dipakai) |
| Pelunasan manual sejak X | Rp |
| Uang tersedia | hasil hitungan §2 (bisa minus → tampil 0 + tanda "pelunasan manual melebihi setoran") |
| Kalau dijalankan | nota jadi lunas · sisa utang yang tetap terbuka · setoran bebas lama |

Klik cabang → rincian: daftar utang lama (IBT, pemasok, tanggal, umur, sisa) dengan kolom
**Hasil** (Lunas / Sebagian Rp… / Tetap terbuka), daftar shift yang dihitung, daftar pelunasan
manual yang dikurangi, dan pohon rantai seperti di F2-3. Tombol **"Cara membaca"** menjelaskan
setiap angka (prinsip Fase 2). Bisa diunduh Excel untuk dicocokkan dengan catatan owner.

## 4. F2-3b-2 Jalankan sekali (sesudah owner melihat angka)

- Tombol **Jalankan pelunasan susulan** (hanya Owner; hak `payable.legacy_run`) memakai isian yang
  sedang dipilih; ketik ulang total Rp sebagai konfirmasi; alasan/catatan wajib.
- Satu transaksi DB + kunci `deposit_settlement` yang sama dengan F2-3 (tidak bentrok dengan
  verifikasi yang sedang berjalan). Hitungan diulang di server; bila hasilnya berbeda dari yang
  dilihat (data berubah), ditolak dan diminta lihat ulang.
- Tiap pelunasan = baris `inter_branch_payments` jenis **`SUSULAN`**, nomor `SUSULAN-<id>`;
  tanpa catatan Pendapatan & Pengeluaran (sama dengan F2-3).
- Catatan pelaksanaan: tabel baru `legacy_settlement_runs` (tanggal mulai, pilihan, total,
  pelaku, waktu, catatan, status) + baris `deposit_settlements` jenis sumber baru `LEGACY_RUN`
  (alter check, migrasi 0058) supaya Finance (F2-6) membaca satu tempat.
- **Hanya satu pelaksanaan aktif.** Owner bisa **membatalkan** (alasan wajib): semua baris dibalik
  dengan `BATAL_SUSULAN` (tidak ada yang dihapus), lalu bisa dijalankan ulang dengan pilihan lain.
- Sisa utang lama: Utang Internal mendapat penyaring **"Utang lama"**; penyelesaiannya memakai
  tombol yang sudah ada (Bayar manual / Hapus Hutang). Tidak ada aksi baru.

## 5. Data

F2-3b-1: tidak ada perubahan schema; hanya query baca + hak baru di seed permissions.
F2-3b-2 (migrasi petshop `0058`): `legacy_settlement_runs`, nilai sumber `LEGACY_RUN` di
`deposit_settlements`, hak `payable.legacy_run`. Tidak ada koreksi data produksi selain lewat
tombol Jalankan oleh owner.

## 6. Tes (non-UI)

- Hitungan uang tersedia: kas terverifikasi sejak X, dikurangi pelunasan manual, non-tunai hanya
  bila dicentang, shift belum terverifikasi tidak dipakai.
- Simulasi memakai `planSettlement` hanya atas utang lama; rantai tidak menyentuh utang November.
- (F2-3b-2) Jalankan: hasil sama dengan pratinjau; ditolak bila data berubah; tidak bisa dua
  pelaksanaan aktif; pembatalan membalik semua baris dan status utang kembali.
- `pnpm typecheck`, `pnpm migrations:check` (F2-3b-2). UI diuji owner di staging.

## 7. Langkah uji owner

F2-3b-1 (staging lalu produksi): buka Utang Lama, ganti tanggal 4 Okt ↔ 24 Okt, centang/lepas
sumber, cocokkan satu cabang dengan catatan owner (nota Oktober yang owner tahu belum lunas).
F2-3b-2 (staging): jalankan → nota lunas bertanda SUSULAN → batalkan → kembali terbuka → jalankan
ulang.

## 8. ❓ Pertanyaan untuk owner

1. **Dua tahap** (pratinjau dulu tayang produksi, tombol jalankan menyusul sesudah melihat angka)
   — usul agent: ya.
2. **Sumber uang**: hanya kas shift terverifikasi cara lama (usul) — atau non-tunai lama juga
   ikut? (Non-tunai lama masuk rekening toko/kantor tanpa verifikasi.)
3. **Pelunasan manual yang sudah ada** dianggap memakai uang setoran yang sama sehingga dikurangi
   (usul) — atau owner tahu sebagian dibayar dari uang lain (mis. uang Owner)?
4. **Shift Oktober yang belum pernah diverifikasi**: tidak dihitung, hanya tampil sebagai info
   (usul) — atau boleh dipakai dengan angka sistem?
5. **Siapa**: pratinjau Owner + GM; tombol jalankan & batalkan **Owner saja** (usul).
6. **Setoran bebas November** tidak dipakai untuk utang lama (sesuai keputusan "data November
   saja") — usul: tetap begitu.

## 9. Keputusan owner 2026-11-08 (atas draf)

Owner: "ok saya setuju" — semua usul agent di §8 disetujui:

1. ✅ Dua tahap: **F2-3b-1 Pratinjau** tayang produksi dulu, **F2-3b-2 Jalankan** sesudah owner
   melihat angka nyata.
2. ✅ Sumber uang bawaan = **kas shift terverifikasi cara lama** saja; centang non-tunai tersedia
   untuk perbandingan, bawaan tidak dicentang.
3. ✅ Pelunasan manual yang sudah ada **dikurangi** (bawaan dicentang); nota yang dibayar dari uang
   lain dibahas khusus.
4. ✅ Shift Oktober yang belum diverifikasi **tidak dihitung**, tampil sebagai info.
5. ✅ Pratinjau Owner + GM; Jalankan & Batalkan **Owner saja**.
6. ✅ Setoran November **tidak** dipakai untuk utang lama.
