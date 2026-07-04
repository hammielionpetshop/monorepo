'use client'

import { X } from 'lucide-react'
import { DISPLAY_TIERS, type DraftUomRow, type UomOption, type ProductConversion } from './types'

interface Props {
  draft: DraftUomRow
  allUoms: UomOption[]
  usedUomIds: number[] // UOM yang sudah punya baris harga di grid untuk produk ini
  conversions: ProductConversion[]
  disabled: boolean
  onChange: (draft: DraftUomRow) => void
  onRemove: () => void
}

function formatPrice(n: number): string {
  return n.toLocaleString('id-ID')
}

function parsePrice(input: string): number | null {
  const digits = input.replace(/[^\d]/g, '')
  if (!digits) return null
  const n = parseInt(digits, 10)
  return isNaN(n) ? null : n
}

export default function DraftUomRowView({
  draft,
  allUoms,
  usedUomIds,
  conversions,
  disabled,
  onChange,
  onRemove,
}: Props) {
  const isBaseSelected = draft.uomId !== null && draft.uomId === draft.baseUomId
  const existingConv = draft.uomId !== null
    ? conversions.find((c) => c.uomId === draft.uomId) ?? null
    : null

  function handleSelectUom(value: string) {
    if (value === '__new__') {
      onChange({ ...draft, uomId: null, newUom: { code: '', name: '' }, ratio: '' })
      return
    }
    const uomId = value ? Number(value) : null
    const conv = uomId !== null ? conversions.find((c) => c.uomId === uomId) : undefined
    onChange({
      ...draft,
      uomId,
      newUom: null,
      ratio: conv?.ratio != null ? String(conv.ratio) : (uomId === draft.baseUomId ? '' : draft.ratio),
    })
  }

  return (
    <tr className="bg-primary/[0.03]">
      {/* Kolom UOM — select atau input satuan baru */}
      <td className="px-2 py-1.5">
        {draft.newUom === null ? (
          <select
            value={draft.uomId ?? ''}
            onChange={(e) => handleSelectUom(e.target.value)}
            disabled={disabled}
            className="w-full border border-border rounded px-1.5 py-1 text-xs bg-background text-foreground"
          >
            <option value="">-- pilih --</option>
            {allUoms
              .filter((u) => !usedUomIds.includes(u.id))
              .map((u) => {
                const conv = conversions.find((c) => c.uomId === u.id)
                return (
                  <option key={u.id} value={u.id}>
                    {u.code}
                    {u.id === draft.baseUomId ? ' (dasar)' : conv ? ` (ratio ${conv.ratio} — global)` : ''}
                  </option>
                )
              })}
            <option value="__new__">+ Satuan baru...</option>
          </select>
        ) : (
          <span className="flex items-center gap-1">
            <input
              type="text"
              value={draft.newUom.code}
              onChange={(e) => onChange({ ...draft, newUom: { ...draft.newUom!, code: e.target.value.toUpperCase() } })}
              maxLength={10}
              placeholder="KODE"
              disabled={disabled}
              className="w-14 border border-border rounded px-1.5 py-1 text-xs bg-background text-foreground uppercase"
            />
            <input
              type="text"
              value={draft.newUom.name}
              onChange={(e) => onChange({ ...draft, newUom: { ...draft.newUom!, name: e.target.value } })}
              maxLength={50}
              placeholder="Nama"
              disabled={disabled}
              className="w-20 border border-border rounded px-1.5 py-1 text-xs bg-background text-foreground"
            />
            <button
              type="button"
              onClick={() => onChange({ ...draft, newUom: null, uomId: null })}
              disabled={disabled}
              title="Batal buat satuan baru"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
      </td>

      {/* Kolom Konversi — ratio (global) */}
      <td className="px-2 py-1.5">
        {isBaseSelected ? (
          <span className="text-xs text-muted-foreground px-2">dasar</span>
        ) : (
          <span className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">=</span>
            <input
              type="text"
              inputMode="numeric"
              value={draft.ratio}
              onChange={(e) => onChange({ ...draft, ratio: e.target.value.replace(/[^\d]/g, '') })}
              placeholder="ratio"
              disabled={disabled}
              className={[
                'w-16 text-right border rounded px-1.5 py-1 text-xs bg-background text-foreground',
                existingConv && String(existingConv.ratio ?? '') !== draft.ratio && draft.ratio !== ''
                  ? 'border-amber-400 bg-amber-50 text-amber-800'
                  : 'border-violet-300',
              ].join(' ')}
            />
            <span className="text-xs text-muted-foreground">{draft.baseUomCode}</span>
          </span>
        )}
        {existingConv && String(existingConv.ratio ?? '') !== draft.ratio && draft.ratio !== '' && (
          <p className="text-[10px] text-amber-700 mt-0.5">ratio global saat ini: {existingConv.ratio}</p>
        )}
      </td>

      {/* Harga Modal */}
      <td className="px-2 py-1.5">
        <input
          type="text"
          inputMode="numeric"
          value={draft.cost !== null ? formatPrice(draft.cost) : ''}
          onChange={(e) => onChange({ ...draft, cost: parsePrice(e.target.value) })}
          placeholder="—"
          disabled={disabled}
          className="w-full text-right px-2 py-1 rounded border border-amber-300 bg-background text-sm text-amber-700 focus:outline-none focus:border-amber-400"
        />
      </td>

      {/* Harga per tier */}
      {DISPLAY_TIERS.map((tier) => (
        <td key={tier} className="px-2 py-1.5">
          <input
            type="text"
            inputMode="numeric"
            value={draft.prices[tier] != null ? formatPrice(draft.prices[tier]!) : ''}
            onChange={(e) => onChange({ ...draft, prices: { ...draft.prices, [tier]: parsePrice(e.target.value) } })}
            placeholder="—"
            disabled={disabled}
            className="w-full text-right px-2 py-1 rounded border border-primary/30 bg-background text-sm text-foreground focus:outline-none focus:border-primary"
          />
        </td>
      ))}

      {/* Aksi — hapus draft */}
      <td className="px-2 py-1.5 text-center">
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          title="Batalkan baris ini"
          className="text-muted-foreground hover:text-destructive transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  )
}
