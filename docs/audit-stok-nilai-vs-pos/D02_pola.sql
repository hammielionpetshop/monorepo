\pset pager off
\pset footer off

\echo '=== A. Klasifikasi tiap (product,branch) yang selisih, per cabang + pola ==='
WITH batch AS (
  SELECT product_id, branch_id, SUM(qty_remaining) AS batch_qty,
         SUM(qty_remaining::bigint * cost_price) AS batch_value,
         min(received_at) AS first_recv, max(received_at) AS last_recv
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
         COALESCE(b.batch_value,0) AS batch_value,
         CASE WHEN COALESCE(b.batch_qty,0) > 0 THEN b.batch_value::numeric/b.batch_qty
              ELSE COALESCE(pr.default_cost_price,0) END AS cost_est
  FROM pb
  LEFT JOIN batch b ON b.product_id=pb.product_id AND b.branch_id=pb.branch_id
  LEFT JOIN agg   a ON a.product_id=pb.product_id AND a.branch_id=pb.branch_id
  LEFT JOIN petshop.products pr ON pr.id = pb.product_id
),
c AS (
  SELECT br.name AS cabang,
    CASE
      WHEN batch_qty = agg_qty THEN '0 sejajar'
      WHEN batch_qty > 0 AND agg_qty <= 0 THEN '1 batch>0, agg<=0 (agg tak pernah dinaikkan)'
      WHEN batch_qty > 0 AND agg_qty > 0  THEN '2 batch>0, agg>0 tapi beda'
      WHEN batch_qty = 0 AND agg_qty < 0  THEN '3 batch=0, agg minus (utang oversell murni)'
      ELSE '4 lain'
    END AS pola,
    j.*
  FROM j JOIN petshop.branches br ON br.id = j.branch_id
)
SELECT cabang, pola, count(*) AS n_pb,
       SUM(batch_qty - agg_qty) AS gap_qty,
       round(SUM((batch_qty - agg_qty) * cost_est)) AS gap_value_est
FROM c
WHERE pola <> '0 sejajar'
GROUP BY cabang, pola
ORDER BY cabang, pola;

\echo ''
\echo '=== B. Dampak rupiah selisih per cabang (semua pola non-sejajar) ==='
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
         CASE WHEN COALESCE(b.batch_qty,0) > 0 THEN b.batch_value::numeric/b.batch_qty
              ELSE COALESCE(pr.default_cost_price,0) END AS cost_est
  FROM pb
  LEFT JOIN batch b ON b.product_id=pb.product_id AND b.branch_id=pb.branch_id
  LEFT JOIN agg   a ON a.product_id=pb.product_id AND a.branch_id=pb.branch_id
  LEFT JOIN petshop.products pr ON pr.id = pb.product_id
)
SELECT COALESCE(br.name,'-- SEMUA --') AS cabang,
       count(*) FILTER (WHERE batch_qty <> agg_qty) AS n_selisih,
       round(SUM(GREATEST(batch_qty - agg_qty,0) * cost_est)) AS nilaistok_lebih_value,
       round(SUM(GREATEST(batch_qty,0) * cost_est))           AS total_nilai_stok_batch
FROM j LEFT JOIN petshop.branches br ON br.id = j.branch_id
GROUP BY ROLLUP(br.name) ORDER BY cabang;

\echo ''
\echo '=== C. Pola 1 (batch>0, agg<=0): kapan batch-nya diterima? (cek impor massal) ==='
WITH agg AS (
  SELECT product_id, branch_id, SUM(qty) AS agg_qty
  FROM petshop.product_stocks GROUP BY product_id, branch_id
)
SELECT to_char(psb.received_at,'YYYY-MM-DD') AS tgl_terima,
       count(DISTINCT (psb.product_id, psb.branch_id)) AS n_pb,
       count(*) AS n_batch,
       SUM(psb.qty_remaining) AS qty_sisa
FROM petshop.product_stock_batches psb
JOIN agg a ON a.product_id = psb.product_id AND a.branch_id = psb.branch_id
WHERE psb.qty_remaining > 0 AND a.agg_qty <= 0
GROUP BY 1 ORDER BY qty_sisa DESC LIMIT 25;

\echo ''
\echo '=== D. Gudang: apakah cabang jual atau gudang distribusi? cek transaksi & IBT ==='
SELECT
  (SELECT count(*) FROM petshop.transactions WHERE branch_id = (SELECT id FROM petshop.branches WHERE name='Gudang')) AS n_trx_gudang,
  (SELECT count(*) FROM petshop.transactions t WHERE t.branch_id=(SELECT id FROM petshop.branches WHERE name='Gudang') AND t.created_at >= TIMESTAMP '2026-07-01') AS n_trx_gudang_sejak_juli,
  (SELECT count(*) FROM petshop.inter_branch_transfers WHERE source_branch_id=(SELECT id FROM petshop.branches WHERE name='Gudang')) AS n_ibt_keluar_gudang,
  (SELECT count(*) FROM petshop.inter_branch_transfers WHERE destination_branch_id=(SELECT id FROM petshop.branches WHERE name='Gudang')) AS n_ibt_masuk_gudang;

\echo ''
\echo '=== E. Daftar 7 cabang + jumlah stock row & batch ==='
SELECT br.id, br.name,
       (SELECT count(*) FROM petshop.product_stocks ps WHERE ps.branch_id=br.id) AS n_stock,
       (SELECT count(*) FROM petshop.product_stock_batches psb WHERE psb.branch_id=br.id) AS n_batch,
       (SELECT count(*) FROM petshop.product_stocks ps WHERE ps.branch_id=br.id AND ps.qty<0) AS n_stock_minus,
       (SELECT count(*) FROM petshop.transactions t WHERE t.branch_id=br.id) AS n_trx
FROM petshop.branches br ORDER BY br.id;

\echo ''
\echo '=== F. Toko Pusat & Toko Depan saja: sebaran selisih ==='
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
SELECT br.name AS cabang,
  count(*) AS n_pb,
  count(*) FILTER (WHERE batch_qty = agg_qty) AS sejajar,
  count(*) FILTER (WHERE batch_qty <> agg_qty AND agg_qty >= 0) AS beda_agg_positif,
  count(*) FILTER (WHERE agg_qty < 0) AS agg_minus,
  count(*) FILTER (WHERE batch_qty > 0 AND agg_qty = 0) AS batch_ada_agg_nol
FROM j JOIN petshop.branches br ON br.id = j.branch_id
WHERE br.name IN ('Toko Pusat','Toko Depan')
GROUP BY br.name ORDER BY br.name;
