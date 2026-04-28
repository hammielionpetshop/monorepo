import React, { useEffect, useState } from 'react'
import { POSLayout } from '@/components/layout/POSLayout'
import { historyService } from '@/services/history-service'
import { usePOSStore } from '@/store/pos-store'
import { formatRupiah } from '@/lib/utils'
import type { LocalTransaction } from '@/lib/db'
import { ClipboardList, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { TransactionDetailDialog } from '@/components/history/TransactionDetailDialog'
import { PaymentMethod } from '@petshop/shared'

export const HistoryPage: React.FC = () => {
  const { paymentMethods } = usePOSStore()
  const [transactions, setTransactions] = useState<LocalTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTransaction, setSelectedTransaction] = useState<LocalTransaction | null>(null)

  useEffect(() => {
    historyService.getTodayTransactions()
      .then(setTransactions)
      .catch((err) => {
        console.error(err)
        toast.error('Gagal memuat riwayat transaksi')
      })
      .finally(() => setIsLoading(false))
  }, [])

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

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <POSLayout>
      <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="mb-8 pb-4 border-b border-white/5">
          <div className="flex items-center space-x-3 mb-1">
            <ClipboardList className="w-6 h-6 text-brand-400" />
            <h1 className="text-2xl font-black text-white">Riwayat Transaksi</h1>
          </div>
          <p className="text-neutral-500 text-sm font-medium">{today}</p>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ClipboardList className="w-12 h-12 text-neutral-700 mb-4" />
            <p className="text-neutral-500 font-bold">Tidak ada transaksi hari ini</p>
            <p className="text-neutral-600 text-sm mt-1">Transaksi yang diproses akan muncul di sini</p>
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
            {transactions.map((trx) => (
              <div
                key={trx.id}
                className="grid grid-cols-5 gap-4 px-4 py-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => setSelectedTransaction(trx)}
              >
                <span className="text-sm font-mono text-neutral-300">{formatTime(trx.createdAt)}</span>
                <span className="text-sm font-bold text-white truncate" title={trx.trxNumber}>{trx.trxNumber}</span>
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
      />
    </POSLayout>
  )
}

export default HistoryPage
