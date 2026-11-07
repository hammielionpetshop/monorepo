# Antrean perbaikan celah Logistik HRIS

Disetujui owner 2026-11-08, hasil analisis celah spec
[`2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md`](../specs/2026-11-04-hris-logistik-t1-toko-surat-jalan-design.md)
(ada di `dev_hris` dan `staging`). Alur development tetap mengikuti `AGENTS.md`
(spec → persetujuan owner → klaim → implementasi → staging → uji owner → rilis).

## Cara kerja yang diminta owner

- Satu butir per sesi chat. Sesi dibuka dengan kata kunci **"lanjutkan perbaikan HRIS"**:
  ambil butir pertama yang belum selesai di tabel status, kerjakan hanya butir itu.
- Beri tahu owner dengan jelas setiap tahap selesai (spec siap disetujui, tayang staging,
  lolos uji owner/terintegrasi). Sesudah butir selesai, perbarui tabel status di berkas ini
  dan minta owner melanjutkan di chat baru. Jangan mulai butir berikutnya di sesi yang sama.

## Urutan dan isi

1. **A3 Cetak cara kirim di struk** (backoffice, dasar `origin/main`): "DIKIRIM TRUK GUDANG"
   (tebal) / "Diantar kurir cabang" / tidak dicetak untuk Ambil sendiri; struk + surat jalan
   (termasuk PO Internal); cetak ulang ikut cara kirim terbaru. Tanpa migrasi.
2. **B3 Kurang serah → Potongan Lain** (HRIS): tombol "Jadikan Potongan Lain" di tab Selisih
   Terima Uang, terisi orang/nominal/alasan, tetap lewat persetujuan, tanpa potong gaji
   otomatis; tanda bila belum ditindaklanjuti. Owner menekankan ini harus diperbaiki.
3. **A2 Tugas Jemput Retur** (HRIS, migrasi logistics): tugas dibuat Kepala Gudang/Marketing
   (toko, alasan, perkiraan barang), masuk antrean Menunggu, dicentang ke trip; driver:
   Diambil (foto + rincian retur → Barang Kembali LT2a) / Tidak ada barang / Kirim Besok.
   Owner: cukup sering terjadi.
4. **A1 Titipan Toko** (HRIS, mungkin kasir): pilihan "Lunas + titip" / "Titip saja" saat
   Terkirim, saldo titipan per toko tanpa hapus, diperiksa di Terima Uang, pemakaian lewat
   "Perlu dicatat di kasir" (HRIS tidak menulis ke kasir). Cek dulu apakah POS punya saldo
   pelanggan. Owner: cukup sering terjadi.
5. **B1+B2 Pemeriksa kasir**: tanda "Terlihat di kasir ✅ / Belum terlihat ⚠️" untuk potong
   nota & harga beda (pakai ulang `logistics-kasir-check`); tautan laporan retur ↔ nomor retur
   BO, nilai retur dibaca, merah "Retur belum dibuat di BO" > 3 hari.
6. **C Celah kecil**: foto Laporan Muat tampil di rincian surat jalan + tanda "belum ada foto
   muat" (Toko Pusat); saringan cabang/mobil di Laporan Logistik (tetap CSV, tanpa
   dependensi baru).

## Keputusan owner (2026-11-08)

- **A4** nota kurir bayar di tempat **selalu dicatat piutang** di kasir — tidak perlu fitur;
  dicatat di spec LT1 saat butir HRIS berikutnya menyentuhnya.
- **A1 dan A2 harus siap sebelum hari pindah** (target 26 Des 2026).
- Pengantar dipilih kantor: biarkan seperti sekarang.
- Modul Keuangan (Buku Kas, uang bensin sebelum isi) tetap di luar Fase 1.

## Status

| Butir | Status | Catatan |
|---|---|---|
| A3 | **Tayang staging — menunggu uji owner** | Spec [`2026-11-08-cara-kirim-di-struk-design.md`](../specs/2026-11-08-cara-kirim-di-struk-design.md) (di branch `feat/print-delivery-method`); commit `a9778ca7`, staging `b9fc6309` (2026-11-08); klaim dilepas. Sesudah lolos uji: PR rilis ke `main`. |
| B3 | Belum dimulai | — |
| A2 | Belum dimulai | — |
| A1 | Belum dimulai | — |
| B1+B2 | Belum dimulai | — |
| C | Belum dimulai | — |
