'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MoneyPlaceHeldBy, MoneyPlaceKind, MoneyPlaceRow, PaymentLinkMatrix } from '@/lib/services/money-place-service'
import { NewBadge } from '@/components/ui/new-badge'
import type { OpeningBalanceRow } from '@/lib/services/money-place-opening-balance-service'
import { OpeningBalanceCell, OpeningBalanceDialog } from './opening-balance-cell'

interface Props {
  initialPlaces: MoneyPlaceRow[]
  initialMatrix: PaymentLinkMatrix
  branchOptions: { id: number; name: string }[]
  canManage: boolean
  /** F2-2: tujuan bawaan setoran tunai per cabang (baris Tunai). */
  initialCashDefaults: { branchId: number; moneyPlaceId: number }[]
  /** F2-6a-1: saldo awal 1 Nov 2026 (berlaku + batal). */
  initialOpeningBalances: OpeningBalanceRow[]
  /** Owner/GM: isi & batalkan saldo awal. */
  canManageOpening: boolean
}

const KIND_LABEL: Record<MoneyPlaceKind, string> = { DRAWER: 'Laci kasir', CASH: 'Tunai', BANK: 'Rekening' }
const HELD_BY_LABEL: Record<MoneyPlaceHeldBy, string> = { FINANCE: 'Finance', STORE: 'Toko', OTHER: 'Lainnya' }

const inputClass =
  'w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30'

interface FormState {
  name: string
  kind: 'CASH' | 'BANK'
  branchId: number | ''
  bankName: string
  accountNumber: string
  accountHolder: string
  heldBy: MoneyPlaceHeldBy
  holderNote: string
  sortOrder: string
}

const emptyForm: FormState = {
  name: '', kind: 'BANK', branchId: '', bankName: '', accountNumber: '', accountHolder: '',
  heldBy: 'FINANCE', holderNote: '', sortOrder: '0',
}

function maskAccount(n: string | null): string {
  if (!n) return ''
  return n.length <= 4 ? n : `•••• ${n.slice(-4)}`
}

export default function MoneyPlaceClient({
  initialPlaces, initialMatrix, branchOptions, canManage, initialCashDefaults, initialOpeningBalances, canManageOpening,
}: Props) {
  const [openingBalances, setOpeningBalances] = useState(initialOpeningBalances)
  const [openingFor, setOpeningFor] = useState<MoneyPlaceRow | null>(null)
  const [cashDefaults, setCashDefaults] = useState(initialCashDefaults)
  const [tab, setTab] = useState<'list' | 'links'>('list')
  const [places, setPlaces] = useState(initialPlaces)
  const [matrix, setMatrix] = useState(initialMatrix)
  const [branchFilter, setBranchFilter] = useState<number | ''>('')
  const [kindFilter, setKindFilter] = useState<MoneyPlaceKind | ''>('')
  const [showInactive, setShowInactive] = useState(false)
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const [editing, setEditing] = useState<MoneyPlaceRow | 'new' | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), message.kind === 'ok' ? 3000 : 7000)
    return () => clearTimeout(t)
  }, [message])

  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) setEditing(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [editing, busy])

  const visible = useMemo(() => places.filter((p) =>
    (showInactive || p.isActive)
    && (branchFilter === '' || p.branchId === branchFilter)
    && (kindFilter === '' || p.kind === kindFilter),
  ), [places, showInactive, branchFilter, kindFilter])

  const grouped = useMemo(() => {
    const map = new Map<string, MoneyPlaceRow[]>()
    for (const p of visible) map.set(p.branchName, [...(map.get(p.branchName) ?? []), p])
    return [...map.entries()]
  }, [visible])

  async function refreshPlaces() {
    const res = await fetch('/api/bo/settings/money-places')
    if (res.ok) setPlaces(await res.json())
  }

  const openingByPlace = useMemo(() => {
    const map = new Map<number, OpeningBalanceRow[]>()
    for (const r of openingBalances) map.set(r.moneyPlaceId, [...(map.get(r.moneyPlaceId) ?? []), r])
    return map
  }, [openingBalances])

  async function refreshOpeningBalances(text: string) {
    const res = await fetch('/api/bo/settings/money-places/opening-balances')
    if (res.ok) setOpeningBalances(await res.json())
    setOpeningFor(null)
    setMessage({ kind: 'ok', text })
  }

  function openNew() {
    setForm({ ...emptyForm, branchId: branchOptions[0]?.id ?? '' })
    setFormError(null)
    setEditing('new')
  }

  function openEdit(p: MoneyPlaceRow) {
    setForm({
      name: p.name, kind: p.kind === 'BANK' ? 'BANK' : 'CASH', branchId: p.branchId,
      bankName: p.bankName ?? '', accountNumber: p.accountNumber ?? '', accountHolder: p.accountHolder ?? '',
      heldBy: p.heldBy, holderNote: p.holderNote ?? '', sortOrder: String(p.sortOrder),
    })
    setFormError(null)
    setEditing(p)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !editing) return
    if (!form.name.trim()) return setFormError('Nama wajib diisi')
    if (form.branchId === '') return setFormError('Cabang wajib dipilih')
    if (form.kind === 'BANK' && (!form.bankName.trim() || !form.accountNumber.trim())) {
      return setFormError('Rekening wajib diisi nama bank dan nomor rekening')
    }
    setBusy(true)
    setFormError(null)
    try {
      const isNew = editing === 'new'
      const res = await fetch(isNew ? '/api/bo/settings/money-places' : `/api/bo/settings/money-places/${editing.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, kind: form.kind, branchId: form.branchId,
          bankName: form.kind === 'BANK' ? form.bankName : null,
          accountNumber: form.kind === 'BANK' ? form.accountNumber : null,
          accountHolder: form.kind === 'BANK' ? form.accountHolder : null,
          heldBy: form.heldBy, holderNote: form.holderNote, sortOrder: Number(form.sortOrder) || 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) return setFormError(data.error ?? `Gagal menyimpan (${res.status})`)
      setEditing(null)
      setMessage({ kind: 'ok', text: isNew ? 'Tempat Uang ditambahkan' : 'Tempat Uang diperbarui' })
      await refreshPlaces()
    } catch {
      setFormError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(p: MoneyPlaceRow) {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/bo/settings/money-places/${p.id}/active`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !p.isActive }),
      })
      const data = await res.json()
      if (!res.ok) return setMessage({ kind: 'error', text: data.error ?? `Gagal (${res.status})` })
      setMessage({ kind: 'ok', text: p.isActive ? `${p.name} dinonaktifkan` : `${p.name} diaktifkan kembali` })
      await refreshPlaces()
    } catch {
      setMessage({ kind: 'error', text: 'Terjadi kesalahan jaringan, silakan coba lagi' })
    } finally {
      setBusy(false)
    }
  }

  async function setLink(paymentMethodId: number, branchId: number, moneyPlaceId: number | null) {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/bo/settings/money-places/links', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId, branchId, moneyPlaceId }),
      })
      const data = await res.json()
      if (!res.ok) return setMessage({ kind: 'error', text: data.error ?? `Gagal (${res.status})` })
      setMatrix(data)
      setMessage({ kind: 'ok', text: moneyPlaceId ? 'Tautan disimpan' : 'Tautan dilepas' })
      await refreshPlaces()
    } catch {
      setMessage({ kind: 'error', text: 'Terjadi kesalahan jaringan, silakan coba lagi' })
    } finally {
      setBusy(false)
    }
  }

  async function setCashDefault(branchId: number, moneyPlaceId: number | null) {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/bo/settings/money-places/cash-defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId, moneyPlaceId }),
      })
      const data = await res.json()
      if (!res.ok) return setMessage({ kind: 'error', text: data.error ?? `Gagal (${res.status})` })
      setCashDefaults(data.defaults)
      setMessage({ kind: 'ok', text: moneyPlaceId ? 'Tujuan setoran tunai disimpan' : 'Tujuan setoran tunai dilepas' })
    } catch {
      setMessage({ kind: 'error', text: 'Terjadi kesalahan jaringan, silakan coba lagi' })
    } finally {
      setBusy(false)
    }
  }

  const activeBanks = places.filter((p) => p.kind === 'BANK' && p.isActive)
  const cashTargets = places.filter((p) => (p.kind === 'BANK' || p.kind === 'CASH') && p.isActive)
  const placeById = new Map(places.map((p) => [p.id, p]))
  const linkOf = (methodId: number, branchId: number) =>
    matrix.links.find((l) => l.paymentMethodId === methodId && l.branchId === branchId)?.moneyPlaceId ?? null
  const unlinkedCount = matrix.branches.length * matrix.methods.length - matrix.links.filter((l) =>
    matrix.branches.some((b) => b.id === l.branchId) && matrix.methods.some((m) => m.id === l.paymentMethodId)).length

  return (
    <>
      {message && (
        <div
          role={message.kind === 'ok' ? 'status' : 'alert'}
          className={`mb-4 px-4 py-3 rounded-md text-sm border ${message.kind === 'ok'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-destructive/10 border-destructive/20 text-destructive'}`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-4 flex gap-1 border-b border-border">
        {([['list', 'Daftar Tempat Uang'], ['links', 'Metode Bayar per Cabang']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${tab === key
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {label}
            {key === 'links' && unlinkedCount > 0 && (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-800">
                {unlinkedCount} belum
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {canManage && (
              <button
                onClick={openNew}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                + Tambah Tempat Uang
              </button>
            )}
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value ? Number(e.target.value) : '')}
              className="px-3 py-2 text-sm border border-border rounded-md bg-background"
              aria-label="Saring cabang"
            >
              <option value="">Semua cabang</option>
              {branchOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as MoneyPlaceKind | '')}
              className="px-3 py-2 text-sm border border-border rounded-md bg-background"
              aria-label="Saring jenis"
            >
              <option value="">Semua jenis</option>
              {(Object.keys(KIND_LABEL) as MoneyPlaceKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Tampilkan nonaktif
            </label>
          </div>

          {grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada Tempat Uang yang cocok dengan saringan.</p>
          ) : (
            <div className="space-y-6">
              {grouped.map(([branchName, rows]) => (
                <div key={branchName} className="bg-card border border-border rounded-lg overflow-x-auto">
                  <div className="px-4 py-2 border-b border-border text-sm font-semibold text-foreground">{branchName}</div>
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="text-left font-medium px-4 py-2">Nama</th>
                        <th className="text-left font-medium px-4 py-2">Jenis</th>
                        <th className="text-left font-medium px-4 py-2">Rekening</th>
                        <th className="text-left font-medium px-4 py-2">Dipegang oleh</th>
                        <th className="text-left font-medium px-4 py-2">
                          Saldo awal 1 Nov 2026 <NewBadge feature="fitur/saldo-awal-tempat-uang" />
                        </th>
                        <th className="text-left font-medium px-4 py-2">Status</th>
                        {canManage && <th className="text-right font-medium px-4 py-2">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((p) => (
                        <tr key={p.id} className={`border-b border-border last:border-0 ${p.isActive ? '' : 'opacity-60'}`}>
                          <td className="px-4 py-2 font-medium text-foreground">
                            {p.name}
                            {p.linkCount > 0 && (
                              <span className="ml-2 text-xs text-muted-foreground">({p.linkCount} metode bayar)</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <span className="inline-flex px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">{KIND_LABEL[p.kind]}</span>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {p.kind === 'BANK' ? (
                              <button
                                type="button"
                                title="Klik untuk lihat nomor lengkap"
                                onClick={() => setRevealed((s) => {
                                  const n = new Set(s)
                                  if (n.has(p.id)) n.delete(p.id)
                                  else n.add(p.id)
                                  return n
                                })}
                                className="text-left hover:text-foreground"
                              >
                                {p.bankName} {revealed.has(p.id) ? p.accountNumber : maskAccount(p.accountNumber)}
                                {p.accountHolder && <span className="block text-xs">a.n. {p.accountHolder}</span>}
                              </button>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {HELD_BY_LABEL[p.heldBy]}
                            {p.holderNote && <span className="block text-xs">{p.holderNote}</span>}
                          </td>
                          <td className="px-4 py-2">
                            {p.kind === 'DRAWER' ? (
                              <span className="text-xs text-muted-foreground" title="Uang laci dihitung per shift">—</span>
                            ) : (
                              <OpeningBalanceCell
                                place={p}
                                rows={openingByPlace.get(p.id) ?? []}
                                canManage={canManageOpening}
                                onOpen={() => setOpeningFor(p)}
                              />
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {p.isActive
                              ? <span className="text-xs text-green-700">Aktif</span>
                              : <span className="text-xs text-muted-foreground">Nonaktif</span>}
                          </td>
                          {canManage && (
                            <td className="px-4 py-2 text-right whitespace-nowrap">
                              {p.kind === 'DRAWER' ? (
                                <span className="text-xs text-muted-foreground">otomatis</span>
                              ) : (
                                <>
                                  <button onClick={() => openEdit(p)} className="mr-3 text-xs font-medium text-primary hover:underline">Ubah</button>
                                  <button
                                    onClick={() => toggleActive(p)}
                                    disabled={busy}
                                    className={`text-xs font-medium hover:underline disabled:opacity-50 ${p.isActive ? 'text-destructive' : 'text-primary'}`}
                                  >
                                    {p.isActive ? 'Nonaktifkan' : 'Aktifkan kembali'}
                                  </button>
                                </>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'links' && (
        <>
          <p className="mb-3 text-sm text-muted-foreground max-w-3xl">
            Uang dari metode bayar non-tunai di tiap cabang masuk ke rekening mana. Tunai masuk laci kasir cabangnya; kolom
            <strong> Tunai</strong> adalah tujuan bawaan saat laci disetor (Rekening untuk setor bank, atau Tunai seperti Brankas
            bila uang diantar ke kantor) — tetap bisa diganti saat melapor/verifikasi Setoran.
          </p>
          {matrix.methods.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada metode bayar non-tunai di Master Data › Metode Pembayaran.</p>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left font-medium px-4 py-2">Cabang</th>
                    <th className="text-left font-medium px-4 py-2 whitespace-nowrap">Tunai (setoran) <NewBadge feature="/deposits" /></th>
                    {matrix.methods.map((m) => <th key={m.id} className="text-left font-medium px-4 py-2">{m.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {matrix.branches.map((b) => {
                    // Rekening cabang sendiri diusulkan di atas.
                    const options = [...activeBanks].sort((x, y) =>
                      Number(y.branchId === b.id) - Number(x.branchId === b.id) || x.name.localeCompare(y.name))
                    return (
                      <tr key={b.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 font-medium text-foreground whitespace-nowrap">{b.name}</td>
                        <td className="px-4 py-2">
                          {(() => {
                            const current = cashDefaults.find((d) => d.branchId === b.id)?.moneyPlaceId ?? null
                            const currentPlace = current ? placeById.get(current) : undefined
                            if (!canManage) return <span>{currentPlace?.name ?? <span className="text-xs text-muted-foreground">belum diatur</span>}</span>
                            return (
                              <select
                                value={current ?? ''}
                                disabled={busy}
                                onChange={(e) => setCashDefault(b.id, e.target.value ? Number(e.target.value) : null)}
                                className="min-w-44 px-2 py-1.5 text-sm border border-border rounded-md bg-background"
                                aria-label={`Tujuan setoran tunai ${b.name}`}
                              >
                                <option value="">— belum diatur —</option>
                                {currentPlace && !currentPlace.isActive && <option value={currentPlace.id}>{currentPlace.name} (nonaktif)</option>}
                                {[...cashTargets]
                                  .sort((x, y) => Number(y.branchId === b.id) - Number(x.branchId === b.id) || x.name.localeCompare(y.name))
                                  .map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} ({KIND_LABEL[p.kind]}){p.branchId !== b.id ? ` · ${p.branchName}` : ''}
                                    </option>
                                  ))}
                              </select>
                            )
                          })()}
                        </td>
                        {matrix.methods.map((m) => {
                          const current = linkOf(m.id, b.id)
                          const currentPlace = current ? placeById.get(current) : undefined
                          return (
                            <td key={m.id} className="px-4 py-2">
                              {canManage ? (
                                <select
                                  value={current ?? ''}
                                  disabled={busy}
                                  onChange={(e) => setLink(m.id, b.id, e.target.value ? Number(e.target.value) : null)}
                                  className={`min-w-44 px-2 py-1.5 text-sm border rounded-md bg-background ${current ? 'border-border' : 'border-amber-400 bg-amber-50'}`}
                                  aria-label={`${m.name} di ${b.name}`}
                                >
                                  <option value="">— belum ditautkan —</option>
                                  {currentPlace && !currentPlace.isActive && (
                                    <option value={currentPlace.id}>{currentPlace.name} (nonaktif)</option>
                                  )}
                                  {options.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}{p.branchId !== b.id ? ` · ${p.branchName}` : ''}
                                    </option>
                                  ))}
                                </select>
                              ) : current ? (
                                <span>{currentPlace?.name ?? `#${current}`}</span>
                              ) : (
                                <span className="text-xs text-amber-700">belum ditautkan</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {activeBanks.length === 0 && canManage && (
            <p className="mt-3 text-xs text-muted-foreground">Tambahkan Rekening di tab Daftar Tempat Uang dulu agar bisa dipilih.</p>
          )}
        </>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mp-dialog-title"
        >
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-border">
              <h2 id="mp-dialog-title" className="text-base font-semibold text-foreground">
                {editing === 'new' ? 'Tambah Tempat Uang' : `Ubah ${editing.name}`}
              </h2>
            </div>
            <form onSubmit={submit} className="px-6 py-4 space-y-4">
              <div>
                <label htmlFor="mp-name" className="block text-sm font-medium mb-1">Nama <span className="text-destructive">*</span></label>
                <input id="mp-name" className={inputClass} maxLength={100} value={form.name}
                  placeholder="Contoh: Rekening BCA Toko B, Kas Tunai Finance, Brankas"
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mp-kind" className="block text-sm font-medium mb-1">Jenis</label>
                  <select id="mp-kind" className={inputClass} value={form.kind}
                    onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as 'CASH' | 'BANK' }))}>
                    <option value="BANK">Rekening</option>
                    <option value="CASH">Tunai</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="mp-branch" className="block text-sm font-medium mb-1">Cabang pemilik</label>
                  <select id="mp-branch" className={inputClass} value={form.branchId}
                    onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value ? Number(e.target.value) : '' }))}>
                    {branchOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              {form.kind === 'BANK' && (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="mp-bank" className="block text-sm font-medium mb-1">Bank <span className="text-destructive">*</span></label>
                      <input id="mp-bank" className={inputClass} maxLength={50} value={form.bankName} placeholder="BCA, BRI, …"
                        onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} />
                    </div>
                    <div>
                      <label htmlFor="mp-acc" className="block text-sm font-medium mb-1">Nomor rekening <span className="text-destructive">*</span></label>
                      <input id="mp-acc" className={inputClass} maxLength={50} value={form.accountNumber} inputMode="numeric"
                        onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="mp-holder" className="block text-sm font-medium mb-1">Atas nama</label>
                    <input id="mp-holder" className={inputClass} maxLength={100} value={form.accountHolder}
                      onChange={(e) => setForm((f) => ({ ...f, accountHolder: e.target.value }))} />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mp-held" className="block text-sm font-medium mb-1">Dipegang oleh</label>
                  <select id="mp-held" className={inputClass} value={form.heldBy}
                    onChange={(e) => setForm((f) => ({ ...f, heldBy: e.target.value as MoneyPlaceHeldBy }))}>
                    <option value="FINANCE">Finance</option>
                    <option value="STORE">Toko</option>
                    <option value="OTHER">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="mp-order" className="block text-sm font-medium mb-1">Urutan tampil</label>
                  <input id="mp-order" type="number" min={0} className={inputClass} value={form.sortOrder}
                    onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} />
                </div>
              </div>
              <div>
                <label htmlFor="mp-note" className="block text-sm font-medium mb-1">Catatan pemegang</label>
                <input id="mp-note" className={inputClass} maxLength={100} value={form.holderNote} placeholder="Opsional, mis. nama orang"
                  onChange={(e) => setForm((f) => ({ ...f, holderNote: e.target.value }))} />
                <p className="mt-1 text-xs text-muted-foreground">
                  Uang dianggap sudah diterima kantor saat masuk ke Tempat Uang yang dipegang Finance.
                </p>
              </div>
              {formError && (
                <div role="alert" className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm">
                  {formError}
                </div>
              )}
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setEditing(null)} disabled={busy}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-md hover:bg-accent disabled:opacity-50">
                  Batal
                </button>
                <button type="submit" disabled={busy}
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">
                  {busy ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {openingFor && (
        <OpeningBalanceDialog
          place={openingFor}
          rows={openingByPlace.get(openingFor.id) ?? []}
          canManage={canManageOpening}
          onClose={() => setOpeningFor(null)}
          onChanged={refreshOpeningBalances}
        />
      )}
    </>
  )
}
