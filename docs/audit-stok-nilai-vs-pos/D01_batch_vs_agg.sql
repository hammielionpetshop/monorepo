\pset pager off
\pset footer off

\echo '========================================================================'
\echo ' DIAGNOSTIK: Nilai Stok (SUM batch qty_remaining) vs Stok POS (product_stocks.qty)'
\echo '========================================================================'

\echo ''
\echo '=== 0. Sizing & struktur ==='
SELECT
  (SELECT count(*) FROM petshop.products)                          AS n_products,
  (SELECT count(*) FROM petshop.products WHERE is_active)          AS n_products_aktif,
  (SELECT count(*) FROM petshop.branches)                          AS n_branches,
  (SELECT count(*) FROM petshop.product_stocks)                    AS n_stock_rows,
  (SELECT count(*) FROM petshop.product_stock_batches)             AS n_batch_rows,
  (SELECT count(*) FROM petshop.product_stock_batches WHERE qty_remaining > 0) AS n_batch_bersisa;

\echo ''
\echo '=== 0a. Index product_stocks (cek keunikan product+branch) ==='
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'petshop' AND tablename = 'product_stocks';

\echo ''
\echo '=== 0b. product_stocks: baris per (product,branch) & uom_id vs base_uom_id ==='
SELECT
  count(*)                                                    AS total_rows,
  count(DISTINCT (ps.product_id, ps.branch_id))               AS distinct_product_branch,
  count(*) FILTER (WHERE ps.uom_id <> p.base_uom_id)          AS rows_uom_bukan_base,
  count(*) FILTER (WHERE ps.qty < 0)                          AS rows_qty_minus
FROM petshop.product_stocks ps
JOIN petshop.products p ON p.id = ps.product_id;

\echo ''
\echo '=== 0c. Contoh baris product_stocks yg uom_id != base_uom_id (max 40) ==='
SELECT ps.branch_id, ps.product_id, left(p.name,40) AS produk,
       ps.uom_id AS ps_uom, p.base_uom_id AS base_uom, ps.qty
FROM petshop.product_stocks ps
JOIN petshop.products p ON p.id = ps.product_id
WHERE ps.uom_id <> p.base_uom_id
ORDER BY ps.branch_id, p.name
LIMIT 40;

\echo ''
\echo '=== 1. REKAP selisih per cabang (batch_qty - agg_qty) ==='
WITH batch AS (
  SELECT product_id, branch_id,
         SUM(qty_remaining)                        AS batch_qty,
         SUM(qty_remaining::bigint * cost_price)   AS batch_value
  FROM petshop.product_stock_batches
  GROUP BY product_id, branch_id
),
agg AS (
  SELECT product_id, branch_id, SUM(qty) AS agg_qty
  FROM petshop.product_stocks
  GROUP BY product_id, branch_id
),
pb AS (
  SELECT product_id, branch_id FROM batch
  UNION
  SELECT product_id, branch_id FROM agg
),
j AS (
  SELECT pb.product_id, pb.branch_id,
         COALESCE(b.batch_qty,0)   AS batch_qty,
         COALESCE(a.agg_qty,0)     AS agg_qty,
         COALESCE(b.batch_value,0) AS batch_value
  FROM pb
  LEFT JOIN batch b ON b.product_id = pb.product_id AND b.branch_id = pb.branch_id
  LEFT JOIN agg   a ON a.product_id = pb.product_id AND a.branch_id = pb.branch_id
)
SELECT
  COALESCE(br.name,'-- SEMUA --')                              AS cabang,
  count(*)                                                     AS n_pb,
  count(*) FILTER (WHERE batch_qty = agg_qty)                  AS n_sejajar,
  count(*) FILTER (WHERE batch_qty <> agg_qty)                 AS n_selisih,
  count(*) FILTER (WHERE agg_qty < 0)                          AS n_agg_minus,
  count(*) FILTER (WHERE batch_qty > agg_qty)                  AS n_batch_gt_agg,
  count(*) FILTER (WHERE agg_qty > batch_qty)                  AS n_agg_gt_batch,
  SUM(batch_qty - agg_qty)                                     AS net_gap_qty,
  SUM(GREATEST(batch_qty - agg_qty, 0))                        AS gap_qty_batch_lebih,
  SUM(GREATEST(agg_qty - batch_qty, 0))                        AS gap_qty_agg_lebih
FROM j
LEFT JOIN petshop.branches br ON br.id = j.branch_id
GROUP BY ROLLUP(br.name)
ORDER BY cabang;

\echo ''
\echo '=== 2. TOP 30: Nilai Stok jauh > POS (batch_qty - agg_qty terbesar) ==='
WITH batch AS (
  SELECT product_id, branch_id, SUM(qty_remaining) AS batch_qty,
         SUM(qty_remaining::bigint * cost_price) AS batch_value
  FROM petshop.product_stock_batches GROUP BY product_id, branch_id
),
agg AS (
  SELECT product_id, branch_id, SUM(qty) AS agg_qty
  FROM petshop.product_stocks GROUP BY product_id, branch_id
),
pb AS (SELECT product_id,branch_id FROM batch UNION SELECT product_id,branch_id FROM agg),
j AS (
  SELECT pb.product_id, pb.branch_id,
         COALESCE(b.batch_qty,0) AS batch_qty, COALESCE(a.agg_qty,0) AS agg_qty,
         COALESCE(b.batch_value,0) AS batch_value
  FROM pb
  LEFT JOIN batch b ON b.product_id=pb.product_id AND b.branch_id=pb.branch_id
  LEFT JOIN agg   a ON a.product_id=pb.product_id AND a.branch_id=pb.branch_id
)
SELECT br.name AS cabang, left(p.name,40) AS produk,
       j.batch_qty, j.agg_qty, (j.batch_qty - j.agg_qty) AS gap_qty,
       CASE WHEN j.batch_qty > 0 THEN round(j.batch_value::numeric / j.batch_qty) END AS cost_rata,
       CASE WHEN j.batch_qty > 0
            THEN round((j.batch_qty - j.agg_qty) * (j.batch_value::numeric / j.batch_qty))
       END AS gap_value_est
FROM j
JOIN petshop.products p ON p.id = j.product_id
JOIN petshop.branches br ON br.id = j.branch_id
WHERE j.batch_qty > j.agg_qty
ORDER BY (j.batch_qty - j.agg_qty) DESC
LIMIT 30;

\echo ''
\echo '=== 3. TOP 30: POS > Nilai Stok (agg_qty - batch_qty terbesar) ==='
WITH batch AS (
  SELECT product_id, branch_id, SUM(qty_remaining) AS batch_qty
  FROM petshop.product_stock_batches GROUP BY product_id, branch_id
),
agg AS (
  SELECT product_id, branch_id, SUM(qty) AS agg_qty
  FROM petshop.product_stocks GROUP BY product_id, branch_id
),
pb AS (SELECT product_id,branch_id FROM batch UNION SELECT product_id,branch_id FROM agg),
j AS (
  SELECT pb.product_id, pb.branch_id,
         COALESCE(b.batch_qty,0) AS batch_qty, COALESCE(a.agg_qty,0) AS agg_qty
  FROM pb
  LEFT JOIN batch b ON b.product_id=pb.product_id AND b.branch_id=pb.branch_id
  LEFT JOIN agg   a ON a.product_id=pb.product_id AND a.branch_id=pb.branch_id
)
SELECT br.name AS cabang, left(p.name,40) AS produk,
       j.batch_qty, j.agg_qty, (j.agg_qty - j.batch_qty) AS gap_qty
FROM j
JOIN petshop.products p ON p.id = j.product_id
JOIN petshop.branches br ON br.id = j.branch_id
WHERE j.agg_qty > j.batch_qty
ORDER BY (j.agg_qty - j.batch_qty) DESC
LIMIT 30;

\echo ''
\echo '=== 4. Agregat minus (utang oversell) — TOP 40 ==='
SELECT br.name AS cabang, left(p.name,40) AS produk, ps.uom_id AS ps_uom,
       p.base_uom_id AS base_uom, ps.qty
FROM petshop.product_stocks ps
JOIN petshop.products p ON p.id = ps.product_id
JOIN petshop.branches br ON br.id = ps.branch_id
WHERE ps.qty < 0
ORDER BY ps.qty ASC
LIMIT 40;

\echo ''
\echo '=== 4b. Rekap agregat minus per cabang ==='
SELECT br.name AS cabang, count(*) AS n_produk_minus, SUM(ps.qty) AS total_qty_minus
FROM petshop.product_stocks ps
JOIN petshop.branches br ON br.id = ps.branch_id
WHERE ps.qty < 0
GROUP BY ROLLUP(br.name)
ORDER BY cabang;

\echo ''
\echo '=== 5. Punya batch bersisa TAPI tak ada baris product_stocks sama sekali ==='
WITH batch AS (
  SELECT product_id, branch_id, SUM(qty_remaining) AS batch_qty
  FROM petshop.product_stock_batches GROUP BY product_id, branch_id
)
SELECT br.name AS cabang, left(p.name,40) AS produk, b.batch_qty
FROM batch b
JOIN petshop.products p ON p.id = b.product_id
JOIN petshop.branches br ON br.id = b.branch_id
LEFT JOIN petshop.product_stocks ps
       ON ps.product_id = b.product_id AND ps.branch_id = b.branch_id
WHERE ps.id IS NULL AND b.batch_qty <> 0
ORDER BY b.batch_qty DESC
LIMIT 30;

\echo ''
\echo '=== 6. Punya baris product_stocks qty>0 TAPI total batch = 0 (Nilai Stok nol, POS ada) ==='
WITH batch AS (
  SELECT product_id, branch_id, SUM(qty_remaining) AS batch_qty
  FROM petshop.product_stock_batches GROUP BY product_id, branch_id
)
SELECT br.name AS cabang, left(p.name,40) AS produk, ps.qty AS agg_qty,
       COALESCE(b.batch_qty,0) AS batch_qty
FROM petshop.product_stocks ps
JOIN petshop.products p ON p.id = ps.product_id
JOIN petshop.branches br ON br.id = ps.branch_id
LEFT JOIN batch b ON b.product_id = ps.product_id AND b.branch_id = ps.branch_id
WHERE ps.qty > 0 AND COALESCE(b.batch_qty,0) = 0
ORDER BY ps.qty DESC
LIMIT 30;

\echo ''
\echo '=== 7. Estimasi dampak rupiah total selisih (|gap_qty| x cost) ==='
WITH batch AS (
  SELECT product_id, branch_id, SUM(qty_remaining) AS batch_qty,
         SUM(qty_remaining::bigint * cost_price) AS batch_value
  FROM petshop.product_stock_batches GROUP BY product_id, branch_id
),
agg AS (
  SELECT product_id, branch_id, SUM(qty) AS agg_qty
  FROM petshop.product_stocks GROUP BY product_id, branch_id
),
pb AS (SELECT product_id,branch_id FROM batch UNION SELECT product_id,branch_id FROM agg),
j AS (
  SELECT pb.product_id, pb.branch_id,
         COALESCE(b.batch_qty,0) AS batch_qty, COALESCE(a.agg_qty,0) AS agg_qty,
         CASE WHEN COALESCE(b.batch_qty,0) > 0
              THEN b.batch_value::numeric / b.batch_qty
              ELSE COALESCE(pr.default_cost_price,0) END AS cost_est
  FROM pb
  LEFT JOIN batch b ON b.product_id=pb.product_id AND b.branch_id=pb.branch_id
  LEFT JOIN agg   a ON a.product_id=pb.product_id AND a.branch_id=pb.branch_id
  LEFT JOIN petshop.products pr ON pr.id = pb.product_id
)
SELECT
  count(*) FILTER (WHERE batch_qty <> agg_qty)                          AS n_pb_selisih,
  round(SUM(ABS(batch_qty - agg_qty) * cost_est))                       AS abs_gap_value,
  round(SUM((batch_qty - agg_qty) * cost_est))                          AS net_gap_value,
  round(SUM(GREATEST(batch_qty - agg_qty,0) * cost_est))               AS nilaistok_lebih_value,
  round(SUM(GREATEST(agg_qty - batch_qty,0) * cost_est))               AS pos_lebih_value
FROM j;
