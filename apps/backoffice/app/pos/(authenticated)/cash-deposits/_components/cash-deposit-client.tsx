'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Landmark, Loader2 } from 'lucide-react'
import { formatRupiahInput, parseRupiahInput } from '@/lib/number-input'
import { ProofPhotoField } from '@/components/ui/proof-photo-field'

// POS › Setor Tunai (F2-2): tim cabang melapor setor tunai ke bank → Menunggu verifikasi Finance.

interface QueueShift { shiftId: number; shiftNumber: number; openedOn: string; closedOn: string; cash: number; ageDays: number; legacy: boolean }
interface DepositRow {
  id: number; depositNumber: string; status: string; depositDate: string; destinationName: string
  reportedAmount: number; receivedAmount: number | null; reportChannel: string; shiftCount: number
  cancelReason: string | null; reportedByName: string | null
}
interface Bank { id: number; name: string; bankName: string | null; accountNumber: string | null }
interface Payload {
  summary: { shiftCount: number; total: number; oldestAgeDays: number; level: 'OK' | 'WARN' | 'OVER' } | null
  shifts: QueueShift[]
  deposits: DepositRow[]
  banks: Bank[]
  defaultBankId: number | null
  settings: { warnDays: number; warnAmount: number }
}

function rupiah(v: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}
function todayWib(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
}

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Menunggu verifikasi Finance', cls: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  VERIFIED: { label: 'Terverifikasi', cls: 'bg-green-500/10 text-green-700 border-green-500/20' },
  CANCELLED: { label: 'Batal', cls: 'bg-muted text-muted-foreground border-border' },
  CORRECTED: { label: 'Dikoreksi Finance', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
}

const input = 'w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30'

export default function CashDepositClient() {
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bankId, setBankId] = useState<number | ''>('')
  const [amount, setAmount] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
  const [date, setDate] = useState(todayWib())
  const [photo, setPhoto] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/pos/cash-deposits')
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return setError(json.error ?? `Gagal memuat (${res.status})`)
      setError(null)
      setData(json)
    } catch {
      setError('Terjadi kesalahan jaringan saat memuat')
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openForm() {
    if (!data) return
    // Bawaan: semua shift tercentang (urut tertua dulu dari server).
    setSelected(new Set(data.shifts.map((s) => s.shiftId)))
    setBankId(data.defaultBankId ?? (data.banks.length === 1 ? data.banks[0].id : ''))
    setAmountTouched(false)
    setDate(todayWib())
    setPhoto(null)
    setNotes('')
    setFormOpen(true)
  }

  const picked = useMemo(() => data?.shifts.filter((s) => selected.has(s.shiftId)) ?? [], [data, selected])
  const total = picked.reduce((sum, s) => sum + s.cash, 0)
  useEffect(() => { if (!amountTouched) setAmount(formatRupiahInput(total)) }, [total, amountTouched])

  async function submit() {
    if (!picked.length || bankId === '' || uploading) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/pos/cash-deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftIds: picked.map((s) => s.shiftId), destinationMoneyPlaceId: bankId,
          reportedAmount: parseRupiahInput(amount), depositDate: date, slipPhotoUrl: photo, notes: notes.trim() || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return setError(json.error ?? `Gagal (${res.status})`)
      setFormOpen(false)
      setMessage(`Setoran ${json.depositNumber} dilaporkan — menunggu verifikasi Finance`)
      load()
    } catch {
      setError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setBusy(false)
    }
  }

  async function cancel(d: DepositRow) {
    const reason = window.prompt(`Alasan membatalkan ${d.depositNumber}?`)
    if (!reason?.trim()) return
    const res = await fetch(`/api/pos/cash-deposits/${d.id}/cancel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reason.trim() }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return setError(json.error ?? `Gagal (${res.status})`)
    setMessage(`Setoran ${d.depositNumber} dibatalkan`)
    load()
  }

  const summary = data?.summary
  const levelCls = summary?.level === 'OVER' ? 'border-red-300 bg-red-50 text-red-800'
    : summary?.level === 'WARN' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-border bg-card text-foreground'

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/pos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Kasir</Link>
        <h1 className="ml-2 flex items-center gap-2 text-lg font-semibold text-foreground"><Landmark className="h-5 w-5" /> Setor Tunai</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Isi hanya bila tunai toko <strong>disetor ke bank</strong>. Uang yang diantar ke kantor tidak perlu dilaporkan di sini — Finance mencatatnya saat menerima.
      </p>
      {message && <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</div>}
      {error && <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
      {!data ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</p>
      ) : (
        <>
          <div className={`rounded-lg border p-4 ${levelCls}`}>
            <p className="text-sm">Tunai belum disetor</p>
            <p className="text-2xl font-bold tabular-nums">{rupiah(summary?.total ?? 0)}</p>
            <p className="text-xs">
              {summary?.shiftCount ?? 0} shift{summary && summary.shiftCount > 0 ? ` · tertua ${summary.oldestAgeDays} hari` : ''}
              {summary?.level === 'OVER' && ` — sudah lewat ${data.settings.warnDays} hari atau ${rupiah(data.settings.warnAmount)}, segera setor`}
            </p>
            {data.shifts.length > 0 && !formOpen && (
              <button type="button" onClick={openForm} className="mt-3 min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                Laporkan Setoran
              </button>
            )}
          </div>

          {formOpen && (
            <div className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h2 className="font-semibold text-foreground">Laporkan Setoran</h2>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                {data.shifts.map((s) => (
                  <label key={s.shiftId} className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.has(s.shiftId)}
                      onChange={(e) => {
                        const next = new Set(selected)
                        if (e.target.checked) next.add(s.shiftId)
                        else next.delete(s.shiftId)
                        setSelected(next)
                      }}
                    />
                    <span className="flex-1">{s.openedOn} · Shift #{s.shiftNumber}{s.legacy ? ' (lama)' : ''}</span>
                    <span className="text-xs text-muted-foreground">{s.ageDays} hari</span>
                    <span className="tabular-nums">{rupiah(s.cash)}</span>
                  </label>
                ))}
              </div>
              <p className="flex justify-between text-sm font-medium"><span>{picked.length} shift dipilih</span><span className="tabular-nums">{rupiah(total)}</span></p>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Rekening tujuan</span>
                {data.banks.length === 0 ? (
                  <span className="text-destructive">Belum ada Rekening aktif di Tempat Uang — hubungi Finance.</span>
                ) : (
                  <select value={bankId} onChange={(e) => setBankId(e.target.value ? Number(e.target.value) : '')} className={input}>
                    <option value="">— pilih rekening —</option>
                    {data.banks.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}{b.bankName ? ` · ${b.bankName}` : ''}{b.accountNumber ? ` •••• ${b.accountNumber.slice(-4)}` : ''}</option>
                    ))}
                  </select>
                )}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Nominal disetor</span>
                  <input inputMode="numeric" value={amount} onChange={(e) => { setAmountTouched(true); setAmount(formatRupiahInput(e.target.value)) }} className={`${input} text-right tabular-nums`} />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Tanggal setor</span>
                  <input type="date" value={date} max={todayWib()} onChange={(e) => setDate(e.target.value)} className={input} />
                </label>
              </div>
              <ProofPhotoField label="Foto slip setoran" value={photo} onChange={setPhoto} onUploadingChange={setUploading} disabled={busy} />
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan (opsional)" className={input} maxLength={500} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setFormOpen(false)} disabled={busy} className="min-h-[44px] rounded-lg border border-border px-4 py-2 text-sm">Batal</button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy || uploading || picked.length === 0 || bankId === ''}
                  className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {busy ? 'Mengirim…' : 'Kirim ke Finance'}
                </button>
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-2 text-sm font-semibold text-foreground">Setoran cabang ini</h2>
            {data.deposits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada setoran.</p>
            ) : (
              <ul className="space-y-2">
                {data.deposits.map((d) => {
                  const st = STATUS[d.status] ?? { label: d.status, cls: 'bg-muted border-border' }
                  return (
                    <li key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                      <span className="font-medium">{d.depositNumber}</span>
                      <span className={`rounded-md border px-2 py-0.5 text-xs ${st.cls}`}>{st.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {d.depositDate} · {d.shiftCount} shift · {d.destinationName}{d.reportChannel === 'BACKOFFICE' ? ' · diterima kantor' : ''}
                      </span>
                      <span className="ml-auto tabular-nums">{rupiah(d.receivedAmount ?? d.reportedAmount)}</span>
                      {d.status === 'PENDING' && d.reportChannel === 'POS' && (
                        <button type="button" onClick={() => cancel(d)} className="text-xs text-destructive hover:underline">Batalkan</button>
                      )}
                      {d.cancelReason && <span className="w-full text-xs text-muted-foreground">Batal: {d.cancelReason}</span>}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
