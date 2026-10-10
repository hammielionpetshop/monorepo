'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { formatDateTime } from '@petshop/shared'
import { DataTable } from '@/components/ui/data-table'
import { usePersistedFilterState } from '@/components/ui/use-persisted-filter-state'
import type { Payable, BranchOption } from './types'
import { digitsOnly, formatRupiahInput } from '@/lib/number-input'

const ALL_BRANCHES = 'ALL'
const FILTERS_STORAGE_KEY = 'po-internal-payables'

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

const isOutstanding = (p: Payable) => p.status === 'UNPAID' || p.status === 'PARTIAL'
const remainingOf = (p: Payable) => Math.max(p.totalAmount - p.paidAmount, 0)
const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

interface Props {
  payables: Payable[]
  canPay: boolean
  canWaive: boolean
  /** Metode bayar selain hutang — wajib dipilih saat mencatat pembayaran. */
  paymentMethods: { id: number; name: string }[]
  /** Tanggal hari ini (WIB, YYYY-MM-DD) dari server — batas atas tanggal bayar. */
  today: string
}

type Modal =
  | { kind: 'pay'; row: Payable }
  | { kind: 'history'; row: Payable }
  | { kind: 'waive'; row: Payable }
  | null

export function PayablesClient({ payables, canPay, canWaive, paymentMethods, today }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = usePersistedFilterState(FILTERS_STORAGE_KEY, 'activeTab', 'UNPAID')
  const [branchFilter, setBranchFilter] = usePersistedFilterState(FILTERS_STORAGE_KEY, 'branchFilter', ALL_BRANCHES)
  const [search, setSearch] = usePersistedFilterState(FILTERS_STORAGE_KEY, 'search', '')

  const [modal, setModal] = useState<Modal>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(today)
  const [payMethodId, setPayMethodId] = useState('')
  const [payRef, setPayRef] = useState('')
  const [payNotes, setPayNotes] = useState('')
  const [waiveReason, setWaiveReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 4000)
    return () => clearTimeout(t)
  }, [successMsg])

  const openModal = useCallback((next: NonNullable<Modal>) => {
    if (next.kind === 'pay') {
      setPayAmount(String(remainingOf(next.row)))
      setPayDate(today)
      setPayMethodId('')
      setPayRef('')
      setPayNotes('')
    }
    if (next.kind === 'waive') setWaiveReason('')
    setFormError(null)
    setModal(next)
    document.body.style.overflow = 'hidden'
  }, [today])

  const closeModal = useCallback(() => {
    setModal(null)
    setFormError(null)
    document.body.style.overflow = ''
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) closeModal()
    }
    if (modal) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modal, submitting, closeModal])

  // Pilihan cabang diturunkan dari data yang sudah dibatasi server, bukan dari daftar cabang
  // penuh: setiap opsi dijamin punya isi, dan tidak ada nama cabang yang bocor ke user yang
  // memang tidak berhak melihat barisnya.
  // Hanya cabang penerima yang jadi opsi. Kalau cabang pengirim ikut terdaftar,
  // memilihnya selalu menghasilkan tabel kosong — filternya kini cuma menyaring penerima.
  const branchOptions = useMemo<BranchOption[]>(() => {
    const map = new Map<number, string>()
    for (const p of payables) {
      if (p.debtorBranchName) map.set(p.debtorBranchId, p.debtorBranchName)
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'id-ID'))
  }, [payables])

  // Hanya sisi penerima (debitur) yang disaring — sama seperti pembatasan di query.
  const branchScoped = useMemo(() => {
    if (branchFilter === ALL_BRANCHES) return payables
    const id = Number(branchFilter)
    return payables.filter(p => p.debtorBranchId === id)
  }, [payables, branchFilter])

  const statusScoped = useMemo(() =>
    activeTab === 'all' ? branchScoped : branchScoped.filter(p => p.status === activeTab),
    [branchScoped, activeTab]
  )

  // Urutan mengikuti server (No. IBT terbaru dulu) — di sini hanya menyaring, tidak mengurut ulang.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return statusScoped
    return statusScoped.filter(p => {
      const hay = `${p.ibtNumber ?? ''} ${p.debtorBranchName ?? ''} ${p.creditorBranchName ?? ''} ${p.notes ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [statusScoped, search])

  // Kartu ringkasan & hitungan tab mengikuti filter cabang; kalau tidak, angkanya
  // akan membantah isi tabel begitu satu cabang dipilih.
  const outstandingRows = branchScoped.filter(isOutstanding)
  const totalUnpaid = outstandingRows.reduce((sum, p) => sum + remainingOf(p), 0)

  async function handlePay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (modal?.kind !== 'pay' || submitting) return
    const row = modal.row
    const amount = parseInt(payAmount, 10)
    const remaining = remainingOf(row)
    if (!payAmount || isNaN(amount) || amount <= 0) return setFormError('Nominal harus lebih dari 0')
    if (amount > remaining) return setFormError(`Nominal tidak boleh melebihi sisa hutang (${rupiah(remaining)})`)
    if (!payDate || payDate > today) return setFormError('Tanggal bayar tidak boleh melewati hari ini')
    if (!payMethodId) return setFormError('Pilih metode pembayaran')

    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch(`/api/bo/inter-branch-payables/${row.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          paymentMethodId: Number(payMethodId),
          paidDate: payDate,
          referenceNumber: payRef.trim() || undefined,
          notes: payNotes.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Terjadi kesalahan')
        return
      }
      closeModal()
      setSuccessMsg('Pembayaran dicatat — juga masuk Pendapatan & Pengeluaran kedua cabang')
      router.refresh()
    } catch {
      setFormError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleWaive(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (modal?.kind !== 'waive' || submitting) return
    const reason = waiveReason.trim()
    if (reason.length < 5) return setFormError('Alasan penghapusan wajib diisi (minimal 5 huruf)')

    setSubmitting(true)
    setFormError(null)
    try {
      const res = await fetch(`/api/bo/inter-branch-payables/${modal.row.id}/waive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Terjadi kesalahan')
        return
      }
      closeModal()
      setSuccessMsg(`Hutang ${modal.row.ibtNumber ?? ''} dihapuskan`)
      router.refresh()
    } catch {
      setFormError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  const payableColumns: ColumnDef<Payable>[] = [
    {
      accessorKey: 'ibtNumber',
      header: 'No. IBT',
      cell: ({ row }) => (
        <a
          href={`/purchase-orders/internal/${row.original.transferId}`}
          className="font-mono text-xs font-medium text-primary hover:underline whitespace-nowrap"
        >
          {row.original.ibtNumber ?? '-'}
        </a>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Tanggal',
      cell: ({ row }) => (
        <a
          href={`/purchase-orders/internal/${row.original.transferId}`}
          title={formatDateTime(row.original.createdAt)}
          className="text-muted-foreground hover:underline whitespace-nowrap"
        >
          {formatDateTime(row.original.createdAt)}
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
        const p = row.original
        if (p.status === 'WAIVED') return <div className="text-right text-muted-foreground">-</div>
        const sisa = remainingOf(p)
        return (
          <div className="text-right font-semibold whitespace-nowrap">
            {sisa > 0 ? <span className="text-red-600">{rupiah(sisa)}</span> : '-'}
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
        const hasHistory = p.payments.length > 0 || p.status === 'WAIVED'
        return (
          <div className="flex items-center justify-end gap-3">
            {hasHistory && (
              <button
                type="button"
                onClick={() => openModal({ kind: 'history', row: p })}
                className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline whitespace-nowrap"
              >
                {p.payments.length > 0 ? `Riwayat (${p.payments.length})` : 'Detail'}
              </button>
            )}
            {canWaive && isOutstanding(p) && (
              <button
                type="button"
                onClick={() => openModal({ kind: 'waive', row: p })}
                className="text-xs font-medium text-muted-foreground hover:text-destructive hover:underline whitespace-nowrap"
              >
                Hapus Hutang
              </button>
            )}
            {canPay && isOutstanding(p) && (
              <button
                type="button"
                onClick={() => openModal({ kind: 'pay', row: p })}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Belum Lunas</p>
          <p className="text-lg font-semibold text-red-600 mt-1">{rupiah(totalUnpaid)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{outstandingRows.length} transfer</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Transaksi</p>
          <p className="text-lg font-semibold text-foreground mt-1">{branchScoped.length}</p>
          {branchScoped.length !== payables.length && (
            <p className="text-xs text-muted-foreground mt-0.5">dari {payables.length} total</p>
          )}
        </div>
      </div>

      {/* Tabs + filter cabang */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div className="flex gap-1">
          {TABS.map(tab => {
            const count = tab.key === 'all' ? branchScoped.length : branchScoped.filter(p => p.status === tab.key).length
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
        <div className="flex items-center gap-2 mb-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari no. IBT atau cabang..."
            className="w-56 px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {branchOptions.length > 1 && (
            <select
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              aria-label="Filter cabang penerima"
              className="px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value={ALL_BRANCHES}>Semua Cabang Penerima</option>
              {branchOptions.map(b => (
                <option key={b.id} value={String(b.id)}>{b.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <DataTable
        data={filtered}
        columns={payableColumns}
        emptyMessage="Tidak ada data untuk filter ini."
        persistKey="po-internal-payables"
      />

      {modal?.kind === 'pay' && (
        <ModalShell title="Catat Pembayaran Hutang Internal" onClose={submitting ? undefined : closeModal}>
          <p className="text-sm text-muted-foreground mb-4">
            <span className="font-mono">{modal.row.ibtNumber ?? '-'}</span> · {modal.row.debtorBranchName} bayar ke{' '}
            {modal.row.creditorBranchName} — sisa hutang:{' '}
            <span className="font-semibold text-foreground">{rupiah(remainingOf(modal.row))}</span>
          </p>
          <FormError message={formError} />
          <form onSubmit={handlePay} className="space-y-4">
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
                <input type="date" value={payDate} max={today} onChange={e => setPayDate(e.target.value)} className={inputClass} required />
              </Field>
              <Field label="Metode Pembayaran" required>
                <select value={payMethodId} onChange={e => setPayMethodId(e.target.value)} className={inputClass} required>
                  <option value="">— Pilih —</option>
                  {paymentMethods.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="No. Bukti Transfer">
              <input type="text" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Opsional" maxLength={100} className={inputClass} />
            </Field>
            <Field label="Keterangan">
              <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Opsional" maxLength={500} className={inputClass} />
            </Field>
            <p className="text-xs text-muted-foreground">
              Pembayaran ini otomatis tercatat di Pendapatan &amp; Pengeluaran: pengeluaran di {modal.row.debtorBranchName},
              pemasukan di {modal.row.creditorBranchName}, pada tanggal bayar di atas.
            </p>
            <FormButtons onCancel={closeModal} submitting={submitting} submitLabel="Simpan" />
          </form>
        </ModalShell>
      )}

      {modal?.kind === 'waive' && (
        <ModalShell title="Hapus Hutang Internal" onClose={submitting ? undefined : closeModal}>
          <p className="text-sm text-muted-foreground mb-4">
            <span className="font-mono">{modal.row.ibtNumber ?? '-'}</span> · {modal.row.debtorBranchName} ke{' '}
            {modal.row.creditorBranchName} — sisa yang direlakan:{' '}
            <span className="font-semibold text-destructive">{rupiah(remainingOf(modal.row))}</span>
          </p>
          <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive space-y-1">
            <p className="font-medium">Tindakan ini tidak dapat dibatalkan. Yang terjadi:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>{modal.row.creditorBranchName} merelakan sisa tagihan — status menjadi Dihapus.</li>
              <li>Stok <strong>tidak</strong> kembali ke {modal.row.creditorBranchName}; barang tetap di {modal.row.debtorBranchName}.</li>
              <li>Nota penjualan &amp; pembayaran yang sudah tercatat tidak berubah.</li>
            </ul>
          </div>
          <FormError message={formError} />
          <form onSubmit={handleWaive} className="space-y-4">
            <Field label="Alasan Penghapusan" required>
              <textarea
                value={waiveReason}
                onChange={e => setWaiveReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Contoh: nilai IBT salah satuan (SAK tercatat PCS), hutang sebenarnya Rp 406.000"
                className={inputClass}
                required
              />
            </Field>
            <FormButtons onCancel={closeModal} submitting={submitting} submitLabel="Ya, Hapus Hutang" destructive />
          </form>
        </ModalShell>
      )}

      {modal?.kind === 'history' && (
        <ModalShell title="Riwayat Hutang Internal" onClose={closeModal} wide>
          <p className="text-sm text-muted-foreground mb-4">
            <span className="font-mono">{modal.row.ibtNumber ?? '-'}</span> · {modal.row.debtorBranchName} ke {modal.row.creditorBranchName}
          </p>

          {modal.row.status === 'WAIVED' && (
            <div className="mb-4 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <p className="font-medium text-foreground">Hutang dihapuskan</p>
              {modal.row.waive ? (
                <p className="text-muted-foreground mt-0.5">
                  {formatDateTime(modal.row.waive.at)} oleh {modal.row.waive.byName ?? '-'}
                  {modal.row.waive.reason && <> — &ldquo;{modal.row.waive.reason}&rdquo;</>}
                </p>
              ) : (
                <p className="text-muted-foreground mt-0.5">
                  Dihapus sebelum pencatatan alasan tersedia — siapa, kapan, dan alasannya tidak tercatat.
                </p>
              )}
            </div>
          )}

          {modal.row.payments.length > 0 ? (
            <div className="max-h-[50vh] overflow-auto border border-border rounded-md">
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
                  {modal.row.payments.map(pay => (
                    <tr key={pay.id} className="border-t border-border align-top">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(pay.paidAt)}</td>
                      <td className="px-3 py-2 text-right font-medium whitespace-nowrap">{rupiah(pay.amount)}</td>
                      <td className="px-3 py-2">{pay.methodName ?? <span className="text-muted-foreground">tidak tercatat</span>}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {pay.referenceNumber && <div>{pay.referenceNumber}</div>}
                        {pay.notes && <div>{pay.notes}</div>}
                        {!pay.referenceNumber && !pay.notes && '-'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{pay.paidByName ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada pembayaran.</p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex gap-6">
              <span className="text-muted-foreground">Total <span className="font-semibold text-foreground">{rupiah(modal.row.totalAmount)}</span></span>
              <span className="text-muted-foreground">Dibayar <span className="font-semibold text-green-600">{rupiah(modal.row.paidAmount)}</span></span>
              {modal.row.status !== 'WAIVED' && (
                <span className="text-muted-foreground">Sisa <span className="font-semibold text-red-600">{rupiah(remainingOf(modal.row))}</span></span>
              )}
            </div>
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm rounded-md border border-border text-foreground hover:bg-muted transition-colors"
            >
              Tutup
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  )
}

const inputClass = 'w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'

function ModalShell({ title, onClose, wide, children }: {
  title: string
  onClose?: () => void
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        className={`bg-background rounded-lg shadow-lg w-full ${wide ? 'max-w-2xl' : 'max-w-md'} mx-4 p-6`}
      >
        <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
        {children}
      </div>
    </div>
  )
}

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

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div role="alert" aria-live="assertive" className="mb-4 px-3 py-2 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive">
      {message}
    </div>
  )
}

function FormButtons({ onCancel, submitting, submitLabel, destructive }: {
  onCancel: () => void
  submitting: boolean
  submitLabel: string
  destructive?: boolean
}) {
  return (
    <div className="flex items-center justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        className="px-4 py-2 text-sm rounded-md border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
      >
        Batal
      </button>
      <button
        type="submit"
        disabled={submitting}
        className={`px-4 py-2 text-sm rounded-md transition-colors disabled:opacity-50 ${
          destructive
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        }`}
      >
        {submitting ? 'Menyimpan...' : submitLabel}
      </button>
    </div>
  )
}
