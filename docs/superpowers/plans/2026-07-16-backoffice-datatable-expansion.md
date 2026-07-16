<!-- markdownlint-disable MD013 -->
# Backoffice DataTable Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the reusable `DataTable` across backoffice list and index
screens while keeping tabs, filters, dialogs, summaries, and fetch orchestration
at page level.

**Architecture:** First extend `apps/backoffice/components/ui/data-table.tsx`
into a stronger TanStack-based table shell that supports optional toolbar,
loading row, summary override, sorting affordances, and row click wiring. Then
migrate the approved list/index consumers in small batches, preserving existing
page behavior while removing duplicated table markup.

**Tech Stack:** Next.js App Router, React 19, TypeScript, TanStack Table,
Vitest, Tailwind CSS

---

## File Map

### Shared foundation

- Modify: `apps/backoffice/components/ui/data-table.tsx` Add the new generic
  `DataTable` props and rendering branches.
- Modify: `apps/backoffice/components/ui/data-table.test.ts` Cover toolbar,
  loading, summary override, sorting affordance, and clickable row styling.
- Modify: `apps/backoffice/components/ui/data-table-pagination.test.ts` Keep
  pagination helper expectations aligned if summary behavior changes.

### Consumer migrations

- Modify:
  `apps/backoffice/app/(dashboard)/master-data/customers/_components/customer-client.tsx`
- Create:
  `apps/backoffice/app/(dashboard)/master-data/customers/_components/customer-client.test.ts`
- Modify:
  `apps/backoffice/app/(dashboard)/master-data/suppliers/_components/supplier-client.tsx`
- Create:
  `apps/backoffice/app/(dashboard)/master-data/suppliers/_components/supplier-client.test.ts`
- Modify:
  `apps/backoffice/app/(dashboard)/orders/_components/orders-list-client.tsx`
- Create:
  `apps/backoffice/app/(dashboard)/orders/_components/orders-list-client.test.ts`
- Modify:
  `apps/backoffice/app/(dashboard)/purchase-orders/_components/po-list-client.tsx`
- Create:
  `apps/backoffice/app/(dashboard)/purchase-orders/_components/po-list-client.test.ts`
- Modify:
  `apps/backoffice/app/(dashboard)/audit-log/_components/audit-log-table.tsx`
- Create:
  `apps/backoffice/app/(dashboard)/audit-log/_components/audit-log-table.test.ts`
- Modify:
  `apps/backoffice/app/(dashboard)/inventory/adjustment-logs/_components/adjustment-logs-client.tsx`
- Create:
  `apps/backoffice/app/(dashboard)/inventory/adjustment-logs/_components/adjustment-logs-client.test.ts`
- Modify:
  `apps/backoffice/app/(dashboard)/inventory/stock-logs/_components/stock-logs-client.tsx`
- Create:
  `apps/backoffice/app/(dashboard)/inventory/stock-logs/_components/stock-logs-client.test.ts`

### Explicitly deferred

- Review only:
  `apps/backoffice/app/(dashboard)/purchase-orders/internal/payables/_components/payables-client.tsx`
  Keep this out of the migration unless its inline expanded-row workflow is
  redesigned first.

## Task 1: Extend the Shared DataTable Foundation

**Files:**

- Modify: `apps/backoffice/components/ui/data-table.tsx`
- Modify: `apps/backoffice/components/ui/data-table.test.ts`
- Modify: `apps/backoffice/components/ui/data-table-pagination.test.ts`

- [ ] **Step 1: Write the failing shared-component tests**

Add the following coverage to
`apps/backoffice/components/ui/data-table.test.ts`:

```ts
it("renders toolbar, loading message, and custom summary", () => {
  const html = renderToStaticMarkup(
    React.createElement(DataTableForRows, {
      data: [],
      columns,
      emptyMessage: "Belum ada data",
      toolbar: React.createElement("div", null, "Toolbar pelanggan"),
      isLoading: true,
      loadingMessage: "Memuat pelanggan...",
      summary: React.createElement("span", null, "Menampilkan 0 hasil filter"),
    }),
  );

  expect(html).toContain("Toolbar pelanggan");
  expect(html).toContain("Memuat pelanggan...");
  expect(html).toContain("Menampilkan 0 hasil filter");
  expect(html).not.toContain("Belum ada data");
});

it("renders sortable header affordance and clickable row styling", () => {
  const sortableColumns = [
    columnHelper.accessor("name", {
      header: "Nama",
      enableSorting: true,
      cell: (info) => info.getValue(),
    }),
  ];

  const html = renderToStaticMarkup(
    React.createElement(DataTableForRows, {
      data: [{ name: "A" }],
      columns: sortableColumns,
      emptyMessage: "Belum ada data",
      enableSorting: true,
      onRowClick: () => undefined,
    }),
  );

  expect(html).toContain("Nama");
  expect(html).toContain("cursor-pointer");
});
```

- [ ] **Step 2: Run the focused shared-component tests to verify they fail**

Run:

```bash
pnpm exec vitest run components/ui/data-table.test.ts components/ui/data-table-pagination.test.ts
```

Expected:

```text
FAIL  components/ui/data-table.test.ts
x Property 'toolbar' does not exist on type 'DataTableProps<Row>'
```

- [ ] **Step 3: Add the new DataTable props and state**

Update `apps/backoffice/components/ui/data-table.tsx`:

```tsx
type DataTableProps<TData> = {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  emptyMessage: string;
  pageSize?: number;
  toolbar?: React.ReactNode;
  isLoading?: boolean;
  loadingMessage?: string;
  summary?: React.ReactNode;
  enableSorting?: boolean;
  onRowClick?: (row: TData) => void;
  rowClassName?: (row: TData) => string;
};

const [sorting, setSorting] = useState<SortingState>([]);

const table = useReactTable({
  data,
  columns,
  state: { pagination, sorting },
  onPaginationChange: setPagination,
  onSortingChange: setSorting,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
});
```

- [ ] **Step 4: Render toolbar, loading, summary, and clickable rows**

In the same file, replace the fixed table shell with these branches:

```tsx
const footerSummary =
  summary ??
  getPaginationSummary(pagination.pageIndex, pagination.pageSize, rowCount);

return (
  <div className="overflow-hidden rounded-lg border border-border bg-card">
    {toolbar ? (
      <div className="border-b border-border px-4 py-3">{toolbar}</div>
    ) : null}
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className={headerCellClassName}>
                  {header.isPlaceholder ? null : enableSorting &&
                    header.column.getCanSort() ? (
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="inline-flex items-center gap-1 text-left"
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      <span className="text-xs text-muted-foreground">
                        {header.column.getIsSorted() === "asc"
                          ? "^"
                          : header.column.getIsSorted() === "desc"
                            ? "v"
                            : "<>"}
                      </span>
                    </button>
                  ) : (
                    flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                {loadingMessage ?? "Memuat data..."}
              </td>
            </tr>
          ) : visibleRows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            visibleRows.map((row) => (
              <tr
                key={row.id}
                onClick={
                  onRowClick ? () => onRowClick(row.original) : undefined
                }
                className={[
                  "border-t border-border transition-colors hover:bg-muted/20",
                  onRowClick ? "cursor-pointer" : "",
                  rowClassName ? rowClassName(row.original) : "",
                ]
                  .join(" ")
                  .trim()}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={bodyCellClassName}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
      <div className="text-muted-foreground">{footerSummary}</div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </button>
      </div>
    </div>
  </div>
);
```

- [ ] **Step 5: Re-run the shared-component tests**

Run:

```bash
pnpm exec vitest run components/ui/data-table.test.ts components/ui/data-table-pagination.test.ts
```

Expected:

```text
PASS  components/ui/data-table.test.ts
PASS  components/ui/data-table-pagination.test.ts
```

- [ ] **Step 6: Commit the shared DataTable foundation**

Run:

```bash
git add apps/backoffice/components/ui/data-table.tsx \
  apps/backoffice/components/ui/data-table.test.ts \
  apps/backoffice/components/ui/data-table-pagination.test.ts
git commit -m "feat(backoffice): extend shared data table"
```

## Task 2: Migrate Customers and Suppliers

**Files:**

- Modify:
  `apps/backoffice/app/(dashboard)/master-data/customers/_components/customer-client.tsx`
- Create:
  `apps/backoffice/app/(dashboard)/master-data/customers/_components/customer-client.test.ts`
- Modify:
  `apps/backoffice/app/(dashboard)/master-data/suppliers/_components/supplier-client.tsx`
- Create:
  `apps/backoffice/app/(dashboard)/master-data/suppliers/_components/supplier-client.test.ts`

- [ ] **Step 1: Write the customer and supplier render tests**

Create `customer-client.test.ts`:

```ts
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import CustomerClient from './customer-client'

describe('CustomerClient', () => {
  it('renders search controls and customer data', () => {
    const html = renderToStaticMarkup(
      <CustomerClient
        customers={[
          {
            id: 1,
            code: 'CUS-001',
            name: 'Budi',
            phone: '08123',
            email: 'budi@example.com',
            address: null,
            isActive: true,
            createdAt: '2026-07-16T10:00:00.000Z',
          },
        ]}
      />
    )

    expect(html).toContain('Cari nama, kode, atau telepon...')
    expect(html).toContain('CUS-001')
    expect(html).toContain('Budi')
    expect(html).toContain('+ Tambah Customer')
  })
})
```

Create `supplier-client.test.ts`:

```ts
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import SupplierClient from './supplier-client'

describe('SupplierClient', () => {
  it('renders search controls and supplier data', () => {
    const html = renderToStaticMarkup(
      <SupplierClient
        suppliers={[
          {
            id: 1,
            name: 'PT Maju',
            contactPerson: 'Sari',
            phone: '08111',
            email: 'sari@example.com',
            bankAccount: null,
            address: null,
            paymentTermDays: 14,
          },
        ]}
      />
    )

    expect(html).toContain('Cari nama, telepon, atau kontak...')
    expect(html).toContain('PT Maju')
    expect(html).toContain('14 hari')
    expect(html).toContain('+ Tambah Supplier')
  })
})
```

- [ ] **Step 2: Run the new consumer tests**

Run:

```bash
pnpm exec vitest run \
  "app/(dashboard)/master-data/customers/_components/customer-client.test.ts" \
  "app/(dashboard)/master-data/suppliers/_components/supplier-client.test.ts"
```

Expected:

```text
PASS  app/(dashboard)/master-data/customers/_components/customer-client.test.ts
PASS  app/(dashboard)/master-data/suppliers/_components/supplier-client.test.ts
```

- [ ] **Step 3: Replace the customer table markup with DataTable**

In `customer-client.tsx`, import `ColumnDef` and `DataTable`, define explicit
columns, and move the search input plus add button into the `toolbar` prop:

```tsx
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'

const columns: ColumnDef<Customer>[] = [
  {
    accessorKey: 'code',
    header: 'Kode',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.code ?? '-'}
      </span>
    ),
  },
  {
    accessorKey: 'name',
    header: 'Nama',
    cell: ({ row }) => (
      <span className="font-medium text-foreground">{row.original.name}</span>
    ),
  },
  {
    id: 'actions',
    header: () => <div className="text-right">Aksi</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <Link href={`/master-data/customers/${row.original.id}`} className="mr-3 text-xs font-medium text-muted-foreground hover:underline">
          Detail
        </Link>
        <button onClick={() => openEditForm(row.original)} className="mr-3 text-xs font-medium text-primary hover:underline">
          Edit
        </button>
        <button onClick={() => setDeletingCustomer(row.original)} className="text-xs font-medium text-destructive hover:underline">
          Hapus
        </button>
      </div>
    ),
  },
]

<DataTable
  data={filtered}
  columns={columns}
  emptyMessage={search ? 'Tidak ada customer yang cocok dengan pencarian' : 'Belum ada data customer'}
  toolbar={
    <div className="flex items-center gap-3">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari nama, kode, atau telepon..."
        className="flex-1 max-w-xs px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <button
        onClick={openAddForm}
        className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        + Tambah Customer
      </button>
    </div>
  }
/>
```

- [ ] **Step 4: Replace the supplier table markup with DataTable**

Apply the same composition pattern in `supplier-client.tsx`:

```tsx
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'

const columns: ColumnDef<Supplier>[] = [
  {
    accessorKey: 'name',
    header: 'Nama',
    cell: ({ row }) => (
      <span className="font-medium text-foreground">{row.original.name}</span>
    ),
  },
  {
    accessorKey: 'contactPerson',
    header: 'Kontak',
    cell: ({ row }) => (
      <span className="text-foreground">{row.original.contactPerson ?? '-'}</span>
    ),
  },
  {
    id: 'actions',
    header: () => <div className="text-right">Aksi</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <button onClick={() => openEditForm(row.original)} className="mr-3 text-xs font-medium text-primary hover:underline">
          Edit
        </button>
        <button onClick={() => setDeletingSupplier(row.original)} className="text-xs font-medium text-destructive hover:underline">
          Hapus
        </button>
      </div>
    ),
  },
]

<DataTable
  data={filtered}
  columns={columns}
  emptyMessage={search ? 'Tidak ada supplier yang cocok dengan pencarian' : 'Belum ada data supplier'}
  toolbar={
    <div className="flex items-center gap-3">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari nama, telepon, atau kontak..."
        className="flex-1 max-w-xs px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <button
        onClick={openAddForm}
        className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        + Tambah Supplier
      </button>
    </div>
  }
/>
```

- [ ] **Step 5: Re-run the targeted tests and TypeScript**

Run:

```bash
pnpm exec vitest run \
  "app/(dashboard)/master-data/customers/_components/customer-client.test.ts" \
  "app/(dashboard)/master-data/suppliers/_components/supplier-client.test.ts" \
  components/ui/data-table.test.ts
pnpm exec tsc --noEmit
```

Expected:

```text
PASS  app/(dashboard)/master-data/customers/_components/customer-client.test.ts
PASS  app/(dashboard)/master-data/suppliers/_components/supplier-client.test.ts
PASS  components/ui/data-table.test.ts
Found 0 errors.
```

- [ ] **Step 6: Commit the customer and supplier migration**

Run:

```bash
git add \
  "apps/backoffice/app/(dashboard)/master-data/customers/_components/customer-client.tsx" \
  "apps/backoffice/app/(dashboard)/master-data/customers/_components/customer-client.test.ts" \
  "apps/backoffice/app/(dashboard)/master-data/suppliers/_components/supplier-client.tsx" \
  "apps/backoffice/app/(dashboard)/master-data/suppliers/_components/supplier-client.test.ts"
git commit -m "refactor(backoffice): migrate customer and supplier tables"
```

## Task 3: Migrate Orders and Purchase Orders

**Files:**

- Modify:
  `apps/backoffice/app/(dashboard)/orders/_components/orders-list-client.tsx`
- Create:
  `apps/backoffice/app/(dashboard)/orders/_components/orders-list-client.test.ts`
- Modify:
  `apps/backoffice/app/(dashboard)/purchase-orders/_components/po-list-client.tsx`
- Create:
  `apps/backoffice/app/(dashboard)/purchase-orders/_components/po-list-client.test.ts`

- [ ] **Step 1: Write the tabbed-list render tests**

Create `orders-list-client.test.ts`:

```ts
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { OrdersListClient } from './orders-list-client'

describe('OrdersListClient', () => {
  it('renders tabs and the pending order row', () => {
    const html = renderToStaticMarkup(
      <OrdersListClient
        orders={[
          {
            id: 1,
            orderNumber: 'SO-001',
            customerName: 'Budi',
            customerPhone: '08123',
            itemCount: 2,
            estimatedTotal: 150000,
            status: 'PENDING',
            createdAt: '2026-07-16T10:00:00.000Z',
          },
        ]}
      />
    )

    expect(html).toContain('Menunggu')
    expect(html).toContain('SO-001')
    expect(html).toContain('Rp 150.000')
  })
})
```

Create `po-list-client.test.ts`:

```ts
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

import { POListClient } from './po-list-client'

describe('POListClient', () => {
  it('renders tabs, create button, and purchase order data', () => {
    const html = renderToStaticMarkup(
      <POListClient
        pos={[
          {
            id: 1,
            poNumber: 'PO-001',
            status: 'PENDING_APPROVAL',
            totalAmount: '250000',
            notes: null,
            createdAt: '2026-07-16T10:00:00.000Z',
            supplier: { id: 1, name: 'PT Maju' },
            branch: { id: 1, name: 'Bandung' },
          },
        ]}
        suppliers={[]}
        branches={[]}
        currentUserId={1}
        role="OWNER"
      />
    )

    expect(html).toContain('Menunggu')
    expect(html).toContain('+ Buat PO')
    expect(html).toContain('PO-001')
  })
})
```

- [ ] **Step 2: Run the tabbed-list tests**

Run:

```bash
pnpm exec vitest run \
  "app/(dashboard)/orders/_components/orders-list-client.test.ts" \
  "app/(dashboard)/purchase-orders/_components/po-list-client.test.ts"
```

Expected:

```text
PASS  app/(dashboard)/orders/_components/orders-list-client.test.ts
PASS  app/(dashboard)/purchase-orders/_components/po-list-client.test.ts
```

- [ ] **Step 3: Replace the orders results table with DataTable**

Keep the status tabs page-level and migrate only the results table:

```tsx
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'

const columns: ColumnDef<OrderSummary>[] = [
  {
    accessorKey: 'orderNumber',
    header: 'No. Order',
    cell: ({ row }) => (
      <Link href={`/orders/${row.original.id}`} className="font-medium text-primary hover:underline">
        {row.original.orderNumber}
      </Link>
    ),
  },
  {
    accessorKey: 'estimatedTotal',
    header: () => <div className="text-right">Total Estimasi</div>,
    enableSorting: true,
    cell: ({ row }) => (
      <div className="text-right font-medium text-foreground">
        Rp {formatCurrency(row.original.estimatedTotal)}
      </div>
    ),
  },
]

<DataTable
  data={filtered}
  columns={columns}
  emptyMessage="Tidak ada order pada status ini."
  enableSorting
/>
```

- [ ] **Step 4: Replace the purchase orders results table with DataTable**

Keep tabs and the create button outside the shared table:

```tsx
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'

const columns: ColumnDef<PO>[] = [
  {
    accessorKey: 'poNumber',
    header: 'No. PO',
    cell: ({ row }) => (
      <span className="font-mono font-medium text-foreground">
        {row.original.poNumber}
      </span>
    ),
  },
  {
    accessorKey: 'totalAmount',
    header: () => <div className="text-right">Total</div>,
    enableSorting: true,
    cell: ({ row }) => (
      <div className="text-right font-medium">
        Rp {parseFloat(row.original.totalAmount).toLocaleString('id-ID')}
      </div>
    ),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <Link href={`/purchase-orders/${row.original.id}`} className="text-xs font-medium text-primary hover:underline">
        Detail ->
      </Link>
    ),
  },
]

<DataTable
  data={filtered}
  columns={columns}
  emptyMessage="Tidak ada Purchase Order untuk filter ini."
  enableSorting
/>
```

- [ ] **Step 5: Re-run the targeted tests and TypeScript**

Run:

```bash
pnpm exec vitest run \
  "app/(dashboard)/orders/_components/orders-list-client.test.ts" \
  "app/(dashboard)/purchase-orders/_components/po-list-client.test.ts" \
  components/ui/data-table.test.ts
pnpm exec tsc --noEmit
```

Expected:

```text
PASS  app/(dashboard)/orders/_components/orders-list-client.test.ts
PASS  app/(dashboard)/purchase-orders/_components/po-list-client.test.ts
PASS  components/ui/data-table.test.ts
Found 0 errors.
```

- [ ] **Step 6: Commit the tabbed-list migration**

Run:

```bash
git add \
  "apps/backoffice/app/(dashboard)/orders/_components/orders-list-client.tsx" \
  "apps/backoffice/app/(dashboard)/orders/_components/orders-list-client.test.ts" \
  "apps/backoffice/app/(dashboard)/purchase-orders/_components/po-list-client.tsx" \
  "apps/backoffice/app/(dashboard)/purchase-orders/_components/po-list-client.test.ts"
git commit -m "refactor(backoffice): migrate order list tables"
```

## Task 4: Migrate Audit Log and Inventory Log Screens

**Files:**

- Modify:
  `apps/backoffice/app/(dashboard)/audit-log/_components/audit-log-table.tsx`
- Create:
  `apps/backoffice/app/(dashboard)/audit-log/_components/audit-log-table.test.ts`
- Modify:
  `apps/backoffice/app/(dashboard)/inventory/adjustment-logs/_components/adjustment-logs-client.tsx`
- Create:
  `apps/backoffice/app/(dashboard)/inventory/adjustment-logs/_components/adjustment-logs-client.test.ts`
- Modify:
  `apps/backoffice/app/(dashboard)/inventory/stock-logs/_components/stock-logs-client.tsx`
- Create:
  `apps/backoffice/app/(dashboard)/inventory/stock-logs/_components/stock-logs-client.test.ts`

- [ ] **Step 1: Write the audit and inventory render tests**

Create `audit-log-table.test.ts`:

```ts
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { AuditLogTable } from './audit-log-table'

describe('AuditLogTable', () => {
  it('renders filter controls and loading state', () => {
    const html = renderToStaticMarkup(<AuditLogTable />)

    expect(html).toContain('Terapkan Filter')
    expect(html).toContain('Reset')
    expect(html).toContain('Memuat data...')
  })
})
```

Create `adjustment-logs-client.test.ts`:

```ts
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import AdjustmentLogsClient from './adjustment-logs-client'

describe('AdjustmentLogsClient', () => {
  it('renders filters, summary, and adjustment rows', () => {
    const html = renderToStaticMarkup(
      <AdjustmentLogsClient
        initialData={[
          {
            id: 1,
            productName: 'Dog Food',
            productSku: 'DOG-01',
            branchName: 'Bandung',
            adjustedByName: 'Admin',
            previousQty: 10,
            newQty: 12,
            deltaQty: '2',
            deltaFormatted: '+2',
            reason: 'Audit',
            createdAt: '2026-07-16T10:00:00.000Z',
          },
        ]}
        branches={[]}
      />
    )

    expect(html).toContain('Cari Produk')
    expect(html).toContain('Menampilkan 1 entri')
    expect(html).toContain('Dog Food')
  })
})
```

Create `stock-logs-client.test.ts`:

```ts
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import StockLogsClient from './stock-logs-client'

describe('StockLogsClient', () => {
  it('renders filters, summary, and stock rows', () => {
    const html = renderToStaticMarkup(
      <StockLogsClient
        initialData={[
          {
            id: 'PO_1',
            createdAt: '2026-07-16T10:00:00.000Z',
            movementType: 'PO_IN',
            productName: 'Dog Food',
            productSku: 'DOG-01',
            branchName: 'Bandung',
            uomCode: 'PCS',
            qtyChange: 5,
            unitPrice: 10000,
            cogs: 10000,
            referenceNumber: 'PO-001',
            actorName: 'Admin',
            notes: 'Restock',
          },
        ]}
        initialError={null}
        branches={[]}
        defaultFrom="2026-07-01"
        defaultTo="2026-07-16"
        isGlobal={false}
      />
    )

    expect(html).toContain('Cari nama atau SKU produk...')
    expect(html).toContain('Menampilkan')
    expect(html).toContain('Dog Food')
  })
})
```

- [ ] **Step 2: Run the audit and inventory tests**

Run:

```bash
pnpm exec vitest run \
  "app/(dashboard)/audit-log/_components/audit-log-table.test.ts" \
  "app/(dashboard)/inventory/adjustment-logs/_components/adjustment-logs-client.test.ts" \
  "app/(dashboard)/inventory/stock-logs/_components/stock-logs-client.test.ts"
```

Expected:

```text
PASS  app/(dashboard)/audit-log/_components/audit-log-table.test.ts
PASS  app/(dashboard)/inventory/adjustment-logs/_components/adjustment-logs-client.test.ts
PASS  app/(dashboard)/inventory/stock-logs/_components/stock-logs-client.test.ts
```

- [ ] **Step 3: Replace the audit-log table shell with DataTable**

Keep the filter card and detail dialog outside the table:

```tsx
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'

const columns: ColumnDef<AuditLogEntry>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Waktu',
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-foreground">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
  {
    accessorKey: 'action',
    header: 'Aksi',
    cell: ({ row }) => (
      <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${actionColors[row.original.action] || 'bg-muted text-muted-foreground border-border'}`}>
        {row.original.action}
      </span>
    ),
  },
]

<DataTable
  data={data}
  columns={columns}
  emptyMessage="Tidak ada data audit untuk periode yang dipilih"
  isLoading={isLoading}
  loadingMessage="Memuat data..."
  summary={<span>Menampilkan {data.length} dari {total} entri</span>}
  onRowClick={setSelectedEntry}
/>
```

- [ ] **Step 4: Replace the adjustment and stock log tables with DataTable**

Move only the result tables into the shared component:

```tsx
const adjustmentColumns: ColumnDef<AdjustmentLogEntry>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Tanggal',
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {formatDateTime(row.original.createdAt)}
      </span>
    ),
  },
  {
    accessorKey: 'productName',
    header: 'Produk',
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.productName}</div>
        {row.original.productSku ? (
          <div className="text-xs text-muted-foreground">{row.original.productSku}</div>
        ) : null}
      </div>
    ),
  },
]

<DataTable
  data={filtered}
  columns={adjustmentColumns}
  emptyMessage="Tidak ada data penyesuaian stok."
  isLoading={loading}
  loadingMessage="Memuat data..."
  summary={<span>Menampilkan {filtered.length} entri{data.length === 100 ? ' (maks 100 terbaru)' : ''}</span>}
/>

const stockColumns: ColumnDef<StockLogEntry>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Tanggal & Jam',
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {formatDateTime(row.original.createdAt)}
      </span>
    ),
  },
  {
    accessorKey: 'movementType',
    header: 'Jenis',
    cell: ({ row }) => (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLE[row.original.movementType] ?? 'bg-muted text-muted-foreground'}`}>
        {MOVEMENT_LABEL[row.original.movementType] ?? row.original.movementType}
      </span>
    ),
  },
]

<DataTable
  data={data}
  columns={stockColumns}
  emptyMessage="Tidak ada data pada rentang tanggal ini."
  isLoading={loading}
  loadingMessage="Memuat data..."
  summary={
    <span>
      Menampilkan <span className="font-semibold text-foreground">{total}</span> entri
      {total >= 300 ? (
        <span className="ml-1 text-amber-600">
          (maks 300 - persempit filter tanggal untuk hasil lebih spesifik)
        </span>
      ) : null}
    </span>
  }
/>
```

- [ ] **Step 5: Re-run the targeted tests and TypeScript**

Run:

```bash
pnpm exec vitest run \
  "app/(dashboard)/audit-log/_components/audit-log-table.test.ts" \
  "app/(dashboard)/inventory/adjustment-logs/_components/adjustment-logs-client.test.ts" \
  "app/(dashboard)/inventory/stock-logs/_components/stock-logs-client.test.ts" \
  components/ui/data-table.test.ts
pnpm exec tsc --noEmit
```

Expected:

```text
PASS  app/(dashboard)/audit-log/_components/audit-log-table.test.ts
PASS  app/(dashboard)/inventory/adjustment-logs/_components/adjustment-logs-client.test.ts
PASS  app/(dashboard)/inventory/stock-logs/_components/stock-logs-client.test.ts
PASS  components/ui/data-table.test.ts
Found 0 errors.
```

- [ ] **Step 6: Commit the audit and inventory migrations**

Run:

```bash
git add \
  "apps/backoffice/app/(dashboard)/audit-log/_components/audit-log-table.tsx" \
  "apps/backoffice/app/(dashboard)/audit-log/_components/audit-log-table.test.ts" \
  "apps/backoffice/app/(dashboard)/inventory/adjustment-logs/_components/adjustment-logs-client.tsx" \
  "apps/backoffice/app/(dashboard)/inventory/adjustment-logs/_components/adjustment-logs-client.test.ts" \
  "apps/backoffice/app/(dashboard)/inventory/stock-logs/_components/stock-logs-client.tsx" \
  "apps/backoffice/app/(dashboard)/inventory/stock-logs/_components/stock-logs-client.test.ts"
git commit -m "refactor(backoffice): migrate audit and inventory tables"
```

## Task 5: Final Verification and Deferred Scope Check

**Files:**

- Review: `docs/superpowers/specs/2026-07-16-expand-datatable-design.md`
- Review:
  `apps/backoffice/app/(dashboard)/purchase-orders/internal/payables/_components/payables-client.tsx`

- [ ] **Step 1: Confirm migrated screens still match the approved scope**

Check this list after implementation:

```text
customers: DataTable with page-level toolbar
suppliers: DataTable with page-level toolbar
orders: tabs remain above the table
purchase-orders: tabs and create button remain above the table
audit-log: filter card and detail dialog stay outside DataTable
adjustment-logs: filter panel and summary stay outside DataTable
stock-logs: filter panel, summary, and branch-specific behavior stay outside DataTable
```

- [ ] **Step 2: Verify payables stays deferred**

Check `payables-client.tsx` and confirm one of these is true:

```text
1. The page still uses custom expanded rows for payment and waive actions.
2. The page was redesigned first and then migrated in a separate scoped change.
```

- [ ] **Step 3: Run the full targeted verification set plus TypeScript**

Run:

```bash
pnpm exec vitest run \
  components/ui/data-table.test.ts \
  components/ui/data-table-pagination.test.ts \
  "app/(dashboard)/master-data/customers/_components/customer-client.test.ts" \
  "app/(dashboard)/master-data/suppliers/_components/supplier-client.test.ts" \
  "app/(dashboard)/orders/_components/orders-list-client.test.ts" \
  "app/(dashboard)/purchase-orders/_components/po-list-client.test.ts" \
  "app/(dashboard)/audit-log/_components/audit-log-table.test.ts" \
  "app/(dashboard)/inventory/adjustment-logs/_components/adjustment-logs-client.test.ts" \
  "app/(dashboard)/inventory/stock-logs/_components/stock-logs-client.test.ts"
pnpm exec tsc --noEmit
```

Expected:

```text
All targeted Vitest files pass.
Found 0 errors.
```

- [ ] **Step 4: Commit the final verification checkpoint**

Run:

```bash
git add apps/backoffice/components/ui \
  "apps/backoffice/app/(dashboard)/master-data/customers/_components" \
  "apps/backoffice/app/(dashboard)/master-data/suppliers/_components" \
  "apps/backoffice/app/(dashboard)/orders/_components" \
  "apps/backoffice/app/(dashboard)/purchase-orders/_components" \
  "apps/backoffice/app/(dashboard)/audit-log/_components" \
  "apps/backoffice/app/(dashboard)/inventory/adjustment-logs/_components" \
  "apps/backoffice/app/(dashboard)/inventory/stock-logs/_components"
git commit -m "test(backoffice): verify datatable expansion rollout"
```

## Self-Review

### Spec Coverage

- Shared `DataTable` capability work is covered in Task 1.
- Local-filter list migrations are covered in Task 2.
- Tabbed list migrations are covered in Task 3.
- Fetch-driven list migrations are covered in Task 4.
- Deferred-scope enforcement for `payables` is covered in Task 5.

### Placeholder Scan

Before execution, do one final editor search and confirm this plan contains no
unfinished markers outside deliberate sample code and expected command output.

Expected: no unresolved planning markers remain in this file.

### Type Consistency

- Shared prop names stay `toolbar`, `isLoading`, `loadingMessage`, `summary`,
  `enableSorting`, `onRowClick`, and `rowClassName`.
- Consumers continue to own filtering, tabs, fetch state, summaries, dialogs,
  and mutations.
- `payables` stays outside this plan unless it is redesigned in a separate
  change first.
