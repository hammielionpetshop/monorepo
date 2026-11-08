'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatRupiah, formatWIB } from '@petshop/shared'
import { ProofPhotoLink } from '@/components/ui/proof-photo-field'
import type {
  DepositDestination, DepositListItem, NoncashRow, UndepositedBranchSummary, UndepositedShift,
} from '@/lib/services/deposit-queries'
import type { DepositSettings } from '@/lib/services/deposit-rules'
import {
  CAUSE_LABEL, NoncashModal, ReceiveModal, SettingsModal, VerifyCashModal, btnPrimary, btnSecondary, postJson,
} from './deposit-forms'

type Tab = 'pending' | 'noncash' | 'undeposited' | 'history'

interface Props {
  initialTab: Tab
  branches: { id: number; name: string }[]
  destinations: DepositDestination[]
  defaults: { branchId: number; moneyPlaceId: number }[]
  paymentMethods: { id: number; name: string }[]
  initialSettings: DepositSettings
  canCorrect: boolean
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: 'Menunggu Verifikasi' },
  { key: 'noncash', label: 'Non-tunai' },
  { key: 'undeposited', label: 'Tunai belum disetor' },
  { key: 'history', label: 'Riwayat' },
]

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Menunggu verifikasi', cls: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  VERIFIED: { label: 'Terverifikasi', cls: 'bg-green-500/10 text-green-700 border-green-500/20' },
  CANCELLED: { label: 'Batal', cls: 'bg-muted text-muted-foreground border-border' },
  CORRECTED: { label: 'Dikoreksi', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  AWAITING_FUNDS: { label: 'Dana belum cair', cls: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
}

const HELD_BY_LABEL: Record<string, string> = { FINANCE: 'Finance', STORE: 'Toko', OTHER: 'Lainnya' }

function Pill({ status }: { status: string }) {
  const p = STATUS_PILL[status] ?? { label: status, cls: 'bg-muted text-muted-foreground border-border' }
  return <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-md border ${p.cls}`}>{p.label}</span>
}

function Variance({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">-</span>
  if (value === 0) return <span className="text-green-600">✓ Cocok</span>
  return <span className={value < 0 ? 'text-red-600' : 'text-green-700'}>{formatRupiah(value)}</span>
}

function daysAgo(n: number): string {
  return new Date(Date.now() + 7 * 3600_000 - n * 86_400_000).toISOString().slice(0, 10)
}

export default function DepositsClient(props: Props) {
  const { branches, destinations, defaults, paymentMethods, canCorrect } = props
  const [tab, setTab] = useState<Tab>(props.initialTab)
  const [settings, setSettings] = useState(props.initialSettings)
  const [branchFilter, setBranchFilter] = useState<number | ''>(branches.length === 1 ? branches[0].id : '')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const [pending, setPending] = useState<DepositListItem[]>([])
  const [history, setHistory] = useState<DepositListItem[]>([])
  const [undeposited, setUndeposited] = useState<{ summary: UndepositedBranchSummary[]; shifts: UndepositedShift[] }>({ summary: [], shifts: [] })
  const [noncash, setNoncash] = useState<NoncashRow[]>([])
  const [historyNoncash, setHistoryNoncash] = useState<NoncashRow[]>([])

  const [from, setFrom] = useState(daysAgo(14))
  const [to, setTo] = useState(daysAgo(0))
  const [methodFilter, setMethodFilter] = useState<number | ''>('')
  const [noncashStatus, setNoncashStatus] = useState<'' | 'PENDING' | 'AWAITING_FUNDS' | 'VERIFIED'>('')
  const [expandedBranch, setExpandedBranch] = useState<number | null>(null)

  const [verifying, setVerifying] = useState<{ deposit: DepositListItem; mode: 'verify' | 'correct' } | null>(null)
  const [receiving, setReceiving] = useState<{ branchId: number | null } | null>(null)
  const [noncashEdit, setNoncashEdit] = useState<{ row: NoncashRow; mode: 'verify' | 'correct' } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), message.kind === 'ok' ? 3500 : 7000)
    return () => clearTimeout(t)
  }, [message])

  const query = useCallback((extra: Record<string, string | number | ''> = {}) => {
    const p = new URLSearchParams()
    if (branchFilter !== '') p.set('branchId', String(branchFilter))
    for (const [k, v] of Object.entries(extra)) if (v !== '') p.set(k, String(v))
    return p.toString()
  }, [branchFilter])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const get = async (url: string) => {
        const res = await fetch(url)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error ?? `Gagal memuat (${res.status})`)
        return data
      }
      // Tunai belum disetor selalu dimuat untuk semua cabang dalam akses: dipakai juga oleh Terima Setoran.
      const und = await get('/api/bo/deposits/undeposited')
      setUndeposited({ summary: und.summary, shifts: und.shifts })
      if (tab === 'pending') setPending((await get(`/api/bo/deposits?${query({ tab: 'pending' })}`)).items)
      if (tab === 'history') {
        const [h, n] = await Promise.all([
          get(`/api/bo/deposits?${query({ tab: 'history', from, to })}`),
          get(`/api/bo/deposits/noncash?${query({ from, to })}`),
        ])
        setHistory(h.items)
        setHistoryNoncash((n.rows as NoncashRow[]).filter((r) => r.status === 'VERIFIED'))
      }
      if (tab === 'noncash') setNoncash((await get(`/api/bo/deposits/noncash?${query({ from, to, paymentMethodId: methodFilter })}`)).rows)
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Gagal memuat data' })
    } finally {
      setLoading(false)
    }
  }, [tab, query, from, to, methodFilter])

  useEffect(() => { load() }, [load])

  function done(text: string) {
    setVerifying(null)
    setReceiving(null)
    setNoncashEdit(null)
    setMessage({ kind: 'ok', text })
    load()
  }

  async function cancelDeposit(d: DepositListItem) {
    const reason = window.prompt(`Alasan membatalkan ${d.depositNumber}? Shift-nya kembali ke Tunai belum disetor.`)
    if (!reason?.trim()) return
    const { ok, data } = await postJson(`/api/bo/deposits/${d.id}/cancel`, { reason: reason.trim() })
    if (!ok) return setMessage({ kind: 'error', text: String(data.error) })
    done(`Setoran ${d.depositNumber} dibatalkan`)
  }

  const visibleNoncash = useMemo(
    () => noncash.filter((r) => noncashStatus === '' || r.status === noncashStatus),
    [noncash, noncashStatus],
  )
  const summary = useMemo(
    () => undeposited.summary.filter((s) => branchFilter === '' || s.branchId === branchFilter),
    [undeposited.summary, branchFilter],
  )
  const overdueCount = summary.filter((s) => s.level === 'OVER').length

  return (
    <>
      {message && (
        <div role={message.kind === 'ok' ? 'status' : 'alert'} className={`mb-4 px-4 py-3 rounded-md text-sm border ${message.kind === 'ok'
          ? 'bg-green-50 border-green-200 text-green-800' : 'bg-destructive/10 border-destructive/20 text-destructive'}`}>
          {message.text}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {t.label}
              {t.key === 'pending' && pending.length > 0 && tab === 'pending' && <span className="ml-1 text-xs">({pending.length})</span>}
              {t.key === 'undeposited' && overdueCount > 0 && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-red-500" aria-label="Ada cabang lewat batas" />}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {branches.length > 1 && (
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value ? Number(e.target.value) : '')} className="px-2 py-1.5 text-sm border border-border rounded-md bg-background" aria-label="Cabang">
              <option value="">Semua cabang</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <button type="button" onClick={() => setReceiving({ branchId: branchFilter === '' ? null : branchFilter })} className={btnPrimary}>Terima Setoran</button>
          {canCorrect && <button type="button" onClick={() => setSettingsOpen(true)} className={btnSecondary}>Pengaturan</button>}
        </div>
      </div>

      {(tab === 'noncash' || tab === 'history') && (
        <div className="mb-3 flex flex-wrap items-end gap-2 text-sm">
          <label>Dari <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-1 px-2 py-1 border border-border rounded-md bg-background" /></label>
          <label>sampai <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ml-1 px-2 py-1 border border-border rounded-md bg-background" /></label>
          {tab === 'noncash' && (
            <>
              <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value ? Number(e.target.value) : '')} className="px-2 py-1.5 border border-border rounded-md bg-background" aria-label="Metode">
                <option value="">Semua metode</option>
                {paymentMethods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select value={noncashStatus} onChange={(e) => setNoncashStatus(e.target.value as typeof noncashStatus)} className="px-2 py-1.5 border border-border rounded-md bg-background" aria-label="Status">
                <option value="">Semua status</option>
                <option value="PENDING">Menunggu</option>
                <option value="AWAITING_FUNDS">Dana belum cair</option>
                <option value="VERIFIED">Terverifikasi</option>
              </select>
            </>
          )}
          <span className="text-xs text-muted-foreground">Mulai Setoran: {settings.startDate}</span>
        </div>
      )}

      {loading && <p className="mb-2 text-xs text-muted-foreground">Memuat…</p>}

      {tab === 'pending' && (
        pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada setoran yang menunggu verifikasi.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((d) => (
              <div key={d.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{d.depositNumber} <span className="font-normal text-muted-foreground">· {d.branchName}</span></p>
                    <p className="text-xs text-muted-foreground">
                      Setor {d.depositDate} ke {d.destinationName} · dilaporkan {d.reportedByName ?? '-'} {formatWIB(d.reportedAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Kas shift / menurut pelapor</p>
                    <p className="font-semibold tabular-nums">{formatRupiah(d.shiftTotal)} / {formatRupiah(d.reportedAmount)}</p>
                  </div>
                </div>
                <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                  {d.shifts.map((s) => (
                    <li key={s.shiftId} className="rounded border border-border px-2 py-0.5">
                      {s.openedOn} #{s.shiftNumber}{s.legacy ? ' (lama)' : ''} · {formatRupiah(s.cash)}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <ProofPhotoLink url={d.slipPhotoUrl} />
                  {d.notes && <span className="text-xs text-muted-foreground">Catatan: {d.notes}</span>}
                  <div className="ml-auto flex gap-2">
                    <button type="button" onClick={() => cancelDeposit(d)} className={btnSecondary}>Batalkan</button>
                    <button type="button" onClick={() => setVerifying({ deposit: d, mode: 'verify' })} className={btnPrimary}>Verifikasi</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'noncash' && (
        visibleNoncash.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada pembayaran non-tunai pada rentang ini (sejak tanggal mulai Setoran).</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                  <th className="px-3 py-2 text-left font-medium">Cabang · Shift</th>
                  <th className="px-3 py-2 text-left font-medium">Metode</th>
                  <th className="px-3 py-2 text-right font-medium">Angka sistem</th>
                  <th className="px-3 py-2 text-left font-medium">Rekening</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Diterima / selisih</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {visibleNoncash.map((r) => (
                  <tr key={r.key} className={`border-b border-border last:border-0 ${r.overdue ? 'bg-red-50' : ''}`}>
                    <td className="px-3 py-2 whitespace-nowrap">{r.businessDate}</td>
                    <td className="px-3 py-2">{r.branchName} · {r.shiftNumber ? `#${r.shiftNumber}` : <span className="text-blue-700">Pelunasan BO</span>}</td>
                    <td className="px-3 py-2">{r.paymentMethodName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(r.expected)}</td>
                    <td className="px-3 py-2">{r.moneyPlaceName ?? r.linkedPlaceName ?? <span className="text-xs text-destructive">belum ditautkan</span>}</td>
                    <td className="px-3 py-2">
                      {r.status === 'PENDING' ? <span className="text-xs text-amber-700">Menunggu</span> : <Pill status={r.status} />}
                      {r.overdue && <span className="ml-1 text-xs text-red-600">lewat {settings.awaitingFundsDays} hari</span>}
                      {r.changedAfterVerify && <span className="block text-xs text-red-600">Angka sistem berubah sesudah diverifikasi (dulu {formatRupiah(r.verifiedExpected ?? 0)})</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.received != null ? (
                        <>
                          {formatRupiah(r.received)} <span className="block text-xs"><Variance value={r.variance} />{r.cause && r.variance ? ` · ${CAUSE_LABEL[r.cause] ?? r.cause}` : ''}</span>
                        </>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {r.status !== 'VERIFIED' && (
                        <button type="button" onClick={() => setNoncashEdit({ row: r, mode: 'verify' })} className="text-xs text-primary hover:underline">Verifikasi</button>
                      )}
                      {r.status === 'VERIFIED' && (
                        <span className="text-xs text-muted-foreground">
                          {r.verifiedByName}
                          {canCorrect && r.verificationId && (
                            <button type="button" onClick={() => setNoncashEdit({ row: r, mode: 'correct' })} className="ml-2 text-primary hover:underline">Koreksi</button>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'undeposited' && (
        summary.length === 0 ? (
          <p className="text-sm text-muted-foreground">Semua tunai sudah masuk setoran.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-medium">Cabang</th>
                  <th className="px-3 py-2 text-right font-medium">Shift</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 text-left font-medium">Shift tertua</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <FragmentRows key={s.branchId}>
                    <tr
                      className={`border-b border-border cursor-pointer hover:bg-muted/50 ${s.level === 'OVER' ? 'bg-red-50' : s.level === 'WARN' ? 'bg-amber-50' : ''}`}
                      onClick={() => setExpandedBranch(expandedBranch === s.branchId ? null : s.branchId)}
                    >
                      <td className="px-3 py-2 font-medium">
                        {s.branchName}
                        {s.legacyCount > 0 && <span className="ml-1 text-xs text-muted-foreground">({s.legacyCount} lama)</span>}
                      </td>
                      <td className="px-3 py-2 text-right">{s.shiftCount}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${s.total >= settings.warnAmount ? 'text-red-600 font-semibold' : ''}`}>{formatRupiah(s.total)}</td>
                      <td className={`px-3 py-2 ${s.oldestAgeDays >= settings.warnDays ? 'text-red-600 font-semibold' : ''}`}>{s.oldestClosedOn} ({s.oldestAgeDays} hari)</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setReceiving({ branchId: s.branchId }) }} className="text-xs text-primary hover:underline">Terima Setoran</button>
                      </td>
                    </tr>
                    {expandedBranch === s.branchId && undeposited.shifts.filter((x) => x.branchId === s.branchId).map((x) => (
                      <tr key={x.shiftId} className="border-b border-border bg-muted/30 text-xs">
                        <td className="px-6 py-1.5" colSpan={2}>
                          {x.openedOn} · Shift #{x.shiftNumber}
                          {x.origin === 'BACKOFFICE' && <span className="ml-1 text-blue-700">Bulk Sale</span>}
                          {x.legacy && <span className="ml-1 text-muted-foreground">(lama)</span>}
                          {x.status === 'FORCE_CLOSED' && <span className="ml-1 text-amber-700">tutup paksa · kas sistem</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatRupiah(x.cash)}</td>
                        <td className="px-3 py-1.5" colSpan={2}>{x.ageDays} hari</td>
                      </tr>
                    ))}
                  </FragmentRows>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Merah = shift tertua ≥ {settings.warnDays} hari atau total ≥ {formatRupiah(settings.warnAmount)}; jingga = mendekati batas.
            </p>
          </div>
        )
      )}

      {tab === 'history' && (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold text-foreground">Setoran tunai</h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada setoran pada rentang ini.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left font-medium">Nomor</th>
                      <th className="px-3 py-2 text-left font-medium">Cabang</th>
                      <th className="px-3 py-2 text-left font-medium">Tujuan</th>
                      <th className="px-3 py-2 text-right font-medium">Kas shift</th>
                      <th className="px-3 py-2 text-right font-medium">Diterima</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-left font-medium">Oleh</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((d) => (
                      <tr key={d.id} className="border-b border-border last:border-0 align-top">
                        <td className="px-3 py-2 whitespace-nowrap">
                          {d.depositNumber}
                          <span className="block text-xs text-muted-foreground">{d.depositDate} · {d.shifts.length} shift · {d.reportChannel === 'POS' ? 'lapor POS' : 'diterima BO'}</span>
                          {d.correctsDepositNumber && <span className="block text-xs text-amber-700">koreksi atas {d.correctsDepositNumber}</span>}
                        </td>
                        <td className="px-3 py-2">{d.branchName}</td>
                        <td className="px-3 py-2">{d.destinationName}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(d.shiftTotal)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {d.receivedAmount != null ? formatRupiah(d.receivedAmount) : '-'}
                          {d.receivedAmount != null && <span className="block text-xs"><Variance value={d.receivedAmount - d.shiftTotal} /></span>}
                          {d.variances.map((v, i) => (
                            <span key={i} className="block text-xs text-muted-foreground">
                              {CAUSE_LABEL[v.cause] ?? v.cause} {formatRupiah(v.amount)}{v.cashierName ? ` · ${v.cashierName}` : ''}{v.note ? ` · ${v.note}` : ''}
                            </span>
                          ))}
                        </td>
                        <td className="px-3 py-2">
                          <Pill status={d.status} />
                          {d.correctedByNumber && <span className="block text-xs text-muted-foreground">→ {d.correctedByNumber}</span>}
                          {d.cancelReason && <span className="block text-xs text-muted-foreground">{d.cancelReason}</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {d.status === 'CANCELLED' ? d.cancelledByName : d.verifiedByName}
                          {d.verifiedAt && <span className="block">{formatWIB(d.verifiedAt)}</span>}
                          {d.verifiedHeldBy && <span className="block">dipegang {HELD_BY_LABEL[d.verifiedHeldBy] ?? d.verifiedHeldBy}</span>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <ProofPhotoLink url={d.slipPhotoUrl} />
                          {canCorrect && d.status === 'VERIFIED' && (
                            <button type="button" onClick={() => setVerifying({ deposit: d, mode: 'correct' })} className="block text-xs text-primary hover:underline">Koreksi</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-foreground">Verifikasi non-tunai</h2>
            {historyNoncash.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada verifikasi non-tunai pada rentang ini.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-sm">
                  <tbody>
                    {historyNoncash.map((r) => (
                      <tr key={r.key} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 whitespace-nowrap">{r.businessDate}</td>
                        <td className="px-3 py-2">{r.branchName} · {r.shiftNumber ? `#${r.shiftNumber}` : 'Pelunasan BO'}</td>
                        <td className="px-3 py-2">{r.paymentMethodName} → {r.moneyPlaceName}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(r.received ?? 0)} <span className="text-xs"><Variance value={r.variance} /></span></td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{r.cause ? CAUSE_LABEL[r.cause] ?? r.cause : ''}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{r.verifiedByName}{r.verifiedAt ? ` · ${formatWIB(r.verifiedAt)}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {verifying && (
        <VerifyCashModal
          deposit={verifying.deposit}
          destinations={destinations}
          mode={verifying.mode}
          onClose={() => setVerifying(null)}
          onDone={done}
        />
      )}
      {receiving && (
        <ReceiveModal
          branches={branches}
          shifts={undeposited.shifts}
          destinations={destinations}
          defaults={defaults}
          initialBranchId={receiving.branchId}
          onClose={() => setReceiving(null)}
          onDone={done}
        />
      )}
      {noncashEdit && (
        <NoncashModal row={noncashEdit.row} mode={noncashEdit.mode} onClose={() => setNoncashEdit(null)} onDone={done} />
      )}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSaved={(s) => { setSettings(s); setSettingsOpen(false); setMessage({ kind: 'ok', text: 'Pengaturan Setoran disimpan' }); load() }}
        />
      )}
    </>
  )
}

function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
