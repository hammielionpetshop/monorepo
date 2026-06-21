'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { formatWIB } from '@petshop/shared'
import type { ReceivableRow, PaymentMethod } from './types'

interface Props {
  rows: ReceivableRow[]
  paymentMethods: PaymentMethod[]
}

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatDateOnly(value: Date | string | null): string {
  return formatWIB(value, { day: '2-digit', month: 'short', year: 'numeric' })
}

function isOverdue(dueAt: Date | string | null, status: string): boolean {
  if (!dueAt || status === 'PAID') return false
  const d = new Date(dueAt)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() < Date.now()
}

function statusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case 'UNPAID':
      return { label: 'Belum Bayar', className: 'bg-destructive/10 text-destructive' }
    case 'PARTIAL':
      return { label: 'Sebagian', className: 'bg-yellow-100 text-yellow-700' }
    case 'PAID':
      return { label: 'Lunas', className: 'bg-green-100 text-green-700' }
    default:
      return { label: status, className: 'bg-muted text-muted-foreground' }
  }
}

export default function ReceivablesClient({ rows: initialRows, paymentMethods }: Props) {
  const [rows, setRows] = useState<ReceivableRow[]>(initialRows)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PARTIAL' | 'OVERDUE'>('ALL')

  const [payingRow, setPayingRow] = useState<ReceivableRow | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethodId, setPayMethodId] = useState<number | ''>('')
  const [payNote, setPayNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 3000)
    return () => clearTimeout(t)
  }, [successMsg])

  const openModal = useCallback((row: ReceivableRow) => {
    setPayingRow(row)
    setPayAmount('')
    setPayMethodId(paymentMethods[0]?.id ?? '')
    setPayNote('')
    setFormError(null)
    document.body.style.overflow = 'hidden'
  }, [paymentMethods])

  const closeModal = useCallback(() => {
    setPayingRow(null)
    setFormError(null)
    document.body.style.overflow = ''
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    if (payingRow) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [payingRow, closeModal])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.customerName} ${r.customerCode ?? ''} ${r.trxNumber ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (statusFilter === 'OVERDUE') return isOverdue(r.dueAt, r.status)
      if (statusFilter === 'UNPAID') return r.status === 'UNPAID'
      if (statusFilter === 'PARTIAL') return r.status === 'PARTIAL'
      return true
    })
  }, [rows, search, statusFilter])

  const totalOutstanding = useMemo(() => rows.reduce((sum, r) => sum + r.remainingAmount, 0), [rows])
  const overdue = useMemo(() => rows.filter((r) => isOverdue(r.dueAt, r.status)), [rows])
  const overdueAmount = useMemo(() => overdue.reduce((sum, r) => sum + r.remainingAmount, 0), [overdue])

  async function handleSubmitPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!payingRow) return
    const amountNum = parseInt(payAmount, 10)
    if (!payAmount || isNaN(amountNum) || amountNum <= 0) {
      setFormError('Nominal harus lebih dari 0')
      return
    }
    if (amountNum > payingRow.remainingAmount) {
      setFormError(`Nominal tidak boleh melebihi sisa hutang (${IDR.format(payingRow.remainingAmount)})`)
      return
    }
    if (!payMethodId) {
      setFormError('Pilih metode pembayaran')
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch(`/api/bo/customers/${payingRow.customerId}/debts/${payingRow.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountNum, paymentMethodId: Number(payMethodId), note: payNote || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error ?? 'Terjadi kesalahan')
        setSubmitting(false)
        return
      }

      if (data.status === 'PAID') {
        setRows((prev) => prev.filter((r) => r.id !== payingRow.id))
      } else {
        setRows((prev) =>
          prev.map((r) =>
            r.id === payingRow.id
              ? { ...r, paidAmount: data.paidAmount, remainingAmount: data.remainingAmount, status: data.status }
              : r
          )
        )
      }
      closeModal()
      setSuccessMsg('Pembayaran berhasil dicatat')
    } catch {
      setFormError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {successMsg && (
        <div role="status" aria-live="polite" className="mb-4 px-4 py-3 rounded-md text-sm bg-green-50 border border-green-200 text-green-800">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Piutang Outstanding</p>
          <p className="text-lg font-semibold text-foreground mt-1">{IDR.format(totalOutstanding)}</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-xs text-yellow-800">Jatuh Tempo Terlewat</p>
          <p className="text-lg font-semibold text-yellow-900 mt-1">{IDR.format(overdueAmount)}</p>
          <p className="text-xs text-yellow-700 mt-0.5">{overdue.length} hutang</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Jumlah Hutang Aktif</p>
          <p className="text-lg font-semibold text-foreground mt-1">{rows.length}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari customer, kode, atau no. transaksi..."
          className="flex-1 min-w-[220px] px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="ALL">Semua Status</option>
          <option value="UNPAID">Belum Bayar</option>
          <option value="PARTIAL">Sebagian</option>
          <option value="OVERDUE">Jatuh Tempo Terlewat</option>
        </select>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">No. Transaksi</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cabang</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Jatuh Tempo</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Sisa</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Tidak ada data piutang
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const { label, className } = statusBadge(r.status)
                const overdueRow = isOverdue(r.dueAt, r.status)
                return (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/master-data/customers/${r.customerId}`} className="font-medium text-foreground hover:text-primary hover:underline">
                        {r.customerName}
                      </Link>
                      {r.customerCode && <div className="text-xs text-muted-foreground font-mono">{r.customerCode}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {r.trxNumber ?? (r.note ? <span className="font-sans italic text-muted-foreground">{r.note}</span> : 'Manual')}
                    </td>
                    <td className="px-4 py-3 text-foreground">{r.branchName ?? '-'}</td>
                    <td className={`px-4 py-3 ${overdueRow ? 'text-destructive font-semibold' : 'text-foreground'}`}>
                      {formatDateOnly(r.dueAt)}{overdueRow ? ' ⚠' : ''}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">{IDR.format(r.totalAmount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{IDR.format(r.remainingAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>{label}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openModal(r)}
                        className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                      >
                        Catat Pembayaran
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {payingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-semibold text-foreground mb-1">Catat Pembayaran Hutang</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {payingRow.customerName} — sisa hutang:{' '}
              <span className="font-semibold text-foreground">{IDR.format(payingRow.remainingAmount)}</span>
            </p>

            {formError && (
              <div role="alert" aria-live="assertive" className="mb-4 px-3 py-2 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Nominal Pembayaran <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={payingRow.remainingAmount}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Masukkan nominal"
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Metode Pembayaran <span className="text-destructive">*</span>
                </label>
                <select
                  value={payMethodId}
                  onChange={(e) => setPayMethodId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                >
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>{pm.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Keterangan</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Opsional"
                  maxLength={255}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="px-4 py-2 text-sm rounded-md border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
