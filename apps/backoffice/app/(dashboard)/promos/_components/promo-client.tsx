'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NewBadge } from '@/components/ui/new-badge'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'
import { PROMO_STATUS_LABEL, type PromoStatus } from '@/lib/promo/promo-engine'
import { describePromo, formatPromoPeriod, promoKindLabel } from '@/lib/promo/promo-form'
import PromoFormDialog from './promo-form-dialog'
import type { BranchOption, PromoItemOption, PromoView } from './types'

const STATUS_FILTERS: ('SEMUA' | PromoStatus)[] = ['SEMUA', 'BERJALAN', 'BELUM_MULAI', 'BERAKHIR', 'NONAKTIF']

const STATUS_CLASS: Record<PromoStatus, string> = {
  BERJALAN: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  BELUM_MULAI: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  BERAKHIR: 'bg-muted text-muted-foreground',
  NONAKTIF: 'bg-destructive/10 text-destructive',
}

async function sendJson(url: string, method: string, body?: unknown): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error ?? `Gagal (${res.status})` }
    return { ok: true, data }
  } catch {
    return { ok: false, error: 'Terjadi kesalahan jaringan, silakan coba lagi' }
  }
}

/** Saklar darurat: matikan / nyalakan semua promo sekaligus, semua cabang. */
function PromoSwitch({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setBusy(true)
    setError(null)
    const result = await sendJson('/api/bo/settings/promo-switch', 'PUT', { enabled: !enabled })
    if (result.ok) setEnabled((result.data as { enabled: boolean }).enabled)
    else setError(result.error)
    setBusy(false)
    setConfirming(false)
  }

  return (
    <section className={`mb-4 rounded-lg border p-4 ${enabled ? 'border-border bg-card' : 'border-destructive/40 bg-destructive/5'}`}>
      {confirming && (
        <RequiredChoiceDialog
          title={enabled ? 'Matikan semua promo?' : 'Nyalakan lagi semua promo?'}
          tone={enabled ? 'danger' : 'warning'}
          actions={[
            { label: 'Batal', variant: 'secondary', disabled: busy, onClick: () => setConfirming(false) },
            {
              label: busy ? 'Menyimpan…' : enabled ? 'Ya, matikan semua' : 'Ya, nyalakan',
              variant: enabled ? 'destructive' : 'primary',
              disabled: busy,
              onClick: () => { void toggle() },
            },
          ]}
        >
          {enabled ? (
            <p>Semua promo berhenti di <b>semua cabang</b> sampai dinyalakan lagi. Kasir kembali seperti tanpa promo. Daftar promo tidak berubah.</p>
          ) : (
            <p>Promo yang sedang dalam masa berlakunya langsung berjalan lagi di kasir.</p>
          )}
          <p>Perubahan ini tercatat atas nama Anda.</p>
        </RequiredChoiceDialog>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            Saklar darurat promo <NewBadge feature="fitur/saklar-promo" />
          </h2>
          <p className="text-xs text-muted-foreground">
            {enabled
              ? 'Promo MENYALA. Bila ada masalah di kasir, matikan semua promo sekaligus di sini.'
              : 'SEMUA PROMO DIMATIKAN di semua cabang. Kasir berjalan tanpa promo.'}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirming(true)}
          className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${
            enabled ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {enabled ? 'Matikan semua promo' : 'Nyalakan promo'}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  )
}

export default function PromoClient({
  promos, enabled, items, branches, today, defaultBranchIds,
}: {
  promos: PromoView[]
  enabled: boolean
  items: PromoItemOption[]
  branches: BranchOption[]
  today: string
  defaultBranchIds: number[]
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>('SEMUA')
  const [creating, setCreating] = useState(false)
  const [deactivating, setDeactivating] = useState<PromoView | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const shown = filter === 'SEMUA' ? promos : promos.filter((p) => p.status === filter)
  const countOf = (s: (typeof STATUS_FILTERS)[number]) => (s === 'SEMUA' ? promos.length : promos.filter((p) => p.status === s).length)

  async function deactivate(promo: PromoView) {
    setBusy(true)
    const result = await sendJson(`/api/bo/promos/${promo.id}/deactivate`, 'POST')
    setBusy(false)
    setDeactivating(null)
    setMessage(result.ok ? { type: 'ok', text: `Promo "${promo.name}" dinonaktifkan.` } : { type: 'error', text: result.error })
    if (result.ok) router.refresh()
  }

  return (
    <>
      <PromoSwitch initialEnabled={enabled} />

      {creating && (
        <PromoFormDialog
          items={items}
          branches={branches}
          today={today}
          defaultBranchIds={defaultBranchIds}
          onClose={() => setCreating(false)}
          onCreated={(name) => {
            setCreating(false)
            setMessage({ type: 'ok', text: `Promo "${name}" tersimpan.` })
            router.refresh()
          }}
        />
      )}

      {deactivating && (
        <RequiredChoiceDialog
          title="Nonaktifkan promo?"
          tone="danger"
          actions={[
            { label: 'Batal', variant: 'secondary', disabled: busy, onClick: () => setDeactivating(null) },
            { label: busy ? 'Menyimpan…' : 'Ya, nonaktifkan', variant: 'destructive', disabled: busy, onClick: () => { void deactivate(deactivating) } },
          ]}
        >
          <p>
            Promo <b>{deactivating.name}</b> langsung berhenti di semua cabangnya dan <b>tidak bisa dinyalakan lagi</b>. Bila masih
            dibutuhkan, buat promo baru. Nota yang sudah memakai promo ini tidak berubah.
          </p>
          <p>Perubahan ini tercatat atas nama Anda.</p>
        </RequiredChoiceDialog>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`rounded-md px-3 py-1.5 text-sm ${filter === s ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'}`}
            >
              {s === 'SEMUA' ? 'Semua' : PROMO_STATUS_LABEL[s]} ({countOf(s)})
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { setMessage(null); setCreating(true) }}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + Buat promo
        </button>
      </div>

      {message && (
        <p className={`mb-4 text-sm ${message.type === 'ok' ? 'text-green-700' : 'text-destructive'}`}>{message.text}</p>
      )}

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {promos.length === 0 ? 'Belum ada promo. Klik "+ Buat promo" untuk membuat yang pertama.' : 'Tidak ada promo dengan keadaan ini.'}
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((p) => (
            <li key={p.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.name}</span>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[p.status]}`}>{PROMO_STATUS_LABEL[p.status]}</span>
                    <span className="text-xs text-muted-foreground">{promoKindLabel(p.kind)}</span>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-sm">
                    {describePromo(p).map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatPromoPeriod(p)} · Cabang: {p.branchNames.join(', ')}
                  </p>
                  {p.note && <p className="mt-1 text-xs text-muted-foreground">Catatan: {p.note}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dibuat {p.createdByName ?? '-'} · {new Date(p.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
                    {p.deactivatedAt && ` · Dinonaktifkan ${p.deactivatedByName ?? '-'} · ${new Date(p.deactivatedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`}
                  </p>
                </div>
                {p.status !== 'NONAKTIF' && p.status !== 'BERAKHIR' && (
                  <button
                    type="button"
                    onClick={() => { setMessage(null); setDeactivating(p) }}
                    className="rounded-md border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                  >
                    Nonaktifkan
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
