'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table'

interface Payable {
  id: number
  transferId: number
  ibtNumber: string | null
  debtorBranchId: number
  debtorBranchName: string | null
  creditorBranchId: number
  creditorBranchName: string | null
  totalAmount: number
  paidAmount: number
  status: string
  notes: string | null
  dueAt: string | null
  createdAt: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  UNPAID:  { label: 'Belum Bayar', color: 'bg-red-100 text-red-700' },
  PARTIAL: { label: 'Sebagian',    color: 'bg-yellow-100 text-yellow-800' },
  PAID:    { label: 'Lunas',       color: 'bg-green-100 text-green-800' },
  WAIVED:  { label: 'Dihapus',     color: 'bg-gray-100 text-gray-500' },
}

const TABS = [
  { key: 'all',     label: 'Semua' },
  { key: 'UNPAID',  label: 'Belum Bayar' },
  { key: 'PARTIAL', label: 'Sebagian' },
  { key: 'PAID',    label: 'Lunas' },
  { key: 'WAIVED',  label: 'Dihapus' },
]

interface Props {
  payables: Payable[]
  role: string
}

export function PayablesClient({ payables, role }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('UNPAID')
  const [payingId, setPayingId] = useState<number | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payRef, setPayRef] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [waivedId, setWaivedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const canPay = ['OWNER', 'GM', 'MANAGER', 'FINANCE'].includes(role)
  const canWaive = ['OWNER', 'GM'].includes(role)

  const filtered = useMemo(() =>
    activeTab === 'all' ? payables : payables.filter(p => p.status === activeTab),
    [payables, activeTab]
  )

  const totalUnpaid = payables
    .filter(p => p.status === 'UNPAID' || p.status === 'PARTIAL')
    .reduce((sum, p) => sum + (p.totalAmount - p.paidAmount), 0)

  function openPay(id: number, remaining: number) {
    setPayingId(id)
    setPayAmount(String(remaining))
    setPayRef('')
    setPayNotes('')
    setErrorMsg(null)
  }

  function closePay() {
    setPayingId(null)
    setPayAmount('')
    setPayRef('')
    setPayNotes('')
    setErrorMsg(null)
  }

  async function handleWaive() {
    if (!waivedId) return
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/bo/inter-branch-payables/${waivedId}/waive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan')
      setSuccessMsg('Hutang berhasil dihapuskan')
      setWaivedId(null)
      setTimeout(() => setSuccessMsg(null), 3000)
      router.refresh()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  async function handlePay() {
    if (!payingId) return
    const amount = parseInt(payAmount)
    if (!amount || amount <= 0) {
      setErrorMsg('Jumlah pembayaran tidak valid')
      return
    }
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/bo/inter-branch-payables/${payingId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, referenceNumber: payRef || undefined, notes: payNotes || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan')
      setSuccessMsg('Pembayaran berhasil dicatat')
      closePay()
      setTimeout(() => setSuccessMsg(null), 3000)
      router.refresh()
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  const payableColumns: ColumnDef<Payable>[] = [
    {
      accessorKey: 'ibtNumber',
      header: 'No. Transfer',
      cell: ({ row }) => (
        <a href={`/purchase-orders/internal/${row.original.transferId}`} className="font-mono font-medium text-primary hover:underline">
          {row.original.ibtNumber ?? '-'}
        </a>
      ),
    },
    {
      accessorKey: 'debtorBranchName',
      header: 'Debitur (Penerima)',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.debtorBranchName ?? '-'}</span>,
    },
    {
      accessorKey: 'creditorBranchName',
      header: 'Kreditur (Pengirim)',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.creditorBranchName ?? '-'}</span>,
    },
    {
      accessorKey: 'totalAmount',
      header: () => <div className="text-right">Total</div>,
      cell: ({ row }) => <div className="text-right">Rp {row.original.totalAmount.toLocaleString('id-ID')}</div>,
    },
    {
      accessorKey: 'paidAmount',
      header: () => <div className="text-right">Sudah Bayar</div>,
      cell: ({ row }) => (
        <div className="text-right text-green-600">
          {row.original.paidAmount > 0 ? `Rp ${row.original.paidAmount.toLocaleString('id-ID')}` : '-'}
        </div>
      ),
    },
    {
      id: 'sisa',
      header: () => <div className="text-right">Sisa</div>,
      cell: ({ row }) => {
        const sisa = row.original.totalAmount - row.original.paidAmount
        return (
          <div className="text-right font-medium">
            {sisa > 0 ? <span className="text-red-600">Rp {sisa.toLocaleString('id-ID')}</span> : '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const st = STATUS_CONFIG[row.original.status] ?? { label: row.original.status, color: 'bg-gray-100 text-gray-600' }
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
            {st.label}
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const p = row.original
        const sisa = p.totalAmount - p.paidAmount
        const isPaying = payingId === p.id
        const isWaiving = waivedId === p.id
        const isOutstanding = p.status === 'UNPAID' || p.status === 'PARTIAL'
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {canPay && isOutstanding && (
                <button
                  onClick={() => isPaying ? closePay() : openPay(p.id, sisa)}
                  className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
                >
                  {isPaying ? 'Batal' : 'Catat Bayar'}
                </button>
              )}
              {canWaive && isOutstanding && (
                <button
                  onClick={() => setWaivedId(isWaiving ? null : p.id)}
                  className="text-xs font-medium text-muted-foreground hover:text-destructive hover:underline whitespace-nowrap"
                >
                  {isWaiving ? 'Batal' : 'Hapus Hutang'}
                </button>
              )}
            </div>
            {isPaying && (
              <div className="w-56 space-y-2 rounded-md border border-border bg-muted/20 p-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Jumlah Bayar (Rp)</label>
                  <input
                    type="number"
                    min={1}
                    max={sisa}
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    onFocus={e => e.target.select()}
                    className="w-full border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">No. Bukti Transfer</label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={e => setPayRef(e.target.value)}
                    placeholder="Opsional"
                    className="w-full border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Catatan</label>
                  <input
                    type="text"
                    value={payNotes}
                    onChange={e => setPayNotes(e.target.value)}
                    placeholder="Opsional"
                    className="w-full border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  onClick={handlePay}
                  disabled={loading}
                  className="w-full px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Menyimpan...' : 'Simpan'}
                </button>
                {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}
              </div>
            )}
            {isWaiving && (
              <div className="w-56 space-y-2 rounded-md border border-destructive/20 bg-destructive/5 p-3">
                <p className="text-xs text-destructive font-medium">
                  Hapus hutang ini? Tindakan ini tidak dapat dibatalkan.
                </p>
                <button
                  onClick={handleWaive}
                  disabled={loading}
                  className="w-full px-4 py-1.5 bg-destructive text-destructive-foreground text-sm font-medium rounded-md hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Memproses...' : 'Ya, Hapus Hutang'}
                </button>
                {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}
              </div>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm">
          {successMsg}
        </div>
      )}

      {/* Summary card */}
      <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-6">
        <div>
          <p className="text-xs text-muted-foreground">Total Belum Lunas</p>
          <p className="text-lg font-semibold text-red-600">
            Rp {totalUnpaid.toLocaleString('id-ID')}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Transaksi</p>
          <p className="text-lg font-semibold">{payables.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-border">
        <div className="flex gap-1">
          {TABS.map(tab => {
            const count = tab.key === 'all' ? payables.length : payables.filter(p => p.status === tab.key).length
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
                <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <DataTable data={filtered} columns={payableColumns} emptyMessage="Tidak ada data untuk filter ini." />
    </div>
  )
}
