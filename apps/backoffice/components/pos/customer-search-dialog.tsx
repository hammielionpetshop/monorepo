'use client'

import { useState, useEffect, useRef } from 'react'
import { useCartStore } from './cart-store'
import type { SelectedCustomer } from './cart-store'

interface CustomerSearchDialogProps {
  onClose: () => void
}

interface CustomerResult {
  id: number
  name: string
  phone: string | null
}

export default function CustomerSearchDialog({ onClose }: CustomerSearchDialogProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [addError, setAddError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const setSelectedCustomer = useCartStore((s) => s.setSelectedCustomer)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Tutup dengan ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Debounce search — 300ms, min 2 karakter
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setError('')
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/customers?q=${encodeURIComponent(trimmed)}&limit=20`)
        if (!res.ok) {
          setError('Gagal memuat daftar pelanggan')
          return
        }
        const data: CustomerResult[] = await res.json()
        setResults(data)
      } catch {
        setError('Terjadi kesalahan jaringan. Coba lagi.')
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const handleSelect = (customer: SelectedCustomer) => {
    setSelectedCustomer(customer)
    onClose()
  }

  const handleOpenAddForm = () => {
    setNewName(query.trim())
    setNewPhone('')
    setAddError('')
    setIsAdding(true)
  }

  const handleCancelAdd = () => {
    setIsAdding(false)
    setAddError('')
  }

  const handleSaveAndSelect = async () => {
    const trimmedName = newName.trim()
    if (!trimmedName) {
      setAddError('Nama pelanggan wajib diisi')
      return
    }
    setIsSaving(true)
    setAddError('')
    try {
      const res = await fetch('/api/bo/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName, phone: newPhone.trim() || undefined }),
      })
      const data: { id?: number; name?: string; error?: string } = await res.json()
      if (!res.ok) {
        setAddError(data.error ?? 'Gagal menyimpan pelanggan')
        return
      }
      if (data.id && data.name) {
        setSelectedCustomer({ id: data.id, name: data.name })
        onClose()
      }
    } catch {
      setAddError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-200"
        role="presentation"
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-md bg-card rounded-t-2xl md:rounded-2xl border border-border p-6 shadow-xl z-10 animate-in fade-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Pilih Pelanggan"
      >
        {/* Header */}
        <div className="mb-4 flex justify-between items-start flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-foreground">Pilih Pelanggan</h2>
            <p className="text-sm text-muted-foreground">Cari nama atau nomor HP</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-full transition-colors"
            aria-label="Tutup dialog"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search input — sembunyikan saat mode tambah */}
        {!isAdding && (
          <div className="mb-3 flex-shrink-0">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nama atau nomor HP pelanggan..."
              className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
              autoComplete="off"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
          </div>
        )}

        {/* Form tambah customer baru */}
        {isAdding ? (
          <div className="flex-1 flex flex-col gap-3 pt-1">
            <p className="text-sm text-muted-foreground -mt-1">Isi data pelanggan baru</p>

            {addError && (
              <div
                className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm"
                role="alert"
                aria-live="assertive"
              >
                {addError}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-foreground" htmlFor="new-customer-name">
                Nama <span className="text-destructive">*</span>
              </label>
              <input
                id="new-customer-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nama pelanggan"
                className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                autoComplete="off"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-foreground" htmlFor="new-customer-phone">
                Telepon <span className="text-muted-foreground font-normal">(opsional)</span>
              </label>
              <input
                id="new-customer-phone"
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Nomor HP"
                className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                autoComplete="off"
              />
            </div>

            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={handleSaveAndSelect}
                disabled={isSaving}
                className="flex-1 min-h-[44px] bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {isSaving ? 'Menyimpan...' : 'Simpan & Pilih'}
              </button>
              <button
                type="button"
                onClick={handleCancelAdd}
                disabled={isSaving}
                className="flex-1 min-h-[44px] rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-60"
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Results */}
            <div className="overflow-y-auto flex-1">
              {error && (
                <p className="text-sm text-destructive py-4 text-center" role="alert">{error}</p>
              )}

              {isLoading && (
                <p className="text-sm text-muted-foreground py-4 text-center">Mencari...</p>
              )}

              {!isLoading && !error && query.trim().length < 2 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Ketik minimal 2 karakter untuk mencari
                </p>
              )}

              {!isLoading && !error && query.trim().length >= 2 && results.length === 0 && (
                <div className="py-4 text-center flex flex-col items-center gap-3">
                  <p className="text-sm text-muted-foreground">Pelanggan tidak ditemukan</p>
                  <button
                    type="button"
                    onClick={handleOpenAddForm}
                    className="text-sm text-primary font-medium hover:underline transition-colors"
                  >
                    + Tambah &ldquo;{query.trim()}&rdquo; sebagai customer baru
                  </button>
                </div>
              )}

              {!isLoading && results.length > 0 && (
                <ul className="divide-y divide-border">
                  {results.map((customer) => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect({ id: customer.id, name: customer.name })}
                        className="w-full text-left px-2 py-3 hover:bg-accent rounded-lg transition-colors min-h-[52px] flex flex-col justify-center"
                      >
                        <p className="text-sm font-semibold text-foreground">{customer.name}</p>
                        {customer.phone && (
                          <p className="text-xs text-muted-foreground">{customer.phone}</p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Guest option */}
            <div className="mt-4 pt-4 border-t border-border flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[44px] text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Lanjut tanpa pilih pelanggan (Guest)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
