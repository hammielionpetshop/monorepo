'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { TransactionWithDetails } from '@/app/pos/(authenticated)/history/page'
import TransactionDetailModal from './transaction-detail-modal'

interface TransactionHistoryClientProps {
  transactions: TransactionWithDetails[]
  branchName: string
  cashierName: string
  activeShiftId: number | null
  currentMode: 'shift' | 'date'
  currentFrom?: string
  currentTo?: string
  currentQ?: string
}

function formatRupiahInt(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export default function TransactionHistoryClient({
  transactions,
  branchName,
  cashierName,
  activeShiftId,
  currentMode,
  currentFrom,
  currentTo,
  currentQ,
}: TransactionHistoryClientProps) {
  const router = useRouter()
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | null>(null)
  const [searchQuery, setSearchQuery] = useState(currentQ ?? '')

  // State lokal untuk date picker (tidak langsung diapply ke URL)
  const today = useMemo(() => {
    const d = new Date()
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]
  }, [])

  const [localFrom, setLocalFrom] = useState(currentFrom ?? today)
  const [localTo, setLocalTo] = useState(currentTo ?? today)

  // Sync state lokal pencarian jika prop currentQ berubah dari navigasi luar
  useEffect(() => {
    setSearchQuery(currentQ ?? '')
  }, [currentQ])

  // Sync state lokal date jika prop URL berubah
  useEffect(() => {
    if (currentFrom) setLocalFrom(currentFrom)
    if (currentTo) setLocalTo(currentTo)
  }, [currentFrom, currentTo])

  // Debounced URL sync untuk server-side search (Opsi B)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery !== (currentQ ?? '')) {
        const params = new URLSearchParams(window.location.search)
        if (searchQuery.trim()) {
          params.set('q', searchQuery.trim())
        } else {
          params.delete('q')
        }
        router.push(`/pos/history?${params.toString()}`)
      }
    }, 450)

    return () => clearTimeout(delayDebounceFn)
  }, [searchQuery, currentQ, router])

  // Client-side filter instan (< 200ms) untuk respons cepat visual kasir
  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions
    const q = searchQuery.toLowerCase()
    return transactions.filter((tx) => tx.trxNumber.toLowerCase().includes(q))
  }, [transactions, searchQuery])

  function applyDateFilter() {
    if (!localFrom || !localTo || localFrom > localTo) return
    const params = new URLSearchParams()
    params.set('mode', 'date')
    params.set('from', localFrom)
    params.set('to', localTo)
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim())
    }
    router.push(`/pos/history?${params.toString()}`)
  }

  function resetToShiftMode() {
    const params = new URLSearchParams()
    if (searchQuery.trim()) {
      params.set('q', searchQuery.trim())
    }
    router.push(`/pos/history${params.toString() ? `?${params.toString()}` : ''}`)
  }

  // Label header dinamis sesuai dengan AC 1-3 & Task 4
  function getHeaderLabel(): string {
    const total = transactions.length
    const filtered = filteredTransactions.length
    const modeLabel =
      currentMode === 'date' && currentFrom && currentTo
        ? `dari ${formatDateLabel(currentFrom)} hingga ${formatDateLabel(currentTo)}`
        : 'shift aktif'

    if (searchQuery.trim() && filtered !== total) {
      return `Menampilkan ${filtered} dari ${total} transaksi (${modeLabel === 'shift aktif' ? 'shift aktif' : modeLabel})`
    }
    if (total === 0) {
      return currentMode === 'date'
        ? `Tidak ada transaksi ${modeLabel}`
        : 'Belum ada transaksi pada shift ini'
    }
    return `${total} transaksi ${modeLabel === 'shift aktif' ? 'pada shift aktif' : modeLabel}`
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px-44px)] overflow-hidden print:hidden">
      {/* Filter bar */}
      <div className="px-4 pt-3 pb-2 border-b border-border bg-card flex-shrink-0 space-y-2">
        {/* Search input */}
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nomor struk..."
          className="w-full border border-input rounded-lg px-3 py-2 text-sm min-h-[44px] bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />

        {/* Mode toggle: Shift Aktif vs Pilih Tanggal */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={resetToShiftMode}
            className={`flex-1 text-sm font-medium py-2 rounded-lg min-h-[44px] transition-colors ${
              currentMode === 'shift'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            Shift Aktif
          </button>
          <button
            type="button"
            onClick={() => {
              if (currentMode !== 'date') {
                const params = new URLSearchParams()
                params.set('mode', 'date')
                params.set('from', localFrom)
                params.set('to', localTo)
                if (searchQuery.trim()) {
                  params.set('q', searchQuery.trim())
                }
                router.push(`/pos/history?${params.toString()}`)
              }
            }}
            className={`flex-1 text-sm font-medium py-2 rounded-lg min-h-[44px] transition-colors ${
              currentMode === 'date'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            Pilih Tanggal
          </button>
        </div>

        {/* Date range picker — tampil hanya saat mode date */}
        {currentMode === 'date' && (
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Dari</label>
              <input
                type="date"
                value={localFrom}
                max={today}
                onChange={(e) => setLocalFrom(e.target.value)}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm min-h-[44px] bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Sampai</label>
              <input
                type="date"
                value={localTo}
                max={today}
                onChange={(e) => setLocalTo(e.target.value)}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm min-h-[44px] bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="button"
              onClick={applyDateFilter}
              disabled={!localFrom || !localTo || localFrom > localTo}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg min-h-[44px] disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              Terapkan
            </button>
          </div>
        )}

        {/* Summary label */}
        <p className="text-sm text-muted-foreground">{getHeaderLabel()}</p>
      </div>

      {/* Transaction list */}
      <div className="flex-1 overflow-y-auto">
        {filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="text-4xl mb-3">🧾</div>
            {searchQuery.trim() ? (
              <>
                <p className="text-base font-medium text-foreground mb-1">Tidak Ada Transaksi yang Cocok</p>
                <p className="text-sm text-muted-foreground">
                  Tidak ada transaksi dengan nomor struk &quot;{searchQuery}&quot;.
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-medium text-foreground mb-1">Belum Ada Transaksi</p>
                <p className="text-sm text-muted-foreground">
                  {currentMode === 'date'
                    ? 'Tidak ada transaksi pada rentang tanggal yang dipilih.'
                    : 'Transaksi yang Anda proses pada shift ini akan muncul di sini.'}
                </p>
              </>
            )}
          </div>
        ) : (
          <ul>
            {filteredTransactions.map((tx) => {
              const combinedPayments = tx.payments.map((p) => p.paymentMethodName).join(' + ') || '-'
              const isVoided = tx.status === 'VOIDED'
              const isPendingVoid = tx.status === 'PENDING_VOID'

              return (
                <li key={tx.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedTransaction(tx)}
                    className="w-full text-left px-4 py-4 border-b border-border hover:bg-accent active:bg-accent transition-colors min-h-[72px] flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-foreground truncate">{tx.trxNumber}</span>
                        {isVoided && (
                          <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full flex-shrink-0">
                            VOID
                          </span>
                        )}
                        {isPendingVoid && (
                          <span className="text-xs font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                            PENDING VOID
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground" suppressHydrationWarning>
                        {formatDateTime(tx.createdAt)}
                        {combinedPayments !== '-' ? ` · ${combinedPayments}` : ''}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className={`font-bold text-sm ${isVoided || isPendingVoid ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                      >
                        {formatRupiahInt(tx.payableAmount)}
                      </p>
                      <p className="text-xs text-muted-foreground">{tx.items.length} item</p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {selectedTransaction && (
        <TransactionDetailModal
          transaction={selectedTransaction}
          branchName={branchName}
          cashierName={cashierName}
          activeShiftId={activeShiftId}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </div>
  )
}
