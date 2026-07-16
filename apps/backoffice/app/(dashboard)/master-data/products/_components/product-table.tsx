'use client'

import type { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { DataTable } from '@/components/ui/data-table'
import type { Product } from './types'

interface ProductTableProps {
  products: Product[]
  onEdit: (product: Product) => void
  onToggle: (product: Product) => void
  togglingId: number | null
}

export default function ProductTable({ products, onEdit, onToggle, togglingId }: ProductTableProps) {
  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: 'name',
      header: 'Nama',
      cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
    },
    {
      accessorKey: 'sku',
      header: 'SKU',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.sku ?? '-'}</span>,
    },
    {
      accessorKey: 'barcode',
      header: 'Barcode',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.barcode ?? '-'}</span>,
    },
    {
      accessorKey: 'categoryName',
      header: 'Kategori',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.categoryName ?? '-'}</span>,
    },
    {
      accessorKey: 'brandName',
      header: 'Brand',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.brandName ?? '-'}</span>,
    },
    {
      id: 'uom',
      header: 'UOM Dasar',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.uomName ?? '-'} ({row.original.uomCode ?? '-'})
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
            row.original.isActive
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {row.original.isActive ? 'Aktif' : 'Nonaktif'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/master-data/products/${row.original.id}`}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Detail
          </Link>
          <button
            onClick={() => onEdit(row.original)}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Edit
          </button>
          <button
            onClick={() => onToggle(row.original)}
            disabled={togglingId === row.original.id}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
              row.original.isActive
                ? 'border-destructive/30 text-destructive hover:bg-destructive/10'
                : 'border-green-300 text-green-700 hover:bg-green-50'
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
}
