# Petshop Management System — Full Project Context
> **Purpose**: Comprehensive reference for rebuilding this project with a different stack/architecture.  
> **Source**: `hml-desktop` (Electron + React 19 + TypeScript)  
> **App name**: `petshop-management-system` v1.0.40

---

## 1. Project Overview

**Petshop Management System** is a multi-store point-of-sale (POS) desktop application for managing petshop retail operations. It runs as an **Electron app** (Windows primary) with an offline-first SQLite database that syncs bidirectionally to a cloud PostgreSQL database.

### Core Business Domains
| Domain | Description |
|--------|-------------|
| **POS / Kasir** | Full cashier interface with barcode, multi-UOM, multi-price category, Open Bills (hold/resume cart) |
| **Inventory** | Stock per store/location, batch tracking, expiry, stock adjustment (opname), damaged goods |
| **Purchasing** | Purchase Orders with status workflow (DRAFT→ORDERED→RECEIVED→CANCELLED), auto-stock on receive |
| **Sales Reports** | Transaction history, Profit & Loss, Cash Flow |
| **Finance** | Cashier shifts, shift expenses, operational expenses, P&L, cash flow |
| **Master Data** | Products, Categories, Customers, Suppliers, Stores, UOMs, Price Categories, Payment Methods, Sales Persons, Expense Categories |
| **User/RBAC** | Users, Roles, Permissions, Role-Permission assignments |
| **Pricing** | Multi-UOM pricing, per price-category, store-specific overrides |
| **Loyalty Points** | Earn/redeem points on transactions, configurable rules |
| **Returns** | Sales return with optional restock |
| **Delivery Order** | Surat jalan (delivery note) generation and printing |
| **Cloud Sync** | Full bidirectional sync with offline queue, 5-min periodic sync |
| **Audit Logging** | Full audit trail on critical actions |
| **Printer** | Network/USB thermal printer, multi-printer config, receipt + settlement + delivery note printing |

---

## 2. Current Tech Stack (Electron)

| Layer | Technology |
|-------|-----------|
| **Runtime** | Electron 39 |
| **Build tool** | electron-vite (Vite-based) |
| **Frontend** | React 19 + TypeScript (strict) |
| **UI Library** | Material UI v7 (`@mui/material`, `@mui/icons-material`, `@mui/x-data-grid`, `@mui/x-date-pickers`) |
| **Routing** | react-router-dom v7 (HashRouter) |
| **Forms** | react-hook-form + zod |
| **Local DB** | sql.js (SQLite WASM) stored as `petshop-local.db` in `%APPDATA%` |
| **Cloud DB** | PostgreSQL via `pg` driver |
| **ORM** | Drizzle ORM (PostgreSQL schema definition + migrations) |
| **State** | React Context (no Redux) |
| **Auto-update** | electron-updater |
| **Utilities** | date-fns, uuid, axios, xlsx (export), node-thermal-printer |

---

## 3. Architecture & Data Flow

```
Renderer (React)
  └─ window.api.db.<domain>.<method>()
        │ contextBridge
Preload (ipcRenderer.invoke)
        │ IPC channel: "db:<domain>:<action>"
Main Process (ipcMain.handle)
  └─ Controller → requirePermission() → Service
        │
  ┌─────┴──────┐
  │            │
SQLite       PostgreSQL
(local)      (cloud)
  └─ Cloud-First: Read cloud first, fall back to local
  └─ Writes: cloud if online, queue if offline
```

### Bootstrap Flow (`src/main/bootstrap.ts`)
1. `getDb()` → initialize SQLite via sql.js
2. Seed: permissions, roles, admin user, UOMs, price categories, point settings, return tables, expense categories
3. Create `QueueService` + `QueueProcessorService` → start background worker
4. Instantiate all cloud-first services (inject `db` + `queueService`)
5. Auto-connect to PostgreSQL from env `PG_DATABASE_URL` or stored app config
6. If connected: start connectivity monitoring, start periodic full sync (5-min)
7. Instantiate all controllers → `registerHandlers()`
8. `authService.restoreSession()`

### Cloud-First Strategy
- **Reads**: Cloud first → fall back to local SQLite
- **Writes**: Cloud if online → queue for later sync if offline
- **Financial reports** (P&L, Sales Summary): Strictly cloud-only when online — never fallback stale data
- **Optimistic concurrency**: `synced_at` timestamps prevent race conditions during push
- **Merge**: `mergeWithLocalPending` overlays offline changes onto cloud results

---

## 4. Database Schema

### SQLite Local Tables (28+ tables in `localDb.ts`)

#### Master Data
| Table | Key Fields |
|-------|-----------|
| `category` | id, name |
| `supplier` | id, name, phone, address |
| `store` | id, code, name, address, phone, email, type (HQ/BRANCH) |
| `customer_category` | id, name |
| `customer` | id, name, phone, address, category_id, total_points |
| `uom` | id, code (PCS/KG/LTR/etc), name |
| `price_category` | id, name, description, is_default, sort_order |
| `payment_method` | id, name, is_active |
| `sales_person` | id, name, is_active |

#### User & Access Control
| Table | Key Fields |
|-------|-----------|
| `user` | id, name, email, password, pin, store_id |
| `role` | id, name, description |
| `permission` | id (format: `domain.entity.action`), name |
| `user_role` | id, user_id, role_id |
| `role_permission` | id, role_id, permission_id |

#### Product & Pricing
| Table | Key Fields |
|-------|-----------|
| `product` | id, sku, name, description, unit, cost, weight, category_id, supplier_id, is_service, is_active |
| `product_uom` | id, product_id, uom_id, conversion_factor, is_base_unit, cost, cost_override |
| `product_uom_category_price` | id, product_id, uom_id, price_category_id, price — HQ default prices |
| `store_product_uom_price` | id, product_id, uom_id, price_category_id, store_id, price — per-store overrides |
| `product_price` | id, product_id, store_id, price, cost, is_active — legacy simple pricing |
| `batch` | id, product_id, code, expiry_date, cost |

#### Inventory
| Table | Key Fields |
|-------|-----------|
| `product_location` | id, product_id, store_id, quantity, reserved_quantity |
| `stock_transaction` | id, product_id, store_id, type (INBOUND/OUTBOUND/TRANSFER_IN/TRANSFER_OUT/ADJUSTMENT/SALE), quantity, reference, batch_id, supplier_id, customer_id, performed_by |
| `stock_adjustment` | id, product_id, store_id, difference, note, performed_by |
| `damaged_goods` | id, product_id, store_id, uom_id, quantity, cost, total_loss, reason, notes, performed_by |

#### Sales & POS
| Table | Key Fields |
|-------|-----------|
| `transactions` | id, code, store_id, subtotal, discount, tax, total, total_weight, payment_method, payment_deadline, receipt_printed, customer_id, user_id, sales_id, sales_name |
| `transaction_items` | id, transaction_id, product_id, quantity, display_quantity, uom_code, product_name, product_sku, price |
| `open_bill` | id, label, store_id, shift_id, customer_id, sales_id, subtotal, discount, total, notes, created_by — held/paused carts |
| `open_bill_item` | id, open_bill_id, product_id, cart_item_id, quantity, display_quantity, uom_code, uom_id, price_category_id, conversion_factor, base_quantity, unit_price, weight |

#### Finance & Operations
| Table | Key Fields |
|-------|-----------|
| `cashier_shift` | id, user_id, store_id, status (OPEN/CLOSED), initial_cash, closing_cash, expected_cash, difference, notes, opened_at, closed_at |
| `shift_history` | id, shift_id, user_id, action, notes |
| `expenses` | id, shift_id, category_id, store_id, item, quantity, price, total, description, created_by, expense_date — shift expenses |
| `expense_category` | id, code, name, type (shift/operational), is_active |

#### Purchasing
| Table | Key Fields |
|-------|-----------|
| `purchase_order` | id, code, supplier_id, store_id, status, total |
| `purchase_order_item` | id, po_id, product_id, quantity, cost, unit |

#### Returns & Delivery
| Table | Key Fields |
|-------|-----------|
| `transaction_return` | id, transaction_id, return_number, store_id, total_refund, reason, created_by |
| `transaction_return_item` | id, return_id, transaction_item_id, product_id, quantity, refund_price, restock |
| `delivery_order` | id, transaction_id, no_surat_jalan, sequence_number, sequence_year, tanggal, sales, customer_id, customer_name, customer_address, notes, printed_at |

#### Loyalty & Audit
| Table | Key Fields |
|-------|-----------|
| `point_setting` | id, point_per_rupiah, min_transaction, redemption_value, min_redemption, max_redemption_percent, expiry_months, is_active |
| `point_history` | id, customer_id, transaction_id, type (EARN/REDEEM/EXPIRE/ADJUST), points, balance_after, notes, expires_at |
| `audit_log` | id, action, entity_type, entity_id, user_id, user_name, store_id, store_name, device_id, old_values, new_values, metadata |
| `printer_config` | id, name, printer_name, printer_type, paper_size, purpose, is_default, copies |

#### System
| Table | Key Fields |
|-------|-----------|
| `sync_metadata` | id, entity_name, last_sync_at, last_pull_at, last_push_at, device_id |
| `transfer_request` | id, source_id, destination_id, reference, note |
| `transfer_item` | id, transfer_id, product_id, quantity |

---

## 5. Permission System

### Format: `<domain>.<entity>.<action>`

All permissions are seeded on startup. Default roles:
- **Admin** — all permissions (`*`)
- **Manager** — dashboard, sales, inventory, purchasing, operations, pricing, finance, master, settings.view
- **Cashier** — sales.pos, sales.transaction.view, sales.return, operations.expense, dashboard.view

### Full Permission Catalog

| Domain | Permissions |
|--------|------------|
| `dashboard` | `view` |
| `sales.pos` | `view`, `create` |
| `sales.transaction` | `view`, `view-profit`, `edit`, `delete` |
| `sales.return` | `view`, `create` |
| `inventory` | `dashboard.view`, `stock.view`, `stock.adjust`, `opname.view`, `opname.create`, `opname.process`, `batch.view`, `batch.edit`, `damaged-goods.view`, `damaged-goods.manage` |
| `purchasing.order` | `view`, `create`, `edit`, `edit-cost`, `delete` |
| `operations` | `expense.view/create/delete`, `operational-expense.view/create`, `shift.view`, `shift.force-close` |
| `pricing` | `product.view/edit`, `category.view/manage` |
| `finance` | `cashflow.view`, `profit-loss.view` |
| `master` | CRUD for product/category/customer/supplier/store/user/uom/customer-category/expense-category/payment-method/sales-person, plus `product.import/export`, `user.reset-password` |
| `settings` | `view`, `role.view/manage`, `config.view/edit`, `point.view/manage` |
| `system` | `audit.view` |

---

## 6. Services & Controllers (Backend)

### ~69 Service Files in `src/main/services/`

#### Cloud-First Services (pair: `.service.ts` local + `-cloud.service.ts` cloud)
| Domain | Local Service | Cloud Service |
|--------|-------------|--------------|
| Category | `category.service.ts` | `category-cloud.service.ts` |
| Supplier | `supplier.service.ts` | `supplier-cloud.service.ts` |
| Store | `store.service.ts` | `store-cloud.service.ts` |
| Customer Category | `customer-category.service.ts` | `customer-category-cloud.service.ts` |
| Customer | `customer.service.ts` | `customer-cloud.service.ts` |
| UOM | `uom.service.ts` | `uom-cloud.service.ts` |
| User | `user.service.ts` | `user-cloud.service.ts` |
| Product | `product.service.ts` | `product-cloud.service.ts` |
| Role | `role.service.ts` | `role-cloud.service.ts` |
| User Role | `user-role.service.ts` | `user-role-cloud.service.ts` |
| Permission | `permission.service.ts` | `permission-cloud.service.ts` |
| Role Permission | `role-permission.service.ts` | `role-permission-cloud.service.ts` |
| Auth | `auth.service.ts` | `auth-cloud.service.ts` |
| Batch | `batch.service.ts` | `batch-cloud.service.ts` |
| Product Price | `product-price.service.ts` | `product-price-cloud.service.ts` |
| Product Location | `product-location.service.ts` | `product-location-cloud.service.ts` |
| Stock Transaction | `stock-transaction.service.ts` | `stock-transaction-cloud.service.ts` |
| Pricing (multi-UOM) | `pricing.service.ts` | `pricing-cloud.service.ts` |
| Price Category | `price-category.service.ts` | `price-category-cloud.service.ts` |
| Payment Method | `payment-method.service.ts` | `payment-method-cloud.service.ts` |
| Sales Person | `sales-person.service.ts` | `sales-person-cloud.service.ts` |
| Expense | `expense.service.ts` | `expense-cloud.service.ts` |
| Purchase Order | — | `purchase-order-cloud.service.ts` |
| Points | — | `point.service.ts` |

#### Standalone Services (no cloud pair)
- `transaction.service.ts` — core POS/sales (70KB!), integrates everything
- `shift.service.ts` — shift open/close/summary/settlement
- `receipt.service.ts` — thermal receipt generation (41KB!)
- `return.service.ts` — sales return processing
- `open-bill.service.ts` — hold/resume cart
- `damaged-goods.service.ts` — damaged goods tracking
- `delivery-order.service.ts` — surat jalan
- `audit-log.service.ts` — audit trail
- `stock-adjustment-cloud.service.ts` — stock opname
- `excel.service.ts` — Excel export
- `printer-config.service.ts` — multi-printer configuration
- `app-config.service.ts` — app/device configuration
- `connectivity.service.ts` — network monitoring
- `queue.service.ts` — offline write queue
- `queue-processor.service.ts` — background queue worker
- `cloud-db.service.ts` — PostgreSQL pool management
- `cloud-first-base.service.ts` — base class for cloud-first services
- `sync.service.ts` — bidirectional sync (33KB)
- `periodic-sync.service.ts` — 5-minute interval sync
- `sync-lock.service.ts` — prevent concurrent syncs

### 40 Controllers in `src/main/controllers/`
One controller per domain. Each exposes `registerHandlers()` which registers IPC channels on `ipcMain.handle`.

---

## 7. Preload API Bridge (`src/preload/api/`)

The `window.api.db` object aggregates all API modules:

```typescript
window.api.db = {
  categories, suppliers, stores, customerCategories, customers, uoms,   // master-data
  users, products, roles, userRoles, permissions, rolePermissions, auth, audit, // core
  productPrices, productLocations, batches, stockTransactions, inventory, // inventory
  pricing, priceCategories,  // pricing
  transactions,              // sales
  purchaseOrders,            // purchasing
  expenses, expenseCategories, // expenses
  sync, queue,               // system
  shifts,                    // shift management
  appConfig,                 // configuration
  receipt, printer, printerConfigs, // printing
  deliveryOrders,            // surat jalan
  paymentMethods, salesPersons, // master helpers
  points,                    // loyalty
  returns,                   // returns
  damagedGoods,              // damaged goods
  openBills,                 // hold/resume cart
}
```

---

## 8. Frontend Pages & Routes (`src/renderer/src/`)

### Route Structure (HashRouter)

| Route | Page | Permission Required |
|-------|------|-------------------|
| `/` | `Home` (Dashboard) | `dashboard.view` |
| `/login` | `Login` | — |
| `/setup` | `Setup` (Cloud DB config) | — |
| `/sales/pos` | `SalesPage` (POS/Kasir) | `sales.pos.view` |
| `/sales/reports` | `SalesReportsPage` | `sales.transaction.view` |
| `/sales/transaction/:id` | `TransactionDetailPage` | `sales.transaction.view` |
| `/inventory` | `InventoryManagementPage` | `inventory.dashboard.view` |
| `/inventory/dashboard` | `InventoryDashboardPage` | `inventory.dashboard.view` |
| `/inventory/pricing` | `InventoryPricingPage` | `inventory.dashboard.view` |
| `/inventory/batches` | `InventoryBatchesPage` | `inventory.dashboard.view` |
| `/inventory/transactions` | `InventoryTransactionsPage` | `inventory.dashboard.view` |
| `/inventory/adjustments` | `BulkStockAdjustmentsPage` | `inventory.dashboard.view` |
| `/inventory/product/:id` | `ProductStockDetailPage` | `inventory.dashboard.view` |
| `/purchasing/orders` | `PurchaseOrdersPage` | `purchasing.order.view` |
| `/purchasing/order-form` | `PurchaseOrderFormPage` | `purchasing.order.view` |
| `/operations/expenses` | `ExpensesPage` (shift expenses) | `operations.expense.view` |
| `/operations/operational-expenses` | `OperationalExpensesPage` | `operations.operational-expense.view` |
| `/operations/damaged-goods` | `DamagedGoodsPage` | `inventory.damaged-goods.view` |
| `/operations/shifts` | `ShiftHistoryPage` | `operations.shift.view` |
| `/operations/shifts/:id` | `ShiftDetailPage` | `operations.shift.view` |
| `/finance/cashflow` | `CashFlowPage` | `finance.cashflow.view` |
| `/finance/profit-loss` | `ProfitLossPage` | `finance.profit-loss.view` |
| `/products` | `ProductManagementPage` | multi |
| `/pricing/categories` | `PriceCategoryPage` | `pricing.category.view` |
| `/pricing/products` | `WarehousePricingListPage` | `pricing.product.view` |
| `/pricing/products/:id` | `ProductPricingPage` | `pricing.product.view` |
| `/warehouse/stocks` | `WarehouseStocksPage` | `inventory.stock.view` |
| `/warehouse/purchasing` | `WarehousePurchasingPage` | `inventory.stock.view` |
| `/warehouse/stock-opname` | `WarehouseStockOpnamePage` | `inventory.stock.view` |
| `/settings` | `Settings` | `settings.view` |
| `/access-control` | `AccessControlPage` | `settings.role.view` |
| `/settings/printer` | `PrinterSettings` | `settings.config.view` |
| `/settings/points` | `PointSettingsPage` | `settings.point.view` |
| `/settings/audit-logs` | `AuditLogs` | `audit.view` |
| `/master-user` | `UserPage` | `master.user.view` |
| `/master-product` | `ProductPage` | `master.product.view` |
| `/master-category` | `CategoryPage` | `master.category.view` |
| `/master-supplier` | `SupplierPage` | `master.supplier.view` |
| `/master-store` | `StorePage` | `master.store.view` |
| `/master-customer` | `CustomerPage` | `master.customer.view` |
| `/master-customer-category` | `CustomerCategoryPage` | `master.customer-category.view` |
| `/master-uom` | `UomPage` | `master.uom.view` |
| `/master-payment-method` | `PaymentMethodPage` | `master.payment-method.view` |
| `/master-sales-person` | `SalesPersonPage` | `master.sales-person.view` |
| `/master-expense-category` | `ExpenseCategoryPage` | `master.expense-category.view` |

### Navigation Structure (SideNav)
```
├── Beranda (Dashboard)
├── Penjualan (Sales)
│   ├── Kasir (POS)
│   └── Laporan Penjualan (Sales Reports)
├── Inventori (Inventory)
│   ├── Inventory Management
│   └── Penyesuaian Stok Massal (Bulk Stock Adjustments)
├── Pembelian (Purchasing)
│   ├── Pesanan Pembelian (Purchase Orders)
│   └── Buat PO (Create PO)
├── Operasional (Operations)
│   ├── Pengeluaran Harian (Shift Expenses)
│   ├── Pengeluaran Operasional (Operational Expenses)
│   ├── Riwayat Shift (Shift History)
│   └── Barang Rusak (Damaged Goods)
├── Manajemen Produk (Product Management)
│   ├── Dashboard Produk (Product Dashboard)
│   └── Kategori Harga (Price Categories)
├── Keuangan (Finance)
│   ├── Arus Kas (Cash Flow)
│   └── Laporan Laba Rugi (Profit & Loss)
├── Menu Pengaturan (Settings)
│   ├── Pengaturan (Settings)
│   ├── Data Master (Master Data)
│   │   ├── Toko/Cabang, Pengguna, Kategori, Supplier
│   │   ├── Pelanggan, Kategori Pelanggan, Satuan (UOM)
│   │   ├── Metode Pembayaran, Sales Person, Kategori Pengeluaran
│   ├── Peran & Izin (Roles & Permissions)
│   ├── Pengaturan Printer
│   ├── Member Points
│   └── Audit Log
└── Keluar (Logout)
```

---

## 9. React Contexts

| Context | Purpose |
|---------|---------|
| `AuthContext` | token, userId, userName, userRole, storeId, storeName, permissions, login/logout/hasPermission |
| `ShiftContext` | currentShift (OPEN/CLOSED), openShift, closeShift, refreshShift |
| `BranchConfigContext` | store/branch configuration |
| `ThemeContext` | dark/light mode toggle |
| `ToastContext` | global snackbar notifications |

### Auth Flow
- Login via `window.api.db.auth.login(email/pin, password)`
- JWT-style token stored in localStorage + React state
- `permissions[]` array loaded on login, checked via `hasPermission()`
- `<RequireAuth />` wrapper redirects unauthenticated users to `/login`
- `<RoleGuard requiredPermissions={[...]} />` redirects to `/forbidden`
- Logout: checks open shifts + unsynced queue records → shows warning → clears state

---

## 10. Key Business Logic Flows

### POS / Kasir Flow
1. Cashier must have open shift (managed by `ShiftContext`)
2. Scan/select products → supports multi-UOM (e.g., SAK→PCS)
3. Select price category (RETAIL, GROSIR, etc.) per customer
4. Apply discount (nominal or %)
5. Add customer → auto-apply their price category
6. Select sales person (optional)
7. Choose payment method (cash, non-cash, credit with deadline)
8. Apply points redemption (optional)
9. Finalize → `transactionService.create()` → creates transaction + items + stock_transaction (SALE) + deducts product_location
10. Print receipt via thermal printer
11. Earn points → `pointService.earnPoints()`
12. Can hold cart as "Open Bill" for later resume

### Shift Lifecycle
1. `shifts.open({userId, storeId, initialCash})` → creates `cashier_shift` record with OPEN status
2. All POS transactions are linked to active shift
3. `shifts.close(shiftId, userId, {closingCash, notes})` → calculates expected_cash, difference, sets CLOSED
4. On close: auto-print settlement report (shift summary)
5. Shift summary: total sales, total expenses, initial cash, expected cash, variance

### Purchase Order Flow
1. Create PO (DRAFT) → add items with product, qty, cost
2. Update status to ORDERED
3. Receive PO → auto-creates `stock_transaction` (INBOUND) for each item, adjusts `product_location.quantity`
4. Status → RECEIVED or CANCELLED

### Stock Sync Flow
1. Write operations queue to `QueueService` if offline
2. `QueueProcessorService` retries queued ops when online
3. Full sync runs every 5 minutes via `periodic-sync.service.ts`
4. `SyncService` does bidirectional pull/push per entity table
5. Conflict resolution: last-write-wins based on `updated_at` timestamp

### Profit & Loss Calculation
- Revenue = sum of transaction totals (cloud, strict)
- COGS = sum(quantity × cost per product) from cloud stock_transaction (SALE type)
- Gross Profit = Revenue − COGS
- Operational Expenses = monthly expenses from `expenses` table (category type = 'operational')
- Shift Expenses = from `expenses` table (linked to shifts)
- Damaged Goods Loss = sum of `damaged_goods.total_loss`
- Net Profit = Gross Profit − All Expenses − Damaged Goods Loss

---

## 11. Seed Data

### Default UOMs (13 units)
`PCS, SAK, BOX, DUS, PACK, KG, GR, LTR, ML, BTL, SET, ROLL, MTR`

### Default Price Category
`RETAIL` (id='RETAIL', is_default=true)

### Default Expense Categories
`KASIR (shift), GAJI, LISTRIK, SEWA, TRANSPORT, LAINNYA (all operational)`

### Default Admin User
- email: `admin@example.com`
- password: `admin123`
- role: Admin (all permissions)

---

## 12. Configuration

### Environment Variables (`.env`)
```
PG_DATABASE_URL=postgresql://...   # Cloud PostgreSQL
DATABASE_URL=postgresql://...       # Alternative
```
Cloud DB URL can also be stored via the app's Setup page (`/setup`) in the local SQLite `app_config` table.

### electron-builder Config (`electron-builder.yml`)
- Target: Windows NSIS installer + portable
- Auto-update via `electron-updater`
- App ID: `petshop-management-system`

---

## 13. Rewrite Target (Next.js PRD Summary)

A PRD (`PRD-NEXTJS-REWRITE.md`) already exists documenting the planned rewrite:

### Recommended Next.js Stack
| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15+ (App Router) |
| **Language** | TypeScript strict |
| **Database** | PostgreSQL (Supabase/Neon/Railway) |
| **ORM** | Drizzle ORM (maintain schema compatibility) |
| **Auth** | NextAuth.js v5 / Clerk |
| **UI** | Material UI v7 (maintain) or shadcn/ui + Tailwind |
| **Forms** | react-hook-form + zod (maintain) |
| **State** | Zustand / Jotai or React Context |
| **Cache** | Redis (Upstash) |
| **Real-time** | Supabase Realtime / Pusher |
| **Deployment** | Vercel / Railway |

### Schema Changes for Web
- Remove: `device_id`, `synced_at` columns (single source of truth)
- Remove: SQLite local tables
- Add: `session`, `verification_token`, `password_reset_token`, `notification`, `api_key`, `webhook_log`, `activity_feed`

### New Features Planned
- **Dynamic Promotions** — per product, type (nominal/%), per customer category, validity period, auto-apply at POS
- **Revenue Target (Omset)** — per branch, per product, progress tracking, display in shift closing
- **Delivery Management** — full delivery order tracking, courier assignment, status flow, customer proof
- **Todo List System** — task assignment, daily recurring, completion tracking
- **Enhanced HR/Payroll** — attendance, salary components, payslip generation
- **PWA Support** — offline mode via service worker
- **Responsive/Touch POS** — tablet-optimized UI

---

## 14. IPC Channel Reference (Selected)

### Auth
`db:auth:login`, `db:auth:logout`, `db:auth:getCurrentUser`

### Transactions (Sales)
`db:transactions:getAll`, `db:transactions:getById`, `db:transactions:create`, `db:transactions:delete`, `db:transactions:restore`, `db:transactions:getSalesSummary`, `db:transactions:getProfitLossReport`, `db:transactions:getCashFlowReport`, `db:transactions:getBrokenGoodsSummary`

### Inventory
`db:productLocations:getAll`, `db:productLocations:adjustQuantity`, `db:stockTransactions:create`, `db:stockTransactions:getStockSummary`

### Shifts
`db:shifts:open`, `db:shifts:close`, `db:shifts:getCurrentShift`, `db:shifts:getSummary`, `db:shifts:getHistory`

### Queue/Sync
`db:sync:fullSync`, `db:queue:getStats`, `cloud:connect`, `cloud:disconnect`

### Receipt/Printer
`receipt:print`, `printer:printSettlementReport`, `printer:printExpenseReport`, `printer:printDeliveryOrder`, `printer:getAvailablePrinters`

---

## 15. Known Business Rules & Decisions

1. **Monetary values** stored as `TEXT`/`numeric` (Decimal safe) — never `float`
2. **Soft deletes** everywhere — `deleted_at IS NOT NULL` = deleted
3. **UUID primary keys** for all entities (via `crypto.randomUUID()`)
4. **Timestamps in milliseconds** for SQLite, `timestamp without time zone` for PostgreSQL
5. **PIN login** supported for cashiers (4-6 digit PIN as alternative to password)
6. **Store type**: `HQ` (head office) or `BRANCH` — affects who can configure global prices
7. **Product weight** stored for delivery fee calculation
8. **Open Bill** = paused cart, linked to shift, can be resumed later
9. **Transaction code** auto-generated, unique per store
10. **Delivery Order number** (no_surat_jalan) auto-incremented per year
11. **Points**: 1 point per Rp100 spent (configurable), 1 point = Rp10 redemption value (configurable), max 50% of transaction, 12-month expiry
12. **Damaged goods** reduces P&L (counted as operational loss)
13. **Shift expenses** (kasir) vs **Operational expenses** (monthly) are separate — both appear in cash flow

---

*Generated: 2026-04-17 | Source: hml-desktop v1.0.40*
