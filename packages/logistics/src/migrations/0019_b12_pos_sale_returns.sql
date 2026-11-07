-- B1+B2 (spec docs/work/specs/2026-11-08-pemeriksa-kasir-design.md): retur penjualan kasir, baca saja, untuk mencocokkan
-- "Sudah dicatat" keputusan Retur BO. Kolom view = kontrak; ubah dengan migrasi baru, jangan dihapus/diganti nama.
CREATE VIEW logistics.pos_sale_returns AS
  SELECT r.id::text AS id, r.return_number, r.transaction_id, t.trx_number, t.customer_id, r.total_refund_amount,
    r.debt_reduction_amount, r.created_at, (r.cancelled_at IS NOT NULL) AS cancelled
  FROM petshop.returns r JOIN petshop.transactions t ON t.id = r.transaction_id;
