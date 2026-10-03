# Pelaksanaan perbaikan batch/FIFO

Rencana sumber: `C:/wt/hm-laporan/docs/work/plans/2026-10-03-perbaikan-batch-fifo.md`.
Tanggal: 2026-10-03. Pelaksana: Codex.

Status terkini: changelog **1.107.31** dirilis (`3fc43e9`) dan seluruh implementasi sudah di-merge ke **main lokal** (`a81425f`) pada 2026-10-03. Typecheck, 224 tes backoffice, 10 FIFO shared, 20 integrasi PostgreSQL, changelog/migrations check lolos ulang dari `C:/wt/hm-main`. Klaim Tahap 0-5 dan kunci migrasi dilepas setelah merge. Belum push/deploy; koreksi data produksi tetap memerlukan persetujuan terpisah. Catatan berikut merekam pelaksanaan sebelum merge.

- Keputusan K1 A: write-off tidak menambah stok; residual defisit tetap ikut invariant sampai recount berjejak.
- Keputusan K2: bypass owner transfer mempertahankan pengurangan penuh dan shortfall transfer berjejak.
- Klaim Tahap 0 di main: `d5a6957`, perluasan pemanggil opname: `08cda36`, keduanya sudah di-push sebelum perubahan path terkait.
- Worktree Tahap 0: `C:/wt/hm-stock0`, branch `fix/stock-lock-fifo`.
- DB pengujian: `petshop_wt_fix_stock_lock_fifo` pada PostgreSQL lokal port 5433, dibuat dari template lokal. Produksi belum diperiksa/dimutasi.
- Baseline: 88 tes unit terarah lolos sebelum implementasi.
- Bukti RED PostgreSQL: batch aktual 4/cache 10/jual 8 menghasilkan shortfall 0, bukan 4; metadata rasio dasar 0/-1 juga mengubah saldo secara salah.
- Bukti RED FIFO: timestamp sama memakai urutan input `[9, 3]`, bukan ID `[3, 9]`.
- Harness khusus membutuhkan `STOCK_TEST_DATABASE_URL`, memvalidasi localhost dan nama DB worktree, membersihkan fixture sendiri, tidak truncate.
- Konkurensi dibuktikan dengan barrier advisory lock dan observasi request menunggu dalam `pg_locks`, bukan sleep.
- Tahap 0 selesai: 170 tes unit/route backoffice, 10 tes FIFO shared, 10 tes integrasi PostgreSQL; typecheck dan changelog check lolos. Commit `5e630fa`.
- Tahap 1: implementasi selesai; 17 tes PO unit/route dan 12 tes integrasi PostgreSQL lolos (mencakup Tahap 0). Approval konkuren hanya satu batch/payable; reversal endpoint lalu approval ulang teruji; item kedua invalid membatalkan batch/cost sync/payable/status. Tahap 2-5 belum selesai.
- DB Tahap 1 `petshop_wt_fix_po_receiving_once` dimigrasi dengan migrasi repo yang sudah ada, karena template lokal belum mempunyai tabel product_cost_syncs.
- Implementasi akan disimpan sebagai branch bertumpuk sesuai dependensi; perubahan kode tidak di-push ke main karena push kode memicu deploy produksi.
- Tahap 2 selesai: 73 tes terarah, 15 tes integrasi PostgreSQL, typecheck, changelog check dan migrations check. DB `petshop_wt_fix_ibt_batch_fifo`; migrasi 0028 hanya diterapkan lokal. Klaim/kunci migrasi main `b716088`. Bypass transfer menghasilkan defisit berjejak, bukan qty hilang tanpa sumber. Tahap 3-5 belum selesai.
- Tahap 2 commit `10c1d30`; Tahap 3 selesai di `C:/wt/hm-stock3`, `fix/shortfall-writeoff`, klaim main `e42a74a`/`2882407`. 58 tes terarah, 18 tes integrasi PostgreSQL dan typecheck lolos. Bukti RED: produk write-off tanpa batch hilang dari overview; recount meninggalkan residual 3 sehingga invariant meleset. Saldo write-off tetap, laporan mencakup residual, recount mempertahankan histori. Tahap 4-5 belum selesai.
- Tahap 3 commit `f66291b`. Tahap 4 audit selesai di `C:/wt/hm-stock4`, `audit/stock-reconciliation`, klaim main `112ee3b`. Query lokal lalu produksi dalam snapshot repeatable read/read only. Produksi: 487 drift, 0 batch negatif/non-base/write-off, 39 konversi invalid, 458 tinjauan modal, 5.779 batch tanpa PO, 23 sumber shortfall VOIDED (15 residual = 810). Artefak ID lengkap dan usulan/precondition/gerbang approval di `docs/work/backlog/2026-10-03-hasil-rekonsiliasi-stok.md`. Tidak ada mutasi produksi. Tahap 5 belum selesai.
- Tahap 4 commit `75791f0`. Tahap 5 selesai: 224 tes backoffice terarah, 10 FIFO shared, 20 integrasi PostgreSQL, typecheck/changelog/migrations/diff check lolos. Guard URL dan transaksi audit read-only terbukti. Audit ulang lokal dan produksi menunjukkan temuan/total yang sama. Bukti/perintah/keterbatasan di [verification.md](verification.md).
- Titik review seluruh implementasi: **`verify/stock-fifo` di `C:/wt/hm-stock5`**, bertumpu Tahap 0-4. Klaim main Tahap 5 `ef43dcb`. Tidak merge/deploy/mutasi produksi; migration lock 0028 tetap di `fix/ibt-batch-fifo` sampai merge. Koreksi data lama membutuhkan bukti tambahan dan persetujuan terpisah atas paket konkret.

## Verifikasi PostgreSQL Tahap 0

10 skenario lolos: cache basi; rasio base dipaksa 1 (0 dan -1); checkout 6/8 atas stok 10; dua checkout tanpa row stok; dua item produk sama; checkout versus penerimaan; checkout versus void; checkout versus opname; konversi invalid/pecahan dengan rollback.

Belum ada klaim pelacakan lot asal untuk reversal. Void/retur tetap membuat batch reversal baru sesuai batasan rencana.
