'use client'

import Big from 'big.js'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'
import type { StockValuationItem } from './types'

function formatRupiah(value: string): string {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(new Big(value).toNumber())
  } catch {
    return 'Rp 0'
  }
}

function formatQty(value: string): string {
  try {
    return new Big(value).toFixed(2)
  } catch {
    return '0.00'
  }
}

const columns: ColumnDef<StockValuationItem>[] = [
  {
    id: 'productName',
    header: 'Nama Produk',
    cell: ({ row }) => <span className="font-semibold text-card-foreground">{row.original.productName}</span>,
  },
  {
    id: 'sku',
    header: 'SKU',
    cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.sku ?? '-'}</span>,
  },
  {
    id: 'categoryName',
    header: 'Kategori',
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.categoryName ?? '-'}</span>,
  },
  {
    id: 'brandName',
    header: 'Brand',
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.brandName ?? '-'}</span>,
  },
  {
    id: 'branchName',
    header: 'Cabang',
    cell: ({ row }) => <span className="text-card-foreground">{row.original.branchName}</span>,
  },
  {
    id: 'stock',
    header: () => <div className="text-right">Stok</div>,
    cell: ({ row }) => (
      <div className="text-right font-medium text-card-foreground">
        {row.original.stockDisplay}
        <span className="block text-[11px] text-muted-foreground font-normal">
          ({formatQty(row.original.totalQty)})
        </span>
      </div>
    ),
  },
  {
    id: 'totalValue',
    header: () => <div className="text-right">Nilai Stok (FIFO)</div>,
    cell: ({ row }) => (
      <div className="text-right font-bold text-emerald-600 dark:text-emerald-400">
        {formatRupiah(row.original.totalValue)}
      </div>
    ),
  },
]

export default function StockValuationTable({
  items,
  emptyMessage,
}: {
  items: StockValuationItem[]
  emptyMessage: string
}) {
  return (
    <DataTable
      data={items}
      columns={columns}
      emptyMessage={emptyMessage}
      pageSize={20}
      persistKey="stock-valuation"
    />
  )
}
