'use client'

import React, { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { formatWIB } from '@petshop/shared'
import { DataTable } from '@/components/ui/data-table'
import { OrderSummary, ORDER_STATUS_LABELS } from './types'

const TABS = [
  { key: 'all', label: 'Semua' },
  { key: 'PENDING', label: 'Menunggu' },
  { key: 'CONFIRMED', label: 'Dikonfirmasi' },
  { key: 'REJECTED', label: 'Ditolak' },
  { key: 'CANCELLED', label: 'Dibatalkan' },
]

function formatCurrency(value: number) {
  return value.toLocaleString('id-ID')
}

interface Props {
  orders: OrderSummary[]
}

export function OrdersListClient({ orders }: Props) {
  const [activeTab, setActiveTab] = useState('PENDING')

  const filtered = useMemo(() => {
    if (activeTab === 'all') return orders
    return orders.filter((order) => order.status === activeTab)
  }, [orders, activeTab])

  const columns: ColumnDef<OrderSummary>[] = [
    {
      accessorKey: 'orderNumber',
      header: 'No. Order',
      cell: ({ row }) => (
        <Link href={`/orders/${row.original.id}`} className="font-medium text-primary hover:underline">
          {row.original.orderNumber}
        </Link>
      ),
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => (
        <div className="text-foreground">
          {row.original.customerName}
          {row.original.customerPhone && (
            <div className="text-xs text-muted-foreground">{row.original.customerPhone}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'itemCount',
      header: () => <div className="text-center">Item</div>,
      cell: ({ row }) => (
        <div className="text-center text-foreground">{row.original.itemCount}</div>
      ),
    },
    {
      accessorKey: 'estimatedTotal',
      header: () => <div className="text-right">Total Estimasi</div>,
      enableSorting: true,
      cell: ({ row }) => (
        <div className="text-right font-medium text-foreground">
          Rp {formatCurrency(row.original.estimatedTotal)}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: () => <div className="text-center">Status</div>,
      cell: ({ row }) => {
        const statusInfo = ORDER_STATUS_LABELS[row.original.status]

        return (
          <div className="text-center">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
        )
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Tanggal',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {formatWIB(new Date(row.original.createdAt), {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center border-b border-border">
        <div className="flex flex-wrap gap-1">
          {TABS.map((tab) => {
            const tabCount =
              tab.key === 'all' ? orders.length : orders.filter((order) => order.status === tab.key).length
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`border-b-2 -mb-px px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">{tabCount}</span>
              </button>
            )
          })}
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        emptyMessage="Tidak ada order pada status ini."
        enableSorting
      />
    </div>
  )
}
