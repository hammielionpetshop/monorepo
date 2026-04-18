# 8. API SPECIFICATIONS

## 8.1 Authentication

```
POST /api/pos/auth/login
Body: { email/pin, password }
Response: { token, user_info, branch_info }

POST /api/pos/auth/refresh
Body: { refresh_token }
Response: { new_token }

POST /api/pos/auth/logout
Headers: Authorization: Bearer {token}
```

## 8.2 Bootstrap (Data Sync)

```
GET /api/pos/bootstrap
Headers: Authorization: Bearer {token}
Response:
{
  branch: {...},
  products: [...],
  prices: [...],
  uom_conversions: [...],
  customers: [...],
  payment_methods: [...],
  active_promotions: [...],
  categories: [...],
  brands: [...]
}

// Untuk offline: simpan response ini ke IndexedDB
```

## 8.3 Transactions

```
POST /api/pos/transactions
Body: {
  branch_id,
  shift_id,
  customer_id?,
  items: [
    {
      product_id,
      uom_id,
      qty,
      unit_price,
      price_tier,
      discount?: {...}
    }
  ],
  payments: [
    { method, amount, ref_number? }
  ],
  created_offline: boolean,
  offline_timestamp?: ISO8601
}
Response: {
  transaction_id,
  trx_number,
  stock_updates: [...],
  auto_break_events: [...]
}

GET /api/pos/transactions?shift_id=X
GET /api/pos/transactions/{id}
POST /api/pos/transactions/{id}/void-request
```

## 8.4 Stock Opname

```
POST /api/pos/stock-opnames
Body: {
  branch_id,
  so_type: "daily" | "full",
  items: [
    {
      product_id,
      uom_id,
      physical_qty,
      variance_reason?
    }
  ]
}

GET /api/pos/stock-opnames?branch_id=X&status=pending
PATCH /api/pos/stock-opnames/{id}/approve
PATCH /api/pos/stock-opnames/{id}/reject
```

## 8.5 Purchase Order

```
POST /api/pos/purchase-orders
GET /api/pos/purchase-orders?status=X
GET /api/pos/purchase-orders/{id}
PATCH /api/pos/purchase-orders/{id}
POST /api/pos/purchase-orders/{id}/receive
  Body: {
    items_received: [...],
    invoice_received: boolean,
    photos?: [...]
  }
PATCH /api/pos/purchase-orders/{id}/approve-receiving
```

## 8.6 Shift & Settlement

```
POST /api/pos/shifts/open
Body: { opening_cash, assigned_cashiers: [id, id] }
Response: { shift_id }

POST /api/pos/shifts/{id}/close
Body: {
  cashier_breakdown: [
    { cashier_id, real_cash }
  ]
}
Response: {
  expected_cash_per_cashier: [...],
  variance_per_cashier: [...],
  report_data
}

POST /api/pos/shifts/{id}/expenses
Body: { category, amount, note, proof? }
```

## 8.7 Customer Debt

```
GET /api/pos/customers/{id}/debts
POST /api/pos/customers/{id}/debts/payment
Body: {
  debt_id,
  amount,
  payment_method
}
```

## 8.8 Sync (Offline → Online)

```
POST /api/pos/sync/batch
Body: {
  transactions: [...],
  void_requests: [...],
  expenses: [...],
  stock_opnames: [...],
  offline_timestamps: [...]
}
Response: {
  success: [...],
  conflicts: [...],
  errors: [...]
}
```
