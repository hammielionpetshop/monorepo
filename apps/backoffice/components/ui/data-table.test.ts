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
