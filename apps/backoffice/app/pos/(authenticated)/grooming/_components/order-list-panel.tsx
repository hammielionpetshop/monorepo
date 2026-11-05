'use client'

import { useCallback, useEffect, useState } from 'react'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'
import type { BootstrapPaymentMethod } from '@/components/pos/pos-client'
import { formatPetAge } from '@/lib/pet-age'
import { NewBadge } from '@/components/ui/new-badge'
import { formatDateTime, formatRp, type GroomingHold, type GroomingOrder } from './types'

interface Props {
  view: 'aktif' | 'selesai'
  /** Metode pelunasan (tanpa metode piutang). */
  paymentMethods: BootstrapPaymentMethod[]
  hasOpenShift: boolean
  canReceiveDebtPayment: boolean
  /** Naik setiap ada nota baru / perubahan dari panel lain → muat ulang. */
  refreshKey: number
  onPrint: (orders: GroomingOrder[]) => void
  /** Cetak (ulang) karcis Grooming Ditahan. */
  onPrintHold: (hold: GroomingHold) => void
  /** Buat nota dari tahanan; `pickup` = sesudah nota tersimpan kucing langsung ditandai diambil. */
  onMakeNota: (hold: GroomingHold, pickup: boolean) => void
  onChanged: () => void
}

const todayWib = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)

type Action =
  | { kind: 'pickup'; order: GroomingOrder }
  | { kind: 'pay'; order: GroomingOrder; methodId: number | null }
  | { kind: 'cancelHold'; hold: GroomingHold; reason: string }

export default function OrderListPanel({ view, paymentMethods, hasOpenShift, canReceiveDebtPayment, refreshKey, onPrint, onPrintHold, onMakeNota, onChanged }: Props) {
  const [orders, setOrders] = useState<GroomingOrder[]>([])
  const [holds, setHolds] = useState<GroomingHold[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [date, setDate] = useState(todayWib())
  const [action, setAction] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ view })
      if (search.trim()) params.set('q', search.trim())
      // Riwayat: per tanggal, kecuali sedang mencari (cari melintasi tanggal).
      if (view === 'selesai' && !search.trim() && date) {
        params.set('from', date)
        params.set('to', date)
      }
      const [res, holdRes] = await Promise.all([
        fetch(`/api/pos/grooming/orders?${params}`),
        fetch(`/api/pos/grooming/holds?${params}`),
      ])
      const data = await res.json().catch(() => ({}))
      const holdData = await holdRes.json().catch(() => ({}))
      if (!res.ok || !holdRes.ok) {
        setError(((res.ok ? holdData : data) as { error?: string }).error ?? 'Gagal memuat daftar grooming')
        return
      }
      setOrders(data as GroomingOrder[])
      setHolds(holdData as GroomingHold[])
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }, [view, search, date])

  useEffect(() => {
    const t = setTimeout(() => { void load() }, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, refreshKey, search])

  async function pickup(order: GroomingOrder): Promise<boolean> {
    const res = await fetch(`/api/pos/grooming/orders/${order.id}/pickup`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setActionError((data as { error?: string }).error ?? 'Gagal menandai kucing diambil')
      return false
    }
    return true
  }

  async function confirmAction() {
    if (!action || busy) return
    setBusy(true)
    setActionError(null)
    try {
      if (action.kind === 'cancelHold') {
        const res = await fetch(`/api/pos/grooming/holds/${action.hold.id}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: action.reason }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setActionError((data as { error?: string }).error ?? 'Gagal membatalkan tahanan')
          return
        }
        setAction(null)
        onChanged()
        return
      }
      if (action.kind === 'pay') {
        if (!action.methodId) {
          setActionError('Pilih metode pembayarannya')
          return
        }
        // Pelunasan lewat jalur piutang yang sudah ada — diarahkan ke nota ini saja — baru
        // kemudian kucing ditandai diambil. Uangnya masuk shift kasir yang sedang berjalan.
        const res = await fetch(`/api/pos/customers/${action.order.owner.id}/debts/pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: action.order.debtRemaining,
            paymentMethodId: action.methodId,
            transactionId: action.order.transactionId,
            note: `Grooming ${action.order.ticketNumber}`,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setActionError((data as { error?: string }).error ?? 'Gagal mencatat pembayaran')
          return
        }
      }
      if (await pickup(action.order)) {
        setAction(null)
        onChanged()
      } else if (action.kind === 'pay') {
        // Uang sudah tercatat tetapi penandaan gagal: muat ulang supaya status lunasnya terlihat,
        // kasir tinggal menekan tombol serah terima lagi.
        onChanged()
      }
    } catch {
      setActionError('Terjadi kesalahan jaringan. Periksa daftar sebelum mengulang, supaya pembayaran tidak tercatat dua kali.')
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const handoverLabel = (o: GroomingOrder) => (o.delivery ? 'Sudah diantar' : 'Diambil')
  const payMethods = paymentMethods.filter((m) => m.type !== 'DEBT')

  return (
    <div>
      {action?.kind === 'cancelHold' && (
        <RequiredChoiceDialog
          title={`Batalkan tahanan TAHAN-${action.hold.id}?`}
          tone="warning"
          actions={[
            { label: 'Kembali', onClick: () => { setAction(null); setActionError(null) }, variant: 'secondary', disabled: busy },
            { label: busy ? 'Memproses…' : 'Ya, batalkan', onClick: () => { void confirmAction() }, variant: 'primary', disabled: busy },
          ]}
        >
          <p>
            {action.hold.owner.name} — {action.hold.lines.map((l) => l.pet.name).join(', ')}. Belum ada nota, jadi tidak ada uang yang dibalik.
          </p>
          <label className="mt-3 block text-sm font-semibold" htmlFor="hold-cancel-reason">Alasan pembatalan *</label>
          <textarea
            id="hold-cancel-reason"
            value={action.reason}
            onChange={(e) => setAction({ ...action, reason: e.target.value })}
            rows={2}
            maxLength={300}
            placeholder="mis. konsumen batal, salah input"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          {actionError && <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{actionError}</p>}
        </RequiredChoiceDialog>
      )}

      {action && action.kind !== 'cancelHold' && (
        <RequiredChoiceDialog
          title={
            action.kind === 'pay'
              ? `Terima pembayaran nota ${action.order.trxNumber}`
              : action.order.delivery
                ? `${action.order.pet.name} sudah diantar ke pemiliknya?`
                : `${action.order.pet.name} sudah diambil pemiliknya?`
          }
          tone={action.kind === 'pickup' && !action.order.isPaid ? 'warning' : 'default'}
          actions={[
            { label: 'Batal', onClick: () => { setAction(null); setActionError(null) }, variant: 'secondary', disabled: busy },
            {
              label: busy ? 'Memproses…' : action.kind === 'pay' ? 'Terima & Selesai' : `Ya, ${handoverLabel(action.order).toLowerCase()}`,
              onClick: () => { void confirmAction() },
              variant: 'primary',
              disabled: busy,
            },
          ]}
        >
          <p>
            <b>{action.order.pet.name}</b> — {action.order.owner.name} — {action.order.serviceName}
          </p>
          {action.kind === 'pay' ? (
            <>
              <p className="mt-2">
                Tagihan nota yang belum dibayar: <b>{formatRp(action.order.debtRemaining)}</b>
                <span className="block text-xs text-muted-foreground">
                  Ini tagihan seluruh nota (semua kucing dan ongkir di nota yang sama), dibayar sekaligus. Uangnya masuk shift Anda.
                </span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {payMethods.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setAction({ ...action, methodId: m.id })}
                    className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                      action.methodId === m.id ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </>
          ) : !action.order.isPaid ? (
            <p className="mt-2">
              Nota ini <b>belum lunas</b> ({formatRp(action.order.debtRemaining)}). Kucing tetap bisa diserahkan; tagihannya tetap
              tercatat sebagai piutang atas nama pemilik.
            </p>
          ) : null}
          {actionError && <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{actionError}</p>}
        </RequiredChoiceDialog>
      )}

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama kucing, pemilik, nomor HP, nomor nota, atau karcis TAHAN"
          className="w-full max-w-md border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {view === 'selesai' && (
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={Boolean(search.trim())}
            className="border border-input rounded-md px-3 py-2 text-sm bg-background disabled:opacity-50"
          />
        )}
        <button type="button" onClick={() => { void load() }} className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
          Muat ulang
        </button>
      </div>

      {error && <div className="mb-3 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
      {loading && <p className="text-sm text-muted-foreground">Memuat…</p>}
      {holds.length > 0 && (
        <ul className="mb-3 space-y-2">
          {holds.map((h) => (
            <li
              key={`hold-${h.id}`}
              className={`rounded-lg border p-3 ${h.status === 'DITAHAN' ? 'border-amber-500/50 bg-amber-500/5' : 'border-border bg-card'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold">{h.owner.name}</span>
                    {h.owner.phone && <span className="text-muted-foreground">{h.owner.phone}</span>}
                    {h.status === 'DITAHAN' ? (
                      <span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-200">
                        BELUM ADA NOTA
                      </span>
                    ) : (
                      <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        DIBATALKAN — TANPA NOTA
                      </span>
                    )}
                    {h.delivery && (
                      <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-700">DIANTAR</span>
                    )}
                    <NewBadge feature="fitur/grooming-tahan" />
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {h.lines.map((l) => (
                      <li key={l.sequence}>
                        <b>{l.pet.name}</b> <span className="text-muted-foreground">({l.pet.species}, {l.pet.color}, {formatPetAge(l.pet.birthDate)})</span>
                        {' '}· {l.serviceName} · Groomer: <b>{l.groomer.name}</b>
                        <span className="text-xs text-muted-foreground"> · Karcis {l.ticketNumber}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="text-xs text-muted-foreground">
                    Ditahan {formatDateTime(h.heldAt)}
                    {h.cancelledAt ? ` · batal ${formatDateTime(h.cancelledAt)} (${h.cancelReason ?? '-'})` : ''}
                  </div>
                  {h.delivery && (
                    <div className="text-xs text-muted-foreground">
                      Delivery: {h.delivery.courier.name} · {h.delivery.address}{h.delivery.free ? ' · gratis ongkir' : ''}
                    </div>
                  )}
                  {expandedId === -h.id && (
                    <div className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-xs">
                      {h.lines.map((l) => (
                        <span key={l.sequence} className="block"><b>Kondisi {l.pet.name}:</b> {l.condition}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {h.status === 'DITAHAN' && (
                    <>
                      <button
                        type="button"
                        disabled={!hasOpenShift}
                        title={hasOpenShift ? undefined : 'Buka shift dulu untuk membuat nota'}
                        onClick={() => onMakeNota(h, false)}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        Buat Nota
                      </button>
                      <button
                        type="button"
                        disabled={!hasOpenShift}
                        title={hasOpenShift ? undefined : 'Buka shift dulu untuk membuat nota'}
                        onClick={() => onMakeNota(h, true)}
                        className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
                      >
                        Buat Nota &amp; {h.delivery ? 'Antar' : 'Ambil'}
                      </button>
                    </>
                  )}
                  <button type="button" onClick={() => setExpandedId(expandedId === -h.id ? null : -h.id)} className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted">
                    {expandedId === -h.id ? 'Tutup' : 'Lihat'}
                  </button>
                  {h.status === 'DITAHAN' && (
                    <>
                      <button type="button" onClick={() => onPrintHold(h)} className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted">
                        Cetak karcis
                      </button>
                      <button
                        type="button"
                        onClick={() => { setActionError(null); setAction({ kind: 'cancelHold', hold: h, reason: '' }) }}
                        className="rounded-md border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10"
                      >
                        Batalkan
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && orders.length === 0 && holds.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {view === 'aktif' ? 'Tidak ada kucing yang sedang dikerjakan.' : 'Tidak ada riwayat untuk pilihan ini.'}
        </p>
      )}

      <ul className="space-y-2">
        {orders.map((o) => (
          <li key={o.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold">{o.pet.name}</span>
                  <span className="text-muted-foreground">{o.pet.species}, {o.pet.color}, {formatPetAge(o.pet.birthDate)}</span>
                  {o.status === 'DIBATALKAN' ? (
                    <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">DIBATALKAN</span>
                  ) : o.isPaid ? (
                    <span className="rounded-md border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-700">LUNAS</span>
                  ) : (
                    <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      BELUM LUNAS {formatRp(o.debtRemaining)}
                    </span>
                  )}
                  {o.delivery && (
                    <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-700">DIANTAR</span>
                  )}
                </div>
                <div className="mt-1">
                  {o.owner.name} {o.owner.phone ? `· ${o.owner.phone}` : ''} · {o.serviceName} · Groomer: <b>{o.groomer.name}</b>
                </div>
                <div className="text-xs text-muted-foreground">
                  Karcis {o.ticketNumber} · masuk {formatDateTime(o.receivedAt)}
                  {o.pickedUpAt ? ` · ${o.delivery ? 'diantar' : 'diambil'} ${formatDateTime(o.pickedUpAt)}` : ''}
                  {o.cancelledAt ? ` · batal ${formatDateTime(o.cancelledAt)} (${o.cancelReason ?? '-'})` : ''}
                </div>
                {o.delivery && (
                  <div className="text-xs text-muted-foreground">
                    Delivery: {o.delivery.courier.name} · {o.delivery.address} · ongkir {o.delivery.fee > 0 ? formatRp(o.delivery.fee) : 'gratis'}
                  </div>
                )}
                {expandedId === o.id && (
                  <div className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-xs">
                    <b>Kondisi saat diterima:</b> {o.condition}
                    <span className="block">Harga jasa: {formatRp(o.price)} · Nota: {o.trxNumber}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {view === 'aktif' && !o.isPaid && canReceiveDebtPayment && (
                  <button
                    type="button"
                    disabled={!hasOpenShift}
                    title={hasOpenShift ? undefined : 'Buka shift dulu untuk menerima pembayaran'}
                    onClick={() => { setActionError(null); setAction({ kind: 'pay', order: o, methodId: payMethods[0]?.id ?? null }) }}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Bayar &amp; {o.delivery ? 'Antar' : 'Ambil'}
                  </button>
                )}
                {view === 'aktif' && (
                  <button
                    type="button"
                    onClick={() => { setActionError(null); setAction({ kind: 'pickup', order: o }) }}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                      o.isPaid ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'border border-border hover:bg-muted'
                    }`}
                  >
                    {handoverLabel(o)}
                  </button>
                )}
                <button type="button" onClick={() => setExpandedId(expandedId === o.id ? null : o.id)} className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted">
                  {expandedId === o.id ? 'Tutup' : 'Lihat'}
                </button>
                {o.status !== 'DIBATALKAN' && (
                  <button type="button" onClick={() => onPrint([o])} className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted">
                    Cetak karcis
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
