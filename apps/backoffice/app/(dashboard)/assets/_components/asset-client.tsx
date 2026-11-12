'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatWIB } from '@petshop/shared'
import { digitsOnly, formatRupiahInput } from '@/lib/number-input'
import { ProofPhotoField, ProofPhotoLink } from '@/components/ui/proof-photo-field'
import { NewBadge } from '@/components/ui/new-badge'
import {
  ASSET_MIN_PRICE, ASSET_START_DATE, ASSET_STATUS_LABEL, ASSET_TYPES, ASSET_TYPE_SHORT, MAX_LIFE_MONTHS, monthlyPortion,
  type AssetStatus, type AssetType, type DisposalStatus,
} from '@/lib/services/asset-rules'
import type { AssetRow } from '@/lib/services/asset-service'

export interface Option {
  id: number
  name: string
}

export interface PlaceOption extends Option {
  kind: 'CASH' | 'BANK'
}

interface Props {
  places: PlaceOption[]
  branches: Option[]
  canRecord: boolean
  canDispose: boolean
  today: string
}

const IDR = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 })
const inputClass = 'w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30'
const OFFICE = 'office'

function monthLabel(month: string): string {
  return formatWIB(`${month}-15T12:00:00+07:00`, { month: 'short', year: 'numeric' })
}

function dateLabel(date: string): string {
  return formatWIB(`${date}T12:00:00+07:00`, { day: '2-digit', month: 'short', year: 'numeric' })
}

function lifeLabel(months: number): string {
  if (months % 12 === 0) return `${months / 12} tahun`
  return `${months} bulan`
}

const STATUS_CLASS: Record<AssetStatus, string> = {
  IN_USE: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/40',
  DAMAGED: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40',
  LOST: 'bg-destructive/10 text-destructive border-destructive/30',
  SOLD: 'bg-muted text-muted-foreground border-border',
}

function Modal({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className={`bg-card border border-border rounded-lg shadow-lg w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto p-6 space-y-4`}>
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

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

export default function AssetClient(props: Props) {
  const { canRecord, canDispose, today } = props
  const [assets, setAssets] = useState<AssetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<'active' | 'cancelled'>('active')
  const [statusFilter, setStatusFilter] = useState<'IN_USE' | 'OUT' | 'all'>('IN_USE')
  const [branchFilter, setBranchFilter] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [detail, setDetail] = useState<AssetRow | null>(null)
  const [disposing, setDisposing] = useState<AssetRow | null>(null)
  const [cancelling, setCancelling] = useState<AssetRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/bo/assets', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Gagal memuat daftar aset')
      setAssets(data.assets)
      setLoadError(null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Gagal memuat daftar aset')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const done = (text: string) => {
    setMessage(text)
    void load()
  }

  const visible = useMemo(() => assets.filter((a) => {
    if (tab === 'cancelled') return a.cancelledAt !== null
    if (a.cancelledAt) return false
    if (statusFilter === 'IN_USE' && a.status !== 'IN_USE') return false
    if (statusFilter === 'OUT' && a.status === 'IN_USE') return false
    if (branchFilter === OFFICE && a.branchId !== null) return false
    if (branchFilter && branchFilter !== OFFICE && String(a.branchId) !== branchFilter) return false
    return true
  }), [assets, tab, statusFilter, branchFilter])

  const summary = useMemo(() => {
    const inUse = assets.filter((a) => !a.cancelledAt && a.status === 'IN_USE')
    return {
      count: inUse.length,
      price: inUse.reduce((s, a) => s + a.purchasePrice, 0),
      book: inUse.reduce((s, a) => s + a.bookValueNow, 0),
      monthly: inUse.reduce((s, a) => s + (a.bookValueNow > 0 ? a.monthlyPortion : 0), 0),
    }
  }, [assets])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Aset dipakai', String(summary.count)],
          ['Total harga beli', IDR.format(summary.price)],
          ['Sisa nilai hari ini', IDR.format(summary.book)],
          ['Penyusutan per bulan', IDR.format(summary.monthly)],
        ].map(([label, value]) => (
          <div key={label} className="bg-card border border-border rounded-lg p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-base font-semibold mt-0.5">{value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-border overflow-hidden text-sm">
          {(['active', 'cancelled'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`px-3 py-1.5 ${tab === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
              {t === 'active' ? 'Daftar Aset' : 'Dibatalkan'}
            </button>
          ))}
        </div>
        {tab === 'active' && (
          <>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="px-3 py-1.5 text-sm border border-border rounded-md bg-background">
              <option value="IN_USE">Dipakai</option>
              <option value="OUT">Rusak / Hilang / Dijual</option>
              <option value="all">Semua keadaan</option>
            </select>
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="px-3 py-1.5 text-sm border border-border rounded-md bg-background">
              <option value="">Semua cabang</option>
              <option value={OFFICE}>Kantor (bersama)</option>
              {props.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </>
        )}
        <div className="flex-1" />
        {canRecord && (
          <button type="button" onClick={() => { setMessage(null); setRecording(true) }} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2">
            Catat Pembelian Aset <NewBadge feature="/assets" />
          </button>
        )}
      </div>

      {message && <div className="bg-green-50 border border-green-200 text-green-800 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300 px-3 py-2 rounded-md text-sm">{message}</div>}
      <ErrorBox text={loadError} />

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Nama</th>
              <th className="text-left px-3 py-2 font-medium">Cabang</th>
              <th className="text-left px-3 py-2 font-medium">Tanggal beli</th>
              <th className="text-right px-3 py-2 font-medium">Harga</th>
              <th className="text-left px-3 py-2 font-medium">Umur</th>
              <th className="text-right px-3 py-2 font-medium">Per bulan</th>
              <th className="text-right px-3 py-2 font-medium">Sisa nilai</th>
              <th className="text-left px-3 py-2 font-medium">Keadaan</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">Memuat…</td></tr>}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">{tab === 'cancelled' ? 'Tidak ada aset yang dibatalkan' : 'Belum ada aset'}</td></tr>
            )}
            {!loading && visible.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{ASSET_TYPE_SHORT[a.assetType]}</div>
                </td>
                <td className="px-3 py-2">{a.branchName ?? 'Kantor'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{dateLabel(a.purchasedOn)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{IDR.format(a.purchasePrice)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{lifeLabel(a.usefulLifeMonths)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{IDR.format(a.monthlyPortion)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{a.cancelledAt ? '—' : IDR.format(a.bookValueNow)}</td>
                <td className="px-3 py-2">
                  {a.cancelledAt ? (
                    <span className="text-xs text-muted-foreground">Dibatalkan: {a.cancelReason}</span>
                  ) : (
                    <span className={`inline-block px-2 py-0.5 rounded-full border text-xs ${STATUS_CLASS[a.status]}`}>
                      {ASSET_STATUS_LABEL[a.status]}{a.disposedOn ? ` · ${dateLabel(a.disposedOn)}` : ''}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-right space-x-2">
                  <button type="button" onClick={() => setDetail(a)} className="text-primary hover:underline">Rincian</button>
                  {canDispose && !a.cancelledAt && a.status === 'IN_USE' && (
                    <button type="button" onClick={() => { setMessage(null); setDisposing(a) }} className="text-primary hover:underline">Ubah keadaan</button>
                  )}
                  {canDispose && !a.cancelledAt && (
                    <button type="button" onClick={() => { setMessage(null); setCancelling(a) }} className="text-destructive hover:underline">Batalkan</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {recording && (
        <PurchaseDialog
          {...props}
          onClose={() => setRecording(false)}
          onDone={(name) => { setRecording(false); done(`Aset "${name}" tercatat; uang keluarnya masuk Pendapatan & Pengeluaran sebagai Beli aset`) }}
        />
      )}
      {detail && <DetailDialog asset={detail} onClose={() => setDetail(null)} />}
      {disposing && (
        <DisposeDialog
          asset={disposing}
          places={props.places}
          today={today}
          onClose={() => setDisposing(null)}
          onDone={() => { setDisposing(null); done('Keadaan aset diperbarui') }}
        />
      )}
      {cancelling && (
        <CancelDialog
          asset={cancelling}
          onClose={() => setCancelling(null)}
          onDone={() => { setCancelling(null); done('Aset dibatalkan; catatan Pendapatan & Pengeluaran tertaut ikut bertanda Batal') }}
        />
      )}
    </div>
  )
}

function PurchaseDialog({ places, branches, today, onClose, onDone }: Props & { onClose: () => void; onDone: (name: string) => void }) {
  const [name, setName] = useState('')
  const [assetType, setAssetType] = useState<AssetType | ''>('')
  const [life, setLife] = useState('')
  const [branch, setBranch] = useState('')
  const [purchasedOn, setPurchasedOn] = useState(today)
  const [price, setPrice] = useState('')
  const [placeId, setPlaceId] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const priceNum = Number(price || 0)
  const lifeNum = Number(life || 0)
  const preview = priceNum >= ASSET_MIN_PRICE && lifeNum >= 1 && lifeNum <= MAX_LIFE_MONTHS && purchasedOn
    ? `${IDR.format(monthlyPortion(priceNum, lifeNum, 1))} per bulan selama ${lifeNum} bulan, mulai ${monthLabel(purchasedOn.slice(0, 7))}`
    : null

  const chooseType = (value: AssetType | '') => {
    setAssetType(value)
    const def = ASSET_TYPES.find((t) => t.value === value)?.defaultLifeMonths
    setLife(def ? String(def) : '')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assetType) return setError('Jenis aset wajib dipilih')
    if (!branch) return setError('Cabang penanggung wajib dipilih (atau Kantor)')
    setBusy(true)
    setError(null)
    const err = await send('/api/bo/assets', {
      name,
      assetType,
      usefulLifeMonths: lifeNum,
      branchId: branch === OFFICE ? null : Number(branch),
      purchasedOn,
      purchasePrice: priceNum,
      moneyPlaceId: Number(placeId) || 0,
      proofPhotoUrl: photo,
      note: note.trim() || null,
    })
    setBusy(false)
    if (err) setError(err)
    else onDone(name.trim())
  }

  return (
    <Modal title="Catat Pembelian Aset" subtitle="Barang tahan lama Rp1.000.000 ke atas. Harga dibagi rata per bulan selama umur pakainya.">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nama barang"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="mis. Freezer 2 pintu" className={inputClass} /></Field>
        <Field label="Jenis">
          <select value={assetType} onChange={(e) => chooseType(e.target.value as AssetType | '')} className={inputClass}>
            <option value="">Pilih jenis…</option>
            {ASSET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Umur pakai (bulan)" hint={assetType === 'LEASEHOLD_IMPROVEMENT' ? 'Isi sampai kontrak sewa tempat berakhir' : 'Terisi dari jenis; boleh diubah (1–120 bulan)'}>
          <input type="text" inputMode="numeric" value={life} onChange={(e) => setLife(digitsOnly(e.target.value))} className={inputClass} />
        </Field>
        <Field label="Cabang penanggung">
          <select value={branch} onChange={(e) => setBranch(e.target.value)} className={inputClass}>
            <option value="">Pilih…</option>
            <option value={OFFICE}>Kantor (bersama)</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal beli"><input type="date" value={purchasedOn} min={ASSET_START_DATE} max={today} onChange={(e) => setPurchasedOn(e.target.value)} className={inputClass} /></Field>
          <Field label="Harga"><input type="text" inputMode="numeric" value={formatRupiahInput(price)} onChange={(e) => setPrice(digitsOnly(e.target.value))} placeholder="0" className={inputClass} /></Field>
        </div>
        <Field label="Dibayar dari">
          <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} className={inputClass}>
            <option value="">Pilih Tempat Uang…</option>
            {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <ProofPhotoField value={photo} onChange={setPhoto} onUploadingChange={setUploading} disabled={busy} label="Foto Bukti (opsional)" />
        <Field label="Catatan (opsional)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={inputClass} /></Field>
        {preview && <div className="text-sm bg-muted/50 border border-border rounded-md px-3 py-2">{preview}</div>}
        <p className="text-xs text-muted-foreground">
          Aset tidak bisa diubah sesudah disimpan. Bila keliru, Owner/GM membatalkannya lalu catat ulang. Barang yang dibeli sejak 1 Nov 2026
          dan terlanjur dicatat sebagai Biaya: batalkan dulu catatan itu di Pendapatan &amp; Pengeluaran, lalu catat di sini.
        </p>
        <ErrorBox text={error} />
        <Buttons onBack={onClose} busy={busy || uploading} submitLabel="Simpan" busyLabel={uploading ? 'Mengunggah foto…' : 'Menyimpan…'} />
      </form>
    </Modal>
  )
}

function DetailDialog({ asset: a, onClose }: { asset: AssetRow; onClose: () => void }) {
  return (
    <Modal title={a.name} subtitle={`${ASSET_TYPE_SHORT[a.assetType]} · ${a.branchName ?? 'Kantor'} · ${IDR.format(a.purchasePrice)} · ${lifeLabel(a.usefulLifeMonths)}`} wide>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Tanggal beli</dt><dd>{dateLabel(a.purchasedOn)}</dd>
        <dt className="text-muted-foreground">Dibayar dari</dt><dd>{a.moneyPlaceName ?? '—'}</dd>
        <dt className="text-muted-foreground">Dicatat oleh</dt><dd>{a.createdByName ?? '—'} · {formatWIB(a.createdAt, { day: '2-digit', month: 'short', year: 'numeric' })}</dd>
        <dt className="text-muted-foreground">Catatan Arus Kas</dt><dd>Beli aset #{a.purchaseCashFlowEntryId}{a.saleCashFlowEntryId ? ` · Jual aset #${a.saleCashFlowEntryId}` : ''}</dd>
        {a.note && <><dt className="text-muted-foreground">Catatan</dt><dd>{a.note}</dd></>}
        {a.proofPhotoUrl && <><dt className="text-muted-foreground">Foto bukti</dt><dd><ProofPhotoLink url={a.proofPhotoUrl} /></dd></>}
        {a.status !== 'IN_USE' && (
          <>
            <dt className="text-muted-foreground">Keadaan</dt>
            <dd>{ASSET_STATUS_LABEL[a.status]} · {a.disposedOn ? dateLabel(a.disposedOn) : ''} · {a.disposalReason} ({a.disposedByName ?? '—'})</dd>
            {a.status === 'SOLD' && <><dt className="text-muted-foreground">Uang hasil jual</dt><dd>{IDR.format(a.saleAmount ?? 0)}</dd></>}
            {a.disposalLoss !== null && (
              <>
                <dt className="text-muted-foreground">{a.disposalLoss >= 0 ? 'Kerugian aset' : 'Untung jual aset'}</dt>
                <dd>{IDR.format(Math.abs(a.disposalLoss))} di {a.disposedOn ? monthLabel(a.disposedOn.slice(0, 7)) : ''}</dd>
              </>
            )}
          </>
        )}
        {a.cancelledAt && <><dt className="text-muted-foreground">Dibatalkan</dt><dd>{a.cancelReason} ({a.cancelledByName ?? '—'})</dd></>}
      </dl>
      <div>
        <h3 className="text-sm font-medium mb-2">Jadwal penyusutan</h3>
        {a.schedule.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada penyusutan (dilepas di bulan pembelian).</p>
        ) : (
          <div className="max-h-72 overflow-y-auto border border-border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                <tr>
                  <th className="text-left px-3 py-1.5 font-medium">Bulan</th>
                  <th className="text-right px-3 py-1.5 font-medium">Penyusutan</th>
                  <th className="text-right px-3 py-1.5 font-medium">Akumulasi</th>
                  <th className="text-right px-3 py-1.5 font-medium">Sisa nilai</th>
                </tr>
              </thead>
              <tbody>
                {a.schedule.map((r) => (
                  <tr key={r.month} className="border-t border-border">
                    <td className="px-3 py-1">{monthLabel(r.month)}</td>
                    <td className="px-3 py-1 text-right">{IDR.format(r.portion)}</td>
                    <td className="px-3 py-1 text-right">{IDR.format(r.accumulated)}</td>
                    <td className="px-3 py-1 text-right">{IDR.format(r.bookValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted">Tutup</button>
      </div>
    </Modal>
  )
}

function DisposeDialog({ asset, places, today, onClose, onDone }: { asset: AssetRow; places: PlaceOption[]; today: string; onClose: () => void; onDone: () => void }) {
  const [status, setStatus] = useState<DisposalStatus | ''>('')
  const [disposedOn, setDisposedOn] = useState(today)
  const [reason, setReason] = useState('')
  const [sale, setSale] = useState('')
  const [placeId, setPlaceId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!status) return setError('Keadaan baru wajib dipilih')
    setBusy(true)
    setError(null)
    const saleAmount = status === 'SOLD' ? Number(sale || 0) : null
    const err = await send(`/api/bo/assets/${asset.id}/dispose`, {
      status,
      disposedOn,
      reason,
      saleAmount,
      moneyPlaceId: status === 'SOLD' && (saleAmount ?? 0) > 0 ? Number(placeId) || null : null,
    })
    setBusy(false)
    if (err) setError(err)
    else onDone()
  }

  return (
    <Modal title={`Ubah keadaan: ${asset.name}`} subtitle="Penyusutan berhenti; sisa nilai menjadi kerugian di bulan kejadian (dikurangi uang hasil jual). Tidak bisa dibalik.">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Keadaan baru">
          <select value={status} onChange={(e) => setStatus(e.target.value as DisposalStatus | '')} className={inputClass}>
            <option value="">Pilih…</option>
            <option value="DAMAGED">Rusak (tidak dipakai lagi)</option>
            <option value="LOST">Hilang</option>
            <option value="SOLD">Dijual</option>
          </select>
        </Field>
        <Field label="Tanggal kejadian"><input type="date" value={disposedOn} min={asset.purchasedOn} max={today} onChange={(e) => setDisposedOn(e.target.value)} className={inputClass} /></Field>
        <Field label={status === 'SOLD' ? 'Alasan / pembeli' : 'Alasan'}><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className={inputClass} /></Field>
        {status === 'SOLD' && (
          <>
            <Field label="Uang hasil jual" hint="Isi 0 bila tidak ada uang">
              <input type="text" inputMode="numeric" value={formatRupiahInput(sale)} onChange={(e) => setSale(digitsOnly(e.target.value))} placeholder="0" className={inputClass} />
            </Field>
            {Number(sale || 0) > 0 && (
              <Field label="Masuk ke">
                <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} className={inputClass}>
                  <option value="">Pilih Tempat Uang…</option>
                  {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            )}
          </>
        )}
        <ErrorBox text={error} />
        <Buttons onBack={onClose} busy={busy} submitLabel="Simpan" busyLabel="Menyimpan…" />
      </form>
    </Modal>
  )
}

function CancelDialog({ asset, onClose, onDone }: { asset: AssetRow; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await send(`/api/bo/assets/${asset.id}/cancel`, { reason })
    setBusy(false)
    if (err) setError(err)
    else onDone()
  }

  return (
    <Modal title={`Batalkan aset: ${asset.name}`} subtitle="Untuk salah catat. Catatan Beli aset (dan Jual aset bila ada) ikut bertanda Batal, saldo Tempat Uang kembali, dan penyusutannya hilang dari Laba Rugi.">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Alasan pembatalan"><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} className={inputClass} /></Field>
        <ErrorBox text={error} />
        <Buttons onBack={onClose} busy={busy} submitLabel="Batalkan aset" busyLabel="Membatalkan…" danger />
      </form>
    </Modal>
  )
}
