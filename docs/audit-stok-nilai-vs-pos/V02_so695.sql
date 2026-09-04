\pset pager off
SET search_path TO petshop, public;

-- V02 — SO 695 (Toko Pusat, 239 item, disetujui 2026-08-28). Read-only.
-- Menguji dua hal: (1) apakah approval menyamakan batch & agregat,
-- (2) apakah penjualan sesudahnya memotong dua-duanya.

\echo '=== A. Item SO 695 menurut ada/tidaknya selisih saat SO ==='
SELECT CASE WHEN soi.variance_qty = 0 THEN 'selisih 0' ELSE 'ada selisih' END AS jenis,
       count(*) AS jml,
       count(*) FILTER (WHERE ps.qty = COALESCE(bt.batch_sum,0)) AS sejajar_sekarang,
       count(*) FILTER (WHERE COALESCE(bt.batch_sum,0) > ps.qty) AS batch_lebih_tinggi
FROM stock_opname_items soi
LEFT JOIN product_stocks ps ON ps.product_id = soi.product_id AND ps.branch_id = 3
LEFT JOIN (SELECT product_id, branch_id, SUM(qty_remaining) AS batch_sum
           FROM product_stock_batches GROUP BY product_id, branch_id) bt
       ON bt.product_id = soi.product_id AND bt.branch_id = 3
WHERE soi.so_id = 695
GROUP BY 1 ORDER BY 1;

\echo ''
\echo '=== B. Vonis per produk: siapa yang mengikuti penjualan sesudah approval? ==='
WITH so AS (SELECT id, branch_id, approved_at FROM stock_opnames WHERE id = 695),
terjual AS (
  SELECT ti.product_id, SUM(ti.qty * COALESCE(puc.ratio, 1)) AS qty_base
  FROM transaction_items ti
  JOIN transactions t ON t.id = ti.transaction_id
  JOIN so s           ON s.branch_id = t.branch_id
  JOIN products p     ON p.id = ti.product_id
  LEFT JOIN product_uom_conversions puc
         ON puc.product_id = ti.product_id AND puc.uom_id = ti.uom_id AND ti.uom_id <> p.base_uom_id
  WHERE t.created_at > s.approved_at AND t.status <> 'VOIDED'
  GROUP BY ti.product_id
)
SELECT CASE
         WHEN ps.qty = COALESCE(bt.batch_sum,0) THEN 'dua-duanya ikut (sejajar)'
         WHEN COALESCE(bt.batch_sum,0) > ps.qty AND ps.qty = soi.physical_qty - tj.qty_base
              THEN 'HANYA POS yang ikut'
         WHEN COALESCE(bt.batch_sum,0) > ps.qty THEN 'batch tertinggal (beda lain)'
         ELSE 'lain-lain'
       END AS vonis,
       count(*) AS jml_produk,
       SUM(COALESCE(bt.batch_sum,0) - ps.qty) AS total_selisih_unit
FROM so s
JOIN stock_opname_items soi ON soi.so_id = s.id
JOIN terjual tj             ON tj.product_id = soi.product_id
LEFT JOIN product_stocks ps ON ps.product_id = soi.product_id AND ps.branch_id = s.branch_id
LEFT JOIN (SELECT product_id, branch_id, SUM(qty_remaining) AS batch_sum
           FROM product_stock_batches GROUP BY product_id, branch_id) bt
       ON bt.product_id = soi.product_id AND bt.branch_id = s.branch_id
GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '=== C. Contoh 25 produk yang terjual sesudah approval ==='
WITH so AS (SELECT id, branch_id, approved_at FROM stock_opnames WHERE id = 695),
terjual AS (
  SELECT ti.product_id, SUM(ti.qty * COALESCE(puc.ratio, 1)) AS qty_base
  FROM transaction_items ti
  JOIN transactions t ON t.id = ti.transaction_id
  JOIN so s           ON s.branch_id = t.branch_id
  JOIN products p     ON p.id = ti.product_id
  LEFT JOIN product_uom_conversions puc
         ON puc.product_id = ti.product_id AND puc.uom_id = ti.uom_id AND ti.uom_id <> p.base_uom_id
  WHERE t.created_at > s.approved_at AND t.status <> 'VOIDED'
  GROUP BY ti.product_id
)
SELECT substr(p.name,1,28) AS produk, soi.system_qty AS sistem_so, soi.physical_qty AS fisik_so,
       soi.variance_qty AS selisih_so, tj.qty_base AS terjual,
       soi.physical_qty - tj.qty_base AS harusnya,
       ps.qty AS pos, COALESCE(bt.batch_sum,0) AS batch,
       COALESCE(bt.batch_sum,0) - ps.qty AS batch_minus_pos
FROM so s
JOIN stock_opname_items soi ON soi.so_id = s.id
JOIN products p             ON p.id = soi.product_id
JOIN terjual tj             ON tj.product_id = soi.product_id
LEFT JOIN product_stocks ps ON ps.product_id = soi.product_id AND ps.branch_id = s.branch_id
LEFT JOIN (SELECT product_id, branch_id, SUM(qty_remaining) AS batch_sum
           FROM product_stock_batches GROUP BY product_id, branch_id) bt
       ON bt.product_id = soi.product_id AND bt.branch_id = s.branch_id
ORDER BY (COALESCE(bt.batch_sum,0) - ps.qty) DESC, tj.qty_base DESC
LIMIT 25;

\echo ''
\echo '=== D. Audit STOCK_OPNAME_ADJUSTMENT dari approval SO 695: batchDelta yang ditulis ==='
SELECT count(*) AS jml_baris,
       count(*) FILTER (WHERE (new_data::jsonb->>'batchDelta')::numeric = 0) AS batchdelta_nol,
       count(*) FILTER (WHERE (new_data::jsonb->>'batchDelta')::numeric <> 0) AS batchdelta_tidak_nol
FROM audit_logs
WHERE action = 'STOCK_OPNAME_ADJUSTMENT'
  AND branch_id = 3
  AND created_at BETWEEN '2026-08-28 10:55' AND '2026-08-28 11:10';
