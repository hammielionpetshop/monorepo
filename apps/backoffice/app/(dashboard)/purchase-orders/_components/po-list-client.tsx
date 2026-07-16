'use client'

import React, { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatWIB } from '@petshop/shared'
import { DataTable } from '@/components/ui/data-table'
import { CreatePODialog } from './create-po-dialog'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING_APPROVAL: { label: 'Menunggu Approval', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'Disetujui', color: 'bg-blue-100 text-blue-800' },
  IN_TRANSIT: { label: 'Dalam Pengiriman', color: 'bg-purple-100 text-purple-800' },
  PARTIALLY_RECEIVED: { label: 'Diterima Sebagian', color: 'bg-orange-100 text-orange-800' },
  FULLY_RECEIVED: { label: 'Diterima Penuh', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-gray-100 text-gray-600' },
  COMPLETED: { label: 'Selesai', color: 'bg-green-100 text-green-800' },
}

const TABS = [
  { key: 'all', label: 'Semua' },
  { key: 'PENDING_APPROVAL', label: 'Menunggu' },
  { key: 'APPROVED', label: 'Disetujui' },
  { key: 'IN_TRANSIT', label: 'Transit' },
  { key: 'PARTIALLY_RECEIVED,FULLY_RECEIVED', label: 'Diterima' },
]

interface PO {
  id: number
  poNumber: string
  status: string
  totalAmount: string
  notes: string | null
  createdAt: string
  supplier: { id: number; name: string }
  branch: { id: number; name: string }
}

interface Supplier { id: number; name: string }
interface Branch { id: number; name: string }

interface POListClientProps {
  pos: PO[]
  suppliers: Supplier[]
  branches: Branch[]
  currentUserId: number
  role: string
}

export function POListClient({ pos, suppliers, branches, currentUserId, role }: POListClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const canCreate = ['OWNER', 'MANAGER', 'GM'].includes(role)

  const filtered =
    activeTab === 'all'
      ? pos
      : pos.filter((po) => activeTab.split(',').includes(po.status))

  const columns: ColumnDef<PO>[] = [
    {
      accessorKey: 'poNumber',
      header: 'No. PO',
      cell: ({ row }) => (
        <span className="font-mono font-medium text-foreground">{row.original.poNumber}</span>
      ),
    },
    {
      id: 'branch',
      header: 'Cabang',
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.branch.name}</span>,
    },
    {
      id: 'supplier',
      header: 'Supplier',
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.supplier.name}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => {
        const statusInfo =
          STATUS_LABELS[row.original.status] ?? { label: row.original.status, color: 'bg-gray-100 text-gray-600' }

        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        )
      },
    },
    {
      accessorKey: 'totalAmount',
      header: () => <div className="text-right">Total</div>,
      enableSorting: true,
      cell: ({ row }) => (
        <div className="text-right font-medium">
          Rp {parseFloat(row.original.totalAmount).toLocaleString('id-ID')}
        </div>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Tanggal',
      enableSorting: true,
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
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <Link
          href={`/purchase-orders/${row.original.id}`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Detail -&gt;
        </Link>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex gap-1">
          {TABS.map((tab) => (
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
              <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">
                {tab.key === 'all'
                  ? pos.length
                  : pos.filter((po) => tab.key.split(',').includes(po.status)).length}
              </span>
            </button>
          ))}
        </div>

        {canCreate && (
          <button
            onClick={() => setShowCreateDialog(true)}
            className="mb-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
          >
            + Buat PO
          </button>
        )}
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        emptyMessage="Tidak ada Purchase Order untuk filter ini."
        enableSorting
      />

      {showCreateDialog && (
        <CreatePODialog
          suppliers={suppliers}
          branches={branches}
          currentUserId={currentUserId}
          role={role}
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            setShowCreateDialog(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
