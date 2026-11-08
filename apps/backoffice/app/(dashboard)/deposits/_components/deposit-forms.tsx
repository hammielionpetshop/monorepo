'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatRupiah } from '@petshop/shared'
import { formatRupiahInput, parseRupiahInput } from '@/lib/number-input'
import type { DepositDestination, DepositListItem, NoncashRow, UndepositedShift } from '@/lib/services/deposit-queries'
import type { CashVarianceCause, DepositSettings } from '@/lib/services/deposit-rules'
import type { SettlementLine } from '@/lib/services/deposit-settlement-service'

// Form & modal menu Setoran (F2-2). Semua angka diketik Finance; tidak ada yang terisi otomatis
// dari angka sistem kecuali saran rincian sebab.

export const inputClass =
  'w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30'
export const btnPrimary =
  'px-3 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50'
export const btnSecondary =
  'px-3 py-2 text-sm font-medium rounded-md border border-border bg-background text-foreground hover:bg-muted disabled:opacity-50'

export const CAUSE_OPTIONS: { value: CashVarianceCause; label: string }[] = [
  { value: 'BANK_FEE', label: 'Biaya setor bank (Biaya Bank)' },
  { value: 'CASHIER_SHORT', label: 'Kurang dari kasir (Minus Kasir)' },
  { value: 'CASHIER_OVER', label: 'Lebih dari kasir (Minus Kasir)' },
  { value: 'OTHER', label: 'Lainnya (tidak dibebankan)' },
]

export const CAUSE_LABEL: Record<string, string> = {
  BANK_FEE: 'Biaya setor bank',
  CASHIER_SHORT: 'Kurang dari kasir',
  CASHIER_OVER: 'Lebih dari kasir',
  OTHER: 'Lainnya',
  CASHIER_INPUT: 'Salah input kasir',
  AWAITING_FUNDS: 'Dana belum cair',
}

/** Ringkasan pelunasan otomatis (F2-3) untuk pesan sesudah Verifikasi. */
export function settlementText(raw: unknown): string {
  const s = raw as { payablesSettled?: number; settledAmount?: number; freeAmount?: number } | null | undefined
  if (!s) return ''
  if (!s.payablesSettled) return s.freeAmount ? ` · tidak ada utang internal terbuka, setoran bebas ${formatRupiah(s.freeAmount)}` : ''
  return ` · melunasi ${s.payablesSettled} tagihan internal (${formatRupiah(s.settledAmount ?? 0)}), setoran bebas ${formatRupiah(s.freeAmount ?? 0)}`
}

/** Rincian pelunasan otomatis per tingkat: penyetor → pemasok, lalu diteruskan ke pemasoknya. */
export function SettlementList({ lines }: { lines?: SettlementLine[] }) {
  if (!lines || lines.length === 0) return null
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
      {lines.map((l) => (
        <li key={l.id} className={l.reversed ? 'line-through opacity-60' : ''} style={{ paddingLeft: `${(l.level - 1) * 12}px` }}>
          {l.level > 1 && '↳ '}
          {l.ibtNumber
            ? `${l.payerBranchName} → ${l.creditorBranchName ?? '-'} ${l.ibtNumber}: ${formatRupiah(l.amount)}`
            : `Setoran bebas ${l.payerBranchName}: ${formatRupiah(l.amount)}`}
          {l.reversed && ' (dibalik)'}
        </li>
      ))}
    </ul>
  )
}

export function todayWib(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
}

export async function postJson(url: string, body: unknown, method = 'POST'): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, data: { error: data.error ?? `Gagal (${res.status})` } }
    return { ok: true, data }
  } catch {
    return { ok: false, data: { error: 'Terjadi kesalahan jaringan, silakan coba lagi' } }
  }
}

export function Modal({ title, onClose, busy, children, wide }: { title: string; onClose: () => void; busy?: boolean; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, busy])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`mt-8 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-lg border border-border bg-card shadow-xl`}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} disabled={busy} className="text-muted-foreground hover:text-foreground" aria-label="Tutup">✕</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

export function RupiahField({ label, value, onChange, autoFocus, hint }: { label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-foreground">{label}</span>
      <input
        inputMode="numeric"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(formatRupiahInput(e.target.value))}
        placeholder="0"
        className={`${inputClass} text-right tabular-nums`}
      />
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

export function DestinationSelect({ value, onChange, destinations, branchId, kinds }: {
  value: number | ''
  onChange: (id: number | '') => void
  destinations: DepositDestination[]
  branchId: number | null
  kinds: ('BANK' | 'CASH')[]
}) {
  const options = destinations
    .filter((d) => kinds.includes(d.kind))
    .sort((a, b) => Number(b.branchId === branchId) - Number(a.branchId === branchId) || a.name.localeCompare(b.name))
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-foreground">Tujuan</span>
      <select value={value} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')} className={inputClass}>
        <option value="">— pilih tujuan —</option>
        {options.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name} ({d.kind === 'BANK' ? `Rekening${d.bankName ? ` ${d.bankName}` : ''}` : 'Tunai'}){d.branchId !== branchId ? ` · ${d.branchName}` : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

// ── Rincian sebab selisih (tunai) ──────────────────────────────────────────

export interface VarianceDraft {
  key: number
  cause: CashVarianceCause | ''
  amount: string
  shiftId: number | ''
  cashierId: number | ''
  note: string
}

export interface VarianceShiftOption {
  shiftId: number
  label: string
  cashiers: { id: number; name: string }[]
}

let draftKey = 1

/** Arah nominal mengikuti sebab: biaya bank & kurang = minus, lebih = plus, Lainnya = mengikuti selisih. */
export function signedAmount(d: VarianceDraft, variance: number): number {
  const abs = parseRupiahInput(d.amount)
  if (d.cause === 'BANK_FEE' || d.cause === 'CASHIER_SHORT') return -abs
  if (d.cause === 'CASHIER_OVER') return abs
  return variance < 0 ? -abs : abs
}

export function toVariancePayload(drafts: VarianceDraft[], variance: number) {
  return drafts.map((d) => ({
    cause: d.cause as CashVarianceCause,
    amount: signedAmount(d, variance),
    shiftId: d.shiftId === '' ? null : d.shiftId,
    cashierId: d.cashierId === '' ? null : d.cashierId,
    note: d.note.trim() || null,
  }))
}

export function varianceDraftProblem(drafts: VarianceDraft[], variance: number): string | null {
  if (variance === 0) return drafts.length ? 'Tidak ada selisih — hapus rincian sebab' : null
  if (drafts.length === 0) return 'Ada selisih — isi rincian sebabnya'
  for (const d of drafts) {
    if (!d.cause) return 'Pilih sebab untuk tiap baris'
    if (parseRupiahInput(d.amount) <= 0) return 'Isi nominal tiap sebab'
    if ((d.cause === 'CASHIER_SHORT' || d.cause === 'CASHIER_OVER') && (d.shiftId === '' || d.cashierId === '')) return 'Pilih shift dan kasirnya'
    if (d.cause === 'OTHER' && !d.note.trim()) return 'Sebab Lainnya wajib diberi catatan'
  }
  const total = drafts.reduce((sum, d) => sum + signedAmount(d, variance), 0)
  if (total !== variance) return `Jumlah rincian (${formatRupiah(total)}) belum sama dengan selisih (${formatRupiah(variance)})`
  return null
}

export function VarianceEditor({ variance, drafts, setDrafts, shifts }: {
  variance: number
  drafts: VarianceDraft[]
  setDrafts: (d: VarianceDraft[]) => void
  shifts: VarianceShiftOption[]
}) {
  // Saran awal: satu baris sebesar selisih.
  useEffect(() => {
    if (variance !== 0 && drafts.length === 0) {
      setDrafts([{ key: draftKey++, cause: '', amount: formatRupiahInput(Math.abs(variance)), shiftId: shifts.length === 1 ? shifts[0].shiftId : '', cashierId: '', note: '' }])
    }
    if (variance === 0 && drafts.length > 0) setDrafts([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variance])

  if (variance === 0) return <p className="text-sm text-green-700 dark:text-green-400">Cocok — tidak ada selisih.</p>
  const update = (key: number, patch: Partial<VarianceDraft>) => setDrafts(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)))
  const problem = varianceDraftProblem(drafts, variance)
  return (
    <div className="space-y-2">
      <p className={`text-sm font-medium ${variance < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
        Selisih {formatRupiah(variance)} — rinci sebabnya:
      </p>
      {drafts.map((d) => {
        const shift = shifts.find((s) => s.shiftId === d.shiftId)
        const needsCashier = d.cause === 'CASHIER_SHORT' || d.cause === 'CASHIER_OVER'
        return (
          <div key={d.key} className="rounded-md border border-border p-2 space-y-2">
            <div className="flex gap-2">
              <select value={d.cause} onChange={(e) => update(d.key, { cause: e.target.value as CashVarianceCause })} className={inputClass} aria-label="Sebab">
                <option value="">— pilih sebab —</option>
                {CAUSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input
                inputMode="numeric"
                value={d.amount}
                onChange={(e) => update(d.key, { amount: formatRupiahInput(e.target.value) })}
                className={`${inputClass} max-w-36 text-right tabular-nums`}
                aria-label="Nominal sebab"
              />
              <button type="button" onClick={() => setDrafts(drafts.filter((x) => x.key !== d.key))} className="px-2 text-muted-foreground hover:text-destructive" aria-label="Hapus baris">✕</button>
            </div>
            {needsCashier && (
              <div className="flex gap-2">
                <select value={d.shiftId} onChange={(e) => update(d.key, { shiftId: e.target.value ? Number(e.target.value) : '', cashierId: '' })} className={inputClass} aria-label="Shift">
                  <option value="">— shift —</option>
                  {shifts.map((s) => <option key={s.shiftId} value={s.shiftId}>{s.label}</option>)}
                </select>
                <select value={d.cashierId} onChange={(e) => update(d.key, { cashierId: e.target.value ? Number(e.target.value) : '' })} className={inputClass} aria-label="Kasir" disabled={!shift}>
                  <option value="">— kasir —</option>
                  {shift?.cashiers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {(d.cause === 'OTHER' || d.cause === 'BANK_FEE') && (
              <input value={d.note} onChange={(e) => update(d.key, { note: e.target.value })} placeholder={d.cause === 'OTHER' ? 'Catatan (wajib)' : 'Catatan (opsional)'} className={inputClass} maxLength={255} />
            )}
          </div>
        )
      })}
      <button type="button" onClick={() => setDrafts([...drafts, { key: draftKey++, cause: '', amount: '', shiftId: '', cashierId: '', note: '' }])} className="text-xs text-primary hover:underline">
        + Tambah sebab
      </button>
      {problem && <p className="text-xs text-amber-700 dark:text-amber-400">{problem}</p>}
    </div>
  )
}

function shiftOptions(shifts: { shiftId: number; shiftNumber: number; openedOn: string; cashiers: { id: number; name: string }[] }[]): VarianceShiftOption[] {
  return shifts.map((s) => ({ shiftId: s.shiftId, label: `${s.openedOn} · Shift #${s.shiftNumber}`, cashiers: s.cashiers }))
}

// ── Verifikasi / Koreksi setoran tunai ─────────────────────────────────────

export function VerifyCashModal({ deposit, destinations, mode, onClose, onDone }: {
  deposit: DepositListItem
  destinations: DepositDestination[]
  mode: 'verify' | 'correct'
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [received, setReceived] = useState('')
  const [destinationId, setDestinationId] = useState<number | ''>(deposit.destinationId)
  const [drafts, setDrafts] = useState<VarianceDraft[]>([])
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const receivedNum = received === '' ? null : parseRupiahInput(received)
  const variance = receivedNum == null ? 0 : receivedNum - deposit.shiftTotal
  const problem = receivedNum == null ? 'Ketik nominal yang benar-benar diterima' : varianceDraftProblem(drafts, variance)

  async function submit() {
    if (problem || destinationId === '' || receivedNum == null) return
    if (mode === 'correct' && !reason.trim()) return setError('Alasan koreksi wajib diisi')
    setBusy(true)
    setError(null)
    const body = {
      receivedAmount: receivedNum,
      variances: toVariancePayload(drafts, variance),
      destinationMoneyPlaceId: destinationId,
      ...(mode === 'verify' ? { notes: notes.trim() || null } : { reason: reason.trim() }),
    }
    const { ok, data } = await postJson(`/api/bo/deposits/${deposit.id}/${mode}`, body)
    setBusy(false)
    if (!ok) return setError(String(data.error))
    onDone((mode === 'verify' ? `Setoran ${deposit.depositNumber} terverifikasi` : `Setoran ${deposit.depositNumber} dikoreksi → ${String(data.depositNumber)}`) + settlementText(data.settlement))
  }

  return (
    <Modal title={mode === 'verify' ? `Verifikasi ${deposit.depositNumber}` : `Koreksi ${deposit.depositNumber}`} onClose={onClose} busy={busy}>
      <div className="space-y-3 text-sm">
        <div className="rounded-md bg-muted/50 p-3 space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Cabang</span><span>{deposit.branchName}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Kas {deposit.shifts.length} shift</span><span className="font-medium tabular-nums">{formatRupiah(deposit.shiftTotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Nominal menurut pelapor</span><span className="tabular-nums">{formatRupiah(deposit.reportedAmount)}</span></div>
          {deposit.receivedAmount != null && (
            <div className="flex justify-between"><span className="text-muted-foreground">Diterima sebelumnya</span><span className="tabular-nums">{formatRupiah(deposit.receivedAmount)}</span></div>
          )}
        </div>
        <RupiahField label="Diterima (ketik dari mutasi / hitungan uang)" value={received} onChange={setReceived} autoFocus />
        <DestinationSelect value={destinationId} onChange={setDestinationId} destinations={destinations} branchId={deposit.branchId} kinds={['BANK', 'CASH']} />
        {receivedNum != null && (
          <VarianceEditor variance={variance} drafts={drafts} setDrafts={setDrafts} shifts={shiftOptions(deposit.shifts)} />
        )}
        {mode === 'verify' ? (
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan (opsional)" className={inputClass} maxLength={500} />
        ) : (
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan koreksi (wajib)" className={inputClass} maxLength={200} />
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className={btnSecondary}>Batal</button>
          <button type="button" onClick={submit} disabled={busy || !!problem || destinationId === ''} className={btnPrimary}>
            {busy ? 'Menyimpan…' : mode === 'verify' ? 'Verifikasi' : 'Simpan Koreksi'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Terima Setoran (uang diantar ke kantor / Bulk Sale) ────────────────────

export function ReceiveModal({ branches, shifts, destinations, defaults, initialBranchId, onClose, onDone }: {
  branches: { id: number; name: string }[]
  shifts: UndepositedShift[]
  destinations: DepositDestination[]
  defaults: { branchId: number; moneyPlaceId: number }[]
  initialBranchId: number | null
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [branchId, setBranchId] = useState<number | ''>(initialBranchId ?? '')
  const branchShifts = useMemo(() => shifts.filter((s) => s.branchId === branchId), [shifts, branchId])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [destinationId, setDestinationId] = useState<number | ''>('')
  const [date, setDate] = useState(todayWib())
  const [received, setReceived] = useState('')
  const [drafts, setDrafts] = useState<VarianceDraft[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSelected(new Set(branchShifts.map((s) => s.shiftId)))
    const def = defaults.find((d) => d.branchId === branchId)?.moneyPlaceId
    const brankas = destinations.find((d) => d.kind === 'CASH' && /brankas/i.test(d.name))?.id
    setDestinationId(def ?? brankas ?? '')
    setDrafts([])
  }, [branchId, branchShifts, defaults, destinations])

  const picked = branchShifts.filter((s) => selected.has(s.shiftId))
  const total = picked.reduce((sum, s) => sum + s.cash, 0)
  const receivedNum = received === '' ? null : parseRupiahInput(received)
  const variance = receivedNum == null ? 0 : receivedNum - total
  const problem = picked.length === 0 ? 'Pilih minimal satu shift'
    : receivedNum == null ? 'Ketik nominal yang benar-benar diterima'
      : varianceDraftProblem(drafts, variance)

  async function submit() {
    if (problem || branchId === '' || destinationId === '' || receivedNum == null) return
    setBusy(true)
    setError(null)
    const { ok, data } = await postJson('/api/bo/deposits', {
      branchId, shiftIds: picked.map((s) => s.shiftId), destinationMoneyPlaceId: destinationId,
      receivedAmount: receivedNum, depositDate: date, variances: toVariancePayload(drafts, variance),
    })
    setBusy(false)
    if (!ok) return setError(String(data.error))
    onDone(`Setoran ${String(data.depositNumber)} diterima dan terverifikasi` + settlementText(data.settlement))
  }

  return (
    <Modal title="Terima Setoran" onClose={onClose} busy={busy} wide>
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Untuk uang yang diantar ke kantor (termasuk tunai Bulk Sale Gudang). Setoran langsung terverifikasi atas nama Anda.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-foreground">Cabang</span>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : '')} className={inputClass}>
              <option value="">— pilih cabang —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-foreground">Tanggal diterima</span>
            <input type="date" value={date} max={todayWib()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </label>
        </div>
        {branchId !== '' && (
          branchShifts.length === 0 ? (
            <p className="text-muted-foreground">Tidak ada tunai belum disetor di cabang ini.</p>
          ) : (
            <div className="max-h-60 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <tbody>
                  {branchShifts.map((s) => (
                    <tr key={s.shiftId} className="border-b border-border last:border-0">
                      <td className="px-3 py-1.5 w-8">
                        <input
                          type="checkbox"
                          checked={selected.has(s.shiftId)}
                          onChange={(e) => {
                            const next = new Set(selected)
                            if (e.target.checked) next.add(s.shiftId)
                            else next.delete(s.shiftId)
                            setSelected(next)
                          }}
                          aria-label={`Shift #${s.shiftNumber} ${s.openedOn}`}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        {s.openedOn} · Shift #{s.shiftNumber}
                        {s.origin === 'BACKOFFICE' && <span className="ml-1 text-xs text-blue-700">Bulk Sale</span>}
                        {s.legacy && <span className="ml-1 text-xs text-muted-foreground">(lama)</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right text-muted-foreground">{s.ageDays} hari</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatRupiah(s.cash)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        <div className="flex justify-between font-medium"><span>Kas {picked.length} shift</span><span className="tabular-nums">{formatRupiah(total)}</span></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DestinationSelect value={destinationId} onChange={setDestinationId} destinations={destinations} branchId={branchId === '' ? null : branchId} kinds={['CASH', 'BANK']} />
          <RupiahField label="Diterima (hitung uangnya)" value={received} onChange={setReceived} />
        </div>
        {receivedNum != null && picked.length > 0 && (
          <VarianceEditor variance={variance} drafts={drafts} setDrafts={setDrafts} shifts={shiftOptions(picked)} />
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className={btnSecondary}>Batal</button>
          <button type="button" onClick={submit} disabled={busy || !!problem || destinationId === ''} className={btnPrimary}>
            {busy ? 'Menyimpan…' : 'Terima & Verifikasi'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Non-tunai ──────────────────────────────────────────────────────────────

export function NoncashModal({ row, mode, onClose, onDone }: {
  row: NoncashRow
  mode: 'verify' | 'correct'
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [received, setReceived] = useState('')
  const [cause, setCause] = useState<'' | 'BANK_FEE' | 'CASHIER_INPUT' | 'OTHER'>('')
  const [cashierId, setCashierId] = useState<number | ''>('')
  const [note, setNote] = useState(mode === 'verify' && row.status === 'AWAITING_FUNDS' ? row.note ?? '' : '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const receivedNum = received === '' ? null : parseRupiahInput(received)
  const variance = receivedNum == null ? 0 : receivedNum - row.expected

  async function save(awaitingFunds: boolean) {
    setError(null)
    if (!awaitingFunds) {
      if (receivedNum == null) return setError('Ketik nominal yang masuk di mutasi')
      if (variance !== 0 && !cause) return setError('Ada selisih — pilih sebabnya')
      if (cause === 'OTHER' && !note.trim()) return setError('Sebab Lainnya wajib diberi catatan')
    }
    if (mode === 'correct' && !reason.trim()) return setError('Alasan koreksi wajib diisi')
    setBusy(true)
    const common = {
      receivedAmount: receivedNum,
      cause: variance === 0 ? null : cause || null,
      cashierId: cause === 'CASHIER_INPUT' && cashierId !== '' ? cashierId : null,
      note: note.trim() || null,
    }
    const { ok, data } = mode === 'correct'
      ? await postJson(`/api/bo/deposits/noncash/${row.verificationId}/correct`, { ...common, receivedAmount: receivedNum ?? 0, reason: reason.trim() })
      : await postJson('/api/bo/deposits/noncash', {
        shiftId: row.shiftId, branchId: row.branchId, businessDate: row.shiftId ? null : row.businessDate,
        paymentMethodId: row.paymentMethodId, awaitingFunds, ...(awaitingFunds ? { note: note.trim() || null } : common),
      })
    setBusy(false)
    if (!ok) return setError(String(data.error))
    onDone(awaitingFunds ? 'Disimpan sebagai Dana belum cair' : (mode === 'correct' ? 'Verifikasi non-tunai dikoreksi' : 'Non-tunai terverifikasi') + settlementText(data.settlement))
  }

  const title = `${row.paymentMethodName} · ${row.branchName} · ${row.shiftNumber ? `Shift #${row.shiftNumber}` : 'Pelunasan BO'} ${row.businessDate}`
  return (
    <Modal title={mode === 'correct' ? `Koreksi ${title}` : title} onClose={onClose} busy={busy}>
      <div className="space-y-3 text-sm">
        <div className="rounded-md bg-muted/50 p-3 space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Angka sistem</span><span className="font-medium tabular-nums">{formatRupiah(row.expected)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Rekening tujuan</span><span>{row.linkedPlaceName ?? <span className="text-destructive">belum ditautkan</span>}</span></div>
          {row.received != null && <div className="flex justify-between"><span className="text-muted-foreground">Diterima sebelumnya</span><span className="tabular-nums">{formatRupiah(row.received)}</span></div>}
        </div>
        {!row.linkedPlaceName && (
          <p className="text-destructive">Tautkan dulu metode ini di Pengaturan › Tempat Uang › Metode Bayar per Cabang.</p>
        )}
        <RupiahField label="Diterima (ketik dari mutasi rekening)" value={received} onChange={setReceived} autoFocus />
        {receivedNum != null && variance !== 0 && (
          <div className="space-y-2">
            <p className={`font-medium ${variance < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>Selisih {formatRupiah(variance)}</p>
            <select value={cause} onChange={(e) => setCause(e.target.value as typeof cause)} className={inputClass} aria-label="Sebab selisih">
              <option value="">— pilih sebab —</option>
              {variance < 0 && <option value="BANK_FEE">Potongan bank (Biaya Bank)</option>}
              <option value="CASHIER_INPUT">Salah input kasir (Minus Kasir)</option>
              <option value="OTHER">Lainnya (tidak dibebankan)</option>
            </select>
            {cause === 'CASHIER_INPUT' && row.shiftId && (
              <select value={cashierId} onChange={(e) => setCashierId(e.target.value ? Number(e.target.value) : '')} className={inputClass} aria-label="Kasir">
                <option value="">— kasir (kosong = dibagi porsi kas) —</option>
                {row.cashiers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
        )}
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={cause === 'OTHER' ? 'Catatan (wajib)' : 'Catatan (opsional)'} className={inputClass} maxLength={255} />
        {mode === 'correct' && (
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan koreksi (wajib)" className={inputClass} maxLength={200} />
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className={btnSecondary}>Batal</button>
          {mode === 'verify' && (
            <button type="button" onClick={() => save(true)} disabled={busy || !row.linkedPlaceName} className={btnSecondary}>Dana belum cair</button>
          )}
          <button type="button" onClick={() => save(false)} disabled={busy || !row.linkedPlaceName} className={btnPrimary}>
            {busy ? 'Menyimpan…' : mode === 'correct' ? 'Simpan Koreksi' : 'Verifikasi'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Pengaturan ─────────────────────────────────────────────────────────────

export function SettingsModal({ settings, onClose, onSaved }: { settings: DepositSettings; onClose: () => void; onSaved: (s: DepositSettings) => void }) {
  const [startDate, setStartDate] = useState(settings.startDate)
  const [warnDays, setWarnDays] = useState(String(settings.warnDays))
  const [warnAmount, setWarnAmount] = useState(formatRupiahInput(settings.warnAmount))
  const [awaitingFundsDays, setAwaitingFundsDays] = useState(String(settings.awaitingFundsDays))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    const { ok, data } = await postJson('/api/bo/deposits/settings', {
      startDate, warnDays: Number(warnDays), warnAmount: parseRupiahInput(warnAmount), awaitingFundsDays: Number(awaitingFundsDays),
    }, 'PUT')
    setBusy(false)
    if (!ok) return setError(String(data.error))
    onSaved(data as unknown as DepositSettings)
  }

  return (
    <Modal title="Pengaturan Setoran" onClose={onClose} busy={busy}>
      <div className="space-y-3 text-sm">
        <label className="block">
          <span className="mb-1 block font-medium text-foreground">Tanggal mulai Setoran</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          <span className="mt-1 block text-xs text-muted-foreground">Shift yang ditutup sejak tanggal ini diverifikasi lewat menu Setoran.</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block font-medium text-foreground">Peringatan: umur (hari)</span>
            <input inputMode="numeric" value={warnDays} onChange={(e) => setWarnDays(e.target.value.replace(/\D/g, ''))} className={inputClass} />
          </label>
          <RupiahField label="… atau total tunai" value={warnAmount} onChange={setWarnAmount} />
        </div>
        <label className="block">
          <span className="mb-1 block font-medium text-foreground">Batas dana belum cair (hari)</span>
          <input inputMode="numeric" value={awaitingFundsDays} onChange={(e) => setAwaitingFundsDays(e.target.value.replace(/\D/g, ''))} className={inputClass} />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className={btnSecondary}>Batal</button>
          <button type="button" onClick={submit} disabled={busy} className={btnPrimary}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </div>
      </div>
    </Modal>
  )
}
