'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatWIB } from '@petshop/shared'
import { digitsOnly, formatRupiahInput } from '@/lib/number-input'
import { ProofPhotoField, ProofPhotoLink } from '@/components/ui/proof-photo-field'
import { NewBadge } from '@/components/ui/new-badge'
import { addMonths, amountFor, type BillStatus } from '@/lib/services/recurring-cost-rules'
import type { BillRow, CostRow } from '@/lib/services/recurring-cost-service'

export interface Option {
  id: number
  name: string
}

export interface PlaceOption extends Option {
  kind: 'CASH' | 'BANK'
}

interface TemporaryRent {
  id: number
  branchId: number | null
  branchName: string | null
  amount: number
  forMonth: string
  occurredOn: string
  note: string | null
}

interface Data {
  costs: CostRow[]
  bills: BillRow[]
  temporaryRent: TemporaryRent[]
}

interface Props {
  categories: Option[]
  places: PlaceOption[]
  branches: Option[]
  canManage: boolean
  canPay: boolean
  isOwner: boolean
  today: string
  prepayLimit: string
}

const IDR = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
const inputClass = 'w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30'
const SHARED = 'shared'

function monthLabel(month: string): string {
  return formatWIB(`${month}-15T12:00:00+07:00`, { month: 'short', year: 'numeric' })
}

function dateLabel(date: string): string {
  return formatWIB(`${date}T12:00:00+07:00`, { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS: Record<BillStatus, { label: string; className: string }> = {
  OVERDUE: { label: 'Lewat jatuh tempo', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  DUE_SOON: { label: 'Segera jatuh tempo', className: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40' },
  UNPAID: { label: 'Belum dibayar', className: 'bg-muted text-muted-foreground border-border' },
  PAID: { label: 'Sudah dibayar', className: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/40' },
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

function Buttons({ onBack, busy, submitLabel, busyLabel, danger }: { onBack: () => void; busy: boolean; submitLabel: string; busyLabel: string; danger?: boolean }) {
  return (
    <div className="flex justify-end gap-3">
      <button type="button" onClick={onBack} disabled={busy} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted disabled:opacity-50">Kembali</button>
      <button type="submit" disabled={busy} className={`px-4 py-2 text-sm rounded-md disabled:opacity-50 ${danger ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
        {busy ? busyLabel : submitLabel}
      </button>
    </div>
  )
}

async function send(url: string, method: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) return null
    const data = await res.json().catch(() => ({}))
    return data.error ?? 'Gagal menyimpan'
  } catch {
    return 'Terjadi kesalahan jaringan, silakan coba lagi'
  }
}

export default function RecurringCostClient(props: Props) {
  const { canManage, canPay, today } = props
  const [data, setData] = useState<Data>({ costs: [], bills: [], temporaryRent: [] })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'bills' | 'settings'>('bills')
  const [statusFilter, setStatusFilter] = useState<'open' | 'PAID' | 'all'>('open')
  const [branchFilter, setBranchFilter] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const [costForm, setCostForm] = useState<{ cost: CostRow | null } | null>(null)
  const [amountCost, setAmountCost] = useState<CostRow | null>(null)
  const [payBill, setPayBill] = useState<BillRow | null>(null)
  const [cancelBill, setCancelBill] = useState<BillRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/bo/recurring-costs')
      if (!res.ok) return setMessage({ ok: false, text: 'Gagal memuat Biaya Rutin' })
      setData(await res.json())
    } catch {
      setMessage({ ok: false, text: 'Gagal memuat Biaya Rutin' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(t)
  }, [message])

  async function done(text: string) {
    setMessage({ ok: true, text })
    await load()
  }

  const matchesBranch = (branchId: number | null) =>
    !branchFilter || (branchFilter === SHARED ? branchId === null : branchId === Number(branchFilter))

  const bills = useMemo(
    () => data.bills.filter((b) => {
      if (!matchesBranch(b.branchId)) return false
      if (statusFilter === 'open') return b.status !== 'PAID'
      if (statusFilter === 'PAID') return b.status === 'PAID'
      return true
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.bills, statusFilter, branchFilter],
  )
  const overdueTotal = data.bills.filter((b) => b.status === 'OVERDUE').reduce((s, b) => s + (b.amount ?? 0), 0)
  const costsById = useMemo(() => new Map(data.costs.map((c) => [c.id, c])), [data.costs])

  return (
    <div className="min-w-0">
      {message && (
        <div role="status" className={`mb-4 px-4 py-3 rounded-md text-sm ${message.ok ? 'bg-green-50 border border-green-200 text-green-800 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300' : 'bg-destructive/10 border border-destructive/20 text-destructive'}`}>
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4 border-b border-border">
        {(['bills', 'settings'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t === 'bills' ? 'Tagihan' : 'Pengaturan'}
          </button>
        ))}
        <NewBadge feature="/recurring-costs" />
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-3 text-sm">
        {tab === 'bills' && (
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="px-2 py-1.5 border border-border rounded-md bg-background">
              <option value="open">Belum dibayar</option>
              <option value="PAID">Sudah dibayar</option>
              <option value="all">Semua</option>
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Cabang</label>
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="px-2 py-1.5 border border-border rounded-md bg-background">
            <option value="">Semua cabang</option>
            <option value={SHARED}>Bersama</option>
            {props.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        {tab === 'settings' && canManage && (
          <button onClick={() => setCostForm({ cost: null })} className="ml-auto px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
            + Tambah Biaya Rutin
          </button>
        )}
        {tab === 'bills' && overdueTotal > 0 && (
          <div className="ml-auto text-sm text-destructive font-medium">Lewat jatuh tempo: {IDR.format(overdueTotal)}</div>
        )}
      </div>

      {tab === 'bills' ? (
        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Untuk bulan</th>
                <th className="text-left font-medium px-3 py-2">Biaya</th>
                <th className="text-left font-medium px-3 py-2">Cabang</th>
                <th className="text-right font-medium px-3 py-2">Jumlah</th>
                <th className="text-left font-medium px-3 py-2">Jatuh tempo</th>
                <th className="text-left font-medium px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Memuat...</td></tr>
              ) : bills.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">{data.costs.length === 0 ? 'Belum ada Biaya Rutin. Tambahkan di tab Pengaturan.' : 'Tidak ada tagihan'}</td></tr>
              ) : bills.map((b) => (
                <tr key={`${b.costId}-${b.month}`} className="border-t border-border align-top">
                  <td className="px-3 py-2 whitespace-nowrap font-medium">{monthLabel(b.month)}</td>
                  <td className="px-3 py-2">
                    <div>{b.name}</div>
                    <div className="text-xs text-muted-foreground">{b.categoryName}</div>
                  </td>
                  <td className="px-3 py-2">{b.branchName ?? 'Bersama'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {b.payment ? (
                      <>
                        <div className="font-medium">{IDR.format(b.payment.amount)}</div>
                        {b.amount !== null && b.payment.amount !== b.amount && <div className="text-xs text-muted-foreground line-through">{IDR.format(b.amount)}</div>}
                      </>
                    ) : b.amount !== null ? <span className="font-medium">{IDR.format(b.amount)}</span> : '-'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{dateLabel(b.dueDate)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS[b.status].className}`}>{STATUS[b.status].label}</span>
                    {b.payment && (
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        <div>{dateLabel(b.payment.occurredOn)} · dari {b.payment.moneyPlaceName ?? '-'} · {b.payment.createdByName ?? '-'}</div>
                        {b.payment.batchMonths.length > 1 && <div>Dibayar sekaligus {monthLabel(b.payment.batchMonths[0])} – {monthLabel(b.payment.batchMonths.at(-1)!)}</div>}
                        {b.payment.differenceReason && <div>Alasan beda: {b.payment.differenceReason}</div>}
                        {b.payment.proofPhotoUrl ? <ProofPhotoLink url={b.payment.proofPhotoUrl} /> : <div>tanpa bukti</div>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {!b.payment && canPay && b.amount !== null && (
                      <button onClick={() => setPayBill(b)} className="text-xs font-medium text-primary hover:underline">Sudah dibayar</button>
                    )}
                    {b.payment?.canCancel && (
                      <button onClick={() => setCancelBill(b)} className="text-xs font-medium text-destructive hover:underline">Batalkan</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Nama</th>
                <th className="text-left font-medium px-3 py-2">Cabang</th>
                <th className="text-right font-medium px-3 py-2">Per bulan</th>
                <th className="text-left font-medium px-3 py-2">Jatuh tempo</th>
                <th className="text-left font-medium px-3 py-2">Berlaku</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Memuat...</td></tr>
              ) : data.costs.filter((c) => matchesBranch(c.branchId)).length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Belum ada Biaya Rutin</td></tr>
              ) : data.costs.filter((c) => matchesBranch(c.branchId)).map((c) => (
                <tr key={c.id} className={`border-t border-border align-top ${c.isActive ? '' : 'text-muted-foreground'}`}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{c.name} {!c.isActive && <span className="ml-1 text-xs font-normal">(nonaktif)</span>}</div>
                    <div className="text-xs text-muted-foreground">{c.categoryName}{c.note ? ` · ${c.note}` : ''}</div>
                  </td>
                  <td className="px-3 py-2">{c.branchName ?? 'Bersama'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div className="font-medium">{c.currentAmount !== null ? IDR.format(c.currentAmount) : '-'}</div>
                    {c.amounts.length > 1 && (
                      <div className="text-xs text-muted-foreground">
                        {c.amounts.map((a) => `${monthLabel(a.effectiveMonth)}: ${IDR.format(a.amount)}`).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">Tanggal {c.dueDay}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{monthLabel(c.startMonth)} – {c.endMonth ? monthLabel(c.endMonth) : 'seterusnya'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap space-x-3">
                    {canManage && (
                      <>
                        <button onClick={() => setCostForm({ cost: c })} className="text-xs font-medium text-primary hover:underline">Ubah</button>
                        {c.isActive && <button onClick={() => setAmountCost(c)} className="text-xs font-medium text-primary hover:underline">Ubah jumlah</button>}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Biaya Rutin tidak dihapus: yang selesai diisi Berlaku sampai; salah buat sebelum ada pembayaran boleh dinonaktifkan. Pembayaran yang salah
        dibatalkan dengan alasan (pembayar sendiri di hari yang sama; sesudah itu Owner/GM), lalu dibayar ulang.
      </p>

      {costForm && (
        <CostForm
          {...props}
          cost={costForm.cost}
          temporaryRent={data.temporaryRent}
          onClose={() => setCostForm(null)}
          onDone={(text) => { setCostForm(null); done(text) }}
        />
      )}
      {amountCost && (
        <AmountForm cost={amountCost} today={today} onClose={() => setAmountCost(null)} onDone={(text) => { setAmountCost(null); done(text) }} />
      )}
      {payBill && costsById.get(payBill.costId) && (
        <PayForm
          {...props}
          bill={payBill}
          cost={costsById.get(payBill.costId)!}
          paidMonths={new Set(data.bills.filter((b) => b.costId === payBill.costId && b.payment).map((b) => b.month))}
          onClose={() => setPayBill(null)}
          onDone={(text) => { setPayBill(null); done(text) }}
        />
      )}
      {cancelBill?.payment && (
        <CancelForm bill={cancelBill} onClose={() => setCancelBill(null)} onDone={(text) => { setCancelBill(null); done(text) }} />
      )}
    </div>
  )
}

function CostForm({ cost, categories, branches, temporaryRent, today, onClose, onDone }: Props & {
  cost: CostRow | null
  temporaryRent: TemporaryRent[]
  onClose: () => void
  onDone: (text: string) => void
}) {
  const hasPayments = !!cost?.lastPaidMonth
  const [name, setName] = useState(cost?.name ?? '')
  const [categoryId, setCategoryId] = useState(cost ? String(cost.categoryId) : String(categories.find((c) => c.name === 'Sewa toko')?.id ?? ''))
  const [branch, setBranch] = useState(cost ? (cost.branchId === null ? SHARED : String(cost.branchId)) : '')
  const [amount, setAmount] = useState('')
  const [dueDay, setDueDay] = useState(cost ? String(cost.dueDay) : '5')
  const [startMonth, setStartMonth] = useState(cost?.startMonth ?? today.slice(0, 7))
  const [endMonth, setEndMonth] = useState(cost?.endMonth ?? '')
  const [note, setNote] = useState(cost?.note ?? '')
  const [isActive, setIsActive] = useState(cost?.isActive ?? true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Kategori lama (mis. nonaktif) tetap tampil saat mengubah biaya yang memakainya.
  const categoryOptions = cost && !categories.some((c) => c.id === cost.categoryId) ? [...categories, { id: cost.categoryId, name: cost.categoryName }] : categories
  const rentForBranch = temporaryRent.filter((r) => !branch || (branch === SHARED ? r.branchId === null : r.branchId === Number(branch)))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (!name.trim()) return setError('Nama wajib diisi')
    if (!categoryId) return setError('Kategori wajib dipilih')
    if (!branch) return setError('Pilih cabang yang menanggung (atau Bersama)')
    if (!cost && (!amount || Number(amount) <= 0)) return setError('Jumlah per bulan harus lebih dari 0')
    const body = {
      name: name.trim(),
      categoryId: Number(categoryId),
      branchId: branch === SHARED ? null : Number(branch),
      dueDay: Number(dueDay),
      startMonth,
      endMonth: endMonth || null,
      note: note.trim() || null,
      ...(cost ? { isActive } : { amount: Number(amount) }),
    }
    setBusy(true)
    const err = await send(cost ? `/api/bo/recurring-costs/${cost.id}` : '/api/bo/recurring-costs', cost ? 'PATCH' : 'POST', body)
    setBusy(false)
    if (err) return setError(err)
    onDone(cost ? 'Biaya Rutin diubah' : 'Biaya Rutin ditambahkan')
  }

  return (
    <Modal title={cost ? 'Ubah Biaya Rutin' : 'Tambah Biaya Rutin'} subtitle={cost ? 'Untuk mengubah jumlah per bulan, pakai tombol Ubah jumlah.' : undefined}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Nama <span className="text-destructive">*</span></label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={inputClass} placeholder="Mis. Sewa Toko C" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Kategori <span className="text-destructive">*</span></label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={hasPayments} className={inputClass}>
              <option value="">— Pilih —</option>
              {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cabang yang menanggung <span className="text-destructive">*</span></label>
            <select value={branch} onChange={(e) => setBranch(e.target.value)} disabled={hasPayments} className={inputClass}>
              <option value="">— Pilih —</option>
              <option value={SHARED}>Bersama</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
        {hasPayments && <p className="text-xs text-muted-foreground">Kategori, cabang, dan Berlaku mulai terkunci karena sudah ada pembayaran. Bila perlu berubah, isi Berlaku sampai lalu buat biaya baru.</p>}
        <div className="grid grid-cols-2 gap-3">
          {!cost && (
            <div>
              <label className="block text-sm font-medium mb-1">Jumlah per bulan (Rp) <span className="text-destructive">*</span></label>
              <input type="text" inputMode="numeric" value={formatRupiahInput(amount)} onChange={(e) => setAmount(digitsOnly(e.target.value))} placeholder="0" className={inputClass} />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Tanggal jatuh tempo <span className="text-destructive">*</span></label>
            <select value={dueDay} onChange={(e) => setDueDay(e.target.value)} className={inputClass}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Tanggal {d}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Berlaku mulai <span className="text-destructive">*</span></label>
            <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} disabled={hasPayments} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Berlaku sampai <span className="text-muted-foreground font-normal">(kosong = terus)</span></label>
            <input type="month" value={endMonth} min={startMonth} onChange={(e) => setEndMonth(e.target.value)} className={inputClass} />
          </div>
        </div>
        {!cost && (
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/40 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <div className="font-medium">Isi Berlaku mulai dengan bulan pertama yang BELUM dibayar.</div>
            <div>Sewa yang sudah dicatat lewat &quot;Sewa (sementara)&quot; jangan ditagih lagi.</div>
            {rentForBranch.length > 0 && (
              <ul className="list-disc pl-4">
                {rentForBranch.map((r) => (
                  <li key={r.id}>
                    {monthLabel(r.forMonth.slice(0, 7))} · {r.branchName ?? 'Bersama'} · {IDR.format(r.amount)} (dibayar {dateLabel(r.occurredOn)}){r.note ? ` — ${r.note}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Catatan <span className="text-muted-foreground font-normal">(opsional)</span></label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} rows={2} className={`${inputClass} resize-none`} placeholder="Mis. pemilik sewa, nomor rekening tujuan" />
        </div>
        {cost && !hasPayments && (
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Aktif (hilangkan centang bila salah buat; tagihannya ikut hilang)
          </label>
        )}
        <ErrorBox text={error} />
        <Buttons onBack={onClose} busy={busy} submitLabel="Simpan" busyLabel="Menyimpan..." />
      </form>
    </Modal>
  )
}

function AmountForm({ cost, today, onClose, onDone }: { cost: CostRow; today: string; onClose: () => void; onDone: (text: string) => void }) {
  const earliest = cost.lastPaidMonth ? addMonths(cost.lastPaidMonth, 1) : cost.startMonth
  const nowMonth = today.slice(0, 7)
  const [effectiveMonth, setEffectiveMonth] = useState(nowMonth < earliest ? earliest : nowMonth)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!amount || Number(amount) <= 0) return setError('Jumlah harus lebih dari 0')
    setBusy(true)
    const err = await send(`/api/bo/recurring-costs/${cost.id}/amounts`, 'POST', { effectiveMonth, amount: Number(amount) })
    setBusy(false)
    if (err) return setError(err)
    onDone('Jumlah per bulan diubah')
  }

  return (
    <Modal title={`Ubah jumlah — ${cost.name}`} subtitle={`Sekarang ${cost.currentAmount !== null ? IDR.format(cost.currentAmount) : '-'} per bulan. Tagihan sebelum bulan berlaku tidak berubah.`}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Jumlah baru (Rp) <span className="text-destructive">*</span></label>
            <input type="text" inputMode="numeric" value={formatRupiahInput(amount)} onChange={(e) => setAmount(digitsOnly(e.target.value))} placeholder="0" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mulai bulan <span className="text-destructive">*</span></label>
            <input type="month" value={effectiveMonth} min={earliest} onChange={(e) => setEffectiveMonth(e.target.value)} className={inputClass} />
          </div>
        </div>
        {cost.lastPaidMonth && <p className="text-xs text-muted-foreground">Sudah dibayar sampai {monthLabel(cost.lastPaidMonth)}, jadi jumlah baru paling cepat {monthLabel(earliest)}.</p>}
        <ErrorBox text={error} />
        <Buttons onBack={onClose} busy={busy} submitLabel="Simpan" busyLabel="Menyimpan..." />
      </form>
    </Modal>
  )
}

function PayForm({ bill, cost, paidMonths, places, isOwner, today, prepayLimit, onClose, onDone }: Props & {
  bill: BillRow
  cost: CostRow
  paidMonths: Set<string>
  onClose: () => void
  onDone: (text: string) => void
}) {
  // Bulan berurutan yang bisa dibayar sekaligus: sampai bulan yang sudah dibayar, Berlaku sampai, atau batas bayar di muka.
  const options = useMemo(() => {
    const out: string[] = []
    for (let m = bill.month; m <= prepayLimit && (!cost.endMonth || m <= cost.endMonth) && !paidMonths.has(m); m = addMonths(m, 1)) out.push(m)
    return out
  }, [bill.month, prepayLimit, cost.endMonth, paidMonths])
  const [toMonth, setToMonth] = useState(bill.month)
  const months = options.slice(0, options.indexOf(toMonth) + 1)
  const billedTotal = months.reduce((s, m) => s + (amountFor(cost.amounts, m) ?? 0), 0)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [placeId, setPlaceId] = useState('')
  const [occurredOn, setOccurredOn] = useState(today)
  const [photo, setPhoto] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const paid = amount === '' ? billedTotal : Number(amount)
  const differs = paid !== billedTotal
  const minDate = useMemo(() => {
    if (isOwner) return undefined
    const d = new Date(`${today}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 7)
    return d.toISOString().slice(0, 10)
  }, [today, isOwner])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (!placeId) return setError('Pilih "Dibayar dari" (Tempat Uang)')
    if (!paid || paid <= 0) return setError('Jumlah dibayar harus lebih dari 0')
    if (differs && !reason.trim()) return setError('Jumlah dibayar berbeda dari tagihan; alasan wajib diisi')
    if (uploading) return setError('Tunggu foto selesai diunggah')
    setBusy(true)
    const err = await send('/api/bo/recurring-costs/pay', 'POST', {
      recurringCostId: cost.id,
      fromMonth: bill.month,
      toMonth,
      occurredOn,
      moneyPlaceId: Number(placeId),
      amount: paid,
      differenceReason: differs ? reason.trim() : null,
      proofPhotoUrl: photo ?? undefined,
    })
    setBusy(false)
    if (err) return setError(err)
    onDone(months.length > 1 ? `${months.length} bulan tagihan dicatat sudah dibayar` : 'Tagihan dicatat sudah dibayar')
  }

  return (
    <Modal title={`Sudah dibayar — ${cost.name}`} subtitle={`${cost.branchName ?? 'Bersama'} · tercatat di Pendapatan & Pengeluaran untuk bulan tagihannya.`}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Dari bulan</label>
            <input value={monthLabel(bill.month)} disabled className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sampai bulan</label>
            <select value={toMonth} onChange={(e) => setToMonth(e.target.value)} className={inputClass}>
              {options.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>
        </div>
        <div className="text-sm">
          Tagihan {months.length} bulan: <span className="font-semibold">{IDR.format(billedTotal)}</span>
          {months.length > 1 && <span className="text-muted-foreground"> (dicatat per bulan; uang keluar satu kali)</span>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Jumlah dibayar (Rp)</label>
            <input type="text" inputMode="numeric" value={formatRupiahInput(amount)} onChange={(e) => setAmount(digitsOnly(e.target.value))} placeholder={formatRupiahInput(String(billedTotal))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tanggal uang <span className="text-destructive">*</span></label>
            <input type="date" value={occurredOn} max={today} min={minDate} onChange={(e) => setOccurredOn(e.target.value)} className={inputClass} />
          </div>
        </div>
        {differs && (
          <div>
            <label className="block text-sm font-medium mb-1">Alasan jumlah berbeda <span className="text-destructive">*</span></label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className={inputClass} placeholder="Mis. potongan dari pemilik" />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Dibayar dari <span className="text-destructive">*</span></label>
          <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} className={inputClass}>
            <option value="">— Pilih Tempat Uang —</option>
            {places.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.kind === 'CASH' ? 'Tunai' : 'Rekening'})</option>)}
          </select>
        </div>
        <ProofPhotoField value={photo} onChange={setPhoto} onUploadingChange={setUploading} disabled={busy} label="Foto Bukti" />
        <ErrorBox text={error} />
        <Buttons onBack={onClose} busy={busy} submitLabel="Simpan" busyLabel="Menyimpan..." />
      </form>
    </Modal>
  )
}

function CancelForm({ bill, onClose, onDone }: { bill: BillRow; onClose: () => void; onDone: (text: string) => void }) {
  const payment = bill.payment!
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const months = payment.batchMonths

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (reason.trim().length < 3) return setError('Alasan pembatalan wajib diisi')
    setBusy(true)
    const err = await send(`/api/bo/recurring-costs/payments/${payment.batchKey}/cancel`, 'POST', { reason: reason.trim() })
    setBusy(false)
    if (err) return setError(err)
    onDone('Pembayaran dibatalkan; tagihannya kembali Belum dibayar')
  }

  return (
    <Modal
      title="Batalkan pembayaran?"
      subtitle={`${bill.name} · ${months.length > 1 ? `${months.length} bulan (${monthLabel(months[0])} – ${monthLabel(months.at(-1)!)}) dibatalkan bersama` : monthLabel(bill.month)}. Catatan di Pendapatan & Pengeluaran ikut bertanda Batal.`}
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Alasan <span className="text-destructive">*</span></label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} rows={2} className={`${inputClass} resize-none`} />
        </div>
        <ErrorBox text={error} />
        <Buttons onBack={onClose} busy={busy} submitLabel="Batalkan" busyLabel="Membatalkan..." danger />
      </form>
    </Modal>
  )
}
