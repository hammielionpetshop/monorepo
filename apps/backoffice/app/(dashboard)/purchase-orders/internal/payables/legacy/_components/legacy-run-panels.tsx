'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { simulationTotals } from '@/lib/services/legacy-settlement-rules'
import type { LegacyCancelledRun, LegacyRunInfo } from '@/lib/services/legacy-settlement-service'

// F2-3b-2 — Jalankan / Batalkan pelunasan susulan (spec docs/work/specs/2026-11-08-f2-3b-utang-lama-design.md §4).

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`
const wibDateTime = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' })
const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-1.5 text-foreground'

async function postJson(url: string, body: unknown): Promise<string | null> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (res.ok) return null
  const json = await res.json().catch(() => ({}))
  return json.error ?? 'Gagal menyimpan'
}

export function RunDialog({ fromDate, cutoffDate, includeNoncash, subtractManual, totals, onClose }: {
  fromDate: string
  cutoffDate: string
  includeNoncash: boolean
  subtractManual: boolean
  totals: ReturnType<typeof simulationTotals>
  onClose: () => void
}) {
  const router = useRouter()
  const [confirmDigits, setConfirmDigits] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmTotal = Number(confirmDigits || 0)
  const matches = confirmTotal === totals.settled

  async function submit() {
    setBusy(true)
    setError(null)
    const err = await postJson('/api/bo/inter-branch-payables/legacy-run', {
      fromDate, includeNoncash, subtractManual, confirmTotal, expectedFingerprint: totals.fingerprint, notes,
    })
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg space-y-3 rounded-lg border border-border bg-card p-5 text-sm shadow-lg">
        <h2 className="text-base font-semibold text-foreground">Jalankan pelunasan susulan utang lama</h2>
        <ul className="space-y-0.5 text-foreground">
          <li>Setoran dihitung sejak <b>{fromDate}</b> s.d. sebelum {cutoffDate}</li>
          <li>
            Non-tunai: <b>{includeNoncash ? 'ikut' : 'tidak ikut'}</b> · Pelunasan manual:{' '}
            <b>{subtractManual ? 'dikurangi' : 'tidak dikurangi'}</b>
          </li>
          <li>
            Dilunasi: <b>{rupiah(totals.settled)}</b> pada {totals.payablesCount} nota · setoran bebas lama {rupiah(totals.free)}
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Tiap nota tercatat lunas/sebagian dengan Riwayat bertanda SUSULAN (bukan uang kas baru, tidak masuk Pendapatan &amp;
          Pengeluaran). Hanya satu pelaksanaan boleh berlaku; bisa dibatalkan seluruhnya nanti.
        </p>
        <label className="block space-y-1">
          <span className="text-foreground">Ketik ulang total dilunasi</span>
          <input
            inputMode="numeric"
            value={confirmDigits ? Number(confirmDigits).toLocaleString('id-ID') : ''}
            onChange={(e) => setConfirmDigits(e.target.value.replace(/\D/g, '').slice(0, 13))}
            placeholder="ketik angkanya"
            className={inputClass}
          />
          {confirmDigits && !matches && (
            <span className="text-xs text-red-700 dark:text-red-400">Belum sama dengan {rupiah(totals.settled)}</span>
          )}
        </label>
        <label className="block space-y-1">
          <span className="text-foreground">Catatan (wajib)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="mis. sudah dicocokkan dengan catatan setoran Oktober"
            className={inputClass}
          />
        </label>
        {error && <p className="rounded-md bg-red-50 p-2 text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md border border-border px-3 py-1.5 text-foreground hover:bg-muted">
            Batal
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !matches || notes.trim().length < 5}
            className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? 'Menjalankan…' : 'Jalankan'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ActiveRunCard({ run, canRun }: { run: LegacyRunInfo; canRun: boolean }) {
  const router = useRouter()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lines = run.lines.filter((l) => !l.reversed)
  const paidCount = lines.filter((l) => l.creditorBranchName != null).length

  async function cancel() {
    setBusy(true)
    setError(null)
    const err = await postJson(`/api/bo/inter-branch-payables/legacy-run/${run.id}/cancel`, { reason })
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setCancelOpen(false)
    router.refresh()
  }

  return (
    <div className="space-y-3 rounded-lg border border-green-600/40 bg-card p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-foreground">Pelunasan susulan SUSULAN-{run.id} sudah berlaku</p>
          <p className="text-muted-foreground">
            Dijalankan {run.createdByName ?? '—'} · {wibDateTime(run.createdAt)} · setoran sejak {run.fromDate} s.d. sebelum{' '}
            {run.cutoffDate} · non-tunai {run.includeNoncash ? 'ikut' : 'tidak ikut'} · pelunasan manual{' '}
            {run.subtractManual ? 'dikurangi' : 'tidak dikurangi'}
          </p>
          <p className="mt-1 text-foreground">Catatan: {run.notes}</p>
        </div>
        {canRun && !cancelOpen && (
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="rounded-md border border-red-600/50 px-3 py-1 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Batalkan pelunasan susulan…
          </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Dilunasi" value={rupiah(run.settledAmount)} note={`${run.payablesCount} nota`} />
        <Stat label="Setoran bebas lama" value={rupiah(run.freeAmount)} note="hanya info" />
        <Stat label="Sisa utang lama" value="Lihat Utang Internal" note="penyaring Utang lama · bayar manual / hapus" />
      </div>
      {cancelOpen && (
        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <p className="text-foreground">
            Semua pelunasan SUSULAN-{run.id} dibalik (Riwayat bertanda BATAL SUSULAN, tidak ada yang dihapus) dan nota kembali
            terbuka. Sesudah itu pratinjau bisa dibuka lagi dan dijalankan ulang dengan pilihan lain.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Alasan pembatalan (wajib)"
            className={inputClass}
          />
          {error && <p className="text-red-700 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setCancelOpen(false)} disabled={busy} className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-muted">
              Tutup
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={busy || reason.trim().length < 5}
              className="rounded-md bg-red-600 px-3 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? 'Membatalkan…' : 'Batalkan seluruhnya'}
            </button>
          </div>
        </div>
      )}
      <section>
        <h3 className="mb-1 font-semibold text-foreground">Rincian ({paidCount} pelunasan)</h3>
        <ul className="space-y-0.5 text-xs">
          {lines.map((l) => (
            <li key={l.id} className="text-foreground" style={{ paddingLeft: `${(l.level - 1) * 16}px` }}>
              {l.level > 1 ? '↳ ' : ''}
              {l.creditorBranchName != null
                ? <>{l.payerBranchName} → {l.ibtNumber ?? 'nota'} ({l.creditorBranchName}) <b>{rupiah(l.amount)}</b></>
                : <>Setoran bebas {l.payerBranchName} <b>{rupiah(l.amount)}</b></>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

export function CancelledRuns({ runs }: { runs: LegacyCancelledRun[] }) {
  if (runs.length === 0) return null
  return (
    <details className="rounded-lg border border-border bg-card p-3 text-sm">
      <summary className="cursor-pointer text-muted-foreground">Pelunasan susulan yang dibatalkan ({runs.length})</summary>
      <ul className="mt-2 space-y-1 text-xs text-foreground">
        {runs.map((r) => (
          <li key={r.id}>
            SUSULAN-{r.id} · sejak {r.fromDate} · {rupiah(r.settledAmount)} · dijalankan {wibDateTime(r.createdAt)} · dibatalkan{' '}
            {r.cancelledByName ?? '—'} {wibDateTime(r.cancelledAt)}
            {r.cancelReason ? ` — ${r.cancelReason}` : ''}
          </li>
        ))}
      </ul>
    </details>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  )
}
