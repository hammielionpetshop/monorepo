# A1 Titipan Toko (HRIS Logistik)

Butir A1 antrean [`2026-11-08-perbaikan-logistik-hris.md`](../backlog/2026-11-08-perbaikan-logistik-hris.md).
Disetujui owner 2026-11-08 lewat jawaban sesi malam (bagian **Sesi malam** backlog itu). Pengganti LOG-49/114 v3.

## Keputusan owner

- POS tidak punya saldo/deposit pelanggan (yang ada: Saldo Internal antar cabang, saldo supplier, poin). Saldo
  titipan disimpan di HRIS sebagai buku tanpa hapus; **kasir tidak diubah**. Pemakaian titipan untuk nota dicatat
  Finance di kasir sebagai **Pelunasan Piutang** nota itu, lewat daftar "Perlu dicatat di kasir".
- **Lunas + titip** = toko membayar tunai lebih dari tagihan; kelebihannya titipan. **Titip saja** = kunjungan tanpa
  tagihan (lunas di kasir) tetapi toko menyerahkan uang. Lebih bayar wajib dikonfirmasi lagi di HP awak.
- Titipan boleh **dikembalikan tunai** ke toko, alasan wajib.

## Alur

| Langkah | Oleh | Isi |
|---|---|---|
| Terkirim | awak trip truk | Cara bayar **Lunas + titip** (uang tunai diterima > tagihan; tercatat Lunas cash + titipan = selisih) atau, bila tagihan 0, **Titip saja** (nominal). Ringkasan menampilkan "Titipan toko Rp…" dan wajib dicentang "Benar, toko menitipkan kelebihannya". |
| Diperiksa | Finance (`logistics.money_check.do`) di **Terima Uang** (bagian Titipan toko) atau Titipan Toko | Uang titipan yang diterima: **Cocok** (= dilaporkan) atau angka lain + catatan. Hanya yang diperiksa masuk saldo; trip harus sudah Menuju Garasi. |
| Pakai untuk nota | Finance | Pilih nota berpiutang toko itu (dibaca dari kasir), nominal ≤ saldo dan ≤ sisa piutang → masuk **Perlu dicatat di kasir** (Pakai titipan): Finance input Pelunasan Piutang di kasir lalu **Sudah dicatat** (nomor/keterangan). Selama belum dicatat boleh **Batalkan** (alasan). |
| Kembalikan tunai | Finance | Nominal ≤ saldo + alasan. |

- Saldo = titipan diperiksa − pemakaian (tidak batal) − pengembalian. Server mengunci per toko agar saldo tidak minus.
- Halaman **Logistik › Titipan Toko**: toko bersaldo / menunggu diperiksa, riwayat per toko; kartu Beranda Finance
  "titipan menunggu diperiksa".
- Di luar: antar sendiri (tetap tanpa titipan), titipan lewat transfer, potongan kurang serah atas titipan (dicatat
  sebagai catatan pemeriksaan saja).

## Data

Migrasi `logistics` 0018: tabel `store_deposits` (jenis IN / USE / REFUND; sumber kunjungan untuk IN; nota kasir untuk
USE; pemeriksaan, catat di kasir, batal; tanpa hapus) dan view `logistics.pos_open_debts` (piutang kasir terbuka + nomor
nota, baca saja).
