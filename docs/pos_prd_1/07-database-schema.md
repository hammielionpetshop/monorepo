# 7. DATABASE SCHEMA

## 7.1 Master Tables

### `products`
```sql
CREATE TABLE products (
  product_id SERIAL PRIMARY KEY,
  sku VARCHAR(50) UNIQUE NOT NULL,
  barcode VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  category_id INT,
  brand_id INT,
  base_uom_id INT REFERENCES units_of_measure(uom_id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `units_of_measure`
```sql
CREATE TABLE units_of_measure (
  uom_id SERIAL PRIMARY KEY,
  uom_code VARCHAR(20) UNIQUE NOT NULL,
  uom_name VARCHAR(100) NOT NULL,
  is_base_unit BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `product_uom_conversions`
```sql
CREATE TABLE product_uom_conversions (
  conversion_id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(product_id),
  from_uom_id INT NOT NULL REFERENCES units_of_measure(uom_id),
  to_uom_id INT NOT NULL REFERENCES units_of_measure(uom_id),
  ratio DECIMAL(10,2) NOT NULL,
  auto_break_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, from_uom_id, to_uom_id)
);
```

### `product_prices`
```sql
CREATE TABLE product_prices (
  price_id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(product_id),
  branch_id INT NOT NULL REFERENCES branches(branch_id),
  uom_id INT NOT NULL REFERENCES units_of_measure(uom_id),
  tier_type VARCHAR(20) NOT NULL, -- retail/grosir/member/distributor/reseller/promo
  price DECIMAL(15,2) NOT NULL,
  effective_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, branch_id, uom_id, tier_type, effective_date)
);
```

## 7.2 Stock Tables

### `product_stocks`
```sql
CREATE TABLE product_stocks (
  stock_id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(product_id),
  branch_id INT NOT NULL REFERENCES branches(branch_id),
  uom_id INT NOT NULL REFERENCES units_of_measure(uom_id),
  qty DECIMAL(10,2) NOT NULL DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, branch_id, uom_id)
);

CREATE INDEX idx_stock_product_branch ON product_stocks(product_id, branch_id);
```

### `product_stock_batches` (FIFO Tracking)
```sql
CREATE TABLE product_stock_batches (
  batch_id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(product_id),
  branch_id INT NOT NULL REFERENCES branches(branch_id),
  uom_id INT NOT NULL REFERENCES units_of_measure(uom_id),
  qty DECIMAL(10,2) NOT NULL,
  cost_price DECIMAL(15,2) NOT NULL,
  received_date TIMESTAMP NOT NULL,
  po_id INT REFERENCES purchase_orders(po_id),
  parent_batch_id INT REFERENCES product_stock_batches(batch_id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_batch_fifo ON product_stock_batches(
  product_id, branch_id, uom_id, received_date
);
```

### `stock_auto_breaks` (Audit Log)
```sql
CREATE TABLE stock_auto_breaks (
  break_id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(product_id),
  branch_id INT NOT NULL REFERENCES branches(branch_id),
  from_uom_id INT NOT NULL REFERENCES units_of_measure(uom_id),
  from_qty DECIMAL(10,2) NOT NULL,
  to_uom_id INT NOT NULL REFERENCES units_of_measure(uom_id),
  to_qty DECIMAL(10,2) NOT NULL,
  from_batch_id INT REFERENCES product_stock_batches(batch_id),
  to_batch_id INT REFERENCES product_stock_batches(batch_id),
  triggered_by VARCHAR(50) NOT NULL, -- SALE / MANUAL / SO_ADJUSTMENT
  transaction_id INT,
  stock_before JSONB,
  stock_after JSONB,
  performed_by INT REFERENCES users(user_id),
  performed_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);
```

## 7.3 Transaction Tables

### `transactions`
```sql
CREATE TABLE transactions (
  transaction_id SERIAL PRIMARY KEY,
  trx_number VARCHAR(50) UNIQUE NOT NULL,
  branch_id INT NOT NULL,
  shift_id INT REFERENCES shifts(shift_id),
  cashier_id INT NOT NULL REFERENCES users(user_id),
  customer_id INT REFERENCES customers(customer_id),
  subtotal DECIMAL(15,2) NOT NULL,
  discount_total DECIMAL(15,2) DEFAULT 0,
  tax_total DECIMAL(15,2) DEFAULT 0,
  grand_total DECIMAL(15,2) NOT NULL,
  payment_status VARCHAR(20) NOT NULL, -- paid/partial/debt
  transaction_status VARCHAR(20) NOT NULL DEFAULT 'completed',
  void_request_id INT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_offline BOOLEAN DEFAULT false,
  synced_at TIMESTAMP
);
```

### `transaction_items`
```sql
CREATE TABLE transaction_items (
  item_id SERIAL PRIMARY KEY,
  transaction_id INT NOT NULL REFERENCES transactions(transaction_id),
  product_id INT NOT NULL REFERENCES products(product_id),
  uom_id INT NOT NULL REFERENCES units_of_measure(uom_id),
  qty DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  price_tier VARCHAR(20) NOT NULL,
  discount_type VARCHAR(20),
  discount_value DECIMAL(15,2) DEFAULT 0,
  subtotal DECIMAL(15,2) NOT NULL,
  cost_price_snapshot DECIMAL(15,2),
  auto_break_triggered BOOLEAN DEFAULT false,
  auto_break_log_id INT REFERENCES stock_auto_breaks(break_id),
  is_owner_override BOOLEAN DEFAULT false,
  override_price DECIMAL(15,2),
  override_by INT REFERENCES users(user_id),
  override_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `transaction_payments`
```sql
CREATE TABLE transaction_payments (
  payment_id SERIAL PRIMARY KEY,
  transaction_id INT NOT NULL REFERENCES transactions(transaction_id),
  payment_method VARCHAR(30) NOT NULL, -- cash/qris/debit/credit/debt
  amount DECIMAL(15,2) NOT NULL,
  reference_number VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 7.4 Void Request

### `void_requests`
```sql
CREATE TABLE void_requests (
  request_id SERIAL PRIMARY KEY,
  transaction_id INT NOT NULL REFERENCES transactions(transaction_id),
  requested_by INT NOT NULL REFERENCES users(user_id),
  reason_type VARCHAR(30) NOT NULL, -- salah_input/retur/pembatalan
  reason_note TEXT,
  proof_image_url VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  approved_by INT REFERENCES users(user_id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 7.5 Shift & Settlement

### `shifts`
```sql
CREATE TABLE shifts (
  shift_id SERIAL PRIMARY KEY,
  branch_id INT NOT NULL REFERENCES branches(branch_id),
  opened_by INT NOT NULL REFERENCES users(user_id),
  assigned_cashiers JSONB NOT NULL, -- [12, 15, 18]
  shift_number INT NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  opening_cash DECIMAL(15,2) NOT NULL DEFAULT 200000,
  total_closing_cash_real DECIMAL(15,2),
  total_closing_cash_expected DECIMAL(15,2),
  total_variance DECIMAL(15,2),
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- open/closed/force_closed
  force_closed_by INT REFERENCES users(user_id),
  force_closed_at TIMESTAMP,
  settlement_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_shifts_branch_status ON shifts(branch_id, status);
CREATE INDEX idx_shifts_date ON shifts(start_time);
```

### `shift_cashier_breakdown`
```sql
CREATE TABLE shift_cashier_breakdown (
  breakdown_id SERIAL PRIMARY KEY,
  shift_id INT NOT NULL REFERENCES shifts(shift_id),
  cashier_id INT NOT NULL REFERENCES users(user_id),
  total_sales_cash DECIMAL(15,2) DEFAULT 0,
  total_sales_qris DECIMAL(15,2) DEFAULT 0,
  total_sales_debit DECIMAL(15,2) DEFAULT 0,
  total_sales_credit DECIMAL(15,2) DEFAULT 0,
  total_sales_debt DECIMAL(15,2) DEFAULT 0,
  total_sales DECIMAL(15,2) DEFAULT 0,
  total_transactions INT DEFAULT 0,
  total_expenses DECIMAL(15,2) DEFAULT 0,
  modal_share DECIMAL(15,2),
  expected_cash DECIMAL(15,2),
  real_cash DECIMAL(15,2),
  variance DECIMAL(15,2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(shift_id, cashier_id)
);

CREATE INDEX idx_breakdown_shift ON shift_cashier_breakdown(shift_id);
```

### `shift_expenses`
```sql
CREATE TABLE shift_expenses (
  expense_id SERIAL PRIMARY KEY,
  shift_id INT NOT NULL REFERENCES shifts(shift_id),
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  note TEXT NOT NULL,
  proof_image_url VARCHAR(500),
  created_by INT NOT NULL REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 7.6 Customer Debt

### `customer_debts`
```sql
CREATE TABLE customer_debts (
  debt_id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(customer_id),
  transaction_id INT NOT NULL REFERENCES transactions(transaction_id),
  original_amount DECIMAL(15,2) NOT NULL,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  remaining_amount DECIMAL(15,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  due_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `debt_payments`
```sql
CREATE TABLE debt_payments (
  payment_id SERIAL PRIMARY KEY,
  debt_id INT NOT NULL REFERENCES customer_debts(debt_id),
  amount DECIMAL(15,2) NOT NULL,
  payment_method VARCHAR(30) NOT NULL,
  reference_number VARCHAR(100),
  paid_by_cashier INT NOT NULL REFERENCES users(user_id),
  shift_id INT REFERENCES shifts(shift_id),
  paid_at TIMESTAMP DEFAULT NOW()
);
```

## 7.7 Promotions

### `promotions`
```sql
CREATE TABLE promotions (
  promo_id SERIAL PRIMARY KEY,
  promo_name VARCHAR(255) NOT NULL,
  promo_type VARCHAR(30) NOT NULL, -- percentage/nominal/bxgy/bundle
  discount_value DECIMAL(15,2),
  apply_to_type VARCHAR(30) NOT NULL, -- product/category/brand/all
  apply_to_ids JSONB,
  branch_ids JSONB,
  stackable BOOLEAN DEFAULT false,
  priority INT DEFAULT 0,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  rules JSONB,
  created_by INT REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 7.8 Stock Opname

### `stock_opnames`
```sql
CREATE TABLE stock_opnames (
  so_id SERIAL PRIMARY KEY,
  branch_id INT NOT NULL REFERENCES branches(branch_id),
  so_type VARCHAR(20) NOT NULL, -- daily/full
  so_date DATE NOT NULL,
  created_by INT NOT NULL REFERENCES users(user_id),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  approved_by INT REFERENCES users(user_id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  total_variance_value DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `stock_opname_items`
```sql
CREATE TABLE stock_opname_items (
  so_item_id SERIAL PRIMARY KEY,
  so_id INT NOT NULL REFERENCES stock_opnames(so_id),
  product_id INT NOT NULL REFERENCES products(product_id),
  uom_id INT NOT NULL REFERENCES units_of_measure(uom_id),
  system_qty DECIMAL(10,2) NOT NULL,
  physical_qty DECIMAL(10,2) NOT NULL,
  variance_qty DECIMAL(10,2) NOT NULL,
  variance_value DECIMAL(15,2) NOT NULL,
  variance_reason VARCHAR(30),
  notes TEXT
);
```

## 7.9 Purchase Order

### `purchase_orders`
```sql
CREATE TABLE purchase_orders (
  po_id SERIAL PRIMARY KEY,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  branch_id INT NOT NULL REFERENCES branches(branch_id),
  supplier_id INT NOT NULL REFERENCES suppliers(supplier_id),
  created_by INT NOT NULL REFERENCES users(user_id),
  approved_by INT REFERENCES users(user_id),
  approved_at TIMESTAMP,
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `purchase_order_items`
```sql
CREATE TABLE purchase_order_items (
  po_item_id SERIAL PRIMARY KEY,
  po_id INT NOT NULL REFERENCES purchase_orders(po_id),
  product_id INT NOT NULL REFERENCES products(product_id),
  uom_id INT NOT NULL REFERENCES units_of_measure(uom_id),
  qty_ordered DECIMAL(10,2) NOT NULL,
  qty_received DECIMAL(10,2) DEFAULT 0,
  qty_remaining DECIMAL(10,2),
  price_ordered DECIMAL(15,2) NOT NULL,
  price_actual DECIMAL(15,2),
  notes TEXT
);
```

### `po_receiving_logs`
```sql
CREATE TABLE po_receiving_logs (
  log_id SERIAL PRIMARY KEY,
  po_id INT NOT NULL REFERENCES purchase_orders(po_id),
  received_by INT NOT NULL REFERENCES users(user_id),
  received_date TIMESTAMP NOT NULL,
  items_received JSONB,
  discrepancies JSONB,
  photo_urls JSONB,
  invoice_received BOOLEAN DEFAULT false,
  invoice_url VARCHAR(500),
  approved_by_backoffice INT REFERENCES users(user_id),
  approved_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### `supplier_payables`
```sql
CREATE TABLE supplier_payables (
  payable_id SERIAL PRIMARY KEY,
  po_id INT NOT NULL REFERENCES purchase_orders(po_id),
  supplier_id INT NOT NULL REFERENCES suppliers(supplier_id),
  amount_owed DECIMAL(15,2) NOT NULL,
  amount_paid DECIMAL(15,2) DEFAULT 0,
  due_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 7.10 Loyalty Points

### `customer_points`
```sql
CREATE TABLE customer_points (
  point_id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(customer_id),
  points_balance INT NOT NULL DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW()
);
```

### `point_transactions`
```sql
CREATE TABLE point_transactions (
  point_trx_id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(customer_id),
  transaction_id INT REFERENCES transactions(transaction_id),
  points_change INT NOT NULL,
  reason VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 7.11 Owner Price Override Audit

```sql
CREATE TABLE owner_price_overrides (
  override_id SERIAL PRIMARY KEY,
  transaction_id INT REFERENCES transactions(transaction_id),
  transaction_item_id INT REFERENCES transaction_items(item_id),
  product_id INT,
  uom_id INT,
  original_price DECIMAL(15,2),
  override_price DECIMAL(15,2),
  discount_amount DECIMAL(15,2),
  discount_percentage DECIMAL(5,2),
  override_by INT REFERENCES users(user_id),
  override_at TIMESTAMP DEFAULT NOW(),
  customer_id INT REFERENCES customers(customer_id),
  notes TEXT
);
```
