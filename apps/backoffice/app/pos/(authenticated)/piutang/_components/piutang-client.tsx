'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, HandCoins, Loader2, Search } from 'lucide-react'
import { formatRupiahInput, parseRupiahInput } from '@/lib/number-input'
import type {
  PayAtPosResult,
  PiutangPaymentMethod,
  PosCustomerDebtDetail,
  PosDebtor,
} from './types'

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatTanggal(iso: string, withTime = false): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

interface PiutangClientProps {
  paymentMethods: PiutangPaymentMethod[]
  hasOpenShift: boolean
  initialCustomerId: number | null
}

export default function PiutangClient({ paymentMethods, hasOpenShift, initialCustomerId }: PiutangClientProps) {
  const [query, setQuery] = useState('')
  const [debtors, setDebtors] = useState<PosDebtor[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [selectedId, setSelectedId] = useState<number | null>(initialCustomerId)
  const [detail, setDetail] = useState<PosCustomerDebtDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const defaultMethodId = paymentMethods.find((m) => m.type === 'CASH')?.id ?? paymentMethods[0]?.id ?? 0
  const [amountText, setAmountText] = useState('')
  const [methodId, setMethodId] = useState(defaultMethodId)
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [payError, setPayError] = useState('')
  const [success, setSuccess] = useState<(PayAtPosResult & { customerName: string }) | null>(null)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const loadDebtors = useCallback(async (q: string) => {
    setListLoading(true)
    setListError('')
    try {
      const res = await fetch(`/api/pos/debts?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok) {
        setListError(data.error ?? 'Gagal memuat daftar piutang')
        return
      }
      setDebtors(data)
    } catch {
      setListError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setListLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (customerId: number) => {
    setDetailLoading(true)
    setDetailError('')
    try {
      const res = await fetch(`/api/pos/customers/${customerId}/debts`)
      const data = await res.json()
      if (!res.ok) {
        setDetail(null)
        setDetailError(data.error ?? 'Gagal memuat piutang pelanggan')
        return
      }
      setDetail(data)
    } catch {
      setDetailError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadDebtors(query.trim()), query ? 300 : 0)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, loadDebtors])

  useEffect(() => {
    setAmountText('')
    setNote('')
    setConfirming(false)
    setPayError('')
    if (selectedId === null) {
      setDetail(null)
      return
    }
    loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const amount = parseRupiahInput(amountText)
  const outstanding = detail?.outstanding ?? 0
  const amountInvalid = amount <= 0 || amount > outstanding
  const selectedMethod = paymentMethods.find((m) => m.id === methodId)

  const handleSelect = (customerId: number) => {
    setSuccess(null)
    setSelectedId(customerId)
  }

  const handleSubmit = async () => {
    if (!detail || amountInvalid || !methodId) return
    if (!confirming) {
      setConfirming(true)
      return
    }
    setSubmitting(true)
    setPayError('')
    try {
      const res = await fetch(`/api/pos/customers/${detail.customer.id}/debts/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, paymentMethodId: methodId, note: note.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPayError(data.error ?? 'Gagal mencatat pelunasan')
        setConfirming(false)
        return
      }
      setSuccess({ ...(data as PayAtPosResult), customerName: detail.customer.name })
      setAmountText('')
      setNote('')
      setConfirming(false)
      await Promise.all([loadDetail(detail.customer.id), loadDebtors(query.trim())])
    } catch {
      setPayError('Terjadi kesalahan jaringan. Periksa riwayat pembayaran sebelum mencoba lagi.')
      setConfirming(false)
    } finally {
      setSubmitting(false)
    }
  }

  const now = Date.now()

  return (
    <div className="flex flex-col md:flex-row min-h-0 h-full">
      {/* Daftar pelanggan berpiutang */}
      <section
        className={`md:w-80 lg:w-96 md:border-r border-border flex-col min-h-0 ${selectedId !== null ? 'hidden md:flex' : 'flex'}`}
        aria-label="Daftar pelanggan berpiutang"
      >
        <div className="p-4 border-b border-border">
          <Link
            href="/pos"
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" /> Kembali ke Kasir
          </Link>
          <h1 className="text-base font-bold text-foreground">Piutang Pelanggan</h1>
          <p className="text-xs text-muted-foreground">Hanya piutang cabang ini</p>
          <div className="relative mt-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau nomor HP..."
              className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {listLoading && debtors.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">Memuat...</p>
          ) : listError ? (
            <p className="p-4 text-sm text-destructive text-center" role="alert">{listError}</p>
          ) : debtors.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">
              {query.trim() ? 'Tidak ada pelanggan berpiutang yang cocok' : 'Tidak ada piutang aktif'}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {debtors.map((d) => (
                <li key={d.customerId}>
                  <button
                    type="button"
                    onClick={() => handleSelect(d.customerId)}
                    aria-current={selectedId === d.customerId ? 'true' : undefined}
                    className={`w-full text-left px-4 py-3 min-h-[56px] flex items-center justify-between gap-3 transition-colors ${
                      selectedId === d.customerId ? 'bg-primary/10' : 'hover:bg-accent'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground truncate">{d.name}</span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {d.debtCount} nota · sejak {formatTanggal(d.oldestAt)}
                        {d.phone ? ` · ${d.phone}` : ''}
                      </span>
                    </span>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400 tabular-nums flex-shrink-0">
                      {formatRupiah(d.outstanding)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Detail & form pelunasan */}
      <section
        className={`flex-1 min-w-0 flex-col min-h-0 overflow-y-auto ${selectedId === null ? 'hidden md:flex' : 'flex'}`}
        aria-label="Detail piutang"
      >
        {success && (
          <div
            className="m-4 mb-0 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200"
            role="status"
          >
            Pelunasan {formatRupiah(success.totalPaid)} dari {success.customerName} tercatat
            {success.settledCount > 0 ? ` — ${success.settledCount} nota lunas` : ''}. Sisa piutang:{' '}
            <span className="font-bold">{formatRupiah(success.remainingOutstanding)}</span>
          </div>
        )}

        {selectedId === null ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <HandCoins className="w-10 h-10 mb-2 opacity-50" aria-hidden="true" />
            <p className="text-sm">Pilih pelanggan untuk melihat dan mencatat pelunasan piutang</p>
          </div>
        ) : detailLoading && !detail ? (
          <p className="p-6 text-sm text-muted-foreground text-center">Memuat...</p>
        ) : detailError ? (
          <div className="p-6 text-center">
            <p className="text-sm text-destructive" role="alert">{detailError}</p>
            <button type="button" onClick={() => setSelectedId(null)} className="mt-3 text-sm text-primary hover:underline">
              Kembali
            </button>
          </div>
        ) : detail ? (
          <div className="p-4 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="md:hidden mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Daftar piutang
                </button>
                <h2 className="text-lg font-bold text-foreground truncate">{detail.customer.name}</h2>
                {detail.customer.phone && <p className="text-sm text-muted-foreground">{detail.customer.phone}</p>}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-muted-foreground">Total piutang</p>
                <p className="text-xl font-bold text-red-600 dark:text-red-400 tabular-nums">
                  {formatRupiah(detail.outstanding)}
                </p>
              </div>
            </div>

            {detail.debts.length === 0 ? (
              <p className="rounded-lg border border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Pelanggan ini tidak punya piutang aktif.
              </p>
            ) : (
              <>
                <div className="rounded-lg border border-border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Tanggal</th>
                        <th className="text-left font-medium px-3 py-2">Nota</th>
                        <th className="text-left font-medium px-3 py-2">Jatuh tempo</th>
                        <th className="text-right font-medium px-3 py-2">Total</th>
                        <th className="text-right font-medium px-3 py-2">Sisa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {detail.debts.map((d) => {
                        const overdue = d.dueAt !== null && new Date(d.dueAt).getTime() < now
                        return (
                          <tr key={d.id}>
                            <td className="px-3 py-2 whitespace-nowrap">{formatTanggal(d.createdAt)}</td>
                            <td className="px-3 py-2">
                              <span className="block font-mono text-xs">{d.trxNumber ?? 'Manual'}</span>
                              {d.note && <span className="block text-xs text-muted-foreground">{d.note}</span>}
                            </td>
                            <td className={`px-3 py-2 whitespace-nowrap ${overdue ? 'text-red-600 dark:text-red-400 font-medium' : ''}`}>
                              {d.dueAt ? formatTanggal(d.dueAt) : '—'}
                              {overdue && <span className="block text-[11px]">Lewat tempo</span>}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                              {formatRupiah(d.totalAmount)}
                              {d.paidAmount > 0 && (
                                <span className="block text-[11px] text-muted-foreground">
                                  dibayar {formatRupiah(d.paidAmount)}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap">
                              {formatRupiah(d.remainingAmount)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <form
                  className="rounded-lg border border-border p-4 flex flex-col gap-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSubmit()
                  }}
                >
                  <h3 className="text-sm font-bold text-foreground">Terima Pembayaran</h3>
                  <p className="text-xs text-muted-foreground -mt-2">
                    Pembayaran dialokasikan ke nota paling lama lebih dulu.
                  </p>

                  {!hasOpenShift && (
                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                      Belum ada shift aktif di cabang ini.{' '}
                      <Link href="/pos/shift" className="font-medium underline">Buka shift</Link> dulu untuk menerima
                      pembayaran.
                    </div>
                  )}

                  {payError && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm" role="alert">
                      {payError}
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label htmlFor="piutang-amount" className="text-xs font-medium text-foreground">Nominal</label>
                    <div className="flex gap-2">
                      <input
                        id="piutang-amount"
                        inputMode="numeric"
                        value={amountText}
                        onChange={(e) => {
                          setAmountText(formatRupiahInput(e.target.value))
                          setConfirming(false)
                        }}
                        placeholder="0"
                        className="flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-2.5 text-right text-base font-semibold tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAmountText(formatRupiahInput(detail.outstanding))
                          setConfirming(false)
                        }}
                        className="min-h-[44px] px-3 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-accent flex-shrink-0"
                      >
                        Lunasi semua
                      </button>
                    </div>
                    {amount > outstanding && (
                      <p className="text-xs text-destructive">Nominal melebihi total piutang ({formatRupiah(outstanding)})</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-foreground">Metode pembayaran</span>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Metode pembayaran">
                      {paymentMethods.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          role="radio"
                          aria-checked={methodId === m.id}
                          onClick={() => {
                            setMethodId(m.id)
                            setConfirming(false)
                          }}
                          className={`min-h-[40px] px-3 rounded-lg border text-sm font-medium transition-colors ${
                            methodId === m.id
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-foreground hover:bg-accent'
                          }`}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="piutang-note" className="text-xs font-medium text-foreground">
                      Keterangan <span className="text-muted-foreground font-normal">(opsional)</span>
                    </label>
                    <input
                      id="piutang-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={255}
                      className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                      autoComplete="off"
                    />
                  </div>

                  <div className="flex gap-2">
                    {confirming && (
                      <button
                        type="button"
                        onClick={() => setConfirming(false)}
                        disabled={submitting}
                        className="min-h-[48px] px-4 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent disabled:opacity-60"
                      >
                        Batal
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={!hasOpenShift || amountInvalid || !methodId || submitting}
                      className="flex-1 min-h-[48px] rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                      {submitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                      {confirming
                        ? `Konfirmasi terima ${formatRupiah(amount)} (${selectedMethod?.name ?? ''})`
                        : 'Terima Pembayaran'}
                    </button>
                  </div>
                </form>
              </>
            )}

            {detail.recentPayments.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-foreground mb-2">Riwayat pembayaran terakhir</h3>
                <ul className="rounded-lg border border-border divide-y divide-border text-sm">
                  {detail.recentPayments.map((p) => (
                    <li key={p.id} className={`px-3 py-2 flex items-start justify-between gap-3 ${p.voided ? 'opacity-50' : ''}`}>
                      <span className="min-w-0">
                        <span className="block">
                          {formatTanggal(p.createdAt, true)} · {p.paymentMethodName}
                          {p.voided && <span className="ml-1 text-xs font-medium text-destructive">(dibatalkan)</span>}
                        </span>
                        <span className="block text-xs text-muted-foreground truncate">
                          {[p.trxNumber ?? 'Manual', p.branchName, p.receivedByName, p.note].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className={`tabular-nums font-semibold flex-shrink-0 ${p.voided ? 'line-through' : ''}`}>
                        {formatRupiah(p.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : null}
      </section>
    </div>
  )
}
