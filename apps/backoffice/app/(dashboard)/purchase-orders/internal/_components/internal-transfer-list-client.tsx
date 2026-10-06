'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import Link from 'next/link'
import { formatWIB } from '@petshop/shared'

import { DataTable } from '@/components/ui/data-table'
import { usePersistedFilterState } from '@/components/ui/use-persisted-filter-state'

import { Branch, InternalTransfer } from './types'
import {
  EMPTY_TRANSFER_FILTERS,
  filterTransfers,
  hasActiveTransferFilters,
  type TransferFilters,
} from './filter-transfers'

const RECEIVED_STATUSES = ['PARTIALLY_RECEIVED', 'FULLY_RECEIVED']
const STORAGE_KEY = 'purchase-orders-internal'
const INPUT_CLASS =
  'border border-border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-600' },
  PENDING_APPROVAL: { label: 'Menunggu Approval', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'Disetujui', color: 'bg-blue-100 text-blue-800' },
  PREPARING: { label: 'Sedang Disiapkan', color: 'bg-indigo-100 text-indigo-800' },
  IN_TRANSIT: { label: 'Dalam Pengiriman', color: 'bg-orange-100 text-orange-800' },
  PARTIALLY_RECEIVED: { label: 'Diterima Sebagian', color: 'bg-amber-100 text-amber-800' },
  FULLY_RECEIVED: { label: 'Diterima Penuh', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700' },
}

const TABS = [
  { key: 'all', label: 'Semua' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'PENDING_APPROVAL', label: 'Menunggu' },
  { key: 'APPROVED', label: 'Disetujui' },
  { key: 'PREPARING', label: 'Disiapkan' },
  { key: 'IN_TRANSIT', label: 'Pengiriman' },
  { key: 'PARTIALLY_RECEIVED,FULLY_RECEIVED', label: 'Diterima' },
  { key: 'CANCELLED', label: 'Dibatalkan' },
]

interface Props {
  transfers: InternalTransfer[]
  branches: Branch[]
}

export function InternalTransferListClient({ transfers, branches }: Props) {
  const [activeTab, setActiveTab] = usePersistedFilterState(STORAGE_KEY, 'activeTab', 'PENDING_APPROVAL')
  const [search, setSearch] = usePersistedFilterState(STORAGE_KEY, 'search', '')
  const [filterSourceBranch, setFilterSourceBranch] = usePersistedFilterState(STORAGE_KEY, 'filterSourceBranch', '')
  const [filterDestBranch, setFilterDestBranch] = usePersistedFilterState(STORAGE_KEY, 'filterDestBranch', '')
  const [filterRequester, setFilterRequester] = usePersistedFilterState(STORAGE_KEY, 'filterRequester', '')
  const [startDate, setStartDate] = usePersistedFilterState(STORAGE_KEY, 'startDate', '')
  const [endDate, setEndDate] = usePersistedFilterState(STORAGE_KEY, 'endDate', '')

  const filters: TransferFilters = useMemo(
    () => ({
      search,
      sourceBranchId: filterSourceBranch,
      destinationBranchId: filterDestBranch,
      requestedById: filterRequester,
      startDate,
      endDate,
    }),
    [search, filterSourceBranch, filterDestBranch, filterRequester, startDate, endDate]
  )
  const filtersActive = hasActiveTransferFilters(filters)

  const requesters = useMemo(() => {
    const byId = new Map<number, string>()
    for (const transfer of transfers) {
      if (!byId.has(transfer.requestedById)) {
        byId.set(transfer.requestedById, transfer.requestedByName ?? `User #${transfer.requestedById}`)
      }
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'))
  }, [transfers])

  // Hitungan tab mengikuti filter lain (bukan status), supaya angka di tab = jumlah baris
  // yang benar-benar muncul saat tab itu dipilih.
  const nonStatusFiltered = useMemo(() => filterTransfers(transfers, filters), [transfers, filters])

  const filtered = useMemo(
    () =>
      activeTab === 'all'
        ? nonStatusFiltered
        : nonStatusFiltered.filter((transfer) => activeTab.split(',').includes(transfer.status)),
    [activeTab, nonStatusFiltered]
  )

  const filteredTotal = useMemo(
    () => filtered.reduce((sum, transfer) => sum + Number(transfer.totalTransferValue ?? 0), 0),
    [filtered]
  )
  const filteredReceivedTotal = useMemo(
    () =>
      filtered.reduce(
        (sum, transfer) => sum + (RECEIVED_STATUSES.includes(transfer.status) ? Number(transfer.receivedValue ?? 0) : 0),
        0
      ),
    [filtered]
  )

  const resetFilters = () => {
    setSearch(EMPTY_TRANSFER_FILTERS.search)
    setFilterSourceBranch(EMPTY_TRANSFER_FILTERS.sourceBranchId)
    setFilterDestBranch(EMPTY_TRANSFER_FILTERS.destinationBranchId)
    setFilterRequester(EMPTY_TRANSFER_FILTERS.requestedById)
    setStartDate(EMPTY_TRANSFER_FILTERS.startDate)
    setEndDate(EMPTY_TRANSFER_FILTERS.endDate)
  }

  const columns: ColumnDef<InternalTransfer>[] = [
    {
      accessorKey: 'ibtNumber',
      header: 'No. Transfer',
      cell: ({ row }) => (
        <span className="font-mono font-medium text-foreground">
          {row.original.ibtNumber}
        </span>
      ),
    },
    {
      accessorKey: 'sourceBranchName',
      enableSorting: false,
      header: 'Dari',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.sourceBranchName ?? '-'}
        </span>
      ),
    },
    {
      accessorKey: 'destinationBranchName',
      enableSorting: false,
      header: 'Ke',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.destinationBranchName ?? '-'}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Tgl Dibuat',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatWIB(row.original.createdAt, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      ),
    },
    {
      accessorKey: 'requestedByName',
      enableSorting: false,
      header: 'Pemohon',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.requestedByName ?? '-'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      enableSorting: false,
      header: 'Status',
      cell: ({ row }) => {
        const statusInfo = STATUS_LABELS[row.original.status] ?? {
          label: row.original.status,
          color: 'bg-gray-100 text-gray-600',
        }

        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}
          >
            {statusInfo.label}
          </span>
        )
      },
    },
    {
      accessorKey: 'totalTransferValue',
      header: () => <div className="text-right">Dipesan</div>,
      cell: ({ row }) => (
        <div className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
          Rp {Number(row.original.totalTransferValue ?? 0).toLocaleString('id-ID')}
        </div>
      ),
    },
    {
      accessorKey: 'receivedValue',
      header: () => (
        <div className="text-right" title="Nilai barang yang diterima cabang tujuan = nominal di Piutang Internal">
          Diterima
        </div>
      ),
      cell: ({ row }) => {
        const t = row.original
        if (!RECEIVED_STATUSES.includes(t.status)) {
          return <div className="text-right text-xs text-muted-foreground">—</div>
        }
        const lost = Number(t.shippedValue ?? 0) - Number(t.receivedValue ?? 0)
        return (
          <div className="text-right whitespace-nowrap">
            <div className="tabular-nums font-medium text-foreground">
              Rp {Number(t.receivedValue ?? 0).toLocaleString('id-ID')}
            </div>
            {lost > 0 && (
              <div className="text-[11px] text-amber-700 dark:text-amber-400" title="Dikirim tapi tidak diterima — tidak ditagih">
                kurang Rp {lost.toLocaleString('id-ID')} di jalan
              </div>
            )}
          </div>
        )
      },
    },
    {
      id: 'actions',
      enableSorting: false,
      header: () => <div className="text-right" />,
      cell: ({ row }) => (
        <div className="text-right">
          <Link
            href={`/purchase-orders/internal/${row.original.id}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            Detail -&gt;
          </Link>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center border-b border-border">
        <div className="flex gap-1 flex-wrap">
          {TABS.map((tab) => {
            const count =
              tab.key === 'all'
                ? nonStatusFiltered.length
                : nonStatusFiltered.filter((transfer) => tab.key.split(',').includes(transfer.status)).length

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length.toLocaleString('id-ID')} transfer · Total dipesan{' '}
        <span className="font-medium text-foreground tabular-nums">
          Rp {filteredTotal.toLocaleString('id-ID')}
        </span>{' '}
        · Total diterima{' '}
        <span className="font-medium text-foreground tabular-nums" title="Sama dengan total di Piutang Internal">
          Rp {filteredReceivedTotal.toLocaleString('id-ID')}
        </span>
      </p>

      <DataTable
        data={filtered}
        columns={columns}
        emptyMessage="Tidak ada transfer internal untuk filter ini."
        persistKey="purchase-orders-internal"
        enableSorting
        toolbar={
          <div className="flex gap-3 flex-wrap items-center">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari no. transfer, cabang, pemohon, catatan, atau produk..."
              className={`${INPUT_CLASS} flex-1 min-w-[260px]`}
            />
            <select
              value={filterSourceBranch}
              onChange={(event) => setFilterSourceBranch(event.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Semua Cabang Asal</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <select
              value={filterDestBranch}
              onChange={(event) => setFilterDestBranch(event.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Semua Cabang Tujuan</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <select
              value={filterRequester}
              onChange={(event) => setFilterRequester(event.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">Semua Pemohon</option>
              {requesters.map((requester) => (
                <option key={requester.id} value={requester.id}>
                  {requester.name}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(event) => setStartDate(event.target.value)}
                aria-label="Dari tanggal"
                className={INPUT_CLASS}
              />
              <span>s/d</span>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
                aria-label="Sampai tanggal"
                className={INPUT_CLASS}
              />
            </div>
            {filtersActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Reset filter
              </button>
            )}
          </div>
        }
      />
    </div>
  )
}
