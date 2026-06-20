'use client'

import { useState, useEffect, useCallback } from 'react'

type ShiftListItem = {
  id: number
  shiftNumber: number
  branchId: number
  branchName: string | null
  openedByName: string | null
  openedAt: string
  closedAt: string | null
  forceClosedAt: string | null
  status: string
  openingCash: number
  totalClosingCashReal: number | null
  totalClosingCashExpected: number | null
  totalVariance: number | null
  cashierCount: number
  settlementNotes: string | null
}

type CashierBreakdown = {
  cashierId: number
  cashierName: string | null
  totalSalesCash: number
  totalSalesQris: number
  totalSalesDebit: number
  totalSalesCredit: number
  totalSalesDebt: number
  totalSales: number
  totalTransactions: number
  totalExpenses: number
  modalShare: number | null
  expectedCash: number | null
  realCash: number | null
  variance: number | null
  isVarianceFlagged: boolean
}

type Expense = {
  id: number
  cashierName: string | null
  categoryName: string | null
  categoryCustom: string | null
  amount: number
  note: string
  proofImage: string | null
  createdAt: string
}

type Session = {
  id: number
  cashierName: string | null
  joinedAt: string
  stoppedAt: string | null
  status: string
}

type ShiftDetail = {
  shift: ShiftListItem & {
    openedByName: string | null
    closedByName: string | null
    forceClosedByName: string | null
  }
  breakdowns: CashierBreakdown[]
  expenses: Expense[]
  sessions: Session[]
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  OPEN: { label: 'Berlangsung', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  CLOSED: { label: 'Selesai', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  FORCE_CLOSED: { label: 'Ditutup Paksa', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
}

const SESSION_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Aktif',
  STOPPED: 'Selesai',
}

function formatRupiah(amount: number | null | undefined) {
  if (amount == null) return '-'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

function formatDateTime(dateStr: string | null | undefined) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABELS[status] ?? { label: status, className: 'bg-muted text-muted-foreground border-border' }
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-md border ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

function VarianceCell({ variance }: { variance: number | null }) {
  if (variance == null) return <span className="text-muted-foreground">-</span>
  const color = variance < 0 ? 'text-red-600' : variance > 0 ? 'text-green-600' : 'text-muted-foreground'
  return <span className={color}>{formatRupiah(variance)}</span>
}

export function ShiftHistoryClient({ branches }: { branches: { id: number; name: string }[] }) {
  const [data, setData] = useState<ShiftListItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ShiftDetail | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'breakdown' | 'expenses' | 'sessions'>('breakdown')
  const [proofImage, setProofImage] = useState<string | null>(null)

  const fetchList = useCallback(async (start: string, end: string, status: string, branch: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (start) params.set('startDate', start)
      if (end) params.set('endDate', end)
      if (status) params.set('status', status)
      if (branch) params.set('branchId', branch)
      const res = await fetch(`/api/bo/shifts?${params.toString()}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? 'Gagal mengambil data')
      }
      const json = await res.json()
      setData(json.data)
      setTotal(json.total)
    } catch (err) {
      setData([])
      setTotal(0)
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList('', '', '', '')
  }, [fetchList])

  function applyFilters() {
    if (startDate && endDate && startDate > endDate) {
      setError('Tanggal mulai tidak boleh lebih besar dari tanggal akhir')
      return
    }
    fetchList(startDate, endDate, statusFilter, branchFilter)
  }

  function resetFilters() {
    setStartDate('')
    setEndDate('')
    setStatusFilter('')
    setBranchFilter('')
    setError(null)
    fetchList('', '', '', '')
  }

  async function openDetail(id: number) {
    setSelectedId(id)
    setDetail(null)
    setDetailError(null)
    setActiveTab('breakdown')
    setIsDetailLoading(true)
    try {
      const res = await fetch(`/api/bo/shifts/${id}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? 'Gagal mengambil detail shift')
      }
      const json = await res.json()
      setDetail(json)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setIsDetailLoading(false)
    }
  }

  function closeDetail() {
    setSelectedId(null)
    setDetail(null)
    setDetailError(null)
    setProofImage(null)
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Tanggal Mulai</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Tanggal Akhir</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Cabang</label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
            >
              <option value="">Semua Cabang</option>
              {branches.map((b) => (
                <option key={b.id} value={String(b.id)}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
            >
              <option value="">Semua Status</option>
              <option value="OPEN">Berlangsung</option>
              <option value="CLOSED">Selesai</option>
              <option value="FORCE_CLOSED">Ditutup Paksa</option>
            </select>
          </div>
          <button
            onClick={applyFilters}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
          >
            Terapkan Filter
          </button>
          <button
            onClick={resetFilters}
            className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:bg-accent transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Shift list table */}
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <p className="text-sm">Tidak ada data shift untuk filter yang dipilih</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">No. Shift</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Cabang</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Dibuka Oleh</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Waktu Buka</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Waktu Tutup</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Modal Awal</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Kas Expected</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Kas Real</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Selisih</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Kasir</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {data.map((shift) => (
                  <tr
                    key={shift.id}
                    className="border-b border-border hover:bg-accent/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                      #{shift.shiftNumber}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {shift.branchName ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {shift.openedByName ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {formatDateTime(shift.openedAt)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {shift.status === 'CLOSED'
                        ? formatDateTime(shift.closedAt)
                        : shift.status === 'FORCE_CLOSED'
                          ? formatDateTime(shift.forceClosedAt)
                          : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={shift.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-foreground whitespace-nowrap">
                      {formatRupiah(shift.openingCash)}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground whitespace-nowrap">
                      {formatRupiah(shift.totalClosingCashExpected)}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground whitespace-nowrap">
                      {formatRupiah(shift.totalClosingCashReal)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <VarianceCell variance={shift.totalVariance} />
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground whitespace-nowrap">
                      {shift.cashierCount}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => openDetail(shift.id)}
                        className="px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-accent hover:text-foreground transition-colors text-muted-foreground"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Menampilkan {data.length} dari {total} shift
      </p>

      {/* Detail Modal */}
      {selectedId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <div
            className="bg-card border border-border rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col m-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <h3 className="text-lg font-semibold text-foreground">
                {detail ? `Detail Shift #${detail.shift.shiftNumber} — ${detail.shift.branchName ?? ''}` : 'Detail Shift'}
              </h3>
              <button
                onClick={closeDetail}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {isDetailLoading ? (
              <div className="p-8 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-8 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : detailError ? (
              <div className="p-6">
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive">
                  {detailError}
                </div>
              </div>
            ) : detail ? (
              <div className="overflow-y-auto flex-1">
                {/* Shift info */}
                <div className="px-6 py-4 border-b border-border">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                      <StatusBadge status={detail.shift.status} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Cabang</p>
                      <p className="text-foreground">{detail.shift.branchName ?? '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Jumlah Kasir</p>
                      <p className="text-foreground">{detail.shift.cashierCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Dibuka Oleh</p>
                      <p className="text-foreground">{detail.shift.openedByName ?? '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Waktu Buka</p>
                      <p className="text-foreground">{formatDateTime(detail.shift.openedAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Modal Awal</p>
                      <p className="text-foreground font-medium">{formatRupiah(detail.shift.openingCash)}</p>
                    </div>
                    {detail.shift.status === 'CLOSED' && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Ditutup Oleh</p>
                          <p className="text-foreground">{detail.shift.closedByName ?? '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Waktu Tutup</p>
                          <p className="text-foreground">{formatDateTime(detail.shift.closedAt)}</p>
                        </div>
                      </>
                    )}
                    {detail.shift.status === 'FORCE_CLOSED' && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Ditutup Paksa Oleh</p>
                          <p className="text-foreground">{detail.shift.forceClosedByName ?? '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Waktu Tutup</p>
                          <p className="text-foreground">{formatDateTime(detail.shift.forceClosedAt)}</p>
                        </div>
                      </>
                    )}
                    {detail.shift.status !== 'OPEN' && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Kas Expected</p>
                          <p className="text-foreground font-medium">{formatRupiah(detail.shift.totalClosingCashExpected)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Kas Real</p>
                          <p className="text-foreground font-medium">{formatRupiah(detail.shift.totalClosingCashReal)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-0.5">Selisih</p>
                          <p className="font-medium"><VarianceCell variance={detail.shift.totalVariance} /></p>
                        </div>
                      </>
                    )}
                    {detail.shift.settlementNotes && (
                      <div className="col-span-2 md:col-span-3">
                        <p className="text-xs text-muted-foreground mb-0.5">Catatan Settlement</p>
                        <p className="text-foreground">{detail.shift.settlementNotes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabs */}
                <div className="px-6 pt-4">
                  <div className="flex gap-1 border-b border-border">
                    {(['breakdown', 'expenses', 'sessions'] as const).map((tab) => {
                      const labels = { breakdown: 'Breakdown Kasir', expenses: 'Pengeluaran', sessions: 'Sesi Kasir' }
                      const counts = {
                        breakdown: detail.breakdowns.length,
                        expenses: detail.expenses.length,
                        sessions: detail.sessions.length,
                      }
                      return (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === tab
                              ? 'border-primary text-primary'
                              : 'border-transparent text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {labels[tab]}{' '}
                          <span className="text-xs">({counts[tab]})</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="px-6 py-4">
                  {/* Breakdown tab */}
                  {activeTab === 'breakdown' && (
                    detail.breakdowns.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        {detail.shift.status === 'OPEN'
                          ? 'Shift masih berlangsung. Breakdown tersedia setelah settlement.'
                          : 'Tidak ada data breakdown.'}
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/30">
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Kasir</th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Trx</th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Cash</th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">QRIS</th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Debit</th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Kredit</th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Utang</th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Total Jual</th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Pengeluaran</th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Kas Bersih</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.breakdowns.map((b) => (
                              <tr key={b.cashierId} className={`border-b border-border ${b.isVarianceFlagged ? 'bg-red-500/5' : ''}`}>
                                <td className="px-3 py-2 text-foreground whitespace-nowrap">
                                  {b.cashierName ?? `Kasir #${b.cashierId}`}
                                  {b.isVarianceFlagged && (
                                    <span className="ml-1 text-xs text-red-600">⚠</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right text-muted-foreground">{b.totalTransactions}</td>
                                <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{formatRupiah(b.totalSalesCash)}</td>
                                <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{formatRupiah(b.totalSalesQris)}</td>
                                <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{formatRupiah(b.totalSalesDebit)}</td>
                                <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{formatRupiah(b.totalSalesCredit)}</td>
                                <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{formatRupiah(b.totalSalesDebt)}</td>
                                <td className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">{formatRupiah(b.totalSales)}</td>
                                <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{formatRupiah(b.totalExpenses)}</td>
                                <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{formatRupiah(b.expectedCash)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}

                  {/* Expenses tab */}
                  {activeTab === 'expenses' && (
                    detail.expenses.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Tidak ada pengeluaran pada shift ini.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/30">
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Kasir</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Kategori</th>
                              <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Jumlah</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Catatan</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Waktu</th>
                              <th className="text-center px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Bukti</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.expenses.map((e) => (
                              <tr key={e.id} className="border-b border-border">
                                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{e.cashierName ?? '-'}</td>
                                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                                  {e.categoryName ?? e.categoryCustom ?? '-'}
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-foreground whitespace-nowrap">
                                  {formatRupiah(e.amount)}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">{e.note}</td>
                                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDateTime(e.createdAt)}</td>
                                <td className="px-3 py-2 text-center">
                                  {e.proofImage ? (
                                    <button
                                      onClick={() => setProofImage(e.proofImage)}
                                      className="text-xs text-primary underline hover:opacity-70"
                                    >
                                      Lihat
                                    </button>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}

                  {/* Sessions tab */}
                  {activeTab === 'sessions' && (
                    detail.sessions.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Tidak ada sesi kasir pada shift ini.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/30">
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Kasir</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Masuk</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Selesai</th>
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.sessions.map((s) => (
                              <tr key={s.id} className="border-b border-border">
                                <td className="px-3 py-2 text-foreground">{s.cashierName ?? '-'}</td>
                                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDateTime(s.joinedAt)}</td>
                                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDateTime(s.stoppedAt)}</td>
                                <td className="px-3 py-2">
                                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-md border ${
                                    s.status === 'ACTIVE'
                                      ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                      : 'bg-muted text-muted-foreground border-border'
                                  }`}>
                                    {SESSION_STATUS_LABELS[s.status] ?? s.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Proof image lightbox */}
      {proofImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80"
          onClick={() => setProofImage(null)}
        >
          <div className="relative max-w-lg max-h-[80vh] m-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setProofImage(null)}
              className="absolute -top-3 -right-3 bg-card text-foreground rounded-full w-7 h-7 flex items-center justify-center border border-border shadow"
            >
              &times;
            </button>
            {proofImage.startsWith('data:') || proofImage.startsWith('http') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={proofImage} alt="Bukti pengeluaran" className="max-w-full max-h-[80vh] rounded-lg object-contain" />
            ) : (
              <div className="bg-card rounded-lg p-4 text-sm text-muted-foreground break-all">
                {proofImage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
