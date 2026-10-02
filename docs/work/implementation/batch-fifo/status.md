# Pelaksanaan perbaikan batch/FIFO

Rencana sumber: `C:/wt/hm-laporan/docs/work/plans/2026-10-03-perbaikan-batch-fifo.md`.
Tanggal: 2026-10-03. Pelaksana: Codex.

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
- Tahap 0: sedang verifikasi akhir. Tahap 1–5 belum selesai.
- Implementasi akan disimpan sebagai branch bertumpuk sesuai dependensi; perubahan kode tidak di-push ke main karena push kode memicu deploy produksi.

## Verifikasi PostgreSQL Tahap 0

10 skenario lolos: cache basi; rasio base dipaksa 1 (0 dan -1); checkout 6/8 atas stok 10; dua checkout tanpa row stok; dua item produk sama; checkout versus penerimaan; checkout versus void; checkout versus opname; konversi invalid/pecahan dengan rollback.

Belum ada klaim pelacakan lot asal untuk reversal. Void/retur tetap membuat batch reversal baru sesuai batasan rencana.
