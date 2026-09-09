'use client'

import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { formatWIB } from '@petshop/shared'
import { DataTable } from '@/components/ui/data-table'
import type { Customer, TransactionSummary, CustomerDebt, DebtPayment, PaymentMethod } from '../../_components/types'
import TransactionDetailModal from '@/app/(dashboard)/transactions/_components/transaction-detail-modal'

interface Props {
  customer: Customer
  transactions: TransactionSummary[]
  debts: CustomerDebt[]
  paymentMethods: PaymentMethod[]
  canViewDebts: boolean
  canVoidPayment: boolean
}

/** page.tsx membatasi query transaksi ke jumlah ini — dipakai untuk catatan "terbaru". */
const TRX_LIMIT = 200

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatDate(value: Date | string): string {
  return formatWIB(value, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDateOnly(value: Date | string | null): string {
  return formatWIB(value, { day: '2-digit', month: 'short', year: 'numeric' })
}

function isOverdue(dueAt: Date | string | null, status: string): boolean {
  if (!dueAt || status === 'PAID') return false
  const d = new Date(dueAt)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() < Date.now()
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
    case 'VOIDED':
      return { label: 'Dibatalkan', className: 'bg-muted text-muted-foreground line-through' }
    default:
      return { label: status, className: 'bg-muted text-muted-foreground' }
  }
}

function tabClass(active: boolean): string {
  return `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
    active
      ? 'border-primary text-foreground'
      : 'border-transparent text-muted-foreground hover:text-foreground'
  }`
}

const filterInputClass =
  'flex-1 min-w-[200px] px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
const filterSelectClass =
  'px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'

type TrxStatusFilter = 'ALL' | 'COMPLETED' | 'PENDING_VOID' | 'VOIDED'
type DebtStatusFilter = 'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'VOIDED' | 'OVERDUE'

export default function CustomerDetailClient({
  customer,
  transactions,
  debts: initialDebts,
  paymentMethods,
  canViewDebts,
  canVoidPayment,
}: Props) {
  const [activeTab, setActiveTab] = useState<'transactions' | 'debts'>('transactions')

  const [debts, setDebts] = useState<CustomerDebt[]>(initialDebts)
  const [selectedTrxNumber, setSelectedTrxNumber] = useState<string | null>(null)
  const [historyDebtId, setHistoryDebtId] = useState<number | null>(null)
  const [voidTargetId, setVoidTargetId] = useState<number | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidSubmitting, setVoidSubmitting] = useState(false)
  const [voidError, setVoidError] = useState<string | null>(null)
  const [payingDebt, setPayingDebt] = useState<CustomerDebt | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethodId, setPayMethodId] = useState<number | ''>('')
  const [payNote, setPayNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [showAddDebt, setShowAddDebt] = useState(false)
  const [addAmount, setAddAmount] = useState('')
  const [addDueAt, setAddDueAt] = useState('')
  const [addNote, setAddNote] = useState('')
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [trxSearch, setTrxSearch] = useState('')
  const [trxStatus, setTrxStatus] = useState<TrxStatusFilter>('ALL')
  const [debtSearch, setDebtSearch] = useState('')
  const [debtStatus, setDebtStatus] = useState<DebtStatusFilter>('ALL')

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
    if (!payingDebt || submitting) return

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
        // Hutang sudah lunas dari sesi/tab lain, kasir lain, atau submit ganda: bukan
        // kegagalan pembayaran. Selaraskan status lokal dan beri tahu tanpa alarm merah.
        if (res.status === 409 && typeof data.error === 'string' && data.error.includes('sudah lunas')) {
          setDebts((prev) =>
            prev.map((d) =>
              d.id === payingDebt.id
                ? { ...d, status: 'PAID', paidAmount: d.totalAmount, remainingAmount: 0 }
                : d
            )
          )
          handleCloseModal()
          setSuccessMsg('Hutang ini sudah lunas. Data diperbarui.')
          setSubmitting(false)
          return
        }
        setFormError(data.error ?? 'Terjadi kesalahan')
        setSubmitting(false)
        return
      }

      const p = data.payment
      const newPayment: DebtPayment | null = p
        ? {
            id: p.id,
            debtId: p.debtId,
            amount: p.amount,
            paymentMethodId: p.paymentMethodId,
            paymentMethodName: paymentMethods.find((m) => m.id === p.paymentMethodId)?.name ?? null,
            note: p.note ?? null,
            createdAt: p.createdAt,
            voidedAt: null,
            voidReason: null,
          }
        : null
      setDebts((prev) =>
        prev.map((d) =>
          d.id === payingDebt.id
            ? {
                ...d,
                paidAmount: data.paidAmount,
                remainingAmount: data.remainingAmount,
                status: data.status,
                payments: newPayment ? [...d.payments, newPayment] : d.payments,
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

  function openHistory(debtId: number) {
    setHistoryDebtId(debtId)
    setVoidTargetId(null)
    setVoidReason('')
    setVoidError(null)
    document.body.style.overflow = 'hidden'
  }

  function closeHistory() {
    setHistoryDebtId(null)
    setVoidTargetId(null)
    setVoidError(null)
    document.body.style.overflow = ''
  }

  async function handleVoidPayment(debtId: number, paymentId: number) {
    setVoidSubmitting(true)
    setVoidError(null)
    try {
      const res = await fetch(
        `/api/bo/customers/${customer.id}/debts/${debtId}/payments/${paymentId}/void`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: voidReason || undefined }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setVoidError(data.error ?? 'Terjadi kesalahan')
        setVoidSubmitting(false)
        return
      }
      setDebts((prev) =>
        prev.map((d) =>
          d.id === debtId
            ? {
                ...d,
                paidAmount: data.paidAmount,
                remainingAmount: data.remainingAmount,
                status: data.status,
                payments: d.payments.map((pm) =>
                  pm.id === paymentId
                    ? { ...pm, voidedAt: new Date().toISOString(), voidReason: voidReason || null }
                    : pm
                ),
              }
            : d
        )
      )
      setVoidTargetId(null)
      setVoidReason('')
      setSuccessMsg('Pembayaran berhasil dibatalkan')
    } catch {
      setVoidError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setVoidSubmitting(false)
    }
  }

  function openAddDebt() {
    setAddAmount('')
    setAddDueAt('')
    setAddNote('')
    setAddError(null)
    setShowAddDebt(true)
    document.body.style.overflow = 'hidden'
  }

  function closeAddDebt() {
    setShowAddDebt(false)
    setAddError(null)
    document.body.style.overflow = ''
  }

  async function handleAddDebt(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const amountNum = parseInt(addAmount, 10)
    if (!addAmount || isNaN(amountNum) || amountNum <= 0) {
      setAddError('Nominal harus lebih dari 0')
      return
    }

    setAddSubmitting(true)
    setAddError(null)
    try {
      const res = await fetch(`/api/bo/customers/${customer.id}/debts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalAmount: amountNum,
          dueAt: addDueAt || null,
          note: addNote || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAddError(data.error ?? 'Terjadi kesalahan')
        setAddSubmitting(false)
        return
      }
      setDebts((prev) => [data as CustomerDebt, ...prev])
      closeAddDebt()
      setSuccessMsg('Hutang manual berhasil ditambahkan')
    } catch {
      setAddError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setAddSubmitting(false)
    }
  }

  const totalOutstanding = debts
    .filter((d) => d.status !== 'PAID' && d.status !== 'VOIDED')
    .reduce((sum, d) => sum + d.remainingAmount, 0)

  const historyDebt = historyDebtId !== null ? debts.find((d) => d.id === historyDebtId) ?? null : null

  const filteredTrx = useMemo(() => {
    const q = trxSearch.trim().toLowerCase()
    return transactions.filter((t) => {
      if (trxStatus !== 'ALL' && t.status !== trxStatus) return false
      if (q && !t.trxNumber.toLowerCase().includes(q)) return false
      return true
    })
  }, [transactions, trxSearch, trxStatus])

  const filteredDebts = useMemo(() => {
    const q = debtSearch.trim().toLowerCase()
    return debts.filter((d) => {
      if (debtStatus === 'OVERDUE') {
        if (!isOverdue(d.dueAt, d.status)) return false
      } else if (debtStatus !== 'ALL' && d.status !== debtStatus) {
        return false
      }
      if (q) {
        const hay = `${d.trxNumber ?? ''} ${d.note ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [debts, debtSearch, debtStatus])

  const trxColumns: ColumnDef<TransactionSummary>[] = [
    {
      accessorKey: 'trxNumber',
      header: 'No. Transaksi',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setSelectedTrxNumber(row.original.trxNumber)}
          className="font-mono text-xs text-primary hover:underline"
        >
          {row.original.trxNumber}
        </button>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Tanggal',
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      accessorKey: 'payableAmount',
      header: () => <div className="text-right">Total</div>,
      cell: ({ row }) => <div className="text-right font-medium">{IDR.format(row.original.payableAmount)}</div>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const { label, className } = statusLabel(row.original.status)
        return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>{label}</span>
      },
    },
  ]

  const debtColumns: ColumnDef<CustomerDebt>[] = [
    {
      accessorKey: 'trxNumber',
      header: 'No. Transaksi',
      cell: ({ row }) => {
        const d = row.original
        return d.trxNumber ?? (d.note ? <span className="font-sans italic text-muted-foreground">{d.note}</span> : 'Manual')
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Tanggal',
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      accessorKey: 'dueAt',
      header: 'Jatuh Tempo',
      cell: ({ row }) => {
        const overdue = isOverdue(row.original.dueAt, row.original.status)
        return (
          <span className={overdue ? 'text-destructive font-semibold' : ''}>
            {formatDateOnly(row.original.dueAt)}{overdue ? ' ⚠' : ''}
          </span>
        )
      },
    },
    {
      accessorKey: 'totalAmount',
      header: () => <div className="text-right">Total Hutang</div>,
      cell: ({ row }) => <div className="text-right font-medium">{IDR.format(row.original.totalAmount)}</div>,
    },
    {
      accessorKey: 'paidAmount',
      header: () => <div className="text-right">Sudah Dibayar</div>,
      cell: ({ row }) => <div className="text-right">{IDR.format(row.original.paidAmount)}</div>,
    },
    {
      accessorKey: 'remainingAmount',
      header: () => <div className="text-right">Sisa</div>,
      cell: ({ row }) => <div className="text-right font-semibold">{IDR.format(row.original.remainingAmount)}</div>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const { label, className } = debtStatusBadge(row.original.status)
        return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>{label}</span>
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const debt = row.original
        return (
          <div className="flex items-center justify-end gap-2">
            {debt.payments.length > 0 && (
              <button
                onClick={() => openHistory(debt.id)}
                className="text-xs px-3 py-1.5 border border-border rounded-md text-foreground hover:bg-muted transition-colors whitespace-nowrap"
              >
                Riwayat ({debt.payments.filter((p) => !p.voidedAt).length})
              </button>
            )}
            {debt.status !== 'PAID' && debt.status !== 'VOIDED' && (
              <button
                onClick={() => handleOpenModal(debt)}
                className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors whitespace-nowrap"
              >
                Catat Pembayaran
              </button>
            )}
          </div>
        )
      },
    },
  ]

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
          <p className="text-xs text-muted-foreground">Tier Harga</p>
          <p className="text-sm font-medium text-foreground">{customer.defaultTierType || 'RETAIL'}</p>
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

      <div className="border-b border-border mb-4 flex gap-1">
        <button type="button" onClick={() => setActiveTab('transactions')} className={tabClass(activeTab === 'transactions')}>
          Riwayat Transaksi
        </button>
        {canViewDebts && (
          <button type="button" onClick={() => setActiveTab('debts')} className={tabClass(activeTab === 'debts')}>
            Hutang / Piutang
          </button>
        )}
      </div>

      {activeTab === 'transactions' && (
        <div className="mb-8">
          <DataTable
            data={filteredTrx}
            columns={trxColumns}
            emptyMessage="Tidak ada transaksi yang cocok dengan filter"
            pageSize={10}
            toolbar={
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={trxSearch}
                  onChange={(e) => setTrxSearch(e.target.value)}
                  placeholder="Cari no. transaksi..."
                  className={filterInputClass}
                />
                <select
                  value={trxStatus}
                  onChange={(e) => setTrxStatus(e.target.value as TrxStatusFilter)}
                  aria-label="Filter status transaksi"
                  className={filterSelectClass}
                >
                  <option value="ALL">Semua Status</option>
                  <option value="COMPLETED">Selesai</option>
                  <option value="PENDING_VOID">Menunggu Batal</option>
                  <option value="VOIDED">Dibatalkan</option>
                </select>
              </div>
            }
          />
          {transactions.length >= TRX_LIMIT && (
            <p className="text-xs text-muted-foreground mt-2">Menampilkan {TRX_LIMIT} transaksi terbaru.</p>
          )}
        </div>
      )}

      {activeTab === 'debts' && canViewDebts && (
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            {totalOutstanding > 0 ? (
              <div className="px-4 py-2 rounded-lg bg-yellow-50 border border-yellow-200 text-sm">
                <span className="text-yellow-800 font-medium">Total Outstanding: </span>
                <span className="font-semibold text-yellow-900">{IDR.format(totalOutstanding)}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Tidak ada tunggakan aktif</span>
            )}
            <button
              onClick={openAddDebt}
              className="text-xs px-3 py-1.5 border border-border rounded-md text-foreground hover:bg-muted transition-colors"
            >
              + Tambah Hutang Manual
            </button>
          </div>

          <DataTable
            data={filteredDebts}
            columns={debtColumns}
            emptyMessage="Tidak ada hutang yang cocok dengan filter"
            pageSize={10}
            toolbar={
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={debtSearch}
                  onChange={(e) => setDebtSearch(e.target.value)}
                  placeholder="Cari no. transaksi atau keterangan..."
                  className={filterInputClass}
                />
                <select
                  value={debtStatus}
                  onChange={(e) => setDebtStatus(e.target.value as DebtStatusFilter)}
                  aria-label="Filter status hutang"
                  className={filterSelectClass}
                >
                  <option value="ALL">Semua Status</option>
                  <option value="UNPAID">Belum Bayar</option>
                  <option value="PARTIAL">Sebagian</option>
                  <option value="PAID">Lunas</option>
                  <option value="VOIDED">Dibatalkan</option>
                  <option value="OVERDUE">Jatuh Tempo Terlewat</option>
                </select>
              </div>
            }
          />
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

      {showAddDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-semibold text-foreground mb-4">Tambah Hutang Manual</h3>

            {addError && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-4 px-3 py-2 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive"
              >
                {addError}
              </div>
            )}

            <form onSubmit={handleAddDebt} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Nominal Hutang <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="Masukkan nominal"
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Jatuh Tempo</label>
                <input
                  type="date"
                  value={addDueAt}
                  onChange={(e) => setAddDueAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Keterangan</label>
                <input
                  type="text"
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  placeholder="mis. Saldo awal piutang"
                  maxLength={255}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAddDebt}
                  disabled={addSubmitting}
                  className="px-4 py-2 text-sm rounded-md border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {addSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-2xl mx-4 p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold text-foreground">Riwayat Pembayaran Hutang</h3>
              <button onClick={closeHistory} className="text-sm text-muted-foreground hover:text-foreground" aria-label="Tutup">✕</button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Total hutang {IDR.format(historyDebt.totalAmount)} · Sudah dibayar{' '}
              <span className="font-semibold text-foreground">{IDR.format(historyDebt.paidAmount)}</span> · Sisa{' '}
              <span className="font-semibold text-foreground">{IDR.format(historyDebt.remainingAmount)}</span>
            </p>

            {voidError && (
              <div role="alert" aria-live="assertive" className="mb-4 px-3 py-2 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive">
                {voidError}
              </div>
            )}

            {historyDebt.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Belum ada pembayaran tercatat.</p>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Tanggal</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Metode</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Nominal</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Keterangan</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyDebt.payments.map((p) => {
                      const voided = !!p.voidedAt
                      return (
                        <Fragment key={p.id}>
                          <tr className={`border-t border-border ${voided ? 'opacity-60' : ''}`}>
                            <td className="px-3 py-2 text-foreground">{formatDate(p.createdAt)}</td>
                            <td className="px-3 py-2 text-foreground">{p.paymentMethodName ?? '-'}</td>
                            <td className={`px-3 py-2 text-right font-medium text-foreground ${voided ? 'line-through' : ''}`}>
                              {IDR.format(p.amount)}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{p.note ?? '-'}</td>
                            <td className="px-3 py-2 text-right">
                              {voided ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">Dibatalkan</span>
                              ) : canVoidPayment ? (
                                <button
                                  onClick={() => { setVoidTargetId(p.id); setVoidReason(''); setVoidError(null) }}
                                  className="text-xs text-destructive hover:underline"
                                >
                                  Batalkan
                                </button>
                              ) : null}
                            </td>
                          </tr>
                          {voidTargetId === p.id && !voided && (
                            <tr className="bg-muted/30">
                              <td colSpan={5} className="px-3 py-3">
                                <label className="block text-xs font-medium text-foreground mb-1">Alasan pembatalan (opsional)</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={voidReason}
                                    onChange={(e) => setVoidReason(e.target.value)}
                                    maxLength={255}
                                    placeholder="mis. salah input nominal"
                                    className="flex-1 px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                  />
                                  <button
                                    disabled={voidSubmitting}
                                    onClick={() => handleVoidPayment(historyDebt.id, p.id)}
                                    className="px-3 py-1.5 text-xs rounded-md bg-destructive text-white hover:bg-destructive/90 transition-colors disabled:opacity-50"
                                  >
                                    {voidSubmitting ? 'Memproses...' : 'Ya, batalkan'}
                                  </button>
                                  <button
                                    disabled={voidSubmitting}
                                    onClick={() => { setVoidTargetId(null); setVoidReason('') }}
                                    className="px-3 py-1.5 text-xs rounded-md border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                                  >
                                    Batal
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                          {voided && p.voidReason && (
                            <tr className="opacity-60">
                              <td colSpan={5} className="px-3 pb-2 text-xs text-muted-foreground italic">Alasan: {p.voidReason}</td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-end pt-4">
              <button
                onClick={closeHistory}
                className="px-4 py-2 text-sm rounded-md border border-border text-foreground hover:bg-muted transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTrxNumber && (
        <TransactionDetailModal
          trxNumber={selectedTrxNumber}
          onClose={() => setSelectedTrxNumber(null)}
        />
      )}
    </div>
  )
}
