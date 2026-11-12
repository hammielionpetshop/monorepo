'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { formatWIB } from '@petshop/shared'
import { digitsOnly, formatRupiahInput } from '@/lib/number-input'
import { ProofPhotoField, ProofPhotoLink } from '@/components/ui/proof-photo-field'
import { NewBadge } from '@/components/ui/new-badge'
import { CASH_COUNT_START, CASH_COUNT_STALE_DAYS, type AdjustmentDirection } from '@/lib/services/cash-count-rules'
import type { CashCountRow, CountPlaceRow } from '@/lib/services/cash-count-service'

interface Prefill {
  countId: number
  direction: AdjustmentDirection
  amount: number | null
  month: string | null
}

interface Props {
  canManage: boolean
  today: string
  prefill: Prefill | null
}

const IDR = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
const inputClass = 'w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30'
const KIND_LABEL: Record<string, string> = { CASH: 'Tunai', BANK: 'Rekening' }

function dateLabel(date: string): string {
  return formatWIB(`${date}T12:00:00+07:00`, { day: '2-digit', month: 'short', year: 'numeric' })
}

function Modal({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}

function ErrorBox({ text }: { text: string | null }) {
  if (!text) return null
  return <div role="alert" className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm">{text}</div>
}

function Buttons({ onBack, busy, submitLabel, danger }: { onBack: () => void; busy: boolean; submitLabel: string; danger?: boolean }) {
  return (
    <div className="flex justify-end gap-3">
      <button type="button" onClick={onBack} disabled={busy} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted disabled:opacity-50">Kembali</button>
      <button type="submit" disabled={busy} className={`px-4 py-2 text-sm rounded-md disabled:opacity-50 ${danger ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
        {busy ? 'Menyimpan...' : submitLabel}
      </button>
    </div>
  )
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

async function send(url: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) return null
    const data = await res.json().catch(() => ({}))
    return data.error ?? 'Gagal menyimpan'
  } catch {
    return 'Terjadi kesalahan jaringan, silakan coba lagi'
  }
}

function FreshnessBadge({ place }: { place: CountPlaceRow }) {
  if (place.freshness === 'FRESH') return null
  return (
    <span className="inline-block px-2 py-0.5 rounded border text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40">
      {place.freshness === 'NEVER' ? 'Belum pernah dihitung' : `Belum dihitung ${CASH_COUNT_STALE_DAYS} hari`}
    </span>
  )
}

export default function CashCountClient({ canManage, today, prefill }: Props) {
  const [month, setMonth] = useState(prefill?.month ?? today.slice(0, 7))
  const [placeFilter, setPlaceFilter] = useState('')
  const [places, setPlaces] = useState<CountPlaceRow[]>([])
  const [counts, setCounts] = useState<CashCountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [recording, setRecording] = useState<CountPlaceRow | null>(null)
  const [cancelling, setCancelling] = useState<CashCountRow | null>(null)
  const [adjusting, setAdjusting] = useState<CashCountRow | null>(null)
  const [cancellingAdjustment, setCancellingAdjustment] = useState<CashCountRow | null>(null)
  const prefillUsed = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ month })
      if (placeFilter) qs.set('place', placeFilter)
      const res = await fetch(`/api/bo/cash-counts?${qs}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Gagal memuat Hitung Kas')
      setPlaces(data.places)
      setCounts(data.counts)
      setLoadError(null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Gagal memuat Hitung Kas')
    } finally {
      setLoading(false)
    }
  }, [month, placeFilter])

  useEffect(() => { void load() }, [load])

  // Tautan "Catat penyesuaian" dari web Finance membuka isian penyesuaian hitungan itu sekali.
  useEffect(() => {
    if (!prefill || prefillUsed.current || loading) return
    prefillUsed.current = true
    const target = counts.find((c) => c.id === prefill.countId)
    if (!canManage) setMessage('Penyesuaian hanya bisa dicatat Owner atau GM.')
    else if (!target) setMessage(`Hitungan #${prefill.countId} tidak ada di bulan ini; pilih bulannya di Riwayat Hitungan.`)
    else if (target.cancelledAt || target.adjustment) setMessage(`Hitungan #${target.id} sudah batal atau sudah punya penyesuaian.`)
    else setAdjusting(target)
  }, [prefill, counts, loading, canManage])

  const done = (text: string) => {
    setMessage(text)
    void load()
  }

  const byBranch = places.reduce<Map<string, CountPlaceRow[]>>((map, p) => {
    map.set(p.branchName, [...(map.get(p.branchName) ?? []), p])
    return map
  }, new Map())

  return (
    <div className="space-y-6">
      {message && (
        <div className="bg-primary/10 border border-primary/20 text-foreground px-4 py-3 rounded-md text-sm flex justify-between gap-4">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage(null)} className="text-muted-foreground hover:text-foreground">Tutup</button>
        </div>
      )}
      <ErrorBox text={loadError} />

      <section className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Tunai & Rekening <NewBadge feature="/cash-counts" /></h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hitung sesudah uang hari itu selesai keluar-masuk. Tunai sebaiknya dihitung paling tidak seminggu sekali.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-2">Tempat Uang</th>
                <th className="text-left font-medium px-4 py-2">Jenis</th>
                <th className="text-left font-medium px-4 py-2">Hitung terakhir</th>
                <th className="text-right font-medium px-4 py-2">Uang nyata</th>
                <th className="text-left font-medium px-4 py-2">Penghitung</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading && places.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Memuat...</td></tr>
              )}
              {!loading && places.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Belum ada Tunai/Rekening aktif di Pengaturan › Tempat Uang.</td></tr>
              )}
              {[...byBranch.entries()].map(([branch, rows]) => (
                <BranchRows key={branch} branch={branch} rows={rows} onRecord={setRecording} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-end gap-3 justify-between">
          <h2 className="text-sm font-semibold">Riwayat Hitungan</h2>
          <div className="flex flex-wrap gap-2">
            <input type="month" value={month} min={CASH_COUNT_START.slice(0, 7)} max={today.slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} className="px-3 py-1.5 text-sm border border-border rounded-md bg-background" aria-label="Bulan" />
            <select value={placeFilter} onChange={(e) => setPlaceFilter(e.target.value)} className="px-3 py-1.5 text-sm border border-border rounded-md bg-background" aria-label="Tempat Uang">
              <option value="">Semua tempat</option>
              {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-2">Tanggal</th>
                <th className="text-left font-medium px-4 py-2">Tempat Uang</th>
                <th className="text-right font-medium px-4 py-2">Uang nyata</th>
                <th className="text-left font-medium px-4 py-2">Dicatat</th>
                <th className="text-left font-medium px-4 py-2">Catatan</th>
                <th className="text-left font-medium px-4 py-2">Penyesuaian</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {!loading && counts.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Belum ada hitungan di bulan ini.</td></tr>
              )}
              {counts.map((c) => (
                <tr key={c.id} className={`border-t border-border align-top ${c.cancelledAt ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {dateLabel(c.countedOn)}
                    <div className="text-xs text-muted-foreground">#{c.id}</div>
                  </td>
                  <td className="px-4 py-2">
                    {c.placeName}
                    <div className="text-xs text-muted-foreground">{KIND_LABEL[c.placeKind] ?? c.placeKind} · {c.branchName}</div>
                  </td>
                  <td className={`px-4 py-2 text-right whitespace-nowrap ${c.cancelledAt ? 'line-through' : ''}`}>{IDR.format(c.amount)}</td>
                  <td className="px-4 py-2 text-xs">
                    {c.createdByName ?? '-'}
                    <div className="text-muted-foreground">{formatWIB(c.createdAt, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className="px-4 py-2 text-xs max-w-xs">
                    {c.note ?? <span className="text-muted-foreground">-</span>}
                    <div>{c.photoUrl ? <ProofPhotoLink url={c.photoUrl} /> : <span className="text-muted-foreground">tanpa bukti</span>}</div>
                    {c.cancelledAt && <div className="text-destructive mt-1">Batal: {c.cancelReason}</div>}
                  </td>
                  <td className="px-4 py-2 text-xs whitespace-nowrap">
                    {c.adjustment ? (
                      <>
                        <span className={c.adjustment.direction === 'SHORT' ? 'text-destructive' : 'text-blue-700 dark:text-blue-300'}>
                          {c.adjustment.direction === 'SHORT' ? 'Kurang' : 'Lebih'} {IDR.format(c.adjustment.amount)}
                        </span>
                        <div className="text-muted-foreground">Arus Kas #{c.adjustment.entryId}</div>
                      </>
                    ) : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap space-x-2">
                    {canManage && !c.cancelledAt && !c.adjustment && (
                      <button type="button" onClick={() => setAdjusting(c)} className="text-xs text-primary hover:underline">Catat penyesuaian</button>
                    )}
                    {canManage && !c.cancelledAt && c.adjustment && (
                      <button type="button" onClick={() => setCancellingAdjustment(c)} className="text-xs text-destructive hover:underline">Batalkan penyesuaian</button>
                    )}
                    {canManage && !c.cancelledAt && (
                      <button type="button" onClick={() => setCancelling(c)} className="text-xs text-destructive hover:underline">Batalkan</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {recording && (
        <RecordModal
          place={recording}
          today={today}
          onClose={() => setRecording(null)}
          onDone={() => { setRecording(null); done(`Hitungan "${recording.name}" tercatat.`) }}
        />
      )}
      {adjusting && (
        <AdjustModal
          count={adjusting}
          prefill={prefill && prefill.countId === adjusting.id ? prefill : null}
          onClose={() => setAdjusting(null)}
          onDone={() => { setAdjusting(null); done(`Penyesuaian hitungan #${adjusting.id} tercatat di Pendapatan & Pengeluaran.`) }}
        />
      )}
      {cancelling && (
        <ReasonModal
          title={`Batalkan hitungan #${cancelling.id}`}
          subtitle={`${cancelling.placeName} · ${dateLabel(cancelling.countedOn)} · ${IDR.format(cancelling.amount)}${cancelling.adjustment ? '. Penyesuaiannya ikut dibatalkan.' : ''}`}
          url={`/api/bo/cash-counts/${cancelling.id}/cancel`}
          submitLabel="Batalkan hitungan"
          onClose={() => setCancelling(null)}
          onDone={() => { setCancelling(null); done(`Hitungan #${cancelling.id} dibatalkan.`) }}
        />
      )}
      {cancellingAdjustment && (
        <ReasonModal
          title={`Batalkan penyesuaian hitungan #${cancellingAdjustment.id}`}
          subtitle="Catatan Arus Kas penyesuaiannya bertanda Batal. Hitungan tetap berlaku dan bisa disesuaikan lagi."
          url={`/api/bo/cash-counts/${cancellingAdjustment.id}/adjustment-cancel`}
          submitLabel="Batalkan penyesuaian"
          onClose={() => setCancellingAdjustment(null)}
          onDone={() => { setCancellingAdjustment(null); done(`Penyesuaian hitungan #${cancellingAdjustment.id} dibatalkan.`) }}
        />
      )}
    </div>
  )
}

function BranchRows({ branch, rows, onRecord }: { branch: string; rows: CountPlaceRow[]; onRecord: (p: CountPlaceRow) => void }) {
  return (
    <>
      <tr className="border-t border-border bg-muted/30">
        <td colSpan={6} className="px-4 py-1.5 text-xs font-semibold text-muted-foreground">{branch}</td>
      </tr>
      {rows.map((p) => (
        <tr key={p.id} className="border-t border-border">
          <td className="px-4 py-2">
            {p.name} <FreshnessBadge place={p} />
          </td>
          <td className="px-4 py-2">{KIND_LABEL[p.kind]}</td>
          <td className="px-4 py-2">{p.lastCountedOn ? dateLabel(p.lastCountedOn) : '-'}</td>
          <td className="px-4 py-2 text-right">{p.lastAmount !== null ? IDR.format(p.lastAmount) : '-'}</td>
          <td className="px-4 py-2">{p.lastCountedBy ?? '-'}</td>
          <td className="px-4 py-2 text-right">
            <button type="button" onClick={() => onRecord(p)} className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
              Catat Hitungan
            </button>
          </td>
        </tr>
      ))}
    </>
  )
}

function RecordModal({ place, today, onClose, onDone }: { place: CountPlaceRow; today: string; onClose: () => void; onDone: () => void }) {
  const [countedOn, setCountedOn] = useState(today)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (amount === '') return setError('Isi jumlah uang nyata (0 bila kosong)')
    if (uploading) return setError('Tunggu foto selesai diunggah')
    setBusy(true)
    const err = await send('/api/bo/cash-counts', {
      moneyPlaceId: place.id, countedOn, amount: Number(amount), note: note.trim() || null, photoUrl: photo,
    })
    setBusy(false)
    if (err) setError(err)
    else onDone()
  }

  return (
    <Modal title={`Catat Hitungan — ${place.name}`} subtitle={place.kind === 'BANK' ? 'Isi saldo akhir hari menurut mutasi/aplikasi bank.' : 'Hitung uang fisiknya, lalu ketik jumlahnya.'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Tanggal hitung" hint="Uang nyata pada akhir hari tanggal ini. Bila sesudah dihitung masih ada uang keluar/masuk di hari yang sama, hitung ulang.">
          <input type="date" value={countedOn} min={CASH_COUNT_START} max={today} onChange={(e) => setCountedOn(e.target.value)} className={inputClass} required />
        </Field>
        <Field label="Jumlah uang nyata">
          <input type="text" inputMode="numeric" value={formatRupiahInput(amount)} onChange={(e) => setAmount(digitsOnly(e.target.value))} placeholder="0" className={inputClass} autoFocus />
        </Field>
        <ProofPhotoField value={photo} onChange={setPhoto} onUploadingChange={setUploading} disabled={busy} label="Foto uang / mutasi (dianjurkan)" />
        <Field label="Catatan (opsional)" hint="Mis. rincian pecahan atau siapa yang menyaksikan.">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} className={inputClass} />
        </Field>
        <ErrorBox text={error} />
        <Buttons onBack={onClose} busy={busy} submitLabel="Simpan hitungan" />
      </form>
    </Modal>
  )
}

function AdjustModal({ count, prefill, onClose, onDone }: { count: CashCountRow; prefill: Prefill | null; onClose: () => void; onDone: () => void }) {
  const [direction, setDirection] = useState<AdjustmentDirection>(prefill?.direction ?? 'SHORT')
  const [amount, setAmount] = useState(prefill?.amount ? String(prefill.amount) : '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return setError('Isi jumlah penyesuaian')
    setBusy(true)
    const err = await send(`/api/bo/cash-counts/${count.id}/adjust`, { direction, amount: Number(amount), reason })
    setBusy(false)
    if (err) setError(err)
    else onDone()
  }

  return (
    <Modal
      title={`Catat penyesuaian — hitungan #${count.id}`}
      subtitle={`${count.placeName} · ${dateLabel(count.countedOn)} · uang nyata ${IDR.format(count.amount)}`}
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Penyesuaian membuat saldo menurut catatan sama dengan uang nyata pada tanggal hitung. Pastikan tidak ada catatan uang yang
          terlupa lebih dulu. Kurang tercatat sebagai biaya &quot;Selisih kas kurang&quot;, lebih sebagai pendapatan lain &quot;Selisih kas lebih&quot;.
        </p>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={direction === 'SHORT'} onChange={() => setDirection('SHORT')} /> Kurang (uang nyata lebih sedikit)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={direction === 'OVER'} onChange={() => setDirection('OVER')} /> Lebih
          </label>
        </div>
        <Field label="Jumlah" hint={prefill?.amount ? 'Terisi dari selisih di web Finance.' : 'Lihat selisihnya di web Finance › Hitung Kas.'}>
          <input type="text" inputMode="numeric" value={formatRupiahInput(amount)} onChange={(e) => setAmount(digitsOnly(e.target.value))} placeholder="0" className={inputClass} />
        </Field>
        <Field label="Alasan">
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className={inputClass} placeholder="Mis. sudah ditelusuri, sebab tidak ketemu" />
        </Field>
        <ErrorBox text={error} />
        <Buttons onBack={onClose} busy={busy} submitLabel="Simpan penyesuaian" />
      </form>
    </Modal>
  )
}

function ReasonModal({ title, subtitle, url, submitLabel, onClose, onDone }: {
  title: string; subtitle: string; url: string; submitLabel: string; onClose: () => void; onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const err = await send(url, { reason })
    setBusy(false)
    if (err) setError(err)
    else onDone()
  }

  return (
    <Modal title={title} subtitle={subtitle}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Alasan">
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className={inputClass} autoFocus />
        </Field>
        <ErrorBox text={error} />
        <Buttons onBack={onClose} busy={busy} submitLabel={submitLabel} danger />
      </form>
    </Modal>
  )
}
