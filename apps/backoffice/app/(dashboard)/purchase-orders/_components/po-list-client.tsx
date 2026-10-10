'use client'

import React, { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatWIB } from '@petshop/shared'
import { DataTable } from '@/components/ui/data-table'
import { usePersistedFilterState } from '@/components/ui/use-persisted-filter-state'
import { CreatePODialog } from './create-po-dialog'
import { PO_STAGE_INFO, poStage, type PoStage } from '@/lib/po-stage'
import { poPaymentBadge, type PoPayableSummary } from '@/lib/po-payment-status'
import { todayWibDate } from '@/lib/payment-date'

// Urutan tab mengikuti alur PO: rencana → disetujui → barang diterima → harga faktur → selesai.
// Ditolak/Dibatalkan hanya terlihat di "Semua".
const TABS: { key: PoStage | 'all'; label: string }[] = [
  { key: 'RENCANA', label: 'Rencana' },
  { key: 'DISETUJUI', label: 'Disetujui' },
  { key: 'DITERIMA', label: 'Diterima' },
  { key: 'BELUM_HARGA', label: 'Belum Ada Harga' },
  { key: 'SELESAI', label: 'Selesai' },
  { key: 'all', label: 'Semua' },
]

const stageOf = (po: PO) => poStage(po.status, po.pricePendingItems ?? 0)

function matchesTab(po: PO, tab: string) {
  return tab === 'all' || stageOf(po) === tab
}

interface PO {
  id: number
  poNumber: string
  status: string
  totalAmount: string
  notes: string | null
  createdAt: string
  createdByName?: string | null
  supplier: { id: number; name: string }
  branch: { id: number; name: string }
  /** Item yang barangnya sudah masuk tapi harga fakturnya belum ada. */
  pricePendingItems?: number
  payable?: PoPayableSummary | null
}

interface Supplier { id: number; name: string }
interface Branch { id: number; name: string }

interface POListClientProps {
  pos: PO[]
  suppliers: Supplier[]
  branches: Branch[]
  currentUserId: number
  role: string
  /** Hari ini (WIB, YYYY-MM-DD) dari server — pembanding jatuh tempo. */
  today?: string
}

export function POListClient({ pos, suppliers, branches, currentUserId, role, today = todayWibDate() }: POListClientProps) {
  const router = useRouter()
  const [storedTab, setActiveTab] = usePersistedFilterState('purchase-orders', 'activeTab', 'all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // Tab tersimpan dari versi lama (mis. 'PENDING_APPROVAL', 'PRICE_PENDING') tidak dikenal lagi.
  const activeTab = TABS.some((t) => t.key === storedTab) ? storedTab : 'all'

  const canCreate = ['OWNER', 'MANAGER', 'GM'].includes(role)

  const filtered = pos.filter((po) => matchesTab(po, activeTab))

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
        const stage = stageOf(row.original)
        const info = PO_STAGE_INFO[stage]
        return (
          <div className="flex flex-wrap items-center gap-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${info.color}`}>
              {info.label}
            </span>
            {stage === 'BELUM_HARGA' && (
              <span className="text-xs text-amber-800">({row.original.pricePendingItems} barang)</span>
            )}
          </div>
        )
      },
    },
    {
      id: 'payment',
      header: 'Status Bayar',
      enableSorting: false,
      cell: ({ row }) => {
        const badge = poPaymentBadge(stageOf(row.original), row.original.payable ?? null, today)
        if (!badge) return <span className="text-xs text-muted-foreground">-</span>
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badge.color}`}>
            {badge.label}
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
          {row.original.createdByName && (
            <span className="block text-xs">oleh {row.original.createdByName}</span>
          )}
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
                {pos.filter((po) => matchesTab(po, tab.key)).length}
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
        persistKey="purchase-orders"
      />

      {showCreateDialog && (
        <CreatePODialog
          suppliers={suppliers}
          branches={branches}
          currentUserId={currentUserId}
          role={role}
          onClose={() => setShowCreateDialog(false)}
          onSuccess={(poId) => {
            setShowCreateDialog(false)
            // Langsung ke detail PO — di sana PO bisa disimpan sebagai PDF/foto untuk supplier.
            router.push(`/purchase-orders/${poId}?baru=1`)
          }}
        />
      )}
    </div>
  )
}
