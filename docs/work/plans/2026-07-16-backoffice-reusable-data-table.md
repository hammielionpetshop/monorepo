# Backoffice Reusable Data Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared TanStack-based `DataTable` for plain backoffice list pages, then migrate the current plain tables without changing their business logic.

**Architecture:** Keep all domain state in each page-level client component and move only the table presentation into a shared `components/ui/data-table.tsx`. Use TanStack Table only for core row and pagination models, with a small tested pagination helper to keep the component behavior deterministic when the row count changes after refresh.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind v4, Vitest, `@tanstack/react-table`

---

### Task 1: Add the shared table dependency and lock down pagination behavior with failing tests

**Files:**
- Modify: `apps/backoffice/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/backoffice/components/ui/data-table-pagination.ts`
- Test: `apps/backoffice/components/ui/data-table-pagination.test.ts`

- [ ] **Step 1: Add the dependency before writing feature tests**

Update `apps/backoffice/package.json` so the app can import TanStack Table:

```json
{
  "dependencies": {
    "@tanstack/react-table": "^8.20.5"
  }
}
```

Run:

```bash
pnpm --filter backoffice add @tanstack/react-table
```

Expected: `apps/backoffice/package.json` and `pnpm-lock.yaml` change, with no source files touched yet.

- [ ] **Step 2: Write the failing pagination helper test**

Create `apps/backoffice/components/ui/data-table-pagination.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  clampPageIndex,
  getPaginationSummary,
} from './data-table-pagination'

describe('data table pagination helpers', () => {
  it('keeps page index within the last available page', () => {
    expect(clampPageIndex(3, 10, 12)).toBe(1)
    expect(clampPageIndex(1, 10, 0)).toBe(0)
  })

  it('builds a human-readable row summary', () => {
    expect(getPaginationSummary(0, 10, 24)).toBe('Menampilkan 1-10 dari 24 data')
    expect(getPaginationSummary(2, 10, 24)).toBe('Menampilkan 21-24 dari 24 data')
    expect(getPaginationSummary(0, 10, 0)).toBe('Menampilkan 0 dari 0 data')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails for the right reason**

Run:

```bash
pnpm --filter backoffice exec vitest run components/ui/data-table-pagination.test.ts
```

Expected: FAIL because `./data-table-pagination` does not exist yet.

- [ ] **Step 4: Write the minimal pagination helper implementation**

Create `apps/backoffice/components/ui/data-table-pagination.ts`:

```ts
export function clampPageIndex(pageIndex: number, pageSize: number, rowCount: number): number {
  if (rowCount === 0) return 0

  const lastPageIndex = Math.max(Math.ceil(rowCount / pageSize) - 1, 0)

  if (pageIndex < 0) return 0
  if (pageIndex > lastPageIndex) return lastPageIndex

  return pageIndex
}

export function getPaginationSummary(pageIndex: number, pageSize: number, rowCount: number): string {
  if (rowCount === 0) return 'Menampilkan 0 dari 0 data'

  const start = pageIndex * pageSize + 1
  const end = Math.min(start + pageSize - 1, rowCount)

  return `Menampilkan ${start}-${end} dari ${rowCount} data`
}
```

- [ ] **Step 5: Run the helper test to verify it passes**

Run:

```bash
pnpm --filter backoffice exec vitest run components/ui/data-table-pagination.test.ts
```

Expected: PASS with 2 passing tests.

- [ ] **Step 6: Commit the helper groundwork**

Run:

```bash
git add apps/backoffice/package.json pnpm-lock.yaml apps/backoffice/components/ui/data-table-pagination.ts apps/backoffice/components/ui/data-table-pagination.test.ts
git commit -m "test(backoffice): cover data table pagination"
```


### Task 2: Build the reusable `DataTable` with a render-contract test first

**Files:**
- Create: `apps/backoffice/components/ui/data-table.tsx`
- Test: `apps/backoffice/components/ui/data-table.test.ts`
- Use: `apps/backoffice/components/ui/data-table-pagination.ts`

- [ ] **Step 1: Write the failing component contract test**

Create `apps/backoffice/components/ui/data-table.test.ts`:

```ts
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createColumnHelper } from '@tanstack/react-table'
import { describe, expect, it } from 'vitest'

import { DataTable } from './data-table'

type Row = { name: string }

const columnHelper = createColumnHelper<Row>()
const columns = [
  columnHelper.accessor('name', {
    header: 'Nama',
    cell: (info) => info.getValue(),
  }),
]

const DataTableForRows = DataTable as (props: {
  data: Row[]
  columns: typeof columns
  emptyMessage: string
  pageSize?: number
}) => React.ReactElement

describe('DataTable', () => {
  it('renders the empty message and pagination summary', () => {
    const html = renderToStaticMarkup(
      React.createElement(DataTableForRows, {
        data: [],
        columns,
        emptyMessage: 'Belum ada data brand',
        pageSize: 10,
      })
    )

    expect(html).toContain('Belum ada data brand')
    expect(html).toContain('Menampilkan 0 dari 0 data')
    expect(html).toContain('Previous')
    expect(html).toContain('Next')
  })
})
```

- [ ] **Step 2: Run the component test to verify it fails**

Run:

```bash
pnpm --filter backoffice exec vitest run components/ui/data-table.test.ts
```

Expected: FAIL because `./data-table` does not exist yet.

- [ ] **Step 3: Write the minimal reusable `DataTable`**

Create `apps/backoffice/components/ui/data-table.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'

import {
  clampPageIndex,
  getPaginationSummary,
} from './data-table-pagination'

type DataTableProps<TData> = {
  data: TData[]
  columns: ColumnDef<TData, unknown>[]
  emptyMessage: string
  pageSize?: number
}

export function DataTable<TData>({
  data,
  columns,
  emptyMessage,
  pageSize = 10,
}: DataTableProps<TData>) {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize,
  })

  useEffect(() => {
    setPagination((current) => ({
      pageIndex: clampPageIndex(current.pageIndex, pageSize, data.length),
      pageSize,
    }))
  }, [data.length, pageSize])

  const table = useReactTable({
    data,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const rowCount = data.length
  const visibleRows = table.getRowModel().rows
  const summary = getPaginationSummary(pagination.pageIndex, pagination.pageSize, rowCount)

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr key={row.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-foreground">
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
        <p className="text-muted-foreground">{summary}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded-md border border-border px-3 py-1.5 text-muted-foreground disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded-md border border-border px-3 py-1.5 text-muted-foreground disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the component and helper tests to verify they pass**

Run:

```bash
pnpm --filter backoffice exec vitest run components/ui/data-table-pagination.test.ts components/ui/data-table.test.ts
```

Expected: PASS with the helper and render-contract tests green.

- [ ] **Step 5: Refactor the component only after green**

If the implementation passes, do one contained cleanup: extract the repeated cell spacing classes into local constants without changing behavior.

```tsx
const headerCellClassName = 'px-4 py-3 text-left font-medium text-muted-foreground'
const bodyCellClassName = 'px-4 py-3 text-foreground'
```

Then re-run:

```bash
pnpm --filter backoffice exec vitest run components/ui/data-table-pagination.test.ts components/ui/data-table.test.ts
```

Expected: still PASS.

- [ ] **Step 6: Commit the reusable component**

Run:

```bash
git add apps/backoffice/components/ui/data-table.tsx apps/backoffice/components/ui/data-table.test.ts apps/backoffice/components/ui/data-table-pagination.ts apps/backoffice/components/ui/data-table-pagination.test.ts
git commit -m "feat(backoffice): add reusable data table"
```


### Task 3: Migrate the simplest plain list pages to validate the component API against real screens

**Files:**
- Modify: `apps/backoffice/app/(dashboard)/master-data/brands/_components/brand-client.tsx`
- Modify: `apps/backoffice/app/(dashboard)/master-data/categories/_components/category-client.tsx`
- Modify: `apps/backoffice/app/(dashboard)/master-data/uom/_components/uom-client.tsx`
- Modify: `apps/backoffice/app/(dashboard)/master-data/payment-methods/_components/payment-method-client.tsx`
- Use: `apps/backoffice/components/ui/data-table.tsx`

- [ ] **Step 1: Write the failing migration by converting `brand-client.tsx` first**

Replace the inline `<table>` in `brand-client.tsx` with shared columns plus `DataTable`:

```tsx
import type { ColumnDef } from '@tanstack/react-table'

import { DataTable } from '@/components/ui/data-table'

const columns: ColumnDef<Brand>[] = [
  {
    accessorKey: 'name',
    header: 'Nama Brand',
    cell: ({ row }) => <span className="text-foreground">{row.original.name}</span>,
  },
  {
    id: 'actions',
    header: () => <div className="text-right">Aksi</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <button
          onClick={() => openEditForm(row.original)}
          className="text-xs font-medium text-primary hover:underline"
        >
          Edit
        </button>
      </div>
    ),
  },
]
```

And render:

```tsx
<DataTable
  data={brands}
  columns={columns}
  emptyMessage="Belum ada data brand"
/>
```

- [ ] **Step 2: Run typecheck to surface the first real migration errors**

Run:

```bash
pnpm --filter backoffice exec tsc --noEmit
```

Expected: FAIL the first time, usually because of missing imports or JSX return types while the file conversion is incomplete.

- [ ] **Step 3: Finish the simple-page migrations with the same pattern**

Apply the same conversion to the remaining simple files:

```tsx
// category-client.tsx
const categoryColumns: ColumnDef<Category>[] = [
  {
    accessorKey: 'name',
    header: 'Nama Kategori',
    cell: ({ row }) => <span className="text-foreground">{row.original.name}</span>,
  },
  {
    id: 'actions',
    header: () => <div className="text-right">Aksi</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <button onClick={() => openEditForm(row.original)} className="text-xs font-medium text-primary hover:underline">
          Edit
        </button>
      </div>
    ),
  },
]

// uom-client.tsx
const uomColumns: ColumnDef<Uom>[] = [
  {
    accessorKey: 'code',
    header: 'Kode',
    cell: ({ row }) => <span className="font-mono text-foreground">{row.original.code}</span>,
  },
  {
    accessorKey: 'name',
    header: 'Nama',
    cell: ({ row }) => <span className="text-foreground">{row.original.name}</span>,
  },
  {
    id: 'type',
    header: 'Tipe',
    cell: ({ row }) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        row.original.isBase ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'
      }`}>
        {row.original.isBase ? 'Dasar' : 'Turunan'}
      </span>
    ),
  },
  {
    id: 'actions',
    header: () => <div className="text-right">Aksi</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <button onClick={() => openEditForm(row.original)} className="text-xs font-medium text-primary hover:underline">
          Edit
        </button>
      </div>
    ),
  },
]

// payment-method-client.tsx
const paymentMethodColumns: ColumnDef<PaymentMethod>[] = [
  {
    accessorKey: 'name',
    header: 'Nama',
    cell: ({ row }) => <span className="text-foreground font-medium">{row.original.name}</span>,
  },
  {
    id: 'type',
    header: 'Tipe',
    cell: ({ row }) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
        {paymentMethodTypeLabel(row.original.type)}
      </span>
    ),
  },
  {
    id: 'actions',
    header: () => <div className="text-right">Aksi</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <button onClick={() => openEditForm(row.original)} className="text-xs font-medium text-primary hover:underline mr-3">
          Edit
        </button>
        <button onClick={() => setDeletingMethod(row.original)} className="text-xs font-medium text-destructive hover:underline">
          Hapus
        </button>
      </div>
    ),
  },
]
```

Each file should render its own `DataTable` with the matching empty text:

```tsx
<DataTable data={methods} columns={paymentMethodColumns} emptyMessage="Belum ada data metode pembayaran" />
```

- [ ] **Step 4: Run typecheck again to verify the simple migrations pass**

Run:

```bash
pnpm --filter backoffice exec tsc --noEmit
```

Expected: PASS for these converted files, or a smaller set of actionable type errors if one import or cell renderer is still wrong.

- [ ] **Step 5: Commit the simple page migrations**

Run:

```bash
git add apps/backoffice/app/(dashboard)/master-data/brands/_components/brand-client.tsx apps/backoffice/app/(dashboard)/master-data/categories/_components/category-client.tsx apps/backoffice/app/(dashboard)/master-data/uom/_components/uom-client.tsx apps/backoffice/app/(dashboard)/master-data/payment-methods/_components/payment-method-client.tsx
git commit -m "refactor(backoffice): migrate simple list tables"
```


### Task 4: Migrate the richer plain list pages that have more varied cells and row actions

**Files:**
- Modify: `apps/backoffice/app/(dashboard)/settings/branches/_components/branch-client.tsx`
- Modify: `apps/backoffice/app/(dashboard)/settings/users/_components/user-client.tsx`
- Modify: `apps/backoffice/app/(dashboard)/master-data/products/_components/product-table.tsx`
- Use: `apps/backoffice/components/ui/data-table.tsx`

- [ ] **Step 1: Write the failing conversion for `branch-client.tsx`**

Replace the inline table with typed columns:

```tsx
import type { ColumnDef } from '@tanstack/react-table'

import { DataTable } from '@/components/ui/data-table'

const branchColumns: ColumnDef<BranchListItem>[] = [
  {
    accessorKey: 'code',
    header: 'Kode',
    cell: ({ row }) => <span className="font-mono text-xs text-foreground">{row.original.code}</span>,
  },
  {
    accessorKey: 'name',
    header: 'Nama',
    cell: ({ row }) => <span className="text-foreground">{row.original.name}</span>,
  },
  {
    accessorKey: 'address',
    header: 'Alamat',
    cell: ({ row }) => <span className="text-foreground">{row.original.address ?? '-'}</span>,
  },
  {
    accessorKey: 'phone',
    header: 'Telepon',
    cell: ({ row }) => <span className="text-foreground">{row.original.phone ?? '-'}</span>,
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        row.original.isActive ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'
      }`}>
        {row.original.isActive ? 'Aktif' : 'Nonaktif'}
      </span>
    ),
  },
  {
    id: 'lastSeenAt',
    header: 'Terakhir Online',
    cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatLastSeen(row.original.lastSeenAt)}</span>,
  },
  {
    id: 'actions',
    header: () => <div className="text-right">Aksi</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <button onClick={() => openEditForm(row.original)} className="text-xs font-medium text-primary hover:underline">
          Edit
        </button>
      </div>
    ),
  },
]
```

- [ ] **Step 2: Run typecheck to confirm the richer migration still compiles incrementally**

Run:

```bash
pnpm --filter backoffice exec tsc --noEmit
```

Expected: FAIL the first time if one of the columns or imports is incomplete.

- [ ] **Step 3: Finish `user-client.tsx` and `product-table.tsx`**

Convert `user-client.tsx` to column definitions:

```tsx
const userColumns: ColumnDef<UserListItem>[] = [
  { accessorKey: 'name', header: 'Nama', cell: ({ row }) => <span className="text-foreground">{row.original.name}</span> },
  { accessorKey: 'username', header: 'Username', cell: ({ row }) => <span className="text-foreground">{row.original.username ?? '-'}</span> },
  { accessorKey: 'staffNumber', header: 'Nomor Staf', cell: ({ row }) => <span className="text-foreground">{row.original.staffNumber ?? '-'}</span> },
  { accessorKey: 'email', header: 'Email', cell: ({ row }) => <span className="text-foreground">{row.original.email ?? '-'}</span> },
  { accessorKey: 'roleName', header: 'Role', cell: ({ row }) => <span className="text-foreground">{row.original.roleName}</span> },
  { accessorKey: 'branchName', header: 'Cabang', cell: ({ row }) => <span className="text-foreground">{row.original.branchName}</span> },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        row.original.isActive ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'
      }`}>
        {row.original.isActive ? 'Aktif' : 'Nonaktif'}
      </span>
    ),
  },
  {
    id: 'actions',
    header: () => <div className="text-right">Aksi</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <button onClick={() => openEditForm(row.original)} className="text-xs font-medium text-primary hover:underline mr-3">
          Edit
        </button>
        {row.original.isActive && (
          <button
            onClick={() => handleDeactivate(row.original)}
            disabled={deactivatingId === row.original.id}
            className="text-xs font-medium text-destructive hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deactivatingId === row.original.id ? 'Memproses...' : 'Nonaktifkan'}
          </button>
        )}
      </div>
    ),
  },
]
```

Convert `product-table.tsx` while keeping it as a domain wrapper:

```tsx
import type { ColumnDef } from '@tanstack/react-table'

import { DataTable } from '@/components/ui/data-table'

const columns: ColumnDef<Product>[] = [
  { accessorKey: 'name', header: 'Nama', cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span> },
  { accessorKey: 'sku', header: 'SKU', cell: ({ row }) => <span className="text-muted-foreground">{row.original.sku ?? '-'}</span> },
  { accessorKey: 'barcode', header: 'Barcode', cell: ({ row }) => <span className="text-muted-foreground">{row.original.barcode ?? '-'}</span> },
  { accessorKey: 'categoryName', header: 'Kategori', cell: ({ row }) => <span className="text-muted-foreground">{row.original.categoryName ?? '-'}</span> },
  { accessorKey: 'brandName', header: 'Brand', cell: ({ row }) => <span className="text-muted-foreground">{row.original.brandName ?? '-'}</span> },
  {
    id: 'uom',
    header: 'UOM Dasar',
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.uomName ?? '-'} ({row.original.uomCode ?? '-'})</span>,
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
        row.original.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
      }`}>
        {row.original.isActive ? 'Aktif' : 'Nonaktif'}
      </span>
    ),
  },
  {
    id: 'actions',
    header: () => <div className="text-right">Aksi</div>,
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-2">
        <Link href={`/master-data/products/${row.original.id}`} className="px-2.5 py-1 text-xs font-medium text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-colors">
          Detail
        </Link>
        <button onClick={() => onEdit(row.original)} className="px-2.5 py-1 text-xs font-medium text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-colors">
          Edit
        </button>
        <button
          onClick={() => onToggle(row.original)}
          disabled={togglingId === row.original.id}
          className={`px-2.5 py-1 text-xs font-medium border rounded-md transition-colors disabled:opacity-50 ${
            row.original.isActive
              ? 'text-destructive border-destructive/30 hover:bg-destructive/10'
              : 'text-green-700 border-green-300 hover:bg-green-50'
          }`}
        >
          {togglingId === row.original.id ? '...' : row.original.isActive ? 'Nonaktifkan' : 'Aktifkan'}
        </button>
      </div>
    ),
  },
]

return (
  <DataTable
    data={products}
    columns={columns}
    emptyMessage='Belum ada produk. Klik "Tambah Produk" untuk menambahkan produk pertama.'
  />
)
```

- [ ] **Step 4: Run targeted tests and full backoffice typecheck**

Run:

```bash
pnpm --filter backoffice exec vitest run components/ui/data-table-pagination.test.ts components/ui/data-table.test.ts
pnpm --filter backoffice exec tsc --noEmit
```

Expected: both commands PASS.

- [ ] **Step 5: Commit the richer plain-list migrations**

Run:

```bash
git add apps/backoffice/app/(dashboard)/settings/branches/_components/branch-client.tsx apps/backoffice/app/(dashboard)/settings/users/_components/user-client.tsx apps/backoffice/app/(dashboard)/master-data/products/_components/product-table.tsx
git commit -m "refactor(backoffice): migrate plain data tables"
```


### Task 5: Final verification and release notes for the implementation session

**Files:**
- Review: `apps/backoffice/components/ui/data-table.tsx`
- Review: `apps/backoffice/components/ui/data-table-pagination.ts`
- Review: migrated client files from Tasks 3-4

- [ ] **Step 1: Re-run the exact verification commands from a clean working tree**

Run:

```bash
pnpm --filter backoffice exec vitest run components/ui/data-table-pagination.test.ts components/ui/data-table.test.ts
pnpm --filter backoffice exec tsc --noEmit
```

Expected: PASS twice in a row with no new changes required.

- [ ] **Step 2: Manually inspect the changed pages in the browser**

Open the migrated pages and verify these exact behaviors:

```text
/master-data/brands
/master-data/categories
/master-data/uom
/master-data/payment-methods
/settings/branches
/settings/users
/master-data/products
```

Expected:

```text
- empty message still matches the original wording
- row actions still invoke the same edit/detail/delete/toggle flows
- pagination appears only once per table and stays on a valid page after refresh
- visual styling remains consistent with the existing card/table presentation
```

- [ ] **Step 3: Summarize the implementation constraints in the final handoff**

Include these points in the final implementation summary:

```text
- scope only covered plain list tables
- filtered/search/tab tables were intentionally left untouched
- targeted Vitest coverage was added only for the reusable table helpers/component
- broader app test suites were not run
```

- [ ] **Step 4: Create the final checkpoint commit if the branch contains unstaged fixes**

Run only if you had to make last-mile fixes after Task 4:

```bash
git add apps/backoffice/components/ui/data-table.tsx apps/backoffice/components/ui/data-table-pagination.ts apps/backoffice/components/ui/data-table.test.ts apps/backoffice/components/ui/data-table-pagination.test.ts apps/backoffice/app/(dashboard)/master-data/brands/_components/brand-client.tsx apps/backoffice/app/(dashboard)/master-data/categories/_components/category-client.tsx apps/backoffice/app/(dashboard)/master-data/uom/_components/uom-client.tsx apps/backoffice/app/(dashboard)/master-data/payment-methods/_components/payment-method-client.tsx apps/backoffice/app/(dashboard)/settings/branches/_components/branch-client.tsx apps/backoffice/app/(dashboard)/settings/users/_components/user-client.tsx apps/backoffice/app/(dashboard)/master-data/products/_components/product-table.tsx
git commit -m "chore(backoffice): finalize reusable data table rollout"
```
