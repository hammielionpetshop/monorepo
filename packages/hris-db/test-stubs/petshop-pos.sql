-- Tabel petshop paling kecil yang dibaca view HRIS (migrasi hris 0018, spec L4c §2), untuk tes integrasi yang
-- membuat schema petshop palsu. Kolomnya bagian dari kontrak view (PRD 01 §4): ubah bersama view dan tesnya.
CREATE TABLE IF NOT EXISTS petshop.users (id serial PRIMARY KEY, name varchar(100) NOT NULL, username varchar(50), is_active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS petshop.shifts (
  id serial PRIMARY KEY, shift_number integer NOT NULL DEFAULT 1, branch_id integer NOT NULL, origin varchar(20) NOT NULL DEFAULT 'POS',
  status varchar(20) NOT NULL DEFAULT 'OPEN', opened_at timestamp NOT NULL DEFAULT now(), closed_at timestamp, force_closed_at timestamp,
  total_closing_cash_expected integer, deposit_received_cash integer, deposit_verified_at timestamp
);
CREATE TABLE IF NOT EXISTS petshop.shift_cashier_breakdown (id serial PRIMARY KEY, shift_id integer NOT NULL, cashier_id integer NOT NULL, total_sales_cash integer NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS petshop.payment_methods (id serial PRIMARY KEY, name varchar(50) NOT NULL, type varchar(20) NOT NULL);
CREATE TABLE IF NOT EXISTS petshop.debt_payments (
  id serial PRIMARY KEY, shift_id integer, amount integer NOT NULL, payment_method_id integer NOT NULL, created_by integer, voided_at timestamp
);
CREATE TABLE IF NOT EXISTS petshop.app_settings (key varchar(100) PRIMARY KEY, value text NOT NULL);
-- L4d-1 (migrasi hris 0020): jasa grooming dan ongkir untuk view pos_grooming_services, pos_deliveries, pos_groomers.
CREATE TABLE IF NOT EXISTS petshop.groomers (id serial PRIMARY KEY, name varchar(100) NOT NULL, is_active boolean NOT NULL DEFAULT true, is_groomer boolean NOT NULL DEFAULT true, is_courier boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS petshop.transactions (id serial PRIMARY KEY, trx_number varchar(50) NOT NULL, payable_amount integer NOT NULL, created_at timestamp NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS petshop.transaction_items (id serial PRIMARY KEY, transaction_id integer NOT NULL, product_name varchar(255), total_price integer NOT NULL);
CREATE TABLE IF NOT EXISTS petshop.grooming_orders (
  id serial PRIMARY KEY, branch_id integer NOT NULL, transaction_id integer NOT NULL, transaction_item_id integer NOT NULL, groomer_id integer NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'DIKERJAKAN', picked_up_at timestamp
);
CREATE TABLE IF NOT EXISTS petshop.grooming_groomer_changes (id serial PRIMARY KEY, grooming_order_id integer NOT NULL);
CREATE TABLE IF NOT EXISTS petshop.service_deliveries (
  id serial PRIMARY KEY, branch_id integer NOT NULL, transaction_id integer NOT NULL, transaction_item_id integer NOT NULL, courier_id integer NOT NULL,
  address text, is_free_shipping boolean NOT NULL DEFAULT false, status varchar(20) NOT NULL DEFAULT 'DIPROSES'
);
-- L8a (migrasi hris 0036): produk, satuan, dan supplier untuk view pos_products, pos_product_units, pos_suppliers.
CREATE TABLE IF NOT EXISTS petshop.units_of_measure (id serial PRIMARY KEY, code varchar(10) NOT NULL, name varchar(50) NOT NULL, is_base boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS petshop.products (
  id serial PRIMARY KEY, sku varchar(50), name varchar(255) NOT NULL, base_uom_id integer NOT NULL, weight_gram integer,
  is_active boolean NOT NULL DEFAULT true, product_kind varchar(20) NOT NULL DEFAULT 'BARANG'
);
CREATE TABLE IF NOT EXISTS petshop.product_uom_conversions (id serial PRIMARY KEY, product_id integer NOT NULL, uom_id integer NOT NULL, ratio integer NOT NULL DEFAULT 1, weight_gram integer);
CREATE TABLE IF NOT EXISTS petshop.suppliers (id serial PRIMARY KEY, name varchar(100) NOT NULL, is_active boolean NOT NULL DEFAULT true);
-- LT1a (migrasi logistics 0003): pelanggan, cara kirim nota, dan PO Internal untuk view logistics.pos_customers,
-- pos_truck_sales, pos_truck_transfers. Jam kasir `timestamp` UTC tanpa zona, seperti aslinya.
CREATE TABLE IF NOT EXISTS petshop.customers (
  id serial PRIMARY KEY, code varchar(20), name varchar(100) NOT NULL, phone varchar(20), address text, is_active boolean NOT NULL DEFAULT true,
  is_internal_branch boolean NOT NULL DEFAULT false, linked_branch_id integer
);
ALTER TABLE petshop.transactions ADD COLUMN IF NOT EXISTS branch_id integer NOT NULL DEFAULT 1;
ALTER TABLE petshop.transactions ADD COLUMN IF NOT EXISTS customer_id integer;
ALTER TABLE petshop.transactions ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'COMPLETED';
ALTER TABLE petshop.transactions ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE petshop.transactions ADD COLUMN IF NOT EXISTS delivery_method varchar(20);
CREATE TABLE IF NOT EXISTS petshop.inter_branch_transfers (
  id serial PRIMARY KEY, ibt_number varchar(50) NOT NULL, source_branch_id integer NOT NULL, destination_branch_id integer NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'DRAFT', delivery_method varchar(20), created_at timestamp NOT NULL DEFAULT now()
);
-- LT1b-3 (migrasi logistics 0007): sisa piutang per nota untuk view logistics.pos_customer_debts.
CREATE TABLE IF NOT EXISTS petshop.customer_debts (
  id serial PRIMARY KEY, customer_id integer NOT NULL, transaction_id integer, total_amount integer NOT NULL, paid_amount integer NOT NULL DEFAULT 0,
  remaining_amount integer NOT NULL, status varchar(20) NOT NULL DEFAULT 'UNPAID'
);
-- Bongkaran → Draft PO (migrasi hris 0053): PO supplier untuk view pos_purchase_orders, pos_purchase_order_items.
CREATE TABLE IF NOT EXISTS petshop.purchase_orders (
  id serial PRIMARY KEY, po_number varchar(50) NOT NULL, po_type varchar(20) NOT NULL DEFAULT 'EXTERNAL', supplier_id integer,
  status varchar(30) NOT NULL DEFAULT 'PENDING_APPROVAL', created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS petshop.purchase_order_items (
  id serial PRIMARY KEY, po_id integer NOT NULL, product_id integer NOT NULL, uom_id integer NOT NULL, qty_ordered integer NOT NULL, qty_received integer NOT NULL DEFAULT 0
);
