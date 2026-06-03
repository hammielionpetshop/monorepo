'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ActiveShift } from './pos-client'
import OpenShiftDialog from './open-shift-dialog'

interface ShiftGateClientProps {
  shift: ActiveShift | null
  isAssigned: boolean
  isCashierInShift: boolean
  cashierId: number
  branchId: number
  userRole: string
}

export default function ShiftGateClient({
  shift,
  isAssigned,
  isCashierInShift,
  cashierId,
  branchId,
  userRole,
}: ShiftGateClientProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [openShiftDialogOpen, setOpenShiftDialogOpen] = useState(false)

  const canOpenShift = true

  const handleJoin = async () => {
    if (!shift || isLoading) return
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/pos/shifts/${shift.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cashierId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Gagal bergabung ke shift')
        setIsLoading(false)
        return
      }
      router.refresh()
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
      setIsLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value)
  }

  const formatTime = (date: Date | string | null | undefined) => {
    if (!date) return '-'
    try {
      // If it is already a simple time string like "HH:mm", return it as is
      if (typeof date === 'string' && /^\d{2}:\d{2}$/.test(date)) {
        return date
      }

      const parsedDate = new Date(date)
      if (isNaN(parsedDate.getTime())) {
        return '-'
      }
      return new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(parsedDate)
    } catch {
      return '-'
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px-44px)] p-6">
      <div className="w-full max-w-sm">
        {/* Case A: Tidak ada shift aktif */}
        {!shift && (
          <div className="text-center">
            <div className="text-5xl mb-4">⏳</div>
            <h2 className="text-xl font-bold text-foreground mb-2">Belum Ada Shift Aktif</h2>
            {canOpenShift ? (
              <>
                <p className="text-base text-muted-foreground mb-6">
                  Tidak ada shift aktif untuk cabang ini. Buka shift baru untuk mulai beroperasi.
                </p>
                <button
                  onClick={() => setOpenShiftDialogOpen(true)}
                  className="w-full bg-primary text-primary-foreground font-semibold rounded-lg min-h-[44px] px-6 py-3 hover:bg-primary/90 transition-colors"
                >
                  Buka Shift Baru
                </button>
              </>
            ) : (
              <p className="text-base text-muted-foreground">
                Tidak ada shift aktif untuk cabang ini. Hubungi Manager untuk membuka shift terlebih dahulu.
              </p>
            )}
          </div>
        )}

        {/* Case B: Shift ada, kasir ditugaskan, belum join */}
        {shift && isAssigned && (
          <div className="text-center">
            <div className="text-5xl mb-4">👋</div>
            <h2 className="text-xl font-bold text-foreground mb-4">Shift Aktif</h2>

            <div className="bg-card border border-border rounded-lg p-4 mb-6 text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Shift</span>
                <span className="text-sm font-medium text-foreground">#{shift.shiftNumber}</span>
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

            {error && (
              <p className="text-sm text-destructive mb-3">{error}</p>
            )}

            <button
              onClick={handleJoin}
              disabled={isLoading}
              className="w-full bg-primary text-primary-foreground font-semibold rounded-lg min-h-[44px] px-6 py-3 hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {isLoading ? 'Memproses...' : 'Mulai Kerja / Gabung Shift'}
            </button>
          </div>
        )}

        {/* Case C: Shift ada, kasir tidak ditugaskan */}
        {shift && !isAssigned && (
          <div className="text-center">
            <div className="text-5xl mb-4">🚫</div>
            <h2 className="text-xl font-bold text-destructive mb-2">Akses Dibatasi</h2>
            <p className="text-base text-muted-foreground">
              Anda tidak ditugaskan di shift ini. Hubungi Manager untuk mendapatkan akses ke shift ini.
            </p>
          </div>
        )}
      </div>

      <OpenShiftDialog
        isOpen={openShiftDialogOpen}
        branchId={branchId}
        cashierId={cashierId}
        onClose={() => setOpenShiftDialogOpen(false)}
        onSuccess={() => router.refresh()}
      />
    </div>
  )
}
