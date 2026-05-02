import React, { useEffect, useMemo, useState } from 'react'
import { POSLayout } from '@/components/layout/POSLayout'
import { historyService } from '@/services/history-service'
import { usePOSStore } from '@/store/pos-store'
import { formatRupiah } from '@/lib/utils'
import type { LocalTransaction } from '@/lib/db'
import { ClipboardList, Loader2, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { TransactionDetailDialog } from '@/components/history/TransactionDetailDialog'
import { PaymentMethod } from '@petshop/shared'

function formatDateForInput(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const HistoryPage: React.FC = () => {
  const { paymentMethods } = usePOSStore()
  const [transactions, setTransactions] = useState<LocalTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTransaction, setSelectedTransaction] = useState<LocalTransaction | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null)

  useEffect(() => {
    let isCancelled = false
    setSelectedShiftId(null)
    setIsLoading(true)
    historyService.getTransactionsByDate(selectedDate)
      .then((data) => {
        if (!isCancelled) {
          setTransactions(data)
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error(err)
          toast.error('Gagal memuat riwayat transaksi')
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [selectedDate])

  const getPaymentMethodName = (trx: LocalTransaction): string => {
    const payments = trx.payload?.payments ?? []
    if (payments.length === 0) return '—'
    if (payments.length > 1) return 'Split'
    const method = paymentMethods.find((m: PaymentMethod) => m.id === payments[0].paymentMethodId)
    return method?.name ?? '—'
  }

  const formatTime = (timestamp: number) => {
    if (!timestamp || isNaN(timestamp)) return '—'
    return new Date(timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  const shiftOptions = useMemo(() => {
    const shiftMap = new Map<number, number>() // shiftId → createdAt terkecil
    for (const trx of transactions) {
      const existing = shiftMap.get(trx.shiftId)
      if (existing === undefined || trx.createdAt < existing) {
        shiftMap.set(trx.shiftId, trx.createdAt)
      }
    }
    return Array.from(shiftMap.entries())
      .sort(([, a], [, b]) => a - b)
      .map(([shiftId, firstAt], i) => ({
        shiftId,
        label: `Shift ${i + 1} (${new Date(firstAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})`,
      }))
  }, [transactions])

  const shiftFilteredTransactions = useMemo(
    () =>
      selectedShiftId !== null
        ? transactions.filter((trx) => trx.shiftId === selectedShiftId)
        : transactions,
    [transactions, selectedShiftId]
  )

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return shiftFilteredTransactions
    return shiftFilteredTransactions.filter((trx) =>
      String(trx.customerName ?? '').toLowerCase().includes(q)
    )
  }, [shiftFilteredTransactions, searchQuery])
  const dateLabel = useMemo(
    () =>
      selectedDate.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [selectedDate]
  )

  const handleVoid = (updatedTx: LocalTransaction) => {
    setTransactions((prev) =>
      prev.map((trx) => (trx.id === updatedTx.id ? updatedTx : trx))
    )
    setSelectedTransaction(updatedTx) // refresh tampilan dialog jika masih terbuka
  }

  return (
    <POSLayout>
      <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="mb-8 pb-4 border-b border-white/5">
          <div className="flex items-center space-x-3 mb-1">
            <ClipboardList className="w-6 h-6 text-brand-400" />
            <h1 className="text-2xl font-black text-white">Riwayat Transaksi</h1>
          </div>
          <p className="text-neutral-500 text-sm font-medium">{dateLabel}</p>
        </div>

        {/* Filter Bar */}
        <div className="mb-6 flex gap-3 items-center">
          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Cari nama pelanggan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isLoading}
              maxLength={100}
              className="w-full pl-9 pr-9 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-brand-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Date Picker */}
          <input
            type="date"
            value={formatDateForInput(selectedDate)}
            max={formatDateForInput(new Date())}
            onChange={(e) => {
              if (e.target.value) {
                setSelectedDate(new Date(e.target.value + 'T00:00:00'))
              }
            }}
            disabled={isLoading}
            className="py-2.5 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed [color-scheme:dark]"
          />

          {/* Shift Filter */}
          <select
            value={selectedShiftId ?? ''}
            onChange={(e) =>
              setSelectedShiftId(e.target.value ? Number(e.target.value) : null)
            }
            disabled={isLoading || shiftOptions.length === 0}
            className="py-2.5 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed [color-scheme:dark] min-w-[140px]"
          >
            <option value="">Semua Shift</option>
            {shiftOptions.map(({ shiftId, label }) => (
              <option key={shiftId} value={shiftId}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ClipboardList className="w-12 h-12 text-neutral-700 mb-4" />
            {searchQuery ? (
              <>
                <p className="text-neutral-500 font-bold">Tidak ada transaksi untuk "{searchQuery}"</p>
                <p className="text-neutral-600 text-sm mt-1">Coba kata kunci lain atau kosongkan pencarian</p>
              </>
            ) : selectedShiftId !== null ? (
              <>
                <p className="text-neutral-500 font-bold">Tidak ada transaksi untuk shift ini</p>
                <p className="text-neutral-600 text-sm mt-1">Pilih shift lain atau tampilkan semua shift</p>
              </>
            ) : (
              <>
                <p className="text-neutral-500 font-bold">Tidak ada transaksi pada tanggal ini</p>
                <p className="text-neutral-600 text-sm mt-1">Transaksi yang diproses akan muncul di sini</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Table Header */}
            <div className="grid grid-cols-5 gap-4 px-4 py-2 text-[11px] font-black text-neutral-500 uppercase tracking-widest">
              <span>Waktu</span>
              <span>Nomor Struk</span>
              <span>Pelanggan</span>
              <span className="text-right">Total</span>
              <span>Metode Bayar</span>
            </div>

            {/* Transaction Rows */}
            {filteredTransactions.map((trx) => (
              <div
                key={trx.id}
                className={`grid grid-cols-5 gap-4 px-4 py-4 rounded-xl border transition-colors cursor-pointer
                  ${trx.status === 'VOID'
                    ? 'bg-red-500/5 border-red-500/15 hover:bg-red-500/10 opacity-70'
                    : 'bg-white/5 border-white/5 hover:bg-white/10'
                  }`}
                onClick={() => setSelectedTransaction(trx)}
              >
                <span className="text-sm font-mono text-neutral-300">{formatTime(trx.createdAt)}</span>
                <span className="text-sm font-bold text-white truncate flex items-center gap-1.5" title={trx.trxNumber}>
                  {trx.trxNumber}
                  {trx.status === 'VOID' && (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-400 uppercase tracking-wide leading-none shrink-0">
                      VOID
                    </span>
                  )}
                </span>
                <span className="text-sm text-neutral-400 truncate" title={trx.customerName || undefined}>{trx.customerName || '—'}</span>
                <span className="text-sm font-bold text-emerald-400 text-right">{formatRupiah(parseFloat(trx.totalAmount))}</span>
                <span className="text-sm text-neutral-300">{getPaymentMethodName(trx)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <TransactionDetailDialog
        transaction={selectedTransaction}
        paymentMethods={paymentMethods}
        onClose={() => setSelectedTransaction(null)}
        onVoid={handleVoid}
      />
    </POSLayout>
  )
}

export default HistoryPage
