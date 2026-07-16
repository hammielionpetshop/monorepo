import React from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { renderToStaticMarkup } from 'react-dom/server'
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
  toolbar?: React.ReactNode
  isLoading?: boolean
  loadingMessage?: string
  summary?: React.ReactNode
  enableSorting?: boolean
  onRowClick?: (row: Row) => void
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

  it('renders toolbar, loading message, and custom summary', () => {
    const html = renderToStaticMarkup(
      React.createElement(DataTableForRows, {
        data: [],
        columns,
        emptyMessage: 'Belum ada data',
        toolbar: React.createElement('div', null, 'Toolbar pelanggan'),
        isLoading: true,
        loadingMessage: 'Memuat pelanggan...',
        summary: React.createElement('span', null, 'Menampilkan 0 hasil filter'),
      })
    )

    expect(html).toContain('Toolbar pelanggan')
    expect(html).toContain('Memuat pelanggan...')
    expect(html).toContain('Menampilkan 0 hasil filter')
    expect(html).not.toContain('Belum ada data')
  })

  it('renders sortable header affordance and clickable row styling', () => {
    const sortableColumns = [
      columnHelper.accessor('name', {
        header: 'Nama',
        enableSorting: true,
        cell: (info) => info.getValue(),
      }),
    ]

    const html = renderToStaticMarkup(
      React.createElement(DataTableForRows, {
        data: [{ name: 'A' }],
        columns: sortableColumns,
        emptyMessage: 'Belum ada data',
        enableSorting: true,
        onRowClick: () => undefined,
      })
    )

    expect(html).toContain('Nama')
    expect(html).toContain('cursor-pointer')
  })
})
