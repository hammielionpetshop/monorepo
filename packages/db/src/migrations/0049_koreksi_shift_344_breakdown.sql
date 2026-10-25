-- Koreksi data: breakdown kasir shift 344 (BACKOFFICE Gudang, 24 Okt 2026).
-- Shift ditutup paksa oleh auto-close 23.59 WIB; versi lama forceCloseShift menyusun
-- breakdown hanya dari assigned_cashiers, sehingga 2 PO Internal DEBT kasir "irma"
-- (id 25) lenyap dari Riwayat Shift dan kolom Hutang milik "Nisa" tak tersimpan.
-- Transaksinya tetap utuh di tabel transactions (Laba Rugi & Omzet benar); migrasi ini
-- hanya menghitung ulang tabel turunan shift_cashier_breakdown dari transaksi COMPLETED.
--
-- Idempoten (ON CONFLICT DO UPDATE). Di DB tanpa shift 344 / tanpa transaksinya, CTE
-- menghasilkan 0 baris sehingga migrasi ini tidak menyentuh apa pun. Header shift tidak
-- diubah: shift 344 seluruhnya DEBT (kas = 0), jadi expected_cash per kasir = 0.
-- Catatan: shift lain yang mungkin terdampak bug sama dicek lewat query diagnostik di
-- docs/koreksi-shift-344-breakdown.sql.
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
