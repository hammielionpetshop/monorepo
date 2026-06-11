'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'

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
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Tidak ada data untuk filter ini.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">No. Transfer</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Debitur (Penerima)</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Kreditur (Pengirim)</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Sudah Bayar</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Sisa</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(p => {
                const sisa = p.totalAmount - p.paidAmount
                const st = STATUS_CONFIG[p.status] ?? { label: p.status, color: 'bg-gray-100 text-gray-600' }
                const isPaying = payingId === p.id
                return (
                  <>
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium">
                        <a href={`/purchase-orders/internal/${p.transferId}`} className="text-primary hover:underline">
                          {p.ibtNumber ?? '-'}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.debtorBranchName ?? '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.creditorBranchName ?? '-'}</td>
                      <td className="px-4 py-3 text-right">Rp {p.totalAmount.toLocaleString('id-ID')}</td>
                      <td className="px-4 py-3 text-right text-green-600">
                        {p.paidAmount > 0 ? `Rp ${p.paidAmount.toLocaleString('id-ID')}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {sisa > 0 ? (
                          <span className="text-red-600">Rp {sisa.toLocaleString('id-ID')}</span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {canPay && (p.status === 'UNPAID' || p.status === 'PARTIAL') && (
                            <button
                              onClick={() => isPaying ? closePay() : openPay(p.id, sisa)}
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              {isPaying ? 'Batal' : 'Catat Bayar'}
                            </button>
                          )}
                          {canWaive && (p.status === 'UNPAID' || p.status === 'PARTIAL') && (
                            <button
                              onClick={() => setWaivedId(waivedId === p.id ? null : p.id)}
                              className="text-xs font-medium text-muted-foreground hover:text-destructive hover:underline"
                            >
                              {waivedId === p.id ? 'Batal' : 'Hapus Hutang'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isPaying && (
                      <tr key={`pay-${p.id}`}>
                        <td colSpan={8} className="px-4 py-4 bg-muted/20 border-t border-border">
                          <div className="flex flex-wrap items-end gap-3">
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Jumlah Bayar (Rp)</label>
                              <input
                                type="number"
                                min={1}
                                max={sisa}
                                value={payAmount}
                                onChange={e => setPayAmount(e.target.value)}
                                onFocus={e => e.target.select()}
                                className="w-40 border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">No. Bukti Transfer</label>
                              <input
                                type="text"
                                value={payRef}
                                onChange={e => setPayRef(e.target.value)}
                                placeholder="Opsional"
                                className="w-44 border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-muted-foreground mb-1">Catatan</label>
                              <input
                                type="text"
                                value={payNotes}
                                onChange={e => setPayNotes(e.target.value)}
                                placeholder="Opsional"
                                className="w-48 border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            </div>
                            <button
                              onClick={handlePay}
                              disabled={loading}
                              className="px-4 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            >
                              {loading ? 'Menyimpan...' : 'Simpan'}
                            </button>
                          </div>
                          {errorMsg && (
                            <p className="mt-2 text-xs text-destructive">{errorMsg}</p>
                          )}
                        </td>
                      </tr>
                    )}
                    {waivedId === p.id && (
                      <tr key={`waive-${p.id}`}>
                        <td colSpan={8} className="px-4 py-4 bg-destructive/5 border-t border-destructive/20">
                          <div className="flex items-center gap-4">
                            <p className="text-sm text-destructive font-medium">
                              Hapus hutang ini? Tindakan ini tidak dapat dibatalkan.
                            </p>
                            <button
                              onClick={handleWaive}
                              disabled={loading}
                              className="px-4 py-1.5 bg-destructive text-destructive-foreground text-sm font-medium rounded-md hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                            >
                              {loading ? 'Memproses...' : 'Ya, Hapus Hutang'}
                            </button>
                          </div>
                          {errorMsg && (
                            <p className="mt-2 text-xs text-destructive">{errorMsg}</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
