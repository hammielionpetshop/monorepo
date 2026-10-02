-- Read-only, one repeatable snapshot. No temporary tables, no corrections.
-- Run: psql -X -v ON_ERROR_STOP=1 -At -f <this file>
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '5s';

WITH
batch AS (
  SELECT product_id, branch_id, SUM(qty_remaining)::bigint qty,
    SUM(qty_remaining::bigint * cost_price) value,
    array_agg(id ORDER BY id) batch_ids,
    COUNT(*) FILTER (WHERE qty_remaining < 0) negative_batches
  FROM petshop.product_stock_batches GROUP BY product_id, branch_id
),
stock AS (
  SELECT product_id, branch_id, SUM(qty)::bigint qty,
    array_agg(id ORDER BY id) stock_ids
  FROM petshop.product_stocks GROUP BY product_id, branch_id
),
deficit AS (
  SELECT product_id, branch_id,
    SUM(qty_remaining)::bigint qty,
    COALESCE(SUM(qty_remaining) FILTER (WHERE written_off_at IS NULL), 0)::bigint active_qty,
    COALESCE(SUM(qty_remaining) FILTER (WHERE written_off_at IS NOT NULL), 0)::bigint written_off_qty,
    array_agg(id ORDER BY id) shortfall_ids
  FROM petshop.stock_shortfalls WHERE closed_at IS NULL
  GROUP BY product_id, branch_id
),
pairs AS (
  SELECT product_id, branch_id FROM batch UNION
  SELECT product_id, branch_id FROM stock UNION
  SELECT product_id, branch_id FROM deficit
),
balance AS (
  SELECT p.product_id, p.branch_id, b.batch_ids, s.stock_ids, d.shortfall_ids,
    COALESCE(b.qty, 0) batch_qty, COALESCE(s.qty, 0) aggregate_qty,
    COALESCE(d.active_qty, 0) active_deficit, COALESCE(d.written_off_qty, 0) written_off_deficit,
    COALESCE(b.qty, 0) - COALESCE(d.qty, 0) expected_qty,
    COALESCE(s.qty, 0) - (COALESCE(b.qty, 0) - COALESCE(d.qty, 0)) drift,
    s.stock_ids IS NULL missing_aggregate, COALESCE(b.negative_batches, 0) negative_batches
  FROM pairs p LEFT JOIN batch b USING (product_id, branch_id)
    LEFT JOIN stock s USING (product_id, branch_id)
    LEFT JOIN deficit d USING (product_id, branch_id)
),
nonbase AS (
  SELECT s.id, s.product_id, s.branch_id, s.uom_id, p.base_uom_id, s.qty, c.ratio,
    CASE WHEN c.ratio > 0 THEN s.qty::bigint * c.ratio END proposed_base_qty
  FROM petshop.product_stocks s JOIN petshop.products p ON p.id = s.product_id
  LEFT JOIN petshop.product_uom_conversions c ON c.product_id = s.product_id AND c.uom_id = s.uom_id
  WHERE s.uom_id <> p.base_uom_id
),
uom_usage AS (
  SELECT 'BATCH' source, id, product_id, branch_id, uom_id FROM petshop.product_stock_batches
  UNION ALL SELECT 'STOCK', id, product_id, branch_id, uom_id FROM petshop.product_stocks
  UNION ALL SELECT 'PO_ITEM', i.id, i.product_id, po.branch_id, i.uom_id FROM petshop.purchase_order_items i JOIN petshop.purchase_orders po ON po.id = i.po_id
  UNION ALL SELECT 'SALE_ITEM', i.id, i.product_id, t.branch_id, i.uom_id FROM petshop.transaction_items i JOIN petshop.transactions t ON t.id = i.transaction_id WHERE i.product_id IS NOT NULL
  UNION ALL SELECT 'TRANSFER_ITEM', i.id, i.product_id, t.source_branch_id, i.uom_id FROM petshop.inter_branch_transfer_items i JOIN petshop.inter_branch_transfers t ON t.id = i.transfer_id
),
invalid_conversion AS (
  SELECT u.*, p.base_uom_id, c.ratio FROM uom_usage u JOIN petshop.products p ON p.id = u.product_id
  LEFT JOIN petshop.product_uom_conversions c ON c.product_id = u.product_id AND c.uom_id = u.uom_id
  WHERE (u.uom_id <> p.base_uom_id AND (c.ratio IS NULL OR c.ratio <= 0))
    OR (u.uom_id = p.base_uom_id AND c.ratio IS NOT NULL AND c.ratio <> 1)
),
po_expected AS (
  SELECT i.po_id, i.product_id, i.uom_id,
    SUM((i.qty_received::bigint - i.qty_damaged) * CASE WHEN i.uom_id = p.base_uom_id THEN 1 ELSE c.ratio END) received_base
  FROM petshop.purchase_order_items i JOIN petshop.products p ON p.id = i.product_id
  LEFT JOIN petshop.product_uom_conversions c ON c.product_id = i.product_id AND c.uom_id = i.uom_id
  GROUP BY i.po_id, i.product_id, i.uom_id
),
po_batch AS (
  SELECT purchase_order_id po_id, product_id, uom_id,
    SUM(qty_received)::bigint batch_received, SUM(qty_remaining)::bigint batch_remaining,
    array_agg(id ORDER BY id) batch_ids
  FROM petshop.product_stock_batches WHERE purchase_order_id IS NOT NULL
  GROUP BY purchase_order_id, product_id, uom_id
),
po_anomalies AS (
  SELECT b.*, e.received_base, po.branch_id, po.po_number, po.status,
    b.batch_received - e.received_base excess_received
  FROM po_batch b LEFT JOIN po_expected e USING (po_id, product_id, uom_id)
  JOIN petshop.purchase_orders po ON po.id = b.po_id
  WHERE e.received_base IS NULL OR b.batch_received > e.received_base OR po.status <> 'COMPLETED'
),
source_anomalies AS (
  SELECT sf.id, sf.product_id, sf.branch_id, sf.source_type, sf.source_transaction_id,
    sf.source_transaction_item_id, sf.qty_short, sf.qty_remaining, sf.written_off_at, sf.closed_at,
    t.status transaction_status, i.qty current_item_qty, i.original_qty, i.is_removed,
    CASE WHEN i.uom_id = p.base_uom_id THEN i.qty ELSE i.qty::bigint * c.ratio END current_base_qty
  FROM petshop.stock_shortfalls sf LEFT JOIN petshop.transactions t ON t.id = sf.source_transaction_id
  LEFT JOIN petshop.transaction_items i ON i.id = sf.source_transaction_item_id
  LEFT JOIN petshop.products p ON p.id = sf.product_id
  LEFT JOIN petshop.product_uom_conversions c ON c.product_id = sf.product_id AND c.uom_id = i.uom_id
  WHERE sf.source_type IN ('SALE', 'TRX_EDIT') AND
    (t.status = 'VOIDED' OR (sf.source_transaction_id IS NOT NULL AND t.id IS NULL)
      OR (sf.source_transaction_item_id IS NOT NULL AND i.id IS NULL)
      OR i.is_removed OR i.qty = 0 OR i.qty < i.original_qty)
),
findings AS (
  SELECT 'BALANCE_DRIFT' category, to_jsonb(b) detail FROM balance b WHERE drift <> 0 OR missing_aggregate
  UNION ALL SELECT 'NEGATIVE_BATCH', jsonb_build_object('id', id, 'product_id', product_id, 'branch_id', branch_id, 'qty_remaining', qty_remaining) FROM petshop.product_stock_batches WHERE qty_remaining < 0
  UNION ALL SELECT 'NONBASE_STOCK', to_jsonb(n) FROM nonbase n
  UNION ALL SELECT 'INVALID_CONVERSION', to_jsonb(c) FROM invalid_conversion c
  UNION ALL SELECT 'BATCH_COST_REVIEW', jsonb_build_object('id', b.id, 'product_id', b.product_id, 'branch_id', b.branch_id, 'cost_price', b.cost_price, 'qty_remaining', b.qty_remaining, 'purchase_order_id', b.purchase_order_id, 'master_cost_comparison_only', p.default_cost_price) FROM petshop.product_stock_batches b JOIN petshop.products p ON p.id = b.product_id WHERE b.cost_price <= 0 OR (p.default_cost_price > 0 AND (b.cost_price > p.default_cost_price::bigint * 100 OR b.cost_price::bigint * 100 < p.default_cost_price))
  UNION ALL SELECT 'BATCH_WITHOUT_PO', jsonb_build_object('id', id, 'product_id', product_id, 'branch_id', branch_id, 'qty_received', qty_received, 'qty_remaining', qty_remaining, 'cost_price', cost_price, 'received_at', received_at) FROM petshop.product_stock_batches WHERE purchase_order_id IS NULL
  UNION ALL SELECT 'WRITE_OFF_HISTORY', jsonb_build_object('id', id, 'product_id', product_id, 'branch_id', branch_id, 'qty_short', qty_short, 'qty_remaining', qty_remaining, 'written_off_at', written_off_at, 'closed_at', closed_at) FROM petshop.stock_shortfalls WHERE written_off_at IS NOT NULL
  UNION ALL SELECT 'SHORTFALL_SOURCE_REVIEW', to_jsonb(a) FROM source_anomalies a
  UNION ALL SELECT 'PO_BATCH_REVIEW', to_jsonb(a) FROM po_anomalies a
  UNION ALL SELECT 'DUPLICATE_PO_PAYABLE', jsonb_build_object('po_id', po_id, 'payable_ids', array_agg(id ORDER BY id), 'total_amount', SUM(total_amount), 'paid_amount', SUM(paid_amount)) FROM petshop.supplier_payables GROUP BY po_id HAVING COUNT(*) > 1
),
counts AS (SELECT category, COUNT(*) count FROM findings GROUP BY category)
SELECT jsonb_build_object(
  'database', current_database(), 'snapshot_time', transaction_timestamp(),
  'read_only', current_setting('transaction_read_only'), 'isolation', current_setting('transaction_isolation'),
  'formula', 'aggregate = SUM(batch.qty_remaining) - SUM(shortfall.qty_remaining WHERE closed_at IS NULL); includes written-off residual',
  'totals', jsonb_build_object('pairs', (SELECT COUNT(*) FROM pairs), 'batch_qty', (SELECT SUM(qty) FROM batch), 'aggregate_qty', (SELECT SUM(qty) FROM stock), 'active_deficit', (SELECT SUM(active_qty) FROM deficit), 'written_off_deficit', (SELECT SUM(written_off_qty) FROM deficit), 'drift', (SELECT SUM(drift) FROM balance)),
  'counts', COALESCE((SELECT jsonb_object_agg(category, count) FROM counts), '{}'::jsonb),
  'findings', COALESCE((SELECT jsonb_agg(jsonb_build_object('category', category, 'detail', detail) ORDER BY category, detail::text) FROM findings), '[]'::jsonb)
);
ROLLBACK;
