'use client'

import React, { useEffect, useState } from 'react'
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
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
  toolbar?: React.ReactNode
  isLoading?: boolean
  loadingMessage?: string
  summary?: React.ReactNode
  enableSorting?: boolean
  onRowClick?: (row: TData) => void
  rowClassName?: (row: TData) => string
}

const headerCellClassName = 'px-4 py-3 text-left font-medium text-muted-foreground'
const bodyCellClassName = 'px-4 py-3 text-foreground'

export function DataTable<TData>({
  data,
  columns,
  emptyMessage,
  pageSize = 10,
  toolbar,
  isLoading = false,
  loadingMessage = 'Memuat data...',
  summary,
  enableSorting = false,
  onRowClick,
  rowClassName,
}: DataTableProps<TData>) {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize,
  })
  const [sorting, setSorting] = useState<SortingState>([])

  useEffect(() => {
    setPagination((current) => ({
      pageIndex: clampPageIndex(current.pageIndex, pageSize, data.length),
      pageSize,
    }))
  }, [data.length, pageSize])

  const table = useReactTable({
    data,
    columns,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSorting,
  })

  const rowCount = data.length
  const visibleRows = table.getRowModel().rows
  const footerSummary =
    summary ??
    getPaginationSummary(pagination.pageIndex, pagination.pageSize, rowCount)

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {toolbar ? <div className="border-b border-border px-4 py-3">{toolbar}</div> : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className={headerCellClassName}>
                    {header.isPlaceholder ? null : enableSorting && header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 text-left"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className="text-xs text-muted-foreground">
                          {header.column.getIsSorted() === 'asc'
                            ? '^'
                            : header.column.getIsSorted() === 'desc'
                              ? 'v'
                              : '<>'}
                        </span>
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
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
                  {loadingMessage}
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
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={[
                    'border-t border-border transition-colors hover:bg-muted/20',
                    onRowClick ? 'cursor-pointer' : '',
                    rowClassName ? rowClassName(row.original) : '',
                  ].filter(Boolean).join(' ')}
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
