\pset pager off
\pset footer off

\echo '=== 0. Nama & id cabang (pastikan Gudang = id berapa) ==='
SELECT id, name FROM petshop.branches ORDER BY id;

\echo ''
\echo '=== 1. Semua audit INTERNAL_TRANSFER_SHIP_STOCK_BYPASS, per cabang sumber ==='
SELECT br.name AS cabang_sumber, count(*) AS n_audit,
       to_char(min(a.created_at),'YYYY-MM-DD') AS pertama,
       to_char(max(a.created_at),'YYYY-MM-DD') AS terakhir
FROM petshop.audit_logs a
LEFT JOIN petshop.branches br ON br.id = a.branch_id
WHERE a.action = 'INTERNAL_TRANSFER_SHIP_STOCK_BYPASS'
GROUP BY ROLLUP(br.name)
ORDER BY cabang_sumber;

\echo ''
\echo '=== 2. Item bypass diurai dari new_data JSON — rekap per cabang ==='
WITH ev AS (
  SELECT a.branch_id,
         (it->>'productId')::int   AS product_id,
         (it->>'shortInBase')::numeric AS short_base
  FROM petshop.audit_logs a
  CROSS JOIN LATERAL jsonb_array_elements((a.new_data::jsonb)->'items') AS it
  WHERE a.action = 'INTERNAL_TRANSFER_SHIP_STOCK_BYPASS'
)
SELECT br.name AS cabang_sumber,
       count(*)                          AS n_baris_bypass,
       count(DISTINCT ev.product_id)     AS n_produk,
       SUM(ev.short_base)                AS total_short_base
FROM ev LEFT JOIN petshop.branches br ON br.id = ev.branch_id
GROUP BY ROLLUP(br.name)
ORDER BY cabang_sumber;

\echo ''
\echo '=== 3. GUDANG: total kekurangan bypass per produk vs stok minus sekarang ==='
WITH ev AS (
  SELECT (it->>'productId')::int AS product_id,
         SUM((it->>'shortInBase')::numeric) AS short_base
  FROM petshop.audit_logs a
  CROSS JOIN LATERAL jsonb_array_elements((a.new_data::jsonb)->'items') AS it
  WHERE a.action = 'INTERNAL_TRANSFER_SHIP_STOCK_BYPASS'
    AND a.branch_id = (SELECT id FROM petshop.branches WHERE name='Gudang')
  GROUP BY 1
),
neg AS (
  SELECT ps.product_id, ps.qty AS agg_qty
  FROM petshop.product_stocks ps
  WHERE ps.branch_id = (SELECT id FROM petshop.branches WHERE name='Gudang')
    AND ps.qty < 0
),
batch AS (
  SELECT product_id, SUM(qty_remaining) AS batch_qty
  FROM petshop.product_stock_batches
  WHERE branch_id = (SELECT id FROM petshop.branches WHERE name='Gudang')
  GROUP BY 1
)
SELECT
  (SELECT count(*) FROM neg)                                             AS n_produk_agg_minus,
  (SELECT count(*) FROM ev)                                              AS n_produk_kena_bypass,
  (SELECT count(*) FROM neg n JOIN ev e ON e.product_id=n.product_id)    AS n_minus_yg_ada_bypass,
  (SELECT count(*) FROM neg n LEFT JOIN ev e ON e.product_id=n.product_id WHERE e.product_id IS NULL) AS n_minus_tanpa_bypass,
  (SELECT SUM(agg_qty) FROM neg)                                         AS total_agg_minus,
  (SELECT SUM(n.agg_qty) FROM neg n JOIN ev e ON e.product_id=n.product_id) AS agg_minus_pada_produk_bypass,
  (SELECT -SUM(e.short_base) FROM ev e)                                  AS total_short_bypass_neg;

\echo ''
\echo '=== 4. GUDANG: per-produk, samakan short_bypass vs agg_minus vs batch (TOP 40 by |agg|) ==='
WITH ev AS (
  SELECT (it->>'productId')::int AS product_id,
         SUM((it->>'shortInBase')::numeric) AS short_base
  FROM petshop.audit_logs a
  CROSS JOIN LATERAL jsonb_array_elements((a.new_data::jsonb)->'items') AS it
  WHERE a.action = 'INTERNAL_TRANSFER_SHIP_STOCK_BYPASS'
    AND a.branch_id = (SELECT id FROM petshop.branches WHERE name='Gudang')
  GROUP BY 1
),
batch AS (
  SELECT product_id, SUM(qty_remaining) AS batch_qty
  FROM petshop.product_stock_batches
  WHERE branch_id = (SELECT id FROM petshop.branches WHERE name='Gudang')
  GROUP BY 1
)
SELECT left(p.name,38) AS produk,
       ps.qty                       AS agg_qty,
       COALESCE(b.batch_qty,0)      AS batch_qty,
       COALESCE(-ev.short_base,0)   AS short_bypass_neg,
       (ps.qty - COALESCE(-ev.short_base,0)) AS selisih_tak_terjelaskan
FROM petshop.product_stocks ps
JOIN petshop.products p ON p.id = ps.product_id
LEFT JOIN ev ON ev.product_id = ps.product_id
LEFT JOIN batch b ON b.product_id = ps.product_id
WHERE ps.branch_id = (SELECT id FROM petshop.branches WHERE name='Gudang')
  AND ps.qty < 0
ORDER BY ps.qty ASC
LIMIT 40;

\echo ''
\echo '=== 5. GUDANG: arus masuk vs keluar sepanjang riwayat ==='
SELECT
  (SELECT COALESCE(SUM(qty_received),0) FROM petshop.product_stock_batches
     WHERE branch_id=(SELECT id FROM petshop.branches WHERE name='Gudang'))      AS total_batch_received,
  (SELECT count(*) FROM petshop.transactions
     WHERE branch_id=(SELECT id FROM petshop.branches WHERE name='Gudang'))      AS n_trx,
  (SELECT COALESCE(SUM(ti.qty),0) FROM petshop.transaction_items ti
     JOIN petshop.transactions t ON t.id=ti.transaction_id
     WHERE t.branch_id=(SELECT id FROM petshop.branches WHERE name='Gudang'))    AS total_qty_terjual,
  (SELECT count(*) FROM petshop.inter_branch_transfers
     WHERE source_branch_id=(SELECT id FROM petshop.branches WHERE name='Gudang')) AS n_ibt_keluar,
  (SELECT COALESCE(SUM(ibti.qty_shipped),0)
     FROM petshop.inter_branch_transfer_items ibti
     JOIN petshop.inter_branch_transfers ibt ON ibt.id=ibti.transfer_id
     WHERE ibt.source_branch_id=(SELECT id FROM petshop.branches WHERE name='Gudang')) AS total_qty_ibt_dikirim;

\echo ''
\echo '=== 6. Pembanding: apakah audit bypass juga ada di Toko Pusat / Toko Depan? ==='
WITH ev AS (
  SELECT a.branch_id,
         (it->>'productId')::int AS product_id,
         (it->>'shortInBase')::numeric AS short_base,
         a.created_at
  FROM petshop.audit_logs a
  CROSS JOIN LATERAL jsonb_array_elements((a.new_data::jsonb)->'items') AS it
  WHERE a.action = 'INTERNAL_TRANSFER_SHIP_STOCK_BYPASS'
)
SELECT br.name AS cabang, count(*) n_baris, count(DISTINCT ev.product_id) n_produk,
       SUM(ev.short_base) total_short,
       to_char(min(ev.created_at),'YYYY-MM-DD') pertama,
       to_char(max(ev.created_at),'YYYY-MM-DD') terakhir
FROM ev JOIN petshop.branches br ON br.id = ev.branch_id
GROUP BY br.name ORDER BY total_short DESC NULLS LAST;
