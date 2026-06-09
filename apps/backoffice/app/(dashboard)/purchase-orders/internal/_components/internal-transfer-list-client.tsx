'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { InternalTransfer, Branch } from './types'

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
    return transfers.filter((t) => {
      const tabMatch =
        activeTab === 'all' || activeTab.split(',').includes(t.status)
      const sourceMatch =
        !filterSourceBranch || t.sourceBranchId === parseInt(filterSourceBranch)
      const destMatch =
        !filterDestBranch || t.destinationBranchId === parseInt(filterDestBranch)
      return tabMatch && sourceMatch && destMatch
    })
  }, [transfers, activeTab, filterSourceBranch, filterDestBranch])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        {/* Tabs */}
        <div className="flex items-center border-b border-border">
          <div className="flex gap-1 flex-wrap">
            {TABS.map((tab) => {
              const count =
                tab.key === 'all'
                  ? transfers.length
                  : transfers.filter((t) => tab.key.split(',').includes(t.status)).length
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
                  <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex gap-3 flex-wrap">
          <select
            value={filterSourceBranch}
            onChange={(e) => setFilterSourceBranch(e.target.value)}
            className="border border-border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Semua Cabang Asal</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            value={filterDestBranch}
            onChange={(e) => setFilterDestBranch(e.target.value)}
            className="border border-border rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Semua Cabang Tujuan</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Tidak ada transfer internal untuk filter ini.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">No. Transfer</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Dari</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ke</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tgl Dibuat</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pemohon</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((t) => {
                const statusInfo = STATUS_LABELS[t.status] ?? {
                  label: t.status,
                  color: 'bg-gray-100 text-gray-600',
                }
                return (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-foreground">
                      {t.ibtNumber}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t.sourceBranchName ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t.destinationBranchName ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t.requestedByName ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/purchase-orders/internal/${t.id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Detail →
                      </Link>
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
