\pset pager off
\pset footer off
\set gudang '(SELECT id FROM petshop.branches WHERE name=''Gudang'')'

\echo '=== A. GUDANG: batch per tanggal-terima (cluster impor vs harian) ==='
SELECT to_char(received_at,'YYYY-MM-DD') AS tgl, count(*) n_batch,
       SUM(qty_received) qty_received, SUM(qty_remaining) qty_remaining,
       count(DISTINCT product_id) n_produk
FROM petshop.product_stock_batches
WHERE branch_id = :gudang
GROUP BY 1 ORDER BY qty_received DESC LIMIT 20;

\echo ''
\echo '=== B. GUDANG: audit_logs action apa saja (semua waktu) ==='
SELECT action, count(*) n, to_char(min(created_at),'YYYY-MM-DD') pertama,
       to_char(max(created_at),'YYYY-MM-DD') terakhir
FROM petshop.audit_logs WHERE branch_id = :gudang
GROUP BY action ORDER BY n DESC;

\echo ''
\echo '=== C. GUDANG: konsistensi internal batch ledger ==='
\echo '  received - (terjual FIFO + dikirim IBT + rusak) harusnya = sisa batch sekarang'
SELECT
  (SELECT SUM(qty_received)  FROM petshop.product_stock_batches WHERE branch_id=:gudang) AS b_received,
  (SELECT SUM(qty_remaining) FROM petshop.product_stock_batches WHERE branch_id=:gudang) AS b_remaining,
  (SELECT SUM(qty_received) - SUM(qty_remaining) FROM petshop.product_stock_batches WHERE branch_id=:gudang) AS b_consumed;

\echo ''
\echo '=== D. GUDANG: apakah ada baris product_stocks yg PERNAH positif? cek stock_adjustments ==='
SELECT count(*) n_adj,
       count(*) FILTER (WHERE new_qty > previous_qty) AS n_naik,
       count(*) FILTER (WHERE new_qty < previous_qty) AS n_turun,
       SUM(new_qty - previous_qty) AS net_delta
FROM petshop.stock_adjustments WHERE branch_id = :gudang;

\echo ''
\echo '=== E. GUDANG: PO receiving yg menyasar cabang ini ==='
SELECT count(DISTINCT po.id) AS n_po,
       count(*) AS n_item,
       SUM(poi.qty_received) AS total_qty_received
FROM petshop.purchase_orders po
JOIN petshop.purchase_order_items poi ON poi.purchase_order_id = po.id
WHERE po.branch_id = :gudang;

\echo ''
\echo '=== F. GUDANG vs TOKO: total product_stocks.qty (agregat) & total batch remaining ==='
SELECT br.name AS cabang,
       (SELECT SUM(qty) FROM petshop.product_stocks ps WHERE ps.branch_id=br.id) AS agg_total,
       (SELECT SUM(qty_remaining) FROM petshop.product_stock_batches b WHERE b.branch_id=br.id) AS batch_total
FROM petshop.branches br WHERE br.id IN (2,3,4) ORDER BY br.id;

\echo ''
\echo '=== G. Stok opname di GUDANG — pernah dijalankan? ==='
SELECT so.id, so.status, to_char(so.created_at,'YYYY-MM-DD') AS dibuat,
       (SELECT count(*) FROM petshop.stock_opname_items soi WHERE soi.stock_opname_id = so.id) AS n_item
FROM petshop.stock_opnames so
WHERE so.branch_id = :gudang
ORDER BY so.created_at DESC LIMIT 15;
