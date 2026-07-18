'use client'

import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useRouter } from 'next/navigation'

import { DataTable } from '@/components/ui/data-table'
import type { SOMismatchProduct, SOReportRow } from '@/lib/services/stock-opname-report'
import {
  CATEGORY_LABELS,
  METHOD_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  formatDateTime,
  formatRupiah,
} from './format'

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  REJECTED: 'bg-destructive/10 text-destructive',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        STATUS_BADGE[status] ?? 'bg-muted text-muted-foreground'
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function VarianceQty({ value }: { value: number }) {
  if (value === 0) return <span className="text-muted-foreground">0</span>
  return (
    <span className={value < 0 ? 'font-semibold text-destructive' : 'font-semibold text-emerald-600 dark:text-emerald-400'}>
      {value > 0 ? `+${value}` : value}
    </span>
  )
}

export default function SOReportTables({
  rows,
  mismatchProducts,
  exportQuery,
}: {
  rows: SOReportRow[]
  mismatchProducts: SOMismatchProduct[]
  exportQuery: string
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'recap' | 'mismatch'>('recap')

  const recapColumns: ColumnDef<SOReportRow>[] = [
    {
      accessorKey: 'soNumber',
      header: 'Nomor SO',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">{row.original.soNumber}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(row.original.createdAt)}</p>
        </div>
      ),
    },
    {
      accessorKey: 'branchName',
      header: 'Cabang',
      cell: ({ row }) => (
        <div>
          <p>{row.original.branchName}</p>
          <p className="text-xs text-muted-foreground">
            {TYPE_LABELS[row.original.type] ?? row.original.type}
            {row.original.method ? ` — ${METHOD_LABELS[row.original.method] ?? row.original.method}` : ''}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'createdByName',
      header: 'Penghitung / Penyetuju',
      cell: ({ row }) => (
        <div>
          <p>{row.original.createdByName}</p>
          <p className="text-xs text-muted-foreground">{row.original.decidedByName ?? '—'}</p>
        </div>
      ),
    },
    {
      accessorKey: 'itemCount',
      header: 'Item',
      cell: ({ row }) => (
        <div>
          <p>{row.original.itemCount}</p>
          <p className="text-xs text-muted-foreground">{row.original.mismatchCount} selisih</p>
        </div>
      ),
    },
    {
      accessorKey: 'accuracyPct',
      header: 'Akurasi',
      cell: ({ row }) => (
        <span
          className={
            row.original.accuracyPct >= 95
              ? 'font-semibold text-emerald-600 dark:text-emerald-400'
              : row.original.accuracyPct >= 80
                ? 'font-semibold text-amber-600 dark:text-amber-400'
                : 'font-semibold text-destructive'
          }
        >
          {row.original.accuracyPct}%
        </span>
      ),
    },
    {
      id: 'value',
      header: 'Nilai Selisih',
      cell: ({ row }) =>
        row.original.status === 'APPROVED' ? (
          <div className="text-xs">
            <p className="text-destructive">&minus; {formatRupiah(row.original.minusValue)}</p>
            <p className="text-emerald-600 dark:text-emerald-400">+ {formatRupiah(row.original.plusValue)}</p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">tidak mengubah stok</span>
        ),
    },
  ]

  const mismatchColumns: ColumnDef<SOMismatchProduct>[] = [
    {
      accessorKey: 'productName',
      header: 'Produk',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">{row.original.productName}</p>
          <p className="text-xs text-muted-foreground">{row.original.sku ?? '—'}</p>
        </div>
      ),
    },
    {
      accessorKey: 'occurrence',
      header: 'Kejadian',
      cell: ({ row }) => (
        <div>
          <p>{row.original.occurrence}x</p>
          {row.original.rejectedOccurrence > 0 && (
            <p className="text-xs text-muted-foreground">{row.original.rejectedOccurrence} dari SO ditolak</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'totalVarianceQty',
      header: 'Total Selisih',
      cell: ({ row }) => (
        <span>
          <VarianceQty value={row.original.totalVarianceQty} />{' '}
          <span className="text-xs text-muted-foreground">{row.original.uomCode}</span>
        </span>
      ),
    },
    {
      accessorKey: 'totalVarianceValue',
      header: 'Nilai (SO disetujui)',
      cell: ({ row }) => formatRupiah(row.original.totalVarianceValue),
    },
    {
      accessorKey: 'topCategory',
      header: 'Kategori Dominan',
      cell: ({ row }) =>
        row.original.topCategory ? (
          CATEGORY_LABELS[row.original.topCategory] ?? row.original.topCategory
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ]

  const tabButton = (value: 'recap' | 'mismatch', label: string, count: number) => (
    <button
      key={value}
      type="button"
      onClick={() => setTab(value)}
      className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${
        tab === value
          ? 'bg-primary text-primary-foreground'
          : 'border border-border text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      {label} ({count})
    </button>
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-2">
          {tabButton('recap', 'Rekap SO', rows.length)}
          {tabButton('mismatch', 'Produk Bermasalah', mismatchProducts.length)}
        </div>
        {tab === 'mismatch' && mismatchProducts.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 text-sm font-bold text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-all"
            >
              Print
            </button>
            <a
              href={`/api/bo/reports/stock-opname/export?mode=mismatch&${exportQuery}`}
              className="px-4 py-2 text-sm font-bold text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-all"
            >
              Export CSV
            </a>
          </div>
        )}
        {tab === 'recap' && rows.length > 0 && (
          <a
            href={`/api/bo/reports/stock-opname/export?mode=recap&${exportQuery}`}
            className="px-4 py-2 text-sm font-bold text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-all"
          >
            Export CSV
          </a>
        )}
      </div>

      {tab === 'recap' ? (
        <DataTable
          data={rows}
          columns={recapColumns as ColumnDef<SOReportRow, unknown>[]}
          emptyMessage="Belum ada stock opname pada rentang tanggal ini."
          pageSize={15}
          onRowClick={(row) => router.push(`/reports/stock-opname/${row.id}`)}
        />
      ) : (
        <DataTable
          data={mismatchProducts}
          columns={mismatchColumns as ColumnDef<SOMismatchProduct, unknown>[]}
          emptyMessage="Tidak ada produk yang selisih pada rentang tanggal ini."
          pageSize={20}
          enableSorting
        />
      )}
    </div>
  )
}
