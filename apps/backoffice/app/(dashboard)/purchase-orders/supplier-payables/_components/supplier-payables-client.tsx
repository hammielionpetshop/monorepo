'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { formatDateTime, formatWIB } from '@petshop/shared'
import { DataTable } from '@/components/ui/data-table'
import { usePersistedFilterState } from '@/components/ui/use-persisted-filter-state'
import { daysUntilDue, dueState, type DueState } from '@/lib/supplier-due-date'
import type { SupplierPayable, Option, SupplierCredit } from './types'
import { SupplierPaymentDialog } from './supplier-payment-dialog'

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
  { key: 'WAITING', label: 'Menunggu Faktur' },
  { key: 'PAID',    label: 'Lunas' },
  { key: 'all',     label: 'Semua' },
]

const isOpen = (p: SupplierPayable) => p.status === 'UNPAID' || p.status === 'PARTIAL'
// Harga faktur belum lengkap: nominalnya masih perkiraan, jadi dipisah dari hutang pasti dan
// belum bisa dibayar (DP ditulis saat faktur diisi — keputusan owner).
const isWaiting = (p: SupplierPayable) => isOpen(p) && p.pricePendingItems > 0
const isPayable = (p: SupplierPayable) => isOpen(p) && p.pricePendingItems === 0
const remainingOf = (p: SupplierPayable) => Math.max(p.totalAmount - p.paidAmount, 0)
const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

interface Props {
  payables: SupplierPayable[]
  canPay: boolean
  paymentMethods: Option[]
  supplierCredits: SupplierCredit[]
  /** Tanggal hari ini (WIB, YYYY-MM-DD) dari server — batas atas tanggal bayar. */
  today: string
  /** Dari link "Lihat di Hutang Supplier" di detail PO (?q=No. PO). */
  initialSearch: string | null
}

export function SupplierPayablesClient({ payables, canPay, paymentMethods, supplierCredits, today, initialSearch }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = usePersistedFilterState(FILTERS_STORAGE_KEY, 'activeTab', 'OPEN')
  const [branchFilter, setBranchFilter] = usePersistedFilterState(FILTERS_STORAGE_KEY, 'branchFilter', ALL)
  const [supplierFilter, setSupplierFilter] = usePersistedFilterState(FILTERS_STORAGE_KEY, 'supplierFilter', ALL)
  const [search, setSearch] = usePersistedFilterState(FILTERS_STORAGE_KEY, 'search', '')

  const [payingRow, setPayingRow] = useState<SupplierPayable | null>(null)
  const [historyRow, setHistoryRow] = useState<SupplierPayable | null>(null)
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
    document.body.style.overflow = 'hidden'
  }, [])

  const openHistoryModal = useCallback((row: SupplierPayable) => {
    setHistoryRow(row)
    document.body.style.overflow = 'hidden'
  }, [])

  const closeModal = useCallback(() => {
    setPayingRow(null)
    setHistoryRow(null)
    document.body.style.overflow = ''
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    if (historyRow) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [historyRow, closeModal])

  const branchOptions = useMemo(() => uniqueOptions(payables.map(p => [p.branchId, p.branchName])), [payables])
  const supplierOptions = useMemo(() => uniqueOptions(payables.map(p => [p.supplierId, p.supplierName])), [payables])

  // Kartu ringkasan & hitungan tab mengikuti filter cabang + supplier, supaya angkanya
  // selalu cocok dengan isi tabel.
  const scoped = useMemo(() => payables.filter(p =>
    (branchFilter === ALL || p.branchId === Number(branchFilter)) &&
    (supplierFilter === ALL || p.supplierId === Number(supplierFilter))
  ), [payables, branchFilter, supplierFilter])

  const stateOf = useCallback(
    (p: SupplierPayable): DueState => (isPayable(p) ? dueState(p.dueDate, today) : 'NONE'),
    [today]
  )

  const filtered = useMemo(() => {
    const byTab = scoped.filter(p =>
      activeTab === 'all' ? true
        : activeTab === 'OPEN' ? isPayable(p)
        : activeTab === 'OVERDUE' ? stateOf(p) === 'OVERDUE'
        : activeTab === 'WAITING' ? isWaiting(p)
        : p.status === activeTab
    )
    const q = search.trim().toLowerCase()
    if (!q) return byTab
    return byTab.filter(p =>
      `${p.poNumber} ${p.invoiceNumber ?? ''} ${p.supplierName ?? ''}`.toLowerCase().includes(q)
    )
  }, [scoped, activeTab, search, stateOf])

  const openOnes = scoped.filter(isPayable)
  const waitingOnes = scoped.filter(isWaiting)
  const waitingEstimate = waitingOnes.reduce((s, p) => s + Math.max(p.estimatedTotal - p.paidAmount, 0), 0)
  const totalOutstanding = openOnes.reduce((s, p) => s + remainingOf(p), 0)
  const overdueOnes = openOnes.filter(p => stateOf(p) === 'OVERDUE')
  const overdueAmount = overdueOnes.reduce((s, p) => s + remainingOf(p), 0)
  const soonOnes = openOnes.filter(p => stateOf(p) === 'SOON')
  const soonAmount = soonOnes.reduce((s, p) => s + remainingOf(p), 0)
  const totalPaid = scoped.reduce((s, p) => s + p.paidAmount, 0)
  const totalReturDeduction = scoped.reduce(
    (s, p) => s + p.payments.filter(pay => pay.method === 'RETUR').reduce((a, pay) => a + pay.amount, 0),
    0,
  )
  const creditBySupplier = new Map(supplierCredits.map(c => [c.supplierId, c.balance]))
  const visibleCredits = supplierCredits.filter(c => supplierFilter === ALL || c.supplierId === Number(supplierFilter))

  function tabCount(key: string) {
    if (key === 'all') return scoped.length
    if (key === 'OPEN') return openOnes.length
    if (key === 'OVERDUE') return overdueOnes.length
    if (key === 'WAITING') return waitingOnes.length
    return scoped.filter(p => p.status === key).length
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
      cell: ({ row }) => {
        const p = row.original
        if (isWaiting(p)) {
          return (
            <div className="text-right whitespace-nowrap" title="Harga faktur belum lengkap — perkiraan dari harga rencana / modal terakhir">
              <div className="text-amber-800">≈ {rupiah(p.estimatedTotal)}</div>
              <div className="text-xs text-amber-700">perkiraan</div>
            </div>
          )
        }
        return <div className="text-right whitespace-nowrap">{rupiah(p.totalAmount)}</div>
      },
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
        if (isWaiting(row.original)) return <div className="text-right text-xs text-amber-700">menunggu faktur</div>
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
        if (isWaiting(row.original)) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap bg-amber-100 text-amber-800">
              Menunggu Faktur
            </span>
          )
        }
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
            {isWaiting(p) && (
              <a
                href={`/purchase-orders/${p.poId}`}
                className="text-xs font-medium text-amber-800 hover:underline whitespace-nowrap"
                title="Isi harga faktur di detail PO dulu, baru bisa dibayar"
              >
                Isi harga dulu →
              </a>
            )}
            {canPay && isPayable(p) && (
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
          {waitingOnes.length > 0 && (
            <p className="text-xs text-amber-700 mt-0.5">
              + ≈ {rupiah(waitingEstimate)} perkiraan ({waitingOnes.length} PO menunggu faktur)
            </p>
          )}
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
          {totalReturDeduction > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">termasuk potongan retur {rupiah(totalReturDeduction)}</p>
          )}
        </div>
      </div>

      {visibleCredits.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-semibold">Saldo di Supplier (kelebihan retur)</p>
          <p className="text-xs text-emerald-800 mt-0.5">
            Dipakai saat mencatat pembayaran tagihan supplier itu — pilih &quot;Bayar dari Saldo Supplier&quot;.
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
            {visibleCredits.map(c => (
              <li key={c.supplierId}>
                {c.supplierName}: <span className="font-semibold">{rupiah(c.balance)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
        <SupplierPaymentDialog
          target={{
            id: payingRow.id,
            poNumber: payingRow.poNumber,
            supplierName: payingRow.supplierName,
            remaining: remainingOf(payingRow),
            creditBalance: creditBySupplier.get(payingRow.supplierId) ?? 0,
          }}
          paymentMethods={paymentMethods}
          today={today}
          onClose={closeModal}
          onSaved={(message) => {
            closeModal()
            setSuccessMsg(message)
            router.refresh()
          }}
        />
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

const filterSelectClass = 'px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'

function uniqueOptions(pairs: [number, string | null][]): Option[] {
  const map = new Map<number, string>()
  for (const [id, name] of pairs) if (name) map.set(id, name)
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id-ID'))
}
