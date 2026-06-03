'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ExpenseDialog from './expense-dialog'

interface ShiftInfo {
  id: number
  shiftNumber: number
  openedAt: Date | string
  openingCash: number
  targetEndTime?: Date | string | null
}

interface ShiftDashboardClientProps {
  shift: ShiftInfo | null
  cashierId: number
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)

const formatTime = (date: Date | string | null | undefined) => {
  if (!date) return '-'
  try {
    if (typeof date === 'string' && /^\d{2}:\d{2}$/.test(date)) return date
    const parsed = new Date(date)
    if (isNaN(parsed.getTime())) return '-'
    return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(parsed)
  } catch {
    return '-'
  }
}

export default function ShiftDashboardClient({ shift, cashierId }: ShiftDashboardClientProps) {
  const router = useRouter()
  const [expenseOpen, setExpenseOpen] = useState(false)

  if (!shift) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px-44px)] p-6">
        <div className="text-5xl mb-4">⏳</div>
        <h2 className="text-xl font-bold text-foreground mb-2">Tidak Ada Shift Aktif</h2>
        <p className="text-base text-muted-foreground text-center">
          Belum ada shift aktif atau Anda belum bergabung ke shift.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-sm mx-auto">
      <h2 className="text-lg font-bold text-foreground mb-4">Info Shift</h2>

      <div className="bg-card border border-border rounded-lg p-4 mb-6 space-y-3">
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Shift</span>
          <span className="text-sm font-semibold text-foreground">#{shift.shiftNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Jam Buka</span>
          <span className="text-sm font-medium text-foreground">{formatTime(shift.openedAt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-muted-foreground">Modal Awal</span>
          <span className="text-sm font-medium text-foreground">{formatCurrency(shift.openingCash)}</span>
        </div>
        {shift.targetEndTime && (
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Target Selesai</span>
            <span className="text-sm font-medium text-foreground">{formatTime(shift.targetEndTime)}</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setExpenseOpen(true)}
          className="w-full flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          <span>💸</span>
          Catat Expense
        </button>

        <Link
          href="/pos/settlement"
          className="w-full flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors"
        >
          <span>🔒</span>
          Settlement / Tutup Shift
        </Link>
      </div>

      {expenseOpen && (
        <ExpenseDialog
          shiftId={shift.id}
          cashierId={cashierId}
          onClose={() => setExpenseOpen(false)}
          onSuccess={() => {
            setExpenseOpen(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
