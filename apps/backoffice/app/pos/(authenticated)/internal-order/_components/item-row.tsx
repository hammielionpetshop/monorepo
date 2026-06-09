'use client'

import { forwardRef } from 'react'
import type { ItemRow } from './types'

interface ItemRowProps {
  item: ItemRow
  index: number
  onUpdate: (id: number, field: keyof ItemRow, value: unknown) => void
  onRemove: (id: number) => void
  onQtyKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, index: number) => void
  onLastFieldTab?: (index: number) => void
  disabled?: boolean
}

const ItemRowComponent = forwardRef<HTMLInputElement, ItemRowProps>(
  ({ item, index, onUpdate, onRemove, onQtyKeyDown, onLastFieldTab, disabled }, ref) => {
    return (
      <tr className="border-t border-border">
        <td className="px-3 py-2">
          <div className="font-medium text-xs text-foreground">{item.productName}</div>
          <div className="text-xs text-muted-foreground">{item.productCode}</div>
        </td>
        <td className="px-2 py-2">
          <input
            ref={ref}
            type="text"
            inputMode="numeric"
            value={item.qtyRequested === 0 ? '' : String(item.qtyRequested)}
            onChange={(e) => {
              const val = parseInt(e.target.value.replace(/\D/g, ''), 10)
              onUpdate(item.id, 'qtyRequested', isNaN(val) ? 0 : val)
            }}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => onQtyKeyDown(e, index)}
            disabled={disabled}
            placeholder="0"
            className="w-full border border-border rounded px-2 py-1 text-xs text-center bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
        </td>
        <td className="px-2 py-2">
          {item.availableUoms.length > 1 ? (
            <select
              value={item.uomId}
              onChange={(e) => {
                const selectedUomId = parseInt(e.target.value, 10)
                const selectedUom = item.availableUoms.find((u: { id: number; name: string; ratio: number }) => u.id === selectedUomId)
                if (!selectedUom) return
                onUpdate(item.id, 'uomId', selectedUomId)
                onUpdate(item.id, 'uomName', selectedUom.name)
                const baseDefaultCost = item.baseDefaultCostPrice ?? 0
                onUpdate(item.id, 'costPrice', baseDefaultCost * selectedUom.ratio)
              }}
              disabled={disabled}
              className="w-full border border-border rounded px-1.5 py-1 text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            >
              {item.availableUoms.map((u: { id: number; name: string; ratio: number }) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-muted-foreground px-1">{item.uomName}</span>
          )}
        </td>
        <td className="px-2 py-2">
          <input
            type="text"
            inputMode="numeric"
            value={item.costPrice === 0 ? '' : String(item.costPrice)}
            onChange={(e) => {
              const val = parseInt(e.target.value.replace(/\D/g, ''), 10)
              onUpdate(item.id, 'costPrice', isNaN(val) ? 0 : val)
            }}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && !e.shiftKey && onLastFieldTab) onLastFieldTab(index)
            }}
            disabled={disabled}
            placeholder="0"
            className="w-full border border-border rounded px-2 py-1 text-xs text-right bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
        </td>
        <td className="px-2 py-2 text-center">
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            disabled={disabled}
            tabIndex={-1}
            className="text-destructive hover:text-destructive/80 text-xs px-1.5 py-1 rounded hover:bg-destructive/10 transition-colors disabled:opacity-50"
            aria-label={`Hapus ${item.productName}`}
          >
            ✕
          </button>
        </td>
      </tr>
    )
  }
)

ItemRowComponent.displayName = 'ItemRow'

export default ItemRowComponent
