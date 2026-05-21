'use client'

import { useState } from 'react'
import type { TransactionWithDetails } from '@/app/pos/(authenticated)/history/page'
import TransactionDetailModal from './transaction-detail-modal'

interface TransactionHistoryClientProps {
  transactions: TransactionWithDetails[]
  branchName: string
  cashierName: string
}

function formatRupiahInt(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)
}

function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(dateStr))
}

export default function TransactionHistoryClient({
  transactions,
  branchName,
  cashierName,
}: TransactionHistoryClientProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | null>(null)

  return (
    <div className="flex flex-col h-[calc(100vh-64px-44px)] overflow-hidden print:hidden">
      {/* List header */}
      <div className="px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <p className="text-sm text-muted-foreground">
          {transactions.length === 0
            ? 'Belum ada transaksi pada shift ini'
            : `${transactions.length} transaksi pada shift aktif`}
        </p>
      </div>

      {/* Transaction list */}
      <div className="flex-1 overflow-y-auto">
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="text-4xl mb-3">🧾</div>
            <p className="text-base font-medium text-foreground mb-1">Belum Ada Transaksi</p>
            <p className="text-sm text-muted-foreground">Transaksi yang Anda proses pada shift ini akan muncul di sini.</p>
          </div>
        ) : (
          <ul>
            {transactions.map((tx) => {
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
                        <span className="font-semibold text-sm text-foreground truncate">
                          {tx.trxNumber}
                        </span>
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
                      <p className={`font-bold text-sm ${(isVoided || isPendingVoid) ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
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
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </div>
  )
}
