-- Koreksi data kanban #56 — IBT-20261006-0004 (Gudang → Toko Pusat, nota TRX-20261007-3661)
--
-- WHISKAS PC JUNIOR MACKAREL: dikirim 2 DUS, diterima 1 ("kurang dari sana nya"). Kode lama
-- menganggap selisih 1 DUS sebagai kerugian pengiriman, jadi stok Gudang tidak kembali dan nota
-- (Rp 54.477.000) lebih besar Rp 160.000 dari hutang Toko Pusat (Rp 54.317.000).
--
-- Skrip ini meniru persis yang dilakukan kode baru (ReturService.applyReturInTx) saat penerimaan:
--   1. retur 1 DUS dari baris nota 52310 (alasan "Selisih terima IBT-20261006-0004")
--   2. stok Gudang +1 DUS sebagai batch baru dengan modal asli dari nota (cogs/qty)
--   3. audit log RETURN_PROCESSED
-- Hutang antar cabang TIDAK diubah — sudah dihitung dari qty terima (1 DUS).
--
-- JALANKAN HANYA SETELAH rilis fix #56 ter-deploy, dan setelah di-review.
-- Aman dijalankan ulang: berhenti kalau baris nota itu sudah pernah diretur.
--
-- ssh ubuntu@43.173.8.37 'sudo docker exec -i hammielion-postgres-1 psql -U admin -d petshop_db' < docs/koreksi-ibt-20261006-0004.sql

BEGIN;

DO $$
DECLARE
  v_trx_id      integer := 25677;
  v_item_id     integer := 52310;
  v_ibt_id      integer;
  v_branch_id   integer;
  v_user_id     integer;
  v_product_id  integer;
  v_uom_id      integer;
  v_base_uom_id integer;
  v_qty         integer;
  v_unit_price  integer;
  v_cogs        integer;
  v_ratio       integer;
  v_cost_base   integer;
  v_ret_no      varchar;
  v_ret_id      uuid;
  v_batch_no    integer;
BEGIN
  SELECT id, source_branch_id, received_by_id INTO v_ibt_id, v_branch_id, v_user_id
  FROM petshop.inter_branch_transfers
  WHERE ibt_number = 'IBT-20261006-0004' AND converted_transaction_id = v_trx_id AND status = 'PARTIALLY_RECEIVED';
  IF v_ibt_id IS NULL THEN RAISE EXCEPTION 'IBT tidak cocok (status/nota berubah?)'; END IF;

  IF EXISTS (SELECT 1 FROM petshop.return_items WHERE transaction_item_id = v_item_id) THEN
    RAISE EXCEPTION 'Baris nota % sudah pernah diretur — koreksi sudah dijalankan?', v_item_id;
  END IF;

  SELECT ti.product_id, ti.uom_id, ti.qty, ti.unit_price, ti.cogs, p.base_uom_id
    INTO v_product_id, v_uom_id, v_qty, v_unit_price, v_cogs, v_base_uom_id
  FROM petshop.transaction_items ti JOIN petshop.products p ON p.id = ti.product_id
  WHERE ti.id = v_item_id AND ti.transaction_id = v_trx_id AND ti.is_removed = false;
  IF v_qty IS DISTINCT FROM 2 OR v_unit_price IS DISTINCT FROM 160000 THEN
    RAISE EXCEPTION 'Baris nota berubah: qty %, harga %', v_qty, v_unit_price;
  END IF;

  SELECT ratio INTO v_ratio FROM petshop.product_uom_conversions WHERE product_id = v_product_id AND uom_id = v_uom_id;
  IF v_uom_id = v_base_uom_id THEN v_ratio := 1; END IF;
  IF v_ratio IS NULL THEN RAISE EXCEPTION 'Rasio satuan tidak ditemukan'; END IF;

  v_cost_base := round((v_cogs::numeric / v_qty) / v_ratio);

  SELECT 'RTN-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((count(*) + 1)::text, 4, '0') INTO v_ret_no
  FROM petshop.returns WHERE return_number LIKE 'RTN-' || to_char(now(), 'YYYYMMDD') || '-%';

  INSERT INTO petshop.returns (return_number, transaction_id, branch_id, processed_by_id, reason, total_refund_amount, debt_reduction_amount)
  VALUES (v_ret_no, v_trx_id, v_branch_id, v_user_id, 'Selisih terima IBT-20261006-0004 (koreksi data kanban #56)', v_unit_price, 0)
  RETURNING id INTO v_ret_id;

  INSERT INTO petshop.return_items (return_id, transaction_item_id, product_id, uom_id, qty, unit_price, cogs, refund_amount)
  VALUES (v_ret_id, v_item_id, v_product_id, v_uom_id, 1, v_unit_price, round(v_cogs::numeric / v_qty), v_unit_price);

  SELECT count(*) + 1 INTO v_batch_no FROM petshop.product_stock_batches
  WHERE branch_id = v_branch_id AND DATE(received_at) = CURRENT_DATE;

  INSERT INTO petshop.product_stock_batches (product_id, branch_id, uom_id, qty_received, qty_remaining, cost_price, received_at, batch_code)
  VALUES (v_product_id, v_branch_id, v_uom_id, v_ratio, v_ratio, v_cost_base, now(),
          'BTC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(v_batch_no::text, 4, '0'));

  UPDATE petshop.product_stocks SET qty = qty + v_ratio
  WHERE product_id = v_product_id AND branch_id = v_branch_id AND uom_id = v_base_uom_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Baris product_stocks Gudang tidak ada'; END IF;

  INSERT INTO petshop.audit_logs (branch_id, user_id, action, table_name, record_id, new_data)
  VALUES (v_branch_id, v_user_id, 'RETURN_PROCESSED', 'returns', v_ret_id::text,
          json_build_object('returnNumber', v_ret_no, 'transactionId', v_trx_id, 'totalRefundAmount', v_unit_price,
                            'debtReductionAmount', 0, 'cashRefundAmount', v_unit_price,
                            'items', json_build_array(json_build_object('transactionItemId', v_item_id, 'qty', '1')),
                            'note', 'Koreksi manual kanban #56 — selisih terima IBT-20261006-0004')::text);

  RAISE NOTICE 'Retur % dibuat: +% base ke cabang % (modal %/base)', v_ret_no, v_ratio, v_branch_id, v_cost_base;
END $$;

-- Periksa sebelum COMMIT: stok Gudang naik 1 DUS, nota - retur = hutang.
SELECT b.name, ps.qty FROM petshop.product_stocks ps JOIN petshop.branches b ON b.id = ps.branch_id
JOIN petshop.products p ON p.id = ps.product_id WHERE p.name = 'WHISKAS PC JUNIOR MACKAREL';
SELECT t.total_amount - COALESCE((SELECT sum(total_refund_amount) FROM petshop.returns r WHERE r.transaction_id = t.id AND r.cancelled_at IS NULL), 0) AS nota_bersih,
       (SELECT total_amount FROM petshop.inter_branch_payables WHERE transfer_id = 401) AS hutang
FROM petshop.transactions t WHERE t.id = 25677;

-- Ganti ROLLBACK jadi COMMIT setelah angka di atas benar.
ROLLBACK;
