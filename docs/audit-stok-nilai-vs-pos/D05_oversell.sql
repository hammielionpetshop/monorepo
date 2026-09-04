\pset pager off
\pset footer off

\echo '=== A. OVERSELL audit: rekap per cabang + total qtyShortBase (base UOM) ==='
WITH ev AS (
  SELECT a.branch_id, a.created_at,
         (it->>'qtyShortBase')::numeric AS short_base,
         (a.new_data::jsonb->>'authorizedOversell')::boolean AS authorized
  FROM petshop.audit_logs a
  CROSS JOIN LATERAL jsonb_array_elements((a.new_data::jsonb)->'items') AS it
  WHERE a.action = 'OVERSELL'
)
SELECT COALESCE(br.name,'-- SEMUA --') AS cabang,
       count(*)                              AS n_item_oversell,
       count(*) FILTER (WHERE authorized)    AS n_authorized,
       SUM(ev.short_base)                    AS total_short_base,
       to_char(min(ev.created_at),'YYYY-MM-DD') AS pertama,
       to_char(max(ev.created_at),'YYYY-MM-DD') AS terakhir
FROM ev LEFT JOIN petshop.branches br ON br.id = ev.branch_id
GROUP BY ROLLUP(br.name) ORDER BY cabang;

\echo ''
\echo '=== B. OVERSELL per bulan (semua cabang) — masih berlangsung? ==='
WITH ev AS (
  SELECT date_trunc('month', a.created_at) AS bln,
         (it->>'qtyShortBase')::numeric AS short_base
  FROM petshop.audit_logs a
  CROSS JOIN LATERAL jsonb_array_elements((a.new_data::jsonb)->'items') AS it
  WHERE a.action = 'OVERSELL'
)
SELECT to_char(bln,'YYYY-MM') AS bulan, count(*) n_item, SUM(short_base) total_short
FROM ev GROUP BY bln ORDER BY bln;

\echo ''
\echo '=== C. GUDANG: rekonstruksi lubang agregat ==='
\echo '  agg sekarang vs (0 - konsumsi_batch - oversell_short - ibt_bypass_short + manual_adj)'
SELECT
  (SELECT SUM(qty) FROM petshop.product_stocks WHERE branch_id=2)                       AS agg_sekarang,
  (SELECT SUM(qty_received)-SUM(qty_remaining) FROM petshop.product_stock_batches WHERE branch_id=2) AS batch_consumed,
  (SELECT SUM(qty_received) FROM petshop.product_stock_batches WHERE branch_id=2)        AS batch_received,
  (SELECT SUM(qty_remaining) FROM petshop.product_stock_batches WHERE branch_id=2)       AS batch_remaining,
  (SELECT COALESCE(SUM((it->>'qtyShortBase')::numeric),0)
     FROM petshop.audit_logs a CROSS JOIN LATERAL jsonb_array_elements((a.new_data::jsonb)->'items') it
     WHERE a.action='OVERSELL' AND a.branch_id=2)                                        AS oversell_short_gudang,
  (SELECT COALESCE(SUM((it->>'shortInBase')::numeric),0)
     FROM petshop.audit_logs a CROSS JOIN LATERAL jsonb_array_elements((a.new_data::jsonb)->'items') it
     WHERE a.action='INTERNAL_TRANSFER_SHIP_STOCK_BYPASS' AND a.branch_id=2)             AS ibt_bypass_short_gudang,
  (SELECT COALESCE(SUM(new_qty-previous_qty),0) FROM petshop.stock_adjustments WHERE branch_id=2) AS manual_adj_net_gudang;

\echo ''
\echo '=== D. OVERSELL: berapa yang authorized PIN vs tidak (semua cabang) ==='
SELECT (a.new_data::jsonb->>'authorizedOversell') AS authorized,
       count(*) n_audit
FROM petshop.audit_logs a WHERE a.action='OVERSELL'
GROUP BY 1;
