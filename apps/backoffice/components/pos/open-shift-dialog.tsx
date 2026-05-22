'use client'

import { useState, useEffect } from 'react'

interface PosUser {
  id: number
  name: string
  role: string
}

interface OpenShiftDialogProps {
  isOpen: boolean
  branchId: number
  cashierId: number
  onClose: () => void
  onSuccess: () => void
}

export default function OpenShiftDialog({
  isOpen,
  branchId,
  cashierId,
  onClose,
  onSuccess,
}: OpenShiftDialogProps) {
  const [openingCash, setOpeningCash] = useState('')
  const [targetEndTime, setTargetEndTime] = useState('')
  const [users, setUsers] = useState<PosUser[]>([])
  const [selectedCashiers, setSelectedCashiers] = useState<number[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)

  // Escape key handler to close the modal
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose, isSubmitting])

  // Fetch users with AbortController and async/await
  useEffect(() => {
    if (!isOpen) {
      // Clear/reset state on close to prevent state leakage
      setOpeningCash('')
      setTargetEndTime('')
      setUsers([])
      setSelectedCashiers([])
      setError('')
      setIsSubmitting(false)
      return
    }

    setError('')
    setIsLoadingUsers(true)
    const controller = new AbortController()

    async function fetchUsers() {
      try {
        const res = await fetch(`/api/pos/users?branchId=${branchId}`, {
          signal: controller.signal,
        })
        if (!res.ok) {
          throw new Error('Gagal memuat daftar kasir')
        }
        const data: PosUser[] = await res.json()
        setUsers(data)
        // Auto-select current cashier if present in the list
        const selfInList = data.find((u) => u.id === cashierId)
        setSelectedCashiers(selfInList ? [cashierId] : [])
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError('Gagal memuat daftar kasir')
        }
      } finally {
        setIsLoadingUsers(false)
      }
    }

    fetchUsers()

    return () => {
      controller.abort()
    }
  }, [isOpen, branchId, cashierId])

  const toggleCashier = (userId: number) => {
    setSelectedCashiers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    const openingCashInt = Number(openingCash)
    if (isNaN(openingCashInt) || openingCashInt <= 0) {
      setError('Modal awal harus lebih dari 0')
      return
    }
    if (!Number.isInteger(openingCashInt)) {
      setError('Modal awal harus berupa bilangan bulat')
      return
    }
    if (selectedCashiers.length === 0) {
      setError('Pilih minimal satu kasir')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      // 1. POST: Buka shift baru
      const res = await fetch('/api/pos/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          openingCash: openingCashInt,
          assignedCashiers: selectedCashiers,
          openedById: cashierId,
          targetEndTime: targetEndTime || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Gagal membuka shift')
        setIsSubmitting(false)
        return
      }

      const newShift = await res.json()

      // 2. Client-side auto-join if the logged-in user is assigned to the new shift
      if (selectedCashiers.includes(cashierId) && newShift?.id) {
        const joinRes = await fetch(`/api/pos/shifts/${newShift.id}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cashierId }),
        })

        if (!joinRes.ok) {
          const joinData = await joinRes.json()
          setError(
            joinData.error ??
              'Shift berhasil dibuka, tetapi gagal bergabung otomatis. Silakan coba bergabung manual.'
          )
          setIsSubmitting(false)
          return
        }
      }

      onSuccess()
      onClose()
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-xl overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 id="dialog-title" className="text-lg font-bold text-foreground">
            Buka Shift Baru
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Modal Awal */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Modal Awal (Rupiah)
            </label>
            <input
              type="number"
              min="1"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              placeholder="Contoh: 500000"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
              required
            />
          </div>

          {/* Target Selesai (Opsional) */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Target Selesai (Opsional)
            </label>
            <input
              type="time"
              value={targetEndTime}
              onChange={(e) => setTargetEndTime(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            />
          </div>

          {/* Pilih Kasir */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Kasir yang Bertugas
            </label>
            {isLoadingUsers ? (
              <p className="text-sm text-muted-foreground">Memuat daftar kasir...</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada kasir ditemukan</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto border border-border rounded-lg p-2 bg-background">
                {users.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted min-h-[44px]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCashiers.includes(user.id)}
                      onChange={() => toggleCashier(user.id)}
                      className="w-4 h-4 accent-primary rounded border-border"
                    />
                    <span className="text-sm text-foreground flex-1">{user.name}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {user.role}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 border border-border text-foreground font-medium rounded-lg min-h-[44px] px-4 py-2 hover:bg-muted transition-colors disabled:opacity-60"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoadingUsers}
              className="flex-1 bg-primary text-primary-foreground font-semibold rounded-lg min-h-[44px] px-4 py-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {isSubmitting ? 'Memproses...' : 'Konfirmasi Buka Shift'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
