'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { Customer, TransactionSummary, CustomerDebt, PaymentMethod } from '../../_components/types'

interface Props {
  customer: Customer
  transactions: TransactionSummary[]
  debts: CustomerDebt[]
  paymentMethods: PaymentMethod[]
  canViewDebts: boolean
}

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatDate(value: Date | string): string {
  const d = new Date(value)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function statusLabel(status: string): { label: string; className: string } {
  switch (status) {
    case 'COMPLETED':
      return { label: 'Selesai', className: 'bg-green-100 text-green-700' }
    case 'VOIDED':
      return { label: 'Dibatalkan', className: 'bg-destructive/10 text-destructive' }
    case 'PENDING_VOID':
      return { label: 'Menunggu Batal', className: 'bg-yellow-100 text-yellow-700' }
    default:
      return { label: status, className: 'bg-muted text-muted-foreground' }
  }
}

function debtStatusBadge(status: string): { label: string; className: string } {
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

export default function CustomerDetailClient({
  customer,
  transactions,
  debts: initialDebts,
  paymentMethods,
  canViewDebts,
}: Props) {
  const [debts, setDebts] = useState<CustomerDebt[]>(initialDebts)
  const [payingDebt, setPayingDebt] = useState<CustomerDebt | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethodId, setPayMethodId] = useState<number | ''>('')
  const [payNote, setPayNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 3000)
      return () => clearTimeout(t)
    }
  }, [successMsg])

  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => setErrorMsg(null), 5000)
      return () => clearTimeout(t)
    }
  }, [errorMsg])

  const handleOpenModal = useCallback((debt: CustomerDebt) => {
    setPayingDebt(debt)
    setPayAmount('')
    setPayMethodId(paymentMethods[0]?.id ?? '')
    setPayNote('')
    setFormError(null)
    document.body.style.overflow = 'hidden'
  }, [paymentMethods])

  const handleCloseModal = useCallback(() => {
    setPayingDebt(null)
    setFormError(null)
    document.body.style.overflow = ''
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseModal()
    }
    if (payingDebt) {
      document.addEventListener('keydown', onKey)
    }
    return () => document.removeEventListener('keydown', onKey)
  }, [payingDebt, handleCloseModal])

  async function handleSubmitPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!payingDebt) return

    const amountNum = parseInt(payAmount, 10)
    if (!payAmount || isNaN(amountNum) || amountNum <= 0) {
      setFormError('Nominal harus lebih dari 0')
      return
    }
    if (amountNum > payingDebt.remainingAmount) {
      setFormError(`Nominal tidak boleh melebihi sisa hutang (${IDR.format(payingDebt.remainingAmount)})`)
      return
    }
    if (!payMethodId) {
      setFormError('Pilih metode pembayaran')
      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      const res = await fetch(
        `/api/bo/customers/${customer.id}/debts/${payingDebt.id}/pay`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: amountNum,
            paymentMethodId: Number(payMethodId),
            note: payNote || undefined,
          }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        setFormError(data.error ?? 'Terjadi kesalahan')
        setSubmitting(false)
        return
      }

      setDebts((prev) =>
        prev.map((d) =>
          d.id === payingDebt.id
            ? {
                ...d,
                paidAmount: data.paidAmount,
                remainingAmount: data.remainingAmount,
                status: data.status,
              }
            : d
        )
      )
      handleCloseModal()
      setSuccessMsg('Pembayaran berhasil dicatat')
    } catch {
      setFormError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  const totalOutstanding = debts
    .filter((d) => d.status !== 'PAID')
    .reduce((sum, d) => sum + d.remainingAmount, 0)

  return (
    <div>
      <Link
        href="/master-data/customers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        ← Kembali ke Daftar Customer
      </Link>

      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 px-4 py-3 rounded-md text-sm bg-green-50 border border-green-200 text-green-800"
        >
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-4 px-4 py-3 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive"
        >
          {errorMsg}
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{customer.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            {customer.code && (
              <span className="text-sm text-muted-foreground font-mono">{customer.code}</span>
            )}
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                customer.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {customer.isActive ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-muted/30 rounded-lg border border-border">
        <div>
          <p className="text-xs text-muted-foreground">Kode</p>
          <p className="text-sm font-medium text-foreground">{customer.code ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Telepon</p>
          <p className="text-sm font-medium text-foreground">{customer.phone ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Email</p>
          <p className="text-sm font-medium text-foreground">{customer.email ?? '-'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Terdaftar</p>
          <p className="text-sm font-medium text-foreground">{formatDate(customer.createdAt)}</p>
        </div>
        {customer.address && (
          <div className="col-span-2 md:col-span-4">
            <p className="text-xs text-muted-foreground">Alamat</p>
            <p className="text-sm font-medium text-foreground">{customer.address}</p>
          </div>
        )}
      </div>

      <div className="mb-8">
        <h2 className="text-base font-semibold text-foreground mb-3">Riwayat Transaksi</h2>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">No. Transaksi</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tanggal</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Belum ada riwayat transaksi
                  </td>
                </tr>
              ) : (
                transactions.map((trx) => {
                  const { label, className } = statusLabel(trx.status)
                  return (
                    <tr key={trx.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{trx.trxNumber}</td>
                      <td className="px-4 py-3 text-foreground">{formatDate(trx.createdAt)}</td>
                      <td className="px-4 py-3 text-right text-foreground font-medium">
                        {IDR.format(trx.payableAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
                          {label}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {transactions.length === 50 && (
          <p className="text-xs text-muted-foreground mt-2">Menampilkan 50 transaksi terbaru.</p>
        )}
      </div>

      {canViewDebts && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">Hutang / Piutang</h2>
          </div>

          {totalOutstanding > 0 && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center justify-between">
              <span className="text-sm text-yellow-800 font-medium">Total Outstanding</span>
              <span className="text-sm font-semibold text-yellow-900">{IDR.format(totalOutstanding)}</span>
            </div>
          )}

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">No. Transaksi</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tanggal</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Hutang</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Sudah Dibayar</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Sisa</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {debts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Belum ada data hutang
                    </td>
                  </tr>
                ) : (
                  debts.map((debt) => {
                    const { label, className } = debtStatusBadge(debt.status)
                    return (
                      <tr key={debt.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-foreground">
                          {debt.trxNumber ?? '-'}
                        </td>
                        <td className="px-4 py-3 text-foreground">{formatDate(debt.createdAt)}</td>
                        <td className="px-4 py-3 text-right text-foreground font-medium">
                          {IDR.format(debt.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-right text-foreground">
                          {IDR.format(debt.paidAmount)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">
                          {IDR.format(debt.remainingAmount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
                            {label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {debt.status !== 'PAID' && (
                            <button
                              onClick={() => handleOpenModal(debt)}
                              className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                            >
                              Catat Pembayaran
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {payingDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-semibold text-foreground mb-1">Catat Pembayaran Hutang</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Sisa hutang: <span className="font-semibold text-foreground">{IDR.format(payingDebt.remainingAmount)}</span>
            </p>

            {formError && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-4 px-3 py-2 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive"
              >
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
                  max={payingDebt.remainingAmount}
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
                    <option key={pm.id} value={pm.id}>
                      {pm.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Keterangan
                </label>
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
                  onClick={handleCloseModal}
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
