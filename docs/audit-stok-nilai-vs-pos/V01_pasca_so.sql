\pset pager off
SET search_path TO petshop, public;

-- V01 — Menguji laporan: "setelah SO disetujui, POS & batch sejajar, tapi penjualan
-- berikutnya tidak memotong batch." Read-only.

\echo '=== A. SO yang sudah disetujui (terbaru dulu) ==='
SELECT so.id AS so_id, b.name AS cabang, so.status, so.approved_at,
       count(soi.id) AS jml_item
FROM stock_opnames so
JOIN branches b ON b.id = so.branch_id
LEFT JOIN stock_opname_items soi ON soi.so_id = so.id
WHERE so.approved_at IS NOT NULL
GROUP BY so.id, b.name, so.status, so.approved_at
ORDER BY so.approved_at DESC
LIMIT 15;

\echo ''
\echo '=== B. Per produk pada SO toko terakhir yang disetujui: siapa yang mengikuti penjualan? ==='
-- fisik saat SO  −  terjual sesudah approve  =  harusnya = agregat = batch sekarang
WITH so_terakhir AS (
  SELECT so.id, so.branch_id, so.approved_at
  FROM stock_opnames so
  JOIN branches b ON b.id = so.branch_id
  WHERE so.approved_at IS NOT NULL
    AND b.name ILIKE '%toko%'
  ORDER BY so.approved_at DESC
  LIMIT 1
),
terjual AS (
  SELECT ti.product_id,
         SUM(ti.qty * COALESCE(puc.ratio, 1)) AS qty_base
  FROM transaction_items ti
  JOIN transactions t ON t.id = ti.transaction_id
  JOIN so_terakhir s  ON s.branch_id = t.branch_id
  JOIN products p     ON p.id = ti.product_id
  LEFT JOIN product_uom_conversions puc
         ON puc.product_id = ti.product_id AND puc.uom_id = ti.uom_id
        AND ti.uom_id <> p.base_uom_id
  WHERE t.created_at > s.approved_at
    AND t.status <> 'VOIDED'
  GROUP BY ti.product_id
)
SELECT p.name AS produk,
       soi.physical_qty              AS fisik_saat_so,
       COALESCE(tj.qty_base, 0)      AS terjual_sesudah,
       soi.physical_qty - COALESCE(tj.qty_base, 0) AS harusnya,
       ps.qty                        AS agregat_pos,
       COALESCE(bt.batch_sum, 0)     AS batch_sekarang,
       CASE
         WHEN COALESCE(bt.batch_sum,0) = soi.physical_qty - COALESCE(tj.qty_base,0)
              AND ps.qty = COALESCE(bt.batch_sum,0)                    THEN 'dua-duanya ikut'
         WHEN ps.qty = soi.physical_qty - COALESCE(tj.qty_base,0)
              AND COALESCE(bt.batch_sum,0) > ps.qty                    THEN 'HANYA POS yang ikut'
         WHEN COALESCE(bt.batch_sum,0) = soi.physical_qty - COALESCE(tj.qty_base,0)
              AND ps.qty < COALESCE(bt.batch_sum,0)                    THEN 'hanya batch yang ikut'
         ELSE 'lain-lain'
       END AS vonis
FROM so_terakhir s
JOIN stock_opname_items soi ON soi.so_id = s.id
JOIN products p             ON p.id = soi.product_id
LEFT JOIN terjual tj        ON tj.product_id = soi.product_id
LEFT JOIN product_stocks ps ON ps.product_id = soi.product_id AND ps.branch_id = s.branch_id
LEFT JOIN (
  SELECT product_id, branch_id, SUM(qty_remaining) AS batch_sum
  FROM product_stock_batches GROUP BY product_id, branch_id
) bt ON bt.product_id = soi.product_id AND bt.branch_id = s.branch_id
WHERE COALESCE(tj.qty_base, 0) > 0
ORDER BY COALESCE(tj.qty_base, 0) DESC
LIMIT 40;

\echo ''
\echo '=== C. Rekap vonis untuk SO toko terakhir ==='
WITH so_terakhir AS (
  SELECT so.id, so.branch_id, so.approved_at
  FROM stock_opnames so JOIN branches b ON b.id = so.branch_id
  WHERE so.approved_at IS NOT NULL AND b.name ILIKE '%toko%'
  ORDER BY so.approved_at DESC LIMIT 1
),
terjual AS (
  SELECT ti.product_id, SUM(ti.qty * COALESCE(puc.ratio, 1)) AS qty_base
  FROM transaction_items ti
  JOIN transactions t ON t.id = ti.transaction_id
  JOIN so_terakhir s  ON s.branch_id = t.branch_id
  JOIN products p     ON p.id = ti.product_id
  LEFT JOIN product_uom_conversions puc
         ON puc.product_id = ti.product_id AND puc.uom_id = ti.uom_id AND ti.uom_id <> p.base_uom_id
  WHERE t.created_at > s.approved_at AND t.status <> 'VOIDED'
  GROUP BY ti.product_id
)
SELECT CASE
         WHEN COALESCE(bt.batch_sum,0) = soi.physical_qty - COALESCE(tj.qty_base,0)
              AND ps.qty = COALESCE(bt.batch_sum,0)                    THEN 'dua-duanya ikut'
         WHEN ps.qty = soi.physical_qty - COALESCE(tj.qty_base,0)
              AND COALESCE(bt.batch_sum,0) > ps.qty                    THEN 'HANYA POS yang ikut'
         WHEN COALESCE(bt.batch_sum,0) = soi.physical_qty - COALESCE(tj.qty_base,0)
              AND ps.qty < COALESCE(bt.batch_sum,0)                    THEN 'hanya batch yang ikut'
         ELSE 'lain-lain'
       END AS vonis,
       count(*) AS jml_produk
FROM so_terakhir s
JOIN stock_opname_items soi ON soi.so_id = s.id
LEFT JOIN terjual tj        ON tj.product_id = soi.product_id
LEFT JOIN product_stocks ps ON ps.product_id = soi.product_id AND ps.branch_id = s.branch_id
LEFT JOIN (
  SELECT product_id, branch_id, SUM(qty_remaining) AS batch_sum
  FROM product_stock_batches GROUP BY product_id, branch_id
) bt ON bt.product_id = soi.product_id AND bt.branch_id = s.branch_id
WHERE COALESCE(tj.qty_base, 0) > 0
GROUP BY 1 ORDER BY 2 DESC;

\echo ''
\echo '=== D. Apakah SO terakhir itu benar-benar menyamakan batch & agregat? (item tanpa penjualan sesudahnya) ==='
WITH so_terakhir AS (
  SELECT so.id, so.branch_id, so.approved_at
  FROM stock_opnames so JOIN branches b ON b.id = so.branch_id
  WHERE so.approved_at IS NOT NULL AND b.name ILIKE '%toko%'
  ORDER BY so.approved_at DESC LIMIT 1
),
terjual AS (
  SELECT ti.product_id
  FROM transaction_items ti
  JOIN transactions t ON t.id = ti.transaction_id
  JOIN so_terakhir s  ON s.branch_id = t.branch_id
  WHERE t.created_at > s.approved_at AND t.status <> 'VOIDED'
  GROUP BY ti.product_id
)
SELECT count(*) FILTER (WHERE ps.qty = COALESCE(bt.batch_sum,0)) AS sejajar,
       count(*) FILTER (WHERE ps.qty <> COALESCE(bt.batch_sum,0)) AS tidak_sejajar,
       count(*) AS total
FROM so_terakhir s
JOIN stock_opname_items soi ON soi.so_id = s.id
LEFT JOIN product_stocks ps ON ps.product_id = soi.product_id AND ps.branch_id = s.branch_id
LEFT JOIN (
  SELECT product_id, branch_id, SUM(qty_remaining) AS batch_sum
  FROM product_stock_batches GROUP BY product_id, branch_id
) bt ON bt.product_id = soi.product_id AND bt.branch_id = s.branch_id
WHERE soi.product_id NOT IN (SELECT product_id FROM terjual);
