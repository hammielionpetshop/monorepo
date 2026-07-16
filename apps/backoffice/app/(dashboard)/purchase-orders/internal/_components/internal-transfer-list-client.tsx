'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatWIB } from '@petshop/shared'

import { DataTable } from '@/components/ui/data-table'

import { Branch, InternalTransfer } from './types'

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
  const [activeTab, setActiveTab] = useState('all')
  const [filterSourceBranch, setFilterSourceBranch] = useState('')
  const [filterDestBranch, setFilterDestBranch] = useState('')

  const filtered = useMemo(() => {
    return transfers.filter((transfer) => {
      const tabMatch =
        activeTab === 'all' || activeTab.split(',').includes(transfer.status)
      const sourceMatch =
        !filterSourceBranch ||
        transfer.sourceBranchId === Number.parseInt(filterSourceBranch, 10)
      const destMatch =
        !filterDestBranch ||
        transfer.destinationBranchId === Number.parseInt(filterDestBranch, 10)

      return tabMatch && sourceMatch && destMatch
    })
  }, [activeTab, filterDestBranch, filterSourceBranch, transfers])

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
      header: 'Dari',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.sourceBranchName ?? '-'}
        </span>
      ),
    },
    {
      accessorKey: 'destinationBranchName',
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
          })}
        </span>
      ),
    },
    {
      accessorKey: 'requestedByName',
      header: 'Pemohon',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.requestedByName ?? '-'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
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
      id: 'actions',
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
                ? transfers.length
                : transfers.filter((transfer) => tab.key.split(',').includes(transfer.status)).length

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

      <DataTable
        data={filtered}
        columns={columns}
        emptyMessage="Tidak ada transfer internal untuk filter ini."
        toolbar={
          <div className="flex gap-3 flex-wrap">
            <select
              value={filterSourceBranch}
              onChange={(event) => setFilterSourceBranch(event.target.value)}
              className="border border-border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
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
              className="border border-border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Semua Cabang Tujuan</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        }
      />
    </div>
  )
}
