'use client'

import { useEffect, useState } from 'react'
import { NewBadge } from '@/components/ui/new-badge'
import { ProductSelect } from '@/components/ui/product-select'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'
import {
  buildPromoPayload, emptyPromoForm, parseWholeNumber, promoPricePreview,
  PROMO_CUT_LABEL, PROMO_FORM_SHAPES, PROMO_FORM_SHAPE_HINT, PROMO_FORM_SHAPE_LABEL, PROMO_QUOTA_KIND_LABEL,
  type PromoFormItem, type PromoFormState, type PromoPayload,
} from '@/lib/promo/promo-form'
import type { BranchOption, PromoItemOption, PromoLoss } from './types'

const inputClass =
  'w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring'
const labelClass = 'mb-1 block text-xs font-medium text-muted-foreground'
const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

function ItemPicker({
  items, value, onChange,
}: {
  items: PromoItemOption[]
  value: PromoFormItem | null
  onChange: (item: PromoFormItem | null) => void
}) {
  const product = value ? items.find((i) => i.productId === value.productId) ?? null : null
  return (
    <div className="flex flex-wrap gap-2">
      <div className="min-w-56 flex-1">
        <ProductSelect
          products={items.map((i) => ({ id: i.productId, name: i.name, sku: i.sku }))}
          value={value ? String(value.productId) : ''}
          onChange={(v) => {
            const picked = items.find((i) => String(i.productId) === v)
            onChange(picked ? { productId: picked.productId, uomId: picked.uoms[0]!.uomId } : null)
          }}
          placeholder="-- Cari & pilih barang --"
        />
      </div>
      {product && value && <UomSelect items={items} value={value} onChange={(uomId) => onChange({ ...value, uomId })} />}
    </div>
  )
}

function UomSelect({ items, value, onChange }: { items: PromoItemOption[]; value: PromoFormItem; onChange: (uomId: number) => void }) {
  const product = items.find((i) => i.productId === value.productId)
  return (
    <select className={`${inputClass} w-auto`} value={value.uomId} onChange={(e) => onChange(Number(e.target.value))} aria-label="Satuan">
      {(product?.uoms ?? []).map((u) => (
        <option key={u.uomId} value={u.uomId}>
          {u.code}{u.price != null ? ` — ${rupiah(u.price)}` : ' — belum ada harga Retail'}
        </option>
      ))}
    </select>
  )
}

/** Form buat promo baru (popup). Promo yang sudah dibuat tidak bisa diubah. */
export default function PromoFormDialog({
  items, branches, today, defaultBranchIds, onClose, onCreated,
}: {
  items: PromoItemOption[]
  branches: BranchOption[]
  today: string
  defaultBranchIds: number[]
  onClose: () => void
  onCreated: (name: string) => void
}) {
  const [form, setForm] = useState<PromoFormState>(() => emptyPromoForm(today, defaultBranchIds))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [losses, setLosses] = useState<{ payload: PromoPayload; rows: PromoLoss[] } | null>(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const set = <K extends keyof PromoFormState>(key: K, value: PromoFormState[K]) => setForm((f) => ({ ...f, [key]: value }))
  const priceOf = (item: PromoFormItem) =>
    items.find((i) => i.productId === item.productId)?.uoms.find((u) => u.uomId === item.uomId)?.price ?? null
  const nameOf = (item: PromoFormItem) => {
    const p = items.find((i) => i.productId === item.productId)
    return `${p?.name ?? `#${item.productId}`} (${p?.uoms.find((u) => u.uomId === item.uomId)?.code ?? ''})`
  }
  const cutValue = parseWholeNumber(form.cutValue)
  const rewardItems: PromoFormItem[] = form.shape === 'BELI_A_POTONG_B' ? form.rewards : form.target ? [form.target] : []

  async function send(payload: PromoPayload) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/bo/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string; losses?: PromoLoss[] }
      if (res.status === 409 && data.code === 'PROMO_LOSS') {
        setLosses({ payload, rows: data.losses ?? [] })
        return
      }
      if (!res.ok) {
        setError(data.error ?? `Gagal menyimpan (${res.status})`)
        return
      }
      onCreated(payload.name)
    } catch {
      setError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setBusy(false)
    }
  }

  function submit() {
    const built = buildPromoPayload(form)
    if ('error' in built) {
      setError(built.error)
      return
    }
    void send(built.payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 py-8">
      {losses && (
        <RequiredChoiceDialog
          title="Harga promo di bawah modal"
          tone="danger"
          actions={[
            { label: 'Batal, perbaiki dulu', variant: 'secondary', disabled: busy, onClick: () => setLosses(null) },
            {
              label: busy ? 'Menyimpan…' : 'Tetap buat (jual rugi)',
              variant: 'destructive',
              disabled: busy,
              onClick: () => {
                const payload = { ...losses.payload, acceptLoss: true }
                setLosses(null)
                void send(payload)
              },
            },
          ]}
        >
          <p>Barang berikut akan terjual di bawah modalnya selama promo:</p>
          <ul className="max-h-60 space-y-1 overflow-y-auto rounded-md border border-border p-2 text-xs">
            {losses.rows.map((l, i) => (
              <li key={i}>
                <b>{l.productName} ({l.uomCode})</b> di {l.branchName}: harga {rupiah(l.price)} → promo <b>{rupiah(l.promoPrice)}</b>,
                modal {rupiah(l.cost)} (rugi {rupiah(l.cost - l.promoPrice)} per pcs)
              </li>
            ))}
          </ul>
          <p>Bila tetap dibuat, pilihan ini tercatat atas nama Anda.</p>
        </RequiredChoiceDialog>
      )}
      <div role="dialog" aria-modal="true" aria-labelledby="promo-form-title" className="mx-4 w-full max-w-2xl rounded-lg bg-background shadow-xl">
        <div className="h-1.5 rounded-t-lg bg-primary" />
        <div className="space-y-5 p-6">
          <h3 id="promo-form-title" className="text-base font-semibold text-foreground">Buat promo</h3>

          <fieldset>
            <legend className={labelClass}>Bentuk promo</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROMO_FORM_SHAPES.map((shape) => (
                <label
                  key={shape}
                  className={`cursor-pointer rounded-md border p-3 text-sm ${form.shape === shape ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  <input type="radio" name="promo-shape" className="mr-2" checked={form.shape === shape} onChange={() => set('shape', shape)} />
                  <b>{PROMO_FORM_SHAPE_LABEL[shape]}</b>
                  <span className="mt-1 block text-xs text-muted-foreground">{PROMO_FORM_SHAPE_HINT[shape]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Nama promo (tampil di kasir & struk)</label>
              <input className={inputClass} value={form.name} maxLength={100} onChange={(e) => set('name', e.target.value)} placeholder="mis. Promo Gajian" />
            </div>
            <div>
              <label className={labelClass}>Catatan (opsional)</label>
              <input className={inputClass} value={form.note} maxLength={500} onChange={(e) => set('note', e.target.value)} />
            </div>
          </div>

          {branches.length > 1 && (
            <fieldset>
              <legend className={labelClass}>Berlaku di cabang</legend>
              <div className="flex flex-wrap gap-3 text-sm">
                {branches.map((b) => (
                  <label key={b.id} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={form.branchIds.includes(b.id)}
                      onChange={(e) => set('branchIds', e.target.checked ? [...form.branchIds, b.id] : form.branchIds.filter((id) => id !== b.id))}
                    />
                    {b.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="space-y-2">
            <legend className={labelClass}>Masa berlaku (WIB)</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex gap-2">
                <input type="date" className={inputClass} value={form.startDate} onChange={(e) => set('startDate', e.target.value)} aria-label="Tanggal mulai" />
                <input type="time" className={`${inputClass} w-32`} value={form.startTime} onChange={(e) => set('startTime', e.target.value)} aria-label="Jam mulai" />
              </div>
              <div className="flex gap-2">
                <input type="date" className={inputClass} value={form.endDate} onChange={(e) => set('endDate', e.target.value)} aria-label="Tanggal selesai" />
                <input type="time" className={`${inputClass} w-32`} value={form.endTime} onChange={(e) => set('endTime', e.target.value)} aria-label="Jam selesai" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.useDailyHours} onChange={(e) => set('useDailyHours', e.target.checked)} />
              Hanya jam tertentu tiap hari
            </label>
            {form.useDailyHours && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <input type="time" className={`${inputClass} w-32`} value={form.dailyFrom} onChange={(e) => set('dailyFrom', e.target.value)} aria-label="Jam mulai tiap hari" />
                sampai
                <input type="time" className={`${inputClass} w-32`} value={form.dailyTo} onChange={(e) => set('dailyTo', e.target.value)} aria-label="Jam selesai tiap hari" />
                <span className="text-xs text-muted-foreground">Boleh melewati tengah malam (mis. 22.00 sampai 02.00).</span>
              </div>
            )}
          </fieldset>

          {form.shape === 'BELI_A_POTONG_B' ? (
            <>
              <fieldset className="space-y-2">
                <legend className={labelClass}>Barang syarat (semua harus ada di keranjang)</legend>
                {form.conditions.map((c, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="flex-1">{items.find((p) => p.productId === c.productId)?.name}</span>
                    <UomSelect items={items} value={c} onChange={(uomId) => set('conditions', form.conditions.map((x, j) => (j === i ? { ...x, uomId } : x)))} />
                    minimal
                    <input
                      className={`${inputClass} w-20`}
                      inputMode="numeric"
                      value={c.minQty}
                      onChange={(e) => set('conditions', form.conditions.map((x, j) => (j === i ? { ...x, minQty: e.target.value } : x)))}
                      aria-label="Jumlah minimal"
                    />
                    pcs
                    <button type="button" className="text-xs text-destructive hover:underline" onClick={() => set('conditions', form.conditions.filter((_, j) => j !== i))}>
                      Hapus
                    </button>
                  </div>
                ))}
                <ItemPicker items={items} value={null} onChange={(item) => item && set('conditions', [...form.conditions, { ...item, minQty: '1' }])} />
              </fieldset>
              <fieldset className="space-y-2">
                <legend className={labelClass}>Barang yang dipotong</legend>
                {form.rewards.map((r, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="flex-1">{items.find((p) => p.productId === r.productId)?.name}</span>
                    <UomSelect items={items} value={r} onChange={(uomId) => set('rewards', form.rewards.map((x, j) => (j === i ? { ...x, uomId } : x)))} />
                    <input
                      className={`${inputClass} w-20`}
                      inputMode="numeric"
                      value={r.qty}
                      onChange={(e) => set('rewards', form.rewards.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
                      aria-label="Pcs dipotong"
                    />
                    pcs tiap kali terpakai
                    <button type="button" className="text-xs text-destructive hover:underline" onClick={() => set('rewards', form.rewards.filter((_, j) => j !== i))}>
                      Hapus
                    </button>
                  </div>
                ))}
                <ItemPicker items={items} value={null} onChange={(item) => item && set('rewards', [...form.rewards, { ...item, qty: '1' }])} />
              </fieldset>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.isMultiple} onChange={(e) => set('isMultiple', e.target.checked)} />
                  Berlaku kelipatan (beli 2× syarat → potongan 2×)
                </label>
                {form.isMultiple && (
                  <label className="flex items-center gap-2">
                    paling banyak
                    <input className={`${inputClass} w-20`} inputMode="numeric" value={form.maxPerNote} onChange={(e) => set('maxPerNote', e.target.value)} />
                    × per nota (kosong = tanpa batas)
                  </label>
                )}
              </div>
            </>
          ) : (
            <fieldset className="space-y-2">
              <legend className={labelClass}>Barang promo (satu barang per promo)</legend>
              <ItemPicker items={items} value={form.target} onChange={(item) => set('target', item)} />
              {form.shape === 'MULAI_N' && (
                <label className="flex items-center gap-2 text-sm">
                  Harga khusus mulai
                  <input className={`${inputClass} w-20`} inputMode="numeric" value={form.minQty} onChange={(e) => set('minQty', e.target.value)} />
                  pcs
                </label>
              )}
            </fieldset>
          )}

          <fieldset className="space-y-2">
            <legend className={labelClass}>Cara potong</legend>
            <div className="flex flex-wrap gap-2">
              <select
                className={`${inputClass} w-auto`}
                value={form.cutType}
                onChange={(e) => set('cutType', e.target.value as PromoFormState['cutType'])}
                aria-label="Cara potong"
              >
                {Object.entries(PROMO_CUT_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input className={`${inputClass} w-40`} inputMode="numeric" value={form.cutValue} onChange={(e) => set('cutValue', e.target.value)} placeholder="Rupiah" />
            </div>
            {cutValue != null && cutValue > 0 && rewardItems.length > 0 && (
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {rewardItems.map((item, i) => {
                  const price = priceOf(item)
                  return (
                    <li key={i}>
                      {nameOf(item)}:{' '}
                      {price == null ? 'belum ada harga Retail di cabang ini' : promoPricePreview({ type: form.cutType, value: cutValue }, price)}
                    </li>
                  )
                })}
              </ul>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className={`${labelClass} flex items-center gap-2`}>
              Batas kuota & stok <NewBadge feature="fitur/promo-kuota" />
            </legend>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <select
                className={`${inputClass} w-auto`}
                value={form.quotaKind}
                onChange={(e) => set('quotaKind', e.target.value as PromoFormState['quotaKind'])}
                aria-label="Jenis kuota"
              >
                <option value="">Tanpa kuota (tak terbatas)</option>
                {Object.entries(PROMO_QUOTA_KIND_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {form.quotaKind && (
                <label className="flex items-center gap-2">
                  jatah
                  <input
                    className={`${inputClass} w-24`}
                    inputMode="numeric"
                    value={form.quotaPerBranch}
                    onChange={(e) => set('quotaPerBranch', e.target.value)}
                    aria-label="Jatah kuota per cabang"
                  />
                  {form.quotaKind === 'PCS' ? 'pcs hadiah' : 'nota'} per cabang
                </label>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {form.quotaKind === 'PCS'
                ? 'Promo berhenti setelah sekian pcs barang hadiah terpakai di cabang itu. Bila jatah tinggal sedikit, sisanya dipotong sebagian.'
                : form.quotaKind === 'NOTA'
                  ? 'Promo berhenti setelah sekian nota memakainya di cabang itu.'
                  : 'Tiap cabang punya jatah sendiri dan tidak dicampur. Kosongkan untuk promo tanpa batas kuota.'}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.requireStock} onChange={(e) => set('requireStock', e.target.checked)} />
              Hanya tawarkan bila stok barang hadiah di cabang itu masih ada
            </label>
          </fieldset>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <button type="button" disabled={busy} onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">
              Batal
            </button>
            <button type="button" disabled={busy} onClick={submit} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {busy ? 'Menyimpan…' : 'Simpan promo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
