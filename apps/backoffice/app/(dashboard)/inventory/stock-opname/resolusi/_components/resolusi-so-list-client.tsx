'use client'

import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { formatWIB } from '@petshop/shared'
import { DataTable } from '@/components/ui/data-table'
import type { SOResolutionGroupedRow } from '@/lib/services/stock-opname-resolution-report'

function formatRupiah(value: number | null | undefined): string {
  if (value == null) return '-'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value)
}

const columns: ColumnDef<SOResolutionGroupedRow, unknown>[] = [
  {
    accessorKey: 'soNumber',
    header: 'No. SO',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.soNumber}</span>,
  },
  {
    accessorKey: 'branchName',
    header: 'Cabang',
  },
  {
    accessorKey: 'latestDecidedAt',
    header: 'Diputuskan',
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {row.original.latestDecidedAt ? formatWIB(row.original.latestDecidedAt) : '-'}
      </span>
    ),
  },
  {
    accessorKey: 'itemCount',
    header: 'Item Belum Diresolusi',
    cell: ({ row }) => <span className="font-medium text-foreground">{row.original.itemCount}</span>,
  },
  {
    accessorKey: 'minusValue',
    header: 'Nilai Minus',
    cell: ({ row }) =>
      row.original.minusValue > 0 ? (
        <span className="font-medium text-destructive">- {formatRupiah(row.original.minusValue)}</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    accessorKey: 'plusValue',
    header: 'Nilai Plus',
    cell: ({ row }) =>
      row.original.plusValue > 0 ? (
        <span className="font-medium text-emerald-600">+ {formatRupiah(row.original.plusValue)}</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
]

export default function ResolusiSoListClient({ rows }: { rows: SOResolutionGroupedRow[] }) {
  const router = useRouter()

  return (
    <DataTable
      data={rows}
      columns={columns}
      emptyMessage="Tidak ada SO dengan item selisih yang menunggu resolusi pada filter ini."
      pageSize={15}
      enableSorting
      onRowClick={(row) => router.push(`/inventory/stock-opname/resolusi/${row.soId}`)}
    />
  )
}
