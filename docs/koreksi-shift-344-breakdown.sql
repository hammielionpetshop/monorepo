-- Koreksi breakdown kasir shift 344 (BACKOFFICE Gudang, 24 Okt 2026)
-- ============================================================================
-- Masalah: shift ditutup paksa oleh auto-close 23.59 WIB. Versi lama
-- `forceCloseShift` hanya menyusun breakdown dari `assigned_cashiers` (saat buka
-- shift = [21] "Nisa"), sehingga transaksi kasir lain yang bertransaksi di shift
-- ini — "irma" (id 25), 2 PO Internal DEBT sebesar Rp 18.061.300 — hilang dari
-- breakdown, dan kolom non-tunai (Hutang) milik Nisa pun tidak tersimpan.
-- Transaksinya tetap utuh di tabel `transactions` (Laba Rugi & Omzet tetap benar);
-- yang diperbaiki di sini HANYA tabel turunan `shift_cashier_breakdown` agar
-- Riwayat Shift menampilkan semua kasir & nominalnya dengan benar.
--
-- Aman: tidak menyentuh transaksi/stok/uang. Hanya menghitung ulang baris
-- breakdown dari transaksi COMPLETED yang sudah ada. Idempoten (boleh diulang).
--
-- Sifat shift 344: SEMUA penjualan = DEBT (kas tunai = 0), jadi expected_cash per
-- kasir = 0 dan total kas shift tetap 0 — header shift TIDAK berubah.
--
-- Cara jalan di produksi:
--   psql "$DATABASE_URL" -f docs/koreksi-shift-344-breakdown.sql
-- Jalankan SETELAH deploy perbaikan kode `shift-force-close.ts` (agar tak terulang).
-- ============================================================================

BEGIN;

-- Ganti daftar ini bila perlu mengoreksi shift lain (lihat query diagnostik di bawah).
WITH target(shift_id) AS (VALUES (344)),
trx AS (
  SELECT t.shift_id, t.id, t.cashier_id, t.change_amount
  FROM petshop.transactions t
  JOIN target USING (shift_id)
  WHERE t.status = 'COMPLETED'
),
agg_trx AS (
  SELECT shift_id, cashier_id, COUNT(*) AS n_trx, COALESCE(SUM(change_amount),0) AS total_change
  FROM trx GROUP BY shift_id, cashier_id
),
agg_pay AS (
  SELECT trx.shift_id, trx.cashier_id,
    COALESCE(SUM(tp.amount) FILTER (WHERE pm.type='CASH'),0)          AS cash,
    COALESCE(SUM(tp.amount) FILTER (WHERE pm.type='QRIS'),0)          AS qris,
    COALESCE(SUM(tp.amount) FILTER (WHERE pm.type='BANK_TRANSFER'),0) AS debit,
    COALESCE(SUM(tp.amount) FILTER (WHERE pm.type='DEBT'),0)          AS debt,
    COALESCE(SUM(tp.amount) FILTER (WHERE pm.type NOT IN ('CASH','QRIS','BANK_TRANSFER','DEBT')),0) AS credit,
    COALESCE(SUM(tp.amount),0)                                        AS total
  FROM trx
  JOIN petshop.transaction_payments tp ON tp.transaction_id = trx.id
  JOIN petshop.payment_methods pm ON pm.id = tp.payment_method_id
  GROUP BY trx.shift_id, trx.cashier_id
),
agg_exp AS (
  SELECT se.shift_id, se.cashier_id, COALESCE(SUM(se.amount),0) AS total_exp
  FROM petshop.shift_expenses se
  JOIN target USING (shift_id)
  GROUP BY se.shift_id, se.cashier_id
),
-- Gabungan kasir: yang bertransaksi ∪ yang mencatat pengeluaran (sama seperti kode).
cashiers AS (
  SELECT shift_id, cashier_id FROM agg_trx
  UNION
  SELECT shift_id, cashier_id FROM agg_exp
),
calc AS (
  SELECT
    c.shift_id, c.cashier_id,
    COALESCE(ap.cash,0)  - COALESCE(at.total_change,0) AS total_sales_cash,
    COALESCE(ap.qris,0)   AS total_sales_qris,
    COALESCE(ap.debit,0)  AS total_sales_debit,
    COALESCE(ap.credit,0) AS total_sales_credit,
    COALESCE(ap.debt,0)   AS total_sales_debt,
    COALESCE(ap.total,0) - COALESCE(at.total_change,0) AS total_sales,
    COALESCE(at.n_trx,0)     AS total_transactions,
    COALESCE(ae.total_exp,0) AS total_expenses
  FROM cashiers c
  LEFT JOIN agg_trx at USING (shift_id, cashier_id)
  LEFT JOIN agg_pay ap USING (shift_id, cashier_id)
  LEFT JOIN agg_exp ae USING (shift_id, cashier_id)
)
INSERT INTO petshop.shift_cashier_breakdown
  (shift_id, cashier_id, total_sales_cash, total_sales_qris, total_sales_debit,
   total_sales_credit, total_sales_debt, total_sales, total_transactions,
   total_expenses, modal_share, expected_cash, real_cash, variance, is_variance_flagged)
SELECT
  shift_id, cashier_id, total_sales_cash, total_sales_qris, total_sales_debit,
  total_sales_credit, total_sales_debt, total_sales, total_transactions,
  total_expenses, 0, (total_sales_cash - total_expenses), NULL, NULL, false
FROM calc
ON CONFLICT (shift_id, cashier_id) DO UPDATE SET
  total_sales_cash    = EXCLUDED.total_sales_cash,
  total_sales_qris    = EXCLUDED.total_sales_qris,
  total_sales_debit   = EXCLUDED.total_sales_debit,
  total_sales_credit  = EXCLUDED.total_sales_credit,
  total_sales_debt    = EXCLUDED.total_sales_debt,
  total_sales         = EXCLUDED.total_sales,
  total_transactions  = EXCLUDED.total_transactions,
  total_expenses      = EXCLUDED.total_expenses,
  modal_share         = 0,
  expected_cash       = EXCLUDED.expected_cash,
  real_cash           = NULL,
  variance            = NULL,
  is_variance_flagged = false;

-- Verifikasi (lihat hasil sebelum COMMIT): dua baris kasir, total hutang 65.125.550,
-- expected_cash = 0 keduanya.
SELECT u.name AS kasir, bd.total_transactions AS trx, bd.total_sales_debt AS hutang,
       bd.total_sales AS total_jual, bd.expected_cash
FROM petshop.shift_cashier_breakdown bd
JOIN petshop.users u ON u.id = bd.cashier_id
WHERE bd.shift_id = 344
ORDER BY u.name;

COMMIT;

-- ============================================================================
-- DIAGNOSTIK — cek apakah ada shift LAIN yang terdampak bug yang sama
-- (shift sudah tutup, ada kasir COMPLETED yang tidak punya baris breakdown):
--
-- WITH tc AS (
--   SELECT DISTINCT t.shift_id, t.cashier_id
--   FROM petshop.transactions t WHERE t.status='COMPLETED'
-- )
-- SELECT s.id AS shift, s.origin, s.status, b.name AS cabang, s.opened_at::date AS tgl,
--        u.name AS kasir_hilang
-- FROM tc
-- JOIN petshop.shifts s ON s.id = tc.shift_id
-- JOIN petshop.branches b ON b.id = s.branch_id
-- JOIN petshop.users u ON u.id = tc.cashier_id
-- WHERE s.status IN ('CLOSED','FORCE_CLOSED')
--   AND NOT EXISTS (SELECT 1 FROM petshop.shift_cashier_breakdown bd
--                   WHERE bd.shift_id=tc.shift_id AND bd.cashier_id=tc.cashier_id)
-- ORDER BY s.opened_at DESC;
--
-- Untuk shift yang ditemukan: tambahkan id-nya ke VALUES di CTE `target` lalu jalankan
-- ulang skrip ini. CATATAN: bila shift terdampak punya penjualan TUNAI dari kasir yang
-- hilang, `shifts.total_closing_cash_expected` ikut kurang — tinjau terpisah sebelum
-- menyesuaikan header (menyangkut angka selisih kas), jangan diubah membabi buta.
-- ============================================================================
