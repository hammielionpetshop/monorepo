-- Rekonsiliasi batch FIFO ke stok POS — 2026-10-04 — HANYA GUDANG (branch_id 2)
--
-- Keputusan owner: angka stok POS (product_stocks) dianggap benar. Kelebihan batch
-- (dasar Laporan Nilai Stok) dibuang FIFO dari batch tertua, sampai
--   SUM(batch) = MAX(0, stok POS + shortfall terbuka)
-- Stok POS dan shortfall TIDAK diubah. Produk yang batch-nya KURANG dari target tidak
-- disentuh (perlu SO). Produk stok minus: batch-nya dinolkan, stok minusnya tetap perlu SO.
--
-- Jalankan (baris terakhir COMMIT; ganti ROLLBACK untuk uji coba):
--   ssh ubuntu@43.173.8.37 "sudo docker exec -i hammielion-postgres-1 psql -U admin -d petshop_db -v ON_ERROR_STOP=1" < rekon-batch-ke-pos-2026-10-04.sql
--
-- Cadangan baris batch sebelum diubah: backup.rekon_batch_20261004
-- Pulihkan (kalau perlu):
--   UPDATE petshop.product_stock_batches bt SET qty_remaining = b.qty_remaining
--   FROM backup.rekon_batch_20261004 b WHERE bt.id = b.id;

\set ON_ERROR_STOP 1
\pset pager off
BEGIN;

CREATE TEMP TABLE rk_pair ON COMMIT DROP AS
WITH b AS (
  SELECT product_id, branch_id, SUM(qty_remaining) bq
  FROM petshop.product_stock_batches WHERE qty_remaining > 0 GROUP BY 1, 2
), s AS (
  SELECT product_id, branch_id, SUM(qty_remaining) sq
  FROM petshop.stock_shortfalls WHERE closed_at IS NULL AND qty_remaining > 0 GROUP BY 1, 2
), a AS (
  SELECT ps.product_id, ps.branch_id, SUM(ps.qty) aq
  FROM petshop.product_stocks ps
  JOIN petshop.products p ON p.id = ps.product_id AND p.base_uom_id = ps.uom_id
  GROUP BY 1, 2
)
SELECT a.product_id, a.branch_id
FROM a JOIN b USING (product_id, branch_id) LEFT JOIN s USING (product_id, branch_id)
WHERE a.branch_id = 2
  AND b.bq > GREATEST(0, a.aq + COALESCE(s.sq, 0));

-- Kunci yang sama dengan lockProductStocks di aplikasi, supaya penjualan yang
-- berjalan bersamaan menunggu sampai skrip ini selesai.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT branch_id, product_id FROM rk_pair ORDER BY branch_id, product_id LOOP
    PERFORM pg_advisory_xact_lock(hashtext('stock:' || r.branch_id || ':' || r.product_id));
  END LOOP;
END $$;

-- Hitung ulang SETELAH kunci didapat — angka bisa bergeser sejak rk_pair dibuat.
CREATE TEMP TABLE rk_plan ON COMMIT DROP AS
WITH b AS (
  SELECT bt.product_id, bt.branch_id, SUM(bt.qty_remaining) bq, SUM(bt.qty_remaining::bigint * bt.cost_price) bv
  FROM petshop.product_stock_batches bt JOIN rk_pair USING (product_id, branch_id)
  WHERE bt.qty_remaining > 0 GROUP BY 1, 2
), s AS (
  SELECT sf.product_id, sf.branch_id, SUM(sf.qty_remaining) sq
  FROM petshop.stock_shortfalls sf JOIN rk_pair USING (product_id, branch_id)
  WHERE sf.closed_at IS NULL AND sf.qty_remaining > 0 GROUP BY 1, 2
), a AS (
  SELECT ps.product_id, ps.branch_id, SUM(ps.qty) aq
  FROM petshop.product_stocks ps
  JOIN petshop.products p ON p.id = ps.product_id AND p.base_uom_id = ps.uom_id
  JOIN rk_pair ON rk_pair.product_id = ps.product_id AND rk_pair.branch_id = ps.branch_id
  GROUP BY 1, 2
)
SELECT a.product_id, a.branch_id, a.aq, COALESCE(s.sq, 0) sq, b.bq, b.bv,
       GREATEST(0, a.aq + COALESCE(s.sq, 0)) target
FROM a JOIN b USING (product_id, branch_id) LEFT JOIN s USING (product_id, branch_id)
WHERE b.bq > GREATEST(0, a.aq + COALESCE(s.sq, 0));

CREATE TEMP TABLE rk_batch ON COMMIT DROP AS
SELECT * FROM (
  SELECT bt.id batch_id, bt.product_id, bt.branch_id, bt.cost_price,
         GREATEST(0, LEAST(bt.qty_remaining,
           (pl.bq - pl.target) - (SUM(bt.qty_remaining) OVER w - bt.qty_remaining))) deduct
  FROM rk_plan pl
  JOIN petshop.product_stock_batches bt
    ON bt.product_id = pl.product_id AND bt.branch_id = pl.branch_id AND bt.qty_remaining > 0
  WINDOW w AS (PARTITION BY bt.product_id, bt.branch_id ORDER BY bt.received_at, bt.id)
) x WHERE deduct > 0;

CREATE SCHEMA IF NOT EXISTS backup;
CREATE TABLE backup.rekon_batch_20261004 AS
SELECT bt.* FROM petshop.product_stock_batches bt JOIN rk_batch r ON r.batch_id = bt.id;

UPDATE petshop.product_stock_batches bt
SET qty_remaining = bt.qty_remaining - r.deduct
FROM rk_batch r
WHERE bt.id = r.batch_id;

INSERT INTO petshop.audit_logs (branch_id, user_id, action, table_name, record_id, old_data, new_data)
SELECT pl.branch_id, NULL, 'BATCH_RECONCILE_SQL', 'product_stock_batches', pl.product_id::text,
       json_build_object('stokPos', pl.aq, 'shortfallTerbuka', pl.sq, 'qtyBatch', pl.bq, 'nilaiBatch', pl.bv)::text,
       json_build_object('qtyBatch', pl.target, 'qtyDibuang', pl.bq - pl.target, 'nilaiDibuang', d.dv,
                         'catatan', 'Rekonsiliasi batch ke stok POS (stok POS dianggap benar), 2026-10-04')::text
FROM rk_plan pl
JOIN (SELECT product_id, branch_id, SUM(deduct::bigint * cost_price) dv FROM rk_batch GROUP BY 1, 2) d
  USING (product_id, branch_id);

-- Verifikasi: harus 0
SELECT COUNT(*) AS masih_selisih
FROM rk_plan pl
WHERE (SELECT COALESCE(SUM(qty_remaining), 0) FROM petshop.product_stock_batches bt
       WHERE bt.product_id = pl.product_id AND bt.branch_id = pl.branch_id AND bt.qty_remaining > 0) <> pl.target;

SELECT br.name AS cabang, COUNT(DISTINCT (pl.product_id)) AS produk,
       SUM(pl.bq - pl.target) AS qty_dibuang,
       SUM(d.dv) AS nilai_dibuang
FROM rk_plan pl
JOIN petshop.branches br ON br.id = pl.branch_id
JOIN (SELECT product_id, branch_id, SUM(deduct::bigint * cost_price) dv FROM rk_batch GROUP BY 1, 2) d
  USING (product_id, branch_id)
GROUP BY br.name ORDER BY nilai_dibuang DESC;

COMMIT;
