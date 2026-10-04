-- Nolkan SELURUH stok Gudang (branch_id 2) — 2026-10-04
--
-- Keputusan owner: semua produk Gudang jadi 0, tanpa kecuali (termasuk penyesuaian
-- manual yang diinput pagi ini). Yang dinolkan:
--   - product_stocks.qty (semua satuan)
--   - product_stock_batches.qty_remaining (dasar Laporan Nilai Stok)
--   - stock_shortfalls terbuka → ditutup, dicatat di stock_shortfall_clearings
--     (MANUAL_ADJUSTMENT, cost = cost shortfall itu sendiri → tidak ada true-up HPP)
--
-- Jalankan:
--   ssh ubuntu@43.173.8.37 "sudo docker exec -i hammielion-postgres-1 psql -U admin -d petshop_db -v ON_ERROR_STOP=1" < nol-kan-stok-gudang-2026-10-04.sql
--
-- Cadangan: backup.nol_gudang_20261004_stocks / _batches / _shortfalls
-- Pulihkan (kalau perlu):
--   UPDATE petshop.product_stocks t SET qty = b.qty FROM backup.nol_gudang_20261004_stocks b WHERE t.id = b.id;
--   UPDATE petshop.product_stock_batches t SET qty_remaining = b.qty_remaining FROM backup.nol_gudang_20261004_batches b WHERE t.id = b.id;
--   UPDATE petshop.stock_shortfalls t SET qty_remaining = b.qty_remaining, closed_at = b.closed_at FROM backup.nol_gudang_20261004_shortfalls b WHERE t.id = b.id;
--   UPDATE petshop.stock_shortfall_clearings SET reversed_at = now() WHERE shortfall_id IN (SELECT id FROM backup.nol_gudang_20261004_shortfalls) AND cleared_at::date = '2026-10-04' AND reference_type = 'MANUAL_ADJUSTMENT' AND reference_id IS NULL;

\set ON_ERROR_STOP 1
\pset pager off
BEGIN;

CREATE TEMP TABLE nz_products ON COMMIT DROP AS
SELECT product_id FROM petshop.product_stocks WHERE branch_id = 2 AND qty <> 0
UNION SELECT product_id FROM petshop.product_stock_batches WHERE branch_id = 2 AND qty_remaining > 0
UNION SELECT product_id FROM petshop.stock_shortfalls WHERE branch_id = 2 AND closed_at IS NULL AND qty_remaining > 0;

-- Kunci yang sama dengan lockProductStocks di aplikasi.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT product_id FROM nz_products ORDER BY product_id LOOP
    PERFORM pg_advisory_xact_lock(hashtext('stock:' || 2 || ':' || r.product_id));
  END LOOP;
END $$;

CREATE SCHEMA IF NOT EXISTS backup;
CREATE TABLE backup.nol_gudang_20261004_stocks AS
SELECT * FROM petshop.product_stocks WHERE branch_id = 2 AND qty <> 0;
CREATE TABLE backup.nol_gudang_20261004_batches AS
SELECT * FROM petshop.product_stock_batches WHERE branch_id = 2 AND qty_remaining > 0;
CREATE TABLE backup.nol_gudang_20261004_shortfalls AS
SELECT * FROM petshop.stock_shortfalls WHERE branch_id = 2 AND closed_at IS NULL AND qty_remaining > 0;

INSERT INTO petshop.audit_logs (branch_id, user_id, action, table_name, record_id, old_data, new_data)
SELECT 2, NULL, 'ZERO_STOCK_SQL', 'product_stocks', p.product_id::text,
       json_build_object(
         'stokPos', (SELECT COALESCE(SUM(qty), 0) FROM backup.nol_gudang_20261004_stocks s WHERE s.product_id = p.product_id),
         'qtyBatch', (SELECT COALESCE(SUM(qty_remaining), 0) FROM backup.nol_gudang_20261004_batches b WHERE b.product_id = p.product_id),
         'nilaiBatch', (SELECT COALESCE(SUM(qty_remaining::bigint * cost_price), 0) FROM backup.nol_gudang_20261004_batches b WHERE b.product_id = p.product_id),
         'shortfallTerbuka', (SELECT COALESCE(SUM(qty_remaining), 0) FROM backup.nol_gudang_20261004_shortfalls f WHERE f.product_id = p.product_id)
       )::text,
       json_build_object('stokPos', 0, 'qtyBatch', 0, 'shortfallTerbuka', 0,
                         'catatan', 'Seluruh stok Gudang dinolkan atas keputusan owner, 2026-10-04')::text
FROM nz_products p;

INSERT INTO petshop.stock_shortfall_clearings (shortfall_id, qty_cleared, cost_price_at_clearing, reference_type, reference_id)
SELECT id, qty_remaining, cost_price_per_unit, 'MANUAL_ADJUSTMENT', NULL
FROM backup.nol_gudang_20261004_shortfalls;

UPDATE petshop.stock_shortfalls SET qty_remaining = 0, closed_at = now()
WHERE id IN (SELECT id FROM backup.nol_gudang_20261004_shortfalls);

UPDATE petshop.product_stock_batches SET qty_remaining = 0
WHERE id IN (SELECT id FROM backup.nol_gudang_20261004_batches);

UPDATE petshop.product_stocks SET qty = 0
WHERE id IN (SELECT id FROM backup.nol_gudang_20261004_stocks);

-- Verifikasi: semua harus 0
SELECT
  (SELECT COUNT(*) FROM petshop.product_stocks WHERE branch_id = 2 AND qty <> 0) AS stok_bukan_nol,
  (SELECT COUNT(*) FROM petshop.product_stock_batches WHERE branch_id = 2 AND qty_remaining > 0) AS batch_tersisa,
  (SELECT COUNT(*) FROM petshop.stock_shortfalls WHERE branch_id = 2 AND closed_at IS NULL AND qty_remaining > 0) AS shortfall_terbuka;

SELECT
  (SELECT COUNT(*) FROM nz_products) AS produk,
  (SELECT COUNT(*) FROM backup.nol_gudang_20261004_stocks) AS baris_stok,
  (SELECT COALESCE(SUM(qty), 0) FROM backup.nol_gudang_20261004_stocks WHERE qty > 0) AS qty_positif_dinolkan,
  (SELECT COALESCE(SUM(qty), 0) FROM backup.nol_gudang_20261004_stocks WHERE qty < 0) AS qty_minus_dinolkan,
  (SELECT COUNT(*) FROM backup.nol_gudang_20261004_batches) AS baris_batch,
  (SELECT COALESCE(SUM(qty_remaining::bigint * cost_price), 0) FROM backup.nol_gudang_20261004_batches) AS nilai_stok_dinolkan,
  (SELECT COUNT(*) FROM backup.nol_gudang_20261004_shortfalls) AS shortfall_ditutup;

COMMIT;
