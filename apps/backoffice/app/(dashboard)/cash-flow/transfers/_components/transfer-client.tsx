'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatWIB } from '@petshop/shared'
import { digitsOnly, formatRupiahInput } from '@/lib/number-input'
import { ProofPhotoField, ProofPhotoLink } from '@/components/ui/proof-photo-field'
import { NewBadge } from '@/components/ui/new-badge'

export interface TransferPlace {
  id: number
  name: string
  kind: 'CASH' | 'BANK'
  branchName: string | null
}

interface TransferRow {
  id: number
  fromName: string
  toName: string
  amount: number
  occurredOn: string
  note: string | null
  proofPhotoUrl: string | null
  createdByName: string | null
  cancelledAt: string | null
  cancelledByName: string | null
  cancelReason: string | null
  canCancel: boolean
}

const IDR = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
const inputClass = 'w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30'

function formatDate(value: string): string {
  return formatWIB(`${value}T12:00:00+07:00`, { day: '2-digit', month: 'short', year: 'numeric' })
}

function placeLabel(p: TransferPlace): string {
  return `${p.name} (${p.kind === 'CASH' ? 'Tunai' : 'Rekening'})`
}

export default function TransferClient({ places, canRecord, isOwner, today }: { places: TransferPlace[]; canRecord: boolean; isOwner: boolean; today: string }) {
  const [rows, setRows] = useState<TransferRow[]>([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`)
  const [to, setTo] = useState(today)
  const [showCancelled, setShowCancelled] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const [fromPlace, setFromPlace] = useState('')
  const [toPlace, setToPlace] = useState('')
  const [amount, setAmount] = useState('')
  const [occurredOn, setOccurredOn] = useState(today)
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [cancelTarget, setCancelTarget] = useState<TransferRow | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const minDate = useMemo(() => {
    if (isOwner) return undefined
    const d = new Date(`${today}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 7)
    return d.toISOString().slice(0, 10)
  }, [today, isOwner])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ from, to })
      if (showCancelled) qs.set('includeCancelled', '1')
      const res = await fetch(`/api/bo/cash-flow/transfers?${qs.toString()}`)
      if (!res.ok) return setMessage({ ok: false, text: 'Gagal memuat daftar Pindah Dana' })
      setRows(await res.json())
    } catch {
      setMessage({ ok: false, text: 'Gagal memuat daftar Pindah Dana' })
    } finally {
      setLoading(false)
    }
  }, [from, to, showCancelled])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(t)
  }, [message])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setFormError(null)
    const amountNum = Number(amount)
    if (!fromPlace || !toPlace) return setFormError('Pilih Tempat Uang asal dan tujuan')
    if (fromPlace === toPlace) return setFormError('Asal dan tujuan tidak boleh sama')
    if (!amount || !Number.isInteger(amountNum) || amountNum <= 0) return setFormError('Jumlah harus lebih dari 0')
    if (photoUploading) return setFormError('Tunggu foto selesai diunggah')
    setSaving(true)
    try {
      const res = await fetch('/api/bo/cash-flow/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromMoneyPlaceId: Number(fromPlace),
          toMoneyPlaceId: Number(toPlace),
          amount: amountNum,
          occurredOn,
          note: note.trim() || undefined,
          proofPhotoUrl: photo ?? undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setFormError(data.error ?? 'Gagal menyimpan Pindah Dana')
      setAmount('')
      setNote('')
      setPhoto(null)
      setMessage({ ok: true, text: 'Pindah Dana dicatat' })
      await load()
    } catch {
      setFormError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSaving(false)
    }
  }

  async function submitCancel() {
    if (!cancelTarget || cancelling) return
    if (cancelReason.trim().length < 3) return setCancelError('Alasan pembatalan wajib diisi')
    setCancelling(true)
    setCancelError(null)
    try {
      const res = await fetch(`/api/bo/cash-flow/transfers/${cancelTarget.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setCancelError(data.error ?? 'Gagal membatalkan')
      setCancelTarget(null)
      setMessage({ ok: true, text: 'Pindah Dana dibatalkan' })
      await load()
    } catch {
      setCancelError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className={canRecord ? 'grid gap-6 lg:grid-cols-[360px_1fr]' : ''}>
      {canRecord && (
        <form onSubmit={submit} className="border border-border rounded-lg bg-card p-5 space-y-4 h-fit">
          <h2 className="text-base font-semibold text-foreground inline-flex items-center gap-2">
            Catat Pindah Dana <NewBadge feature="fitur/pindah-dana" />
          </h2>
          <div>
            <label className="block text-sm font-medium mb-1">Dari <span className="text-destructive">*</span></label>
            <select value={fromPlace} onChange={(e) => setFromPlace(e.target.value)} className={inputClass}>
              <option value="">— Pilih Tempat Uang asal —</option>
              {places.map((p) => <option key={p.id} value={p.id}>{placeLabel(p)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ke <span className="text-destructive">*</span></label>
            <select value={toPlace} onChange={(e) => setToPlace(e.target.value)} className={inputClass}>
              <option value="">— Pilih Tempat Uang tujuan —</option>
              {places.filter((p) => String(p.id) !== fromPlace).map((p) => <option key={p.id} value={p.id}>{placeLabel(p)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Jumlah (Rp) <span className="text-destructive">*</span></label>
            <input type="text" inputMode="numeric" value={formatRupiahInput(amount)} onChange={(e) => setAmount(digitsOnly(e.target.value))} placeholder="0" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tanggal uang <span className="text-destructive">*</span></label>
            <input type="date" value={occurredOn} max={today} min={minDate} onChange={(e) => setOccurredOn(e.target.value)} className={inputClass} />
          </div>
          <ProofPhotoField value={photo} onChange={setPhoto} onUploadingChange={setPhotoUploading} disabled={saving} label="Foto Bukti" />
          <div>
            <label className="block text-sm font-medium mb-1">Catatan <span className="text-muted-foreground font-normal">(opsional)</span></label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} rows={2} className={`${inputClass} resize-none`} placeholder="Mis. setor tunai ke BCA" />
          </div>
          {formError && <div role="alert" className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm">{formError}</div>}
          <button type="submit" disabled={saving} className="w-full px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan Pindah Dana'}
          </button>
        </form>
      )}

      <div className="min-w-0">
        {message && (
          <div role="status" className={`mb-4 px-4 py-3 rounded-md text-sm ${message.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-destructive/10 border border-destructive/20 text-destructive'}`}>
            {message.text}
          </div>
        )}
        <div className="flex flex-wrap items-end gap-3 mb-3 text-sm">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Tanggal uang dari</label>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1.5 border border-border rounded-md bg-background" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">sampai</label>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="px-2 py-1.5 border border-border rounded-md bg-background" />
          </div>
          <label className="inline-flex items-center gap-2 pb-1.5">
            <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
            Tampilkan yang batal
          </label>
        </div>

        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Tanggal uang</th>
                <th className="text-left font-medium px-3 py-2">Dari → Ke</th>
                <th className="text-right font-medium px-3 py-2">Jumlah</th>
                <th className="text-left font-medium px-3 py-2">Catatan</th>
                <th className="text-left font-medium px-3 py-2">Oleh</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Memuat...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Belum ada Pindah Dana</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className={`px-3 py-2 whitespace-nowrap ${r.cancelledAt ? 'line-through text-muted-foreground' : ''}`}>
                    {formatDate(r.occurredOn)}
                    {r.cancelledAt && <span className="ml-2 no-underline inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">Batal</span>}
                  </td>
                  <td className="px-3 py-2">{r.fromName} → {r.toName}</td>
                  <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${r.cancelledAt ? 'line-through text-muted-foreground' : ''}`}>{IDR.format(r.amount)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <div>{r.note ?? '-'}</div>
                    <ProofPhotoLink url={r.proofPhotoUrl} />
                    {r.cancelledAt && <div className="text-xs text-destructive">Dibatalkan {r.cancelledByName ?? ''}: {r.cancelReason}</div>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.createdByName ?? '-'}</td>
                  <td className="px-3 py-2 text-right">
                    {r.canCancel && (
                      <button onClick={() => { setCancelTarget(r); setCancelReason(''); setCancelError(null) }} className="text-xs font-medium text-destructive hover:underline">
                        Batalkan
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Tidak bisa diubah atau dihapus. Yang salah dibatalkan dengan alasan lalu dicatat ulang. Pencatat bisa membatalkan catatannya sendiri pada hari yang sama; sesudah itu oleh Owner/GM.
        </p>
      </div>

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4 p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold">Batalkan Pindah Dana?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {cancelTarget.fromName} → {cancelTarget.toName} · {IDR.format(cancelTarget.amount)} · {formatDate(cancelTarget.occurredOn)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Alasan <span className="text-destructive">*</span></label>
              <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} maxLength={255} rows={2} className={`${inputClass} resize-none`} />
            </div>
            {cancelError && <div role="alert" className="text-sm text-destructive">{cancelError}</div>}
            <div className="flex justify-end gap-3">
              <button onClick={() => setCancelTarget(null)} disabled={cancelling} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted disabled:opacity-50">Kembali</button>
              <button onClick={submitCancel} disabled={cancelling} className="px-4 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
                {cancelling ? 'Membatalkan...' : 'Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
