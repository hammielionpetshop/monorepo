import {
  createTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type TableOptionsResolved,
} from '@tanstack/react-table'
import { describe, expect, it } from 'vitest'

// Penjaga untuk `resetPageKey` di data-table.tsx: membuktikan KENAPA prop itu perlu.
// TanStack mereset halaman tiap `data` berganti referensi; daftar yang disaring di render
// (`items.filter(...)`) selalu array baru, jadi mencentang satu baris pun melempar ke halaman 1.

type Row = { id: number }

const rows: Row[] = Array.from({ length: 35 }, (_, i) => ({ id: i + 1 }))

function makeTable(autoResetPageIndex: boolean) {
  let pagination: PaginationState = { pageIndex: 0, pageSize: 10 }

  const options = (data: Row[]): TableOptionsResolved<Row> => ({
    data,
    columns: [{ accessorKey: 'id' }],
    state: { pagination },
    onStateChange: () => {},
    onPaginationChange: (updater) => {
      pagination = typeof updater === 'function' ? updater(pagination) : updater
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    renderFallbackValue: null,
    autoResetPageIndex,
  })

  const table = createTable<Row>(options(rows))

  // Satu "render": pasang data (array baru seperti hasil .filter) lalu baca barisnya.
  const render = async (data: Row[]) => {
    table.setOptions((prev) => ({ ...prev, ...options(data) }))
    table.getRowModel()
    await new Promise((resolve) => setTimeout(resolve, 0))
    table.setOptions((prev) => ({ ...prev, ...options(data) }))
  }

  return { table, render, page: () => pagination.pageIndex }
}

describe('reset halaman DataTable', () => {
  it('bawaan TanStack: array data baru dengan isi sama tetap melempar ke halaman pertama', async () => {
    const { table, render, page } = makeTable(true)
    await render(rows)
    table.setPageIndex(2)
    await render(rows)
    expect(page()).toBe(2)

    await render(rows.filter(() => true))
    expect(page()).toBe(0)
  })

  it('dengan autoResetPageIndex mati (resetPageKey diisi) halaman tetap', async () => {
    const { table, render, page } = makeTable(false)
    await render(rows)
    table.setPageIndex(2)

    await render(rows.filter(() => true))
    expect(page()).toBe(2)
  })
})
