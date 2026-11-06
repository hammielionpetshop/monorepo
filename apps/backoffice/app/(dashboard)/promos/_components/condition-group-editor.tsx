'use client'

import { useMemo, useState } from 'react'
import { ProductSelect } from '@/components/ui/product-select'
import type { PromoFormItem } from '@/lib/promo/promo-form'
import type { PromoItemOption } from './types'

const inputClass =
  'w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring'

export interface ConditionGroupValue {
  members: PromoFormItem[]
  minQty: string
}

/**
 * Satu kelompok campur di form promo: beberapa barang (mis. semua aroma pasir 10 L) yang qty-nya
 * dijumlah terhadap satu jumlah minimal. Semua anggota memakai satu satuan (kode yang sama),
 * supaya "3 pcs campur" tidak rancu.
 */
export function ConditionGroupEditor({
  index, items, value, usedProductIds, onChange, onRemove,
}: {
  index: number
  items: PromoItemOption[]
  value: ConditionGroupValue
  /** Barang yang sudah dipakai di syarat lain — tidak boleh masuk dua kali. */
  usedProductIds: Set<number>
  onChange: (next: ConditionGroupValue) => void
  onRemove: () => void
}) {
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const byId = useMemo(() => new Map(items.map((i) => [i.productId, i])), [items])

  const firstMember = value.members[0]
  const uomCode = firstMember
    ? byId.get(firstMember.productId)?.uoms.find((u) => u.uomId === firstMember.uomId)?.code ?? null
    : null
  const memberIds = new Set(value.members.map((m) => m.productId))

  /** Satuan anggota baru: sama kodenya dengan kelompok; anggota pertama pakai satuan pertamanya. */
  const memberFor = (product: PromoItemOption): PromoFormItem | null => {
    const uom = uomCode ? product.uoms.find((u) => u.code === uomCode) : product.uoms[0]
    return uom ? { productId: product.productId, uomId: uom.uomId } : null
  }

  const add = (products: PromoItemOption[]) => {
    const added: PromoFormItem[] = []
    let skippedUom = 0
    let currentCode = uomCode
    for (const product of products) {
      if (memberIds.has(product.productId) || usedProductIds.has(product.productId)) continue
      const uom = currentCode ? product.uoms.find((u) => u.code === currentCode) : product.uoms[0]
      if (!uom) {
        skippedUom += 1
        continue
      }
      currentCode = uom.code
      added.push({ productId: product.productId, uomId: uom.uomId })
    }
    onChange({ ...value, members: [...value.members, ...added] })
    setNotice(skippedUom > 0 ? `${skippedUom} barang dilewati karena tidak punya satuan ${currentCode}.` : null)
  }

  const term = query.trim().toLowerCase()
  const matches = term.length >= 2
    ? items.filter((i) => !memberIds.has(i.productId) && !usedProductIds.has(i.productId)
      && (i.name.toLowerCase().includes(term) || (i.sku ?? '').toLowerCase().includes(term)))
    : []

  const changeUom = (code: string) => {
    const next: PromoFormItem[] = []
    let dropped = 0
    for (const m of value.members) {
      const uom = byId.get(m.productId)?.uoms.find((u) => u.code === code)
      if (uom) next.push({ productId: m.productId, uomId: uom.uomId })
      else dropped += 1
    }
    onChange({ ...value, members: next })
    setNotice(dropped > 0 ? `${dropped} barang dikeluarkan karena tidak punya satuan ${code}.` : null)
  }
  const groupCodes = firstMember
    ? [...new Set(byId.get(firstMember.productId)?.uoms.map((u) => u.code) ?? [])]
    : []

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Kelompok campur {index + 1}</span>
        <span className="text-muted-foreground">— total minimal</span>
        <input
          className={`${inputClass} w-20`}
          inputMode="numeric"
          value={value.minQty}
          onChange={(e) => onChange({ ...value, minQty: e.target.value })}
          aria-label="Jumlah minimal kelompok"
        />
        {groupCodes.length > 1 ? (
          <select className={`${inputClass} w-auto`} value={uomCode ?? ''} onChange={(e) => changeUom(e.target.value)} aria-label="Satuan kelompok">
            {groupCodes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <span>{uomCode ?? 'pcs'}</span>
        )}
        <span className="text-muted-foreground">rasa/aroma bebas dicampur</span>
        <button type="button" className="ml-auto text-xs text-destructive hover:underline" onClick={onRemove}>
          Hapus kelompok
        </button>
      </div>

      {value.members.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.members.map((m) => (
            <li key={m.productId} className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs">
              {byId.get(m.productId)?.name ?? `#${m.productId}`}
              <button
                type="button"
                className="text-destructive"
                aria-label="Keluarkan dari kelompok"
                onClick={() => onChange({ ...value, members: value.members.filter((x) => x.productId !== m.productId) })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} min-w-48 flex-1`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama, mis. pasir 10L"
          aria-label="Cari barang untuk kelompok"
        />
        <button
          type="button"
          disabled={matches.length === 0}
          onClick={() => { add(matches); setQuery('') }}
          className="rounded-md border border-primary px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          Tambah semua hasil ({matches.length})
        </button>
      </div>
      {matches.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {matches.slice(0, 8).map((m) => m.name).join(' · ')}{matches.length > 8 ? ` · dan ${matches.length - 8} lainnya` : ''}
        </p>
      )}
      <div className="min-w-56">
        <ProductSelect
          products={items
            .filter((i) => !memberIds.has(i.productId) && !usedProductIds.has(i.productId))
            .map((i) => ({ id: i.productId, name: i.name, sku: i.sku }))}
          value=""
          onChange={(v) => {
            const picked = byId.get(Number(v))
            if (!picked) return
            const member = memberFor(picked)
            if (!member) {
              setNotice(`${picked.name} tidak punya satuan ${uomCode}.`)
              return
            }
            onChange({ ...value, members: [...value.members, member] })
            setNotice(null)
          }}
          placeholder="-- atau tambah satu barang --"
        />
      </div>
      {notice && <p className="text-xs text-amber-700">{notice}</p>}
      {value.members.length < 2 && <p className="text-xs text-muted-foreground">Isi sekurangnya 2 barang.</p>}
    </div>
  )
}
