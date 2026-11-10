'use client'

import { useState } from 'react'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'
import { buildPromoDatesPayload, wibParts } from '@/lib/promo/promo-form'
import type { PromoView } from './types'

const inputClass =
  'w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60'

/**
 * Ubah masa berlaku promo. Waktu mulai terkunci begitu promo sudah mulai; isi promo lainnya
 * tidak bisa diubah di sini (pakai "Salin jadi promo baru").
 */
export default function PromoDatesDialog({
  promo, onClose, onSaved,
}: {
  promo: PromoView
  onClose: () => void
  onSaved: () => void
}) {
  const [now] = useState(() => new Date())
  const started = new Date(promo.startsAt).getTime() <= now.getTime()
  const ended = new Date(promo.endsAt).getTime() <= now.getTime()
  const start = wibParts(promo.startsAt)
  const end = wibParts(promo.endsAt)
  const [startDate, setStartDate] = useState(start.date)
  const [startTime, setStartTime] = useState(start.time)
  const [endDate, setEndDate] = useState(end.date)
  const [endTime, setEndTime] = useState(end.time)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const built = buildPromoDatesPayload({ startDate, startTime, endDate, endTime }, new Date())
    if ('error' in built) {
      setError(built.error)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/bo/promos/${promo.id}/dates`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(built.payload),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? `Gagal menyimpan (${res.status})`)
        return
      }
      onSaved()
    } catch {
      setError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <RequiredChoiceDialog
      title={`Ubah tanggal — ${promo.name}`}
      tone="warning"
      actions={[
        { label: 'Batal', variant: 'secondary', disabled: busy, onClick: onClose },
        { label: busy ? 'Menyimpan…' : 'Simpan tanggal', variant: 'primary', disabled: busy, onClick: () => { void save() } },
      ]}
    >
      <div className="space-y-3">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Mulai (WIB)</p>
          <div className="flex gap-2">
            <input type="date" className={inputClass} value={startDate} disabled={started} onChange={(e) => setStartDate(e.target.value)} aria-label="Tanggal mulai" />
            <input type="time" className={`${inputClass} w-32`} value={startTime} disabled={started} onChange={(e) => setStartTime(e.target.value)} aria-label="Jam mulai" />
          </div>
          {started && <p className="mt-1 text-xs text-muted-foreground">Promo sudah mulai, jadi waktu mulainya tidak bisa diubah.</p>}
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Berakhir (WIB)</p>
          <div className="flex gap-2">
            <input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-label="Tanggal berakhir" />
            <input type="time" className={`${inputClass} w-32`} value={endTime} onChange={(e) => setEndTime(e.target.value)} aria-label="Jam berakhir" />
          </div>
        </div>
        {ended && (
          <p className="text-sm">
            Promo ini sudah berakhir. Bila tanggal berakhirnya diperpanjang, promo <b>langsung berjalan lagi</b> di kasir
            {promo.quotaUsage.length > 0 && <> dengan <b>sisa kuota yang sama</b> (tidak kembali penuh — untuk kuota baru, pakai Salin jadi promo baru)</>}.
          </p>
        )}
        <p className="text-xs text-muted-foreground">Barang, potongan, cabang, dan kuota tidak berubah. Perubahan ini tercatat atas nama Anda.</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </RequiredChoiceDialog>
  )
}
