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
