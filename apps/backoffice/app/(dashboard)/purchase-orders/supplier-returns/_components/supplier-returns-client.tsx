'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { SupplierReturnForm } from '@/components/supplier-returns/supplier-return-form'
import { SupplierReturnList } from '@/components/supplier-returns/supplier-return-list'
import type { SupplierReturnStatus, SupplierReturnView } from '@/components/supplier-returns/types'

const TABS: { key: SupplierReturnStatus | 'ALL'; label: string }[] = [
  { key: 'PENDING', label: 'Menunggu' },
  { key: 'APPROVED', label: 'Disetujui' },
  { key: 'REJECTED', label: 'Ditolak' },
  { key: 'ALL', label: 'Semua' },
]

export function SupplierReturnsClient({ rows, branchId }: { rows: SupplierReturnView[]; branchId: number }) {
  const router = useRouter()
  const [tab, setTab] = useState<SupplierReturnStatus | 'ALL'>('PENDING')
  const [formOpen, setFormOpen] = useState(false)
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r =>
      (tab === 'ALL' || r.status === tab) &&
      (!q || `${r.returnNumber} ${r.supplierName} ${r.poNumber ?? ''}`.toLowerCase().includes(q)),
    )
  }, [rows, tab, search])

  return (
    <div className="space-y-4">
      {success && (
        <div role="status" className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm">
          {success}
        </div>
      )}

      {formOpen ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Ajukan Retur Baru</h2>
            <button type="button" onClick={() => setFormOpen(false)} className="text-sm text-muted-foreground hover:text-foreground">
              Tutup form
            </button>
          </div>
          <SupplierReturnForm
            apiBase="/api/bo/supplier-returns"
            branchId={branchId}
            onSubmitted={(returnNumber) => {
              setFormOpen(false)
              setTab('PENDING')
              setSuccess(`Retur ${returnNumber} diajukan — menunggu persetujuan di Permintaan Persetujuan.`)
              router.refresh()
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setFormOpen(true); setSuccess('') }}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Ajukan Retur ke Supplier
        </button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">
                {t.key === 'ALL' ? rows.length : rows.filter(r => r.status === t.key).length}
              </span>
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari no. retur, supplier, PO..."
          className="mb-2 w-56 px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="rounded-lg border border-border bg-card px-4">
        <SupplierReturnList
          rows={filtered}
          printHref={(id) => `/purchase-orders/supplier-returns/${id}/cetak`}
          emptyText="Tidak ada retur untuk filter ini."
        />
      </div>
    </div>
  )
}
