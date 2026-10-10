'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { formatDateTime, formatWIB } from '@petshop/shared'
import { DataTable } from '@/components/ui/data-table'
import { usePersistedFilterState } from '@/components/ui/use-persisted-filter-state'
import { digitsOnly, formatRupiahInput } from '@/lib/number-input'
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
  { key: 'OPEN', label: 'Belum Lunas' },
  { key: 'PAID', label: 'Lunas' },
  { key: 'all',  label: 'Semua' },
]

const isOpen = (p: SupplierPayable) => p.status === 'UNPAID' || p.status === 'PARTIAL'
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

  const [payingId, setPayingId] = useState<number | null>(null)
  const [historyId, setHistoryId] = useState<number | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(today)
  const [payMethod, setPayMethod] = useState('')
  const [payRef, setPayRef] = useState('')
  const [payNote, setPayNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!initialSearch) return
    setSearch(initialSearch)
    setActiveTab('all')
    setBranchFilter(ALL)
    setSupplierFilter(ALL)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSearch])

  const branchOptions = useMemo(() => uniqueOptions(payables.map(p => [p.branchId, p.branchName])), [payables])
  const supplierOptions = useMemo(() => uniqueOptions(payables.map(p => [p.supplierId, p.supplierName])), [payables])

  // Kartu ringkasan & hitungan tab mengikuti filter cabang + supplier, supaya angkanya
  // selalu cocok dengan isi tabel.
  const scoped = useMemo(() => payables.filter(p =>
    (branchFilter === ALL || p.branchId === Number(branchFilter)) &&
    (supplierFilter === ALL || p.supplierId === Number(supplierFilter))
  ), [payables, branchFilter, supplierFilter])

  const filtered = useMemo(() => {
    const byTab = scoped.filter(p =>
      activeTab === 'all' ? true : activeTab === 'OPEN' ? isOpen(p) : p.status === activeTab
    )
    const q = search.trim().toLowerCase()
    if (!q) return byTab
    return byTab.filter(p =>
      `${p.poNumber} ${p.invoiceNumber ?? ''} ${p.supplierName ?? ''}`.toLowerCase().includes(q)
    )
  }, [scoped, activeTab, search])

  const openOnes = scoped.filter(isOpen)
  const totalOutstanding = openOnes.reduce((s, p) => s + Math.max(p.totalAmount - p.paidAmount, 0), 0)
  const totalPaid = scoped.reduce((s, p) => s + p.paidAmount, 0)

  function tabCount(key: string) {
    if (key === 'all') return scoped.length
    if (key === 'OPEN') return openOnes.length
    return scoped.filter(p => p.status === key).length
  }

  function openPay(p: SupplierPayable) {
    setHistoryId(null)
    setPayingId(p.id)
    setPayAmount(String(Math.max(p.totalAmount - p.paidAmount, 0)))
    setPayDate(today)
    setPayMethod('')
    setPayRef('')
    setPayNote('')
    setErrorMsg(null)
  }

  function closePay() {
    setPayingId(null)
    setErrorMsg(null)
  }

  async function handlePay() {
    if (!payingId) return
    const amount = parseInt(payAmount)
    if (!amount || amount <= 0) return setErrorMsg('Jumlah pembayaran tidak valid')
    if (!payMethod) return setErrorMsg('Pilih metode bayar')
    if (!payDate || payDate > today) return setErrorMsg('Tanggal bayar tidak boleh melewati hari ini')

    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/bo/supplier-payables/${payingId}/pay`, {
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
      if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan')
      setSuccessMsg('Pembayaran supplier dicatat')
      closePay()
      setTimeout(() => setSuccessMsg(null), 3000)
      router.refresh()
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
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
        if (sisa > 0) return <div className="text-right font-medium text-red-600 whitespace-nowrap">{rupiah(sisa)}</div>
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
        const isPaying = payingId === p.id
        const showHistory = historyId === p.id
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {canPay && isOpen(p) && (
                <button
                  onClick={() => (isPaying ? closePay() : openPay(p))}
                  className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
                >
                  {isPaying ? 'Batal' : 'Catat Bayar'}
                </button>
              )}
              {p.payments.length > 0 && (
                <button
                  onClick={() => { setPayingId(null); setHistoryId(showHistory ? null : p.id) }}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline whitespace-nowrap"
                >
                  {showHistory ? 'Tutup' : `Riwayat (${p.payments.length})`}
                </button>
              )}
            </div>

            {isPaying && (
              <div className="w-60 space-y-2 rounded-md border border-border bg-muted/20 p-3">
                <Field label="Jumlah Bayar (Rp)">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatRupiahInput(payAmount)}
                    onChange={e => setPayAmount(digitsOnly(e.target.value))}
                    onFocus={e => e.target.select()}
                    className={inputClass}
                  />
                </Field>
                <Field label="Tanggal Bayar">
                  <input
                    type="date"
                    value={payDate}
                    max={today}
                    onChange={e => setPayDate(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Metode Bayar">
                  <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className={`${inputClass} bg-background`}>
                    <option value="">— Pilih —</option>
                    {paymentMethods.map(m => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="No. Bukti Transfer">
                  <input type="text" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Opsional" className={inputClass} />
                </Field>
                <Field label="Catatan">
                  <input type="text" value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Opsional" className={inputClass} />
                </Field>
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

            {showHistory && (
              <div className="w-72 space-y-2 rounded-md border border-border bg-muted/20 p-3">
                {p.payments.map(pay => (
                  <div key={pay.id} className="text-xs border-b border-border last:border-0 pb-2 last:pb-0">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{rupiah(pay.amount)}</span>
                      <span className="text-muted-foreground">{pay.method}</span>
                    </div>
                    <div className="text-muted-foreground">
                      {formatDateTime(pay.paidAt)}{pay.paidByName && ` · ${pay.paidByName}`}
                    </div>
                    {pay.referenceNumber && <div className="text-muted-foreground">Bukti: {pay.referenceNumber}</div>}
                    {pay.note && <div className="text-muted-foreground">{pay.note}</div>}
                  </div>
                ))}
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

      <div className="bg-card border border-border rounded-lg p-4 flex flex-wrap items-center gap-6">
        <div>
          <p className="text-xs text-muted-foreground">Sisa Hutang</p>
          <p className="text-lg font-semibold text-red-600">{rupiah(totalOutstanding)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">PO Belum Lunas</p>
          <p className="text-lg font-semibold">{openOnes.length}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Sudah Dibayar</p>
          <p className="text-lg font-semibold text-green-600">{rupiah(totalPaid)}</p>
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
    </div>
  )
}

const inputClass = 'w-full border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary'
const filterSelectClass = 'px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
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
