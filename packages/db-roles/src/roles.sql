-- Role aplikasi & hak aksesnya (spec HRIS L0 §5).
--
-- Idempoten: dijalankan apply-roles.mjs di SETIAP deploy, sesudah keempat aliran migrasi,
-- supaya tabel yang baru dibuat migrasi langsung ikut ter-GRANT.
--
-- Role bersifat se-cluster, hak CONNECT per database. Database berakhiran `_staging`
-- mendapat role `stg_*`, selain itu role produksi. Karena CONNECT dicabut dari PUBLIC,
-- role staging tidak bisa membuka database produksi, dan sebaliknya.
--
-- View HRIS yang membaca petshop dimiliki pemilik migrasi, jadi hris_app sengaja tidak
-- diberi akses apa pun ke schema petshop.
DO $$
DECLARE
  prefix text := CASE WHEN current_database() LIKE '%\_staging' THEN 'stg_' ELSE '' END;
  role_name text;
  schema_name text;
  rel_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['bo_app', 'order_app', 'hris_app', 'finance_app'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = prefix || role_name) THEN
      EXECUTE format('CREATE ROLE %I LOGIN', prefix || role_name);
    END IF;
  END LOOP;

  EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', current_database());
  REVOKE CREATE ON SCHEMA public FROM PUBLIC;

  FOR role_name, schema_name IN
    SELECT * FROM (VALUES
      ('bo_app', 'petshop'),
      ('bo_app', 'auth'),
      ('order_app', 'petshop'),
      ('hris_app', 'hris'),
      ('hris_app', 'logistics'),
      ('hris_app', 'auth')
    ) AS access(role_name, schema_name)
  LOOP
    role_name := prefix || role_name;
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', schema_name, role_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO %I', schema_name, role_name);
    EXECUTE format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA %I TO %I', schema_name, role_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', schema_name, role_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I', schema_name, role_name);
  END LOOP;

  -- Finance (spec F2-6 §3.1) hanya membaca: SELECT pada daftar pintu baca di bawah, tanpa hak tulis apa pun.
  -- Daftar = tabel yang dibaca apps/finance/modules; tabel yang belum ada di DB ini (mis. aliran belum dimigrasi) dilewati.
  role_name := prefix || 'finance_app';
  FOREACH schema_name IN ARRAY ARRAY['petshop', 'hris', 'logistics', 'auth'] LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', schema_name, role_name);
  END LOOP;
  FOREACH rel_name IN ARRAY ARRAY[
    'petshop.branches', 'petshop.users', 'petshop.roles', 'petshop.payment_methods',
    'petshop.money_places', 'petshop.money_place_opening_balances', 'petshop.money_movements',
    'petshop.cash_deposits', 'petshop.noncash_verifications',
    'petshop.cash_flow_entries', 'petshop.cash_flow_categories',
    'petshop.supplier_payable_payments', 'petshop.supplier_payables', 'petshop.suppliers', 'petshop.purchase_orders',
    'hris.payslip_payments', 'hris.advance_handovers', 'hris.advance_movements', 'hris.advances', 'hris.employees',
    'hris.unloading_payments', 'hris.unloading_overpayment_uses', 'hris.unloading_overpayments',
    'logistics.vehicle_rental_payments', 'logistics.vehicles', 'logistics.fuel_expenses',
    -- Laba Rugi F2-6b: penjualan/retur/HPP setara BO, barang rusak, revisi harga internal, Pengeluaran Kasir,
    -- Biaya Rutin, slip gaji, bongkaran, garasi & trip Logistik.
    'petshop.transactions', 'petshop.transaction_items', 'petshop.returns', 'petshop.return_items',
    'petshop.products', 'petshop.product_uom_costs', 'petshop.product_uom_conversions', 'petshop.customers',
    'petshop.damaged_goods', 'petshop.internal_returns', 'petshop.internal_return_items', 'petshop.inter_branch_transfer_items',
    'petshop.shifts', 'petshop.shift_expenses', 'petshop.expense_categories',
    'petshop.recurring_costs', 'petshop.recurring_cost_amounts', 'petshop.recurring_cost_payments',
    'hris.payslips', 'hris.branches', 'hris.unloading_reports', 'logistics.config', 'logistics.trips',
    -- Utang Antar Cabang & Dana Belum Cair F2-6c: utang internal, pelunasan otomatis, angka non-tunai per shift.
    -- app_settings sengaja TIDAK dibuka (menyimpan rahasia); batas & tanggal mulai disalin di modul Finance.
    'petshop.inter_branch_payables', 'petshop.inter_branch_payments', 'petshop.inter_branch_transfers',
    'petshop.deposit_settlements', 'petshop.legacy_settlement_runs', 'petshop.transaction_payments',
    'petshop.debt_payments', 'petshop.customer_debts', 'petshop.payment_method_money_places',
    -- Setoran bebas vs laba F2-6c-2: shift di dalam setoran tunai (kas shift belum/sudah disetor).
    'petshop.cash_deposit_shifts',
    -- Aset & Penyusutan F2-6d-2: penyusutan & kerugian aset di Laba Rugi.
    'petshop.fixed_assets',
    'auth.sessions', 'auth.session_app_access', 'auth.account_links'
  ] LOOP
    IF to_regclass(rel_name) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON %s TO %I', rel_name, role_name);
    END IF;
  END LOOP;
  -- Akun: hanya kolom yang perlu untuk memeriksa sesi (bukan hash kata sandi).
  EXECUTE format('GRANT SELECT (id, is_active) ON auth.accounts TO %I', role_name);

  FOREACH role_name IN ARRAY ARRAY['bo_app', 'order_app', 'hris_app', 'finance_app'] LOOP
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), prefix || role_name);
  END LOOP;
END $$;
