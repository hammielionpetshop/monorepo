'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatWIB } from '@petshop/shared'
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

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Tidak ada order pada status ini.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">No. Order</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Customer</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">Item</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total Estimasi</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const statusInfo = ORDER_STATUS_LABELS[order.status]
                return (
                  <tr key={order.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link href={`/orders/${order.id}`} className="font-medium text-primary hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {order.customerName}
                      {order.customerPhone && (
                        <div className="text-xs text-muted-foreground">{order.customerPhone}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-foreground">{order.itemCount}</td>
                    <td className="px-3 py-2 text-right font-medium text-foreground">
                      Rp {formatCurrency(order.estimatedTotal)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatWIB(new Date(order.createdAt), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
