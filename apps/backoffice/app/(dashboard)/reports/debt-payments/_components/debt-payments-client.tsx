'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { formatWIB } from '@petshop/shared'
import { DataTable } from '@/components/ui/data-table'
import type { DebtPaymentRow, BranchOption } from './types'

interface Props {
  rows: DebtPaymentRow[]
  /** Kosong untuk user non-global — datanya sudah dikunci ke cabangnya di server. */
  branches: BranchOption[]
  canVoidPayment: boolean
  startDate: string
  endDate: string
}

/** Nilai khusus untuk pelunasan lama yang belum punya cabang, agar tetap bisa dijangkau. */
const NO_BRANCH = 'NONE'

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function formatDateTime(value: Date | string): string {
  return formatWIB(value, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function DebtPaymentsClient({
  rows: initialRows,
  branches,
  canVoidPayment,
  startDate,
  endDate,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const [rows, setRows] = useState<DebtPaymentRow[]>(initialRows)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'VOIDED'>('ALL')
  const [branchFilter, setBranchFilter] = useState<string>('ALL')
  const [start, setStart] = useState(startDate)
  const [end, setEnd] = useState(endDate)

  const [voidingRow, setVoidingRow] = useState<DebtPaymentRow | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Data berasal dari server, jadi setiap perubahan rentang tanggal harus memuat ulang.
  useEffect(() => setRows(initialRows), [initialRows])

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 4000)
    return () => clearTimeout(t)
  }, [successMsg])

  const openModal = useCallback((row: DebtPaymentRow) => {
    setVoidingRow(row)
    setVoidReason('')
    setFormError(null)
    document.body.style.overflow = 'hidden'
  }, [])

  const closeModal = useCallback(() => {
    setVoidingRow(null)
    setFormError(null)
    document.body.style.overflow = ''
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    if (voidingRow) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [voidingRow, closeModal])

  function applyDateRange(nextStart: string, nextEnd: string) {
    const q = new URLSearchParams({ startDate: nextStart, endDate: nextEnd })
    router.push(`${pathname}?${q.toString()}`)
  }

  const hasUnassigned = useMemo(() => rows.some((r) => r.branchId == null), [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (branchFilter !== 'ALL') {
        if (branchFilter === NO_BRANCH) {
          if (r.branchId != null) return false
        } else if (r.branchId !== Number(branchFilter)) {
          return false
        }
      }
      if (statusFilter === 'ACTIVE' && r.voidedAt) return false
      if (statusFilter === 'VOIDED' && !r.voidedAt) return false
      if (q) {
        const hay = `${r.customerName} ${r.customerCode ?? ''} ${r.trxNumber ?? ''} ${r.receivedByName ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, search, statusFilter, branchFilter])

  // Ringkasan mengikuti hasil filter agar angkanya tidak membantah isi tabel.
  const active = useMemo(() => filtered.filter((r) => !r.voidedAt), [filtered])
  const totalReceived = useMemo(() => active.reduce((sum, r) => sum + r.amount, 0), [active])
  const totalCash = useMemo(
    () => active.reduce((sum, r) => (r.isCash ? sum + r.amount : sum), 0),
    [active]
  )
  const voidedRows = useMemo(() => filtered.filter((r) => r.voidedAt), [filtered])
  const voidedAmount = useMemo(() => voidedRows.reduce((sum, r) => sum + r.amount, 0), [voidedRows])

  async function handleVoid() {
    if (!voidingRow) return
    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch(
        `/api/bo/customers/${voidingRow.customerId}/debts/${voidingRow.debtId}/payments/${voidingRow.id}/void`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: voidReason || undefined }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error ?? 'Terjadi kesalahan')
        setSubmitting(false)
        return
      }

      const voidedId = voidingRow.id
      const debtId = voidingRow.debtId
      setRows((prev) =>
        prev.map((r) => {
          if (r.id === voidedId) {
            return {
              ...r,
              voidedAt: new Date().toISOString(),
              voidReason: voidReason || null,
              voidedByName: 'Anda',
              debtRemainingAmount: data.remainingAmount,
              debtStatus: data.status,
            }
          }
          // Sisa hutang ikut berubah untuk semua pembayaran dari hutang yang sama.
          if (r.debtId === debtId) {
            return { ...r, debtRemainingAmount: data.remainingAmount, debtStatus: data.status }
          }
          return r
        })
      )
      closeModal()
      setSuccessMsg(
        `Pelunasan ${IDR.format(voidingRow.amount)} dibatalkan. Sisa hutang ${voidingRow.customerName} kembali menjadi ${IDR.format(data.remainingAmount)}.`
      )
    } catch {
      setFormError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnDef<DebtPaymentRow>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Tanggal',
      cell: ({ row }) => (
        <span className={row.original.voidedAt ? 'text-muted-foreground' : ''}>
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => (
        <div>
          <Link
            href={`/master-data/customers/${row.original.customerId}`}
            className="font-medium text-foreground hover:text-primary hover:underline"
          >
            {row.original.customerName}
          </Link>
          {row.original.customerCode && (
            <div className="text-xs text-muted-foreground font-mono">{row.original.customerCode}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'trxNumber',
      header: 'Nota Asal',
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.trxNumber ?? (
            <span className="font-sans italic text-muted-foreground">
              {row.original.debtNote ?? 'Hutang manual'}
            </span>
          )}
        </span>
      ),
    },
    {
      accessorKey: 'branchName',
      header: 'Cabang',
      cell: ({ row }) => row.original.branchName ?? '-',
    },
    {
      accessorKey: 'paymentMethodName',
      header: 'Metode',
      cell: ({ row }) => row.original.paymentMethodName ?? '-',
    },
    {
      accessorKey: 'amount',
      header: () => <div className="text-right">Nominal</div>,
      cell: ({ row }) => (
        <div className={`text-right font-semibold ${row.original.voidedAt ? 'line-through text-muted-foreground' : ''}`}>
          {IDR.format(row.original.amount)}
        </div>
      ),
    },
    {
      accessorKey: 'receivedByName',
      header: 'Diterima Oleh',
      cell: ({ row }) => (
        <div>
          <span className="text-sm">{row.original.receivedByName ?? '-'}</span>
          {row.original.shiftNumber != null && (
            <div className="text-xs text-muted-foreground">
              Shift #{row.original.shiftNumber}
              {row.original.shiftStatus && row.original.shiftStatus !== 'OPEN' ? ' (tutup)' : ''}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) =>
        row.original.voidedAt ? (
          <div>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
              Dibatalkan
            </span>
            {row.original.voidedByName && (
              <div className="text-xs text-muted-foreground mt-0.5">oleh {row.original.voidedByName}</div>
            )}
            {row.original.voidReason && (
              <div className="text-xs text-muted-foreground italic mt-0.5">{row.original.voidReason}</div>
            )}
          </div>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
            Sah
          </span>
        ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        canVoidPayment && !row.original.voidedAt ? (
          <div className="text-right">
            <button
              onClick={() => openModal(row.original)}
              className="text-xs px-3 py-1.5 border border-destructive/40 text-destructive rounded-md hover:bg-destructive/10 transition-colors"
            >
              Batalkan
            </button>
          </div>
        ) : null,
    },
  ]

  return (
    <div>
      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 px-4 py-3 rounded-md text-sm bg-green-50 border border-green-200 text-green-800"
        >
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Pelunasan Diterima</p>
          <p className="text-lg font-semibold text-foreground mt-1">{IDR.format(totalReceived)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{active.length} pembayaran sah</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Di Antaranya Tunai</p>
          <p className="text-lg font-semibold text-foreground mt-1">{IDR.format(totalCash)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">masuk laci &amp; rekonsiliasi shift</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Dibatalkan</p>
          <p className="text-lg font-semibold text-foreground mt-1">{IDR.format(voidedAmount)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{voidedRows.length} pembayaran</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="date"
          value={start}
          onChange={(e) => {
            setStart(e.target.value)
            if (e.target.value) applyDateRange(e.target.value, end)
          }}
          aria-label="Tanggal mulai"
          className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <span className="text-sm text-muted-foreground">s/d</span>
        <input
          type="date"
          value={end}
          onChange={(e) => {
            setEnd(e.target.value)
            if (e.target.value) applyDateRange(start, e.target.value)
          }}
          aria-label="Tanggal akhir"
          className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari customer, kode, nota, atau petugas..."
          className="flex-1 min-w-[220px] px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          aria-label="Filter status"
          className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="ALL">Semua Status</option>
          <option value="ACTIVE">Sah</option>
          <option value="VOIDED">Dibatalkan</option>
        </select>
        {branches.length > 0 && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            aria-label="Filter cabang"
            className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="ALL">Semua Cabang</option>
            {branches.map((b) => (
              <option key={b.id} value={String(b.id)}>
                {b.name}
              </option>
            ))}
            {hasUnassigned && <option value={NO_BRANCH}>Tanpa Cabang</option>}
          </select>
        )}
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        emptyMessage="Tidak ada pelunasan pada rentang tanggal ini"
      />

      {voidingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-semibold text-foreground mb-1">Batalkan Pelunasan</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {voidingRow.customerName} — {IDR.format(voidingRow.amount)} via{' '}
              {voidingRow.paymentMethodName ?? 'metode tidak diketahui'} pada{' '}
              {formatDateTime(voidingRow.createdAt)}.
            </p>

            <div className="mb-4 px-3 py-2 rounded-md text-sm bg-yellow-50 border border-yellow-200 text-yellow-900">
              Sisa hutang akan bertambah menjadi{' '}
              <span className="font-semibold">
                {IDR.format(voidingRow.debtRemainingAmount + voidingRow.amount)}
              </span>
              .
              {voidingRow.isCash && voidingRow.shiftStatus === 'OPEN' && (
                <> Kas yang harus ada di laci shift #{voidingRow.shiftNumber} ikut berkurang.</>
              )}
              {voidingRow.isCash && voidingRow.shiftStatus && voidingRow.shiftStatus !== 'OPEN' && (
                <>
                  {' '}
                  <span className="font-semibold">Perhatian:</span> shift #{voidingRow.shiftNumber} sudah
                  ditutup dan uangnya kemungkinan sudah disetorkan. Pembatalan ini mengubah kas yang
                  seharusnya ada pada shift tersebut, jadi setorannya perlu dicocokkan manual.
                </>
              )}
            </div>

            {formError && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-4 px-3 py-2 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive"
              >
                {formError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-1">
                Alasan pembatalan
              </label>
              <input
                type="text"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                maxLength={255}
                placeholder="mis. salah input nominal"
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="px-4 py-2 text-sm rounded-md border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleVoid}
                disabled={submitting}
                className="px-4 py-2 text-sm rounded-md bg-destructive text-white hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Memproses...' : 'Ya, batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
