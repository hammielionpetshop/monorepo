'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { formatDateTime, formatWIB } from '@petshop/shared'
import { DataTable } from '@/components/ui/data-table'
import { usePersistedFilterState } from '@/components/ui/use-persisted-filter-state'
import { digitsOnly, formatRupiahInput } from '@/lib/number-input'
import { daysUntilDue, dueState, type DueState } from '@/lib/supplier-due-date'
import type { SupplierPayable, Option } from './types'

const ALL = 'ALL'
const FILTERS_STORAGE_KEY = 'po-supplier-payables'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  UNPAID:  { label: 'Belum Bayar', color: 'bg-red-100 text-red-700' },
  PARTIAL: { label: 'Sebagian',    color: 'bg-yellow-100 text-yellow-800' },
  PAID:    { label: 'Lunas',       color: 'bg-green-100 text-green-800' },
  WAIVED:  { label: 'Dihapus',     color: 'bg-gray-100 text-gray-500' },
}

const TABS = [
  { key: 'OPEN',    label: 'Belum Lunas' },
  { key: 'OVERDUE', label: 'Terlambat' },
  { key: 'PAID',    label: 'Lunas' },
  { key: 'all',     label: 'Semua' },
]

const isOpen = (p: SupplierPayable) => p.status === 'UNPAID' || p.status === 'PARTIAL'
const remainingOf = (p: SupplierPayable) => Math.max(p.totalAmount - p.paidAmount, 0)
const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

interface Props {
  payables: SupplierPayable[]
  canPay: boolean
  paymentMethods: Option[]
  /** Tanggal hari ini (WIB, YYYY-MM-DD) dari server — batas atas tanggal bayar. */
  today: string
  /** Dari link "Lihat di Hutang Supplier" di detail PO (?q=No. PO). */
  initialSearch: string | null
}

export function SupplierPayablesClient({ payables, canPay, paymentMethods, today, initialSearch }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = usePersistedFilterState(FILTERS_STORAGE_KEY, 'activeTab', 'OPEN')
  const [branchFilter, setBranchFilter] = usePersistedFilterState(FILTERS_STORAGE_KEY, 'branchFilter', ALL)
  const [supplierFilter, setSupplierFilter] = usePersistedFilterState(FILTERS_STORAGE_KEY, 'supplierFilter', ALL)
  const [search, setSearch] = usePersistedFilterState(FILTERS_STORAGE_KEY, 'search', '')

  const [payingRow, setPayingRow] = useState<SupplierPayable | null>(null)
  const [historyRow, setHistoryRow] = useState<SupplierPayable | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(today)
  const [payMethod, setPayMethod] = useState('')
  const [payRef, setPayRef] = useState('')
  const [payNote, setPayNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!initialSearch) return
    setSearch(initialSearch)
    setActiveTab('all')
    setBranchFilter(ALL)
    setSupplierFilter(ALL)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSearch])

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 3000)
    return () => clearTimeout(t)
  }, [successMsg])

  const openPayModal = useCallback((row: SupplierPayable) => {
    setPayingRow(row)
    setPayAmount(String(remainingOf(row)))
    setPayDate(today)
    setPayMethod('')
    setPayRef('')
    setPayNote('')
    setFormError(null)
    document.body.style.overflow = 'hidden'
  }, [today])

  const openHistoryModal = useCallback((row: SupplierPayable) => {
    setHistoryRow(row)
    document.body.style.overflow = 'hidden'
  }, [])

  const closeModal = useCallback(() => {
    setPayingRow(null)
    setHistoryRow(null)
    setFormError(null)
    document.body.style.overflow = ''
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) closeModal()
    }
    if (payingRow || historyRow) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [payingRow, historyRow, submitting, closeModal])

  const branchOptions = useMemo(() => uniqueOptions(payables.map(p => [p.branchId, p.branchName])), [payables])
  const supplierOptions = useMemo(() => uniqueOptions(payables.map(p => [p.supplierId, p.supplierName])), [payables])

  // Kartu ringkasan & hitungan tab mengikuti filter cabang + supplier, supaya angkanya
  // selalu cocok dengan isi tabel.
  const scoped = useMemo(() => payables.filter(p =>
    (branchFilter === ALL || p.branchId === Number(branchFilter)) &&
    (supplierFilter === ALL || p.supplierId === Number(supplierFilter))
  ), [payables, branchFilter, supplierFilter])

  const stateOf = useCallback(
    (p: SupplierPayable): DueState => (isOpen(p) ? dueState(p.dueDate, today) : 'NONE'),
    [today]
  )

  const filtered = useMemo(() => {
    const byTab = scoped.filter(p =>
      activeTab === 'all' ? true
        : activeTab === 'OPEN' ? isOpen(p)
        : activeTab === 'OVERDUE' ? stateOf(p) === 'OVERDUE'
        : p.status === activeTab
    )
    const q = search.trim().toLowerCase()
    if (!q) return byTab
    return byTab.filter(p =>
      `${p.poNumber} ${p.invoiceNumber ?? ''} ${p.supplierName ?? ''}`.toLowerCase().includes(q)
    )
  }, [scoped, activeTab, search, stateOf])

  const openOnes = scoped.filter(isOpen)
  const totalOutstanding = openOnes.reduce((s, p) => s + remainingOf(p), 0)
  const overdueOnes = openOnes.filter(p => stateOf(p) === 'OVERDUE')
  const overdueAmount = overdueOnes.reduce((s, p) => s + remainingOf(p), 0)
  const soonOnes = openOnes.filter(p => stateOf(p) === 'SOON')
  const soonAmount = soonOnes.reduce((s, p) => s + remainingOf(p), 0)
  const totalPaid = scoped.reduce((s, p) => s + p.paidAmount, 0)

  function tabCount(key: string) {
    if (key === 'all') return scoped.length
    if (key === 'OPEN') return openOnes.length
    if (key === 'OVERDUE') return overdueOnes.length
    return scoped.filter(p => p.status === key).length
  }

  async function handleSubmitPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!payingRow || submitting) return
    const amount = parseInt(payAmount, 10)
    const remaining = remainingOf(payingRow)
    if (!payAmount || isNaN(amount) || amount <= 0) return setFormError('Nominal harus lebih dari 0')
    if (amount > remaining) return setFormError(`Nominal tidak boleh melebihi sisa tagihan (${rupiah(remaining)})`)
    if (!payDate || payDate > today) return setFormError('Tanggal bayar tidak boleh melewati hari ini')
    if (!payMethod) return setFormError('Pilih metode pembayaran')

    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch(`/api/bo/supplier-payables/${payingRow.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          method: payMethod,
          paidDate: payDate,
          referenceNumber: payRef.trim() || undefined,
          note: payNote.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error ?? 'Terjadi kesalahan')
        return
      }
      closeModal()
      setSuccessMsg(
        amount >= remaining
          ? `Pembayaran dicatat — ${payingRow.poNumber} lunas`
          : `Pembayaran dicatat — sisa ${payingRow.poNumber}: ${rupiah(remaining - amount)}`
      )
      router.refresh()
    } catch {
      setFormError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnDef<SupplierPayable>[] = [
    {
      accessorKey: 'poNumber',
      header: 'No. PO',
      cell: ({ row }) => (
        <a
          href={`/purchase-orders/${row.original.poId}`}
          className="font-mono text-xs font-medium text-primary hover:underline whitespace-nowrap"
        >
          {row.original.poNumber}
        </a>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Diterima',
      cell: ({ row }) => (
        <span className="text-muted-foreground whitespace-nowrap">{formatWIB(row.original.createdAt)}</span>
      ),
    },
    {
      accessorKey: 'supplierName',
      header: 'Supplier',
      cell: ({ row }) => <span className="font-medium">{row.original.supplierName ?? '-'}</span>,
    },
    {
      accessorKey: 'branchName',
      header: 'Cabang',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.branchName ?? '-'}</span>,
    },
    {
      accessorKey: 'dueDate',
      header: 'Jatuh Tempo',
      cell: ({ row }) => {
        const p = row.original
        if (!p.dueDate) {
          return <span className="text-xs text-muted-foreground" title="Termin supplier belum diatur">-</span>
        }
        const state = stateOf(p)
        const days = daysUntilDue(p.dueDate, today)
        return (
          <div className="whitespace-nowrap" title={p.paymentTermDays != null ? `Termin ${p.paymentTermDays} hari` : undefined}>
            <div className={state === 'OVERDUE' ? 'text-destructive font-semibold' : 'text-foreground'}>
              {formatWIB(`${p.dueDate}T12:00:00+07:00`)}
            </div>
            {state === 'OVERDUE' && <div className="text-xs text-destructive">⚠ terlambat {-days} hari</div>}
            {state === 'SOON' && (
              <div className="text-xs text-amber-700">{days === 0 ? 'hari ini' : `${days} hari lagi`}</div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'invoiceNumber',
      header: 'No. Faktur',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.invoiceNumber || '-'}</span>,
    },
    {
      accessorKey: 'totalAmount',
      header: () => <div className="text-right">Tagihan</div>,
      cell: ({ row }) => <div className="text-right whitespace-nowrap">{rupiah(row.original.totalAmount)}</div>,
    },
    {
      accessorKey: 'paidAmount',
      header: () => <div className="text-right">Sudah Bayar</div>,
      cell: ({ row }) => (
        <div className="text-right text-green-600 whitespace-nowrap">
          {row.original.paidAmount > 0 ? rupiah(row.original.paidAmount) : '-'}
        </div>
      ),
    },
    {
      id: 'sisa',
      header: () => <div className="text-right">Sisa</div>,
      cell: ({ row }) => {
        const sisa = row.original.totalAmount - row.original.paidAmount
        if (sisa > 0) return <div className="text-right font-semibold text-red-600 whitespace-nowrap">{rupiah(sisa)}</div>
        if (sisa < 0) {
          return (
            <div className="text-right text-xs text-amber-700 whitespace-nowrap" title="Faktur dikoreksi turun setelah dibayar">
              Lebih bayar {rupiah(-sisa)}
            </div>
          )
        }
        return <div className="text-right">-</div>
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const st = STATUS_CONFIG[row.original.status] ?? { label: row.original.status, color: 'bg-gray-100 text-gray-600' }
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${st.color}`}>
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
        return (
          <div className="flex items-center justify-end gap-3">
            {p.payments.length > 0 && (
              <button
                type="button"
                onClick={() => openHistoryModal(p)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline whitespace-nowrap"
              >
                Riwayat ({p.payments.length})
              </button>
            )}
            {canPay && isOpen(p) && (
              <button
                type="button"
                onClick={() => openPayModal(p)}
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
    <div className="space-y-4">
      {successMsg && (
        <div role="status" aria-live="polite" className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Sisa Hutang ke Supplier</p>
          <p className="text-lg font-semibold text-red-600 mt-1">{rupiah(totalOutstanding)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{openOnes.length} PO belum lunas</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-xs text-red-800">Lewat Jatuh Tempo</p>
          <p className="text-lg font-semibold text-red-900 mt-1">{rupiah(overdueAmount)}</p>
          <p className="text-xs text-red-800 mt-0.5">{overdueOnes.length} PO</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-xs text-yellow-800">Jatuh Tempo ≤ 7 Hari</p>
          <p className="text-lg font-semibold text-yellow-900 mt-1">{rupiah(soonAmount)}</p>
          <p className="text-xs text-yellow-800 mt-0.5">{soonOnes.length} PO</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Sudah Dibayar</p>
          <p className="text-lg font-semibold text-green-600 mt-1">{rupiah(totalPaid)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div className="flex gap-1">
          {TABS.map(tab => (
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
              <span className="ml-1.5 text-xs bg-muted rounded-full px-1.5 py-0.5">{tabCount(tab.key)}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari no. PO, faktur, supplier..."
            className="w-56 px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {supplierOptions.length > 1 && (
            <select
              value={supplierFilter}
              onChange={e => setSupplierFilter(e.target.value)}
              aria-label="Filter supplier"
              className={filterSelectClass}
            >
              <option value={ALL}>Semua Supplier</option>
              {supplierOptions.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
            </select>
          )}
          {branchOptions.length > 1 && (
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              aria-label="Filter cabang"
              className={filterSelectClass}
            >
              <option value={ALL}>Semua Cabang</option>
              {branchOptions.map(b => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        emptyMessage="Tidak ada data untuk filter ini."
        persistKey="po-supplier-payables"
      />

      {payingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div role="dialog" aria-modal="true" className="bg-background rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-semibold text-foreground mb-1">Catat Pembayaran ke Supplier</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {payingRow.supplierName ?? '-'} · <span className="font-mono">{payingRow.poNumber}</span> — sisa tagihan:{' '}
              <span className="font-semibold text-foreground">{rupiah(remainingOf(payingRow))}</span>
            </p>

            {formError && (
              <div role="alert" aria-live="assertive" className="mb-4 px-3 py-2 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <Field label="Nominal Pembayaran" required>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatRupiahInput(payAmount)}
                  onChange={e => setPayAmount(digitsOnly(e.target.value))}
                  onFocus={e => e.target.select()}
                  placeholder="Masukkan nominal"
                  className={inputClass}
                  required
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Tanggal Bayar" required>
                  <input
                    type="date"
                    value={payDate}
                    max={today}
                    onChange={e => setPayDate(e.target.value)}
                    className={inputClass}
                    required
                  />
                </Field>
                <Field label="Metode Pembayaran" required>
                  <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className={inputClass} required>
                    <option value="">— Pilih —</option>
                    {paymentMethods.map(m => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="No. Bukti Transfer">
                <input
                  type="text"
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  placeholder="Opsional"
                  maxLength={100}
                  className={inputClass}
                />
              </Field>

              <Field label="Keterangan">
                <input
                  type="text"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  placeholder="Opsional"
                  maxLength={500}
                  className={inputClass}
                />
              </Field>

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

      {historyRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeModal}>
          <div
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
            className="bg-background rounded-lg shadow-lg w-full max-w-2xl mx-4 p-6"
          >
            <h3 className="text-base font-semibold text-foreground mb-1">Riwayat Pembayaran</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {historyRow.supplierName ?? '-'} · <span className="font-mono">{historyRow.poNumber}</span>
            </p>

            <div className="max-h-[60vh] overflow-auto border border-border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Tanggal</th>
                    <th className="text-right font-medium px-3 py-2">Nominal</th>
                    <th className="text-left font-medium px-3 py-2">Metode</th>
                    <th className="text-left font-medium px-3 py-2">Bukti / Keterangan</th>
                    <th className="text-left font-medium px-3 py-2">Dicatat oleh</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRow.payments.map(pay => (
                    <tr key={pay.id} className="border-t border-border align-top">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(pay.paidAt)}</td>
                      <td className="px-3 py-2 text-right font-medium whitespace-nowrap">{rupiah(pay.amount)}</td>
                      <td className="px-3 py-2">{pay.method}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {pay.referenceNumber && <div>{pay.referenceNumber}</div>}
                        {pay.note && <div>{pay.note}</div>}
                        {!pay.referenceNumber && !pay.note && '-'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{pay.paidByName ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex gap-6">
                <span className="text-muted-foreground">Tagihan <span className="font-semibold text-foreground">{rupiah(historyRow.totalAmount)}</span></span>
                <span className="text-muted-foreground">Dibayar <span className="font-semibold text-green-600">{rupiah(historyRow.paidAmount)}</span></span>
                <span className="text-muted-foreground">Sisa <span className="font-semibold text-red-600">{rupiah(remainingOf(historyRow))}</span></span>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm rounded-md border border-border text-foreground hover:bg-muted transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputClass = 'w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
const filterSelectClass = 'px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  )
}

function uniqueOptions(pairs: [number, string | null][]): Option[] {
  const map = new Map<number, string>()
  for (const [id, name] of pairs) if (name) map.set(id, name)
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id-ID'))
}
