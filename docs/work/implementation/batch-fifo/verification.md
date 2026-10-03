# Verifikasi akhir batch/FIFO

2026-10-03, branch `verify/stock-fifo`, worktree `C:/wt/hm-stock5`.
DB khusus `petshop_wt_verify_stock_fifo`, PostgreSQL lokal port 5433. Migrasi repo sampai 0028 diterapkan pada DB lokal tersebut.

Release/merge 2026-10-03: `pnpm changelog:release patch` menghasilkan **1.107.31** (`3fc43e9`), lalu merge ke **main** (`a81425f`) dan push ke origin (`0e2b5df`). Typecheck, seluruh 254 tes terarah/integrasi, changelog check dan migrations check lolos ulang dari `C:/wt/hm-main`. Enam worktree/branch/DB tes Tahap 0-5 sudah dihapus sesuai permintaan user; commit dan artefak tetap tersimpan di main. Pipeline deploy dipicu push, keberhasilannya belum diverifikasi.

## Hasil

| Pemeriksaan | Hasil |
|---|---|
| `pnpm typecheck` | Lolos backoffice dan order-web |
| Regresi backoffice terarah | 23 file, 224 tes lolos |
| FIFO shared | 10 tes lolos |
| Integrasi PostgreSQL | 20 tes lolos |
| `pnpm changelog:check` | 4 fragmen valid |
| `pnpm migrations:check` | 29 entry, idx 0..28 sesuai SQL |
| `git diff --check` | Lolos |
| Guard harness | URL kosong, non-local, dan DB lokal non-worktree ditolak sebelum tes |
| Audit ulang lokal | Sama dengan baseline template: 12 drift, 1 konversi invalid, 15 batch tanpa PO |
| Audit ulang produksi | Sama dengan snapshot awal: 487 drift; 0 batch negatif, stok non-base, write-off; 39 pemakaian konversi invalid; 458 tinjauan modal; 5.779 batch tanpa PO; 23 sumber shortfall VOIDED |

20 tes integrasi menguji cache saldo basi, rasio base yang rusak, FIFO lintas UOM/tanggal/ID/modal/expiry, dua checkout (termasuk belum ada row stok), produk berulang, penjualan versus penerimaan/void/opname, qty/konversi invalid dengan rollback, approval PO ganda dan rollback item kedua, reversal PO lalu approval ulang, transfer lintas label UOM, ship ganda, bypass/penerimaan tujuan/pelunasan supplier, write-off residual/konkurensi/legacy/recount, serta audit tanpa fan-out dan orphan agregat.

Barrier memakai advisory lock atau row lock header dan membuktikan request menunggu melalui `pg_locks`/`pg_stat_activity`. Tidak memakai sleep sebagai bukti race. Fixture unik dibersihkan berdasarkan ID/cabang sendiri, tanpa truncate. Tes audit read-only membuktikan percobaan write fixture lokal ditolak PostgreSQL dengan SQLSTATE `25006` dan nilai tetap.

## Perintah reproduksi

Perintah berikut adalah catatan lingkungan pengujian sebelum cleanup. Untuk menjalankan ulang, siapkan worktree dan DB lokal baru sesuai prosedur klaim/worktree di CLAUDE.md, migrasikan DB lokal, lalu sesuaikan path dan `STOCK_TEST_DATABASE_URL`. Worktree `hm-stock5` dan DB `petshop_wt_verify_stock_fifo` sudah dihapus.

```powershell
cd C:/wt/hm-stock5
pnpm typecheck
$stockTests = @(git diff --name-only 5e630fa^ HEAD |
  Where-Object { $_ -like 'apps/backoffice/*.test.ts' -and $_ -notlike '*.integration.test.ts' } |
  ForEach-Object { $_.Substring('apps/backoffice/'.Length) })
$stockTests += @(
  'lib/services/report-service.stock-overview.test.ts',
  'lib/services/stock-mutation-summary.test.ts',
  'lib/services/stock-ledger.test.ts',
  'lib/services/stock-ledger-edit.test.ts'
)
pnpm --filter backoffice exec vitest run @stockTests
pnpm --filter @petshop/shared exec vitest run src/utils/fifo-costing.test.ts
$env:STOCK_TEST_DATABASE_URL = 'postgresql://petshop:petshop@127.0.0.1:5433/petshop_wt_verify_stock_fifo'
pnpm --filter backoffice exec vitest run --config vitest.stock-integration.config.ts
pnpm changelog:check
pnpm migrations:check
git diff --check
```

Audit ulang produksi 03:46:54 WIB terbukti `repeatable read`, `read_only=on`; [ringkasan akhir](audit/final-production-summary.json). Audit ulang lokal dilakukan sesudah cleanup fixture; [ringkasan akhir lokal](audit/final-local-summary.json).

## Batas dan tindak lanjut

- Suite seluruh monorepo, build, lint dan UAT browser tidak dijalankan. `pos-desktop` tidak dikerjakan.
- Produksi tidak dimutasi. Data lama belum dibersihkan; kandidat/perhitungan/precondition/approval ada pada [hasil rekonsiliasi](../../backlog/2026-10-03-hasil-rekonsiliasi-stok.md).
- Satu item transfer memakai expiry batch pertama yang dipotong. Jika FIFO memakai beberapa expiry, tujuan tetap satu batch; lot tujuan terpisah memerlukan fase alokasi batch.
- Void/retur/reversal tetap membuat batch baru; tidak ada klaim lot asal dipulihkan. Shortfall sumber VOIDED/retur belum otomatis dibatalkan; kasus lama masuk audit dan keputusan koreksi terpisah.
- Seluruh implementasi sudah di-merge dan di-push ke main. Klaim Tahap 0-5 dan migration lock dilepas setelah merge. Branch/worktree/DB tes lokal Tahap 0-5 sudah dibersihkan; tidak menghapus worktree pekerjaan lain. Deploy otomatis belum diverifikasi berhasil.
