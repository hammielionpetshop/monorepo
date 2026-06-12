'use client'

import { forwardRef } from 'react'
import { calculateRowSubtotal } from './bulk-sale-calculations'
import type { BulkSalePriceOption, BulkSaleRow } from './types'

type BulkSaleItemRowProps = {
  row: BulkSaleRow
  onChange: (row: BulkSaleRow) => void
  onRemove: () => void
  onLastFieldTab: () => void
  disabled?: boolean
}

function parseIntegerInput(value: string) {
  const parsed = parseInt(value.replace(/\D/g, ''), 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

function safeSubtotal(row: Pick<BulkSaleRow, 'qty' | 'unitPrice' | 'discountAmount'>) {
  try {
    return calculateRowSubtotal(row)
  } catch {
    return 0
  }
}

function firstPriceForUom(prices: BulkSalePriceOption[], uomId: number) {
  return prices.find((price) => price.uomId === uomId) ?? null
}

function clampDiscount(discountAmount: number, qty: number, unitPrice: number) {
  return Math.min(discountAmount, qty * unitPrice)
}

const BulkSaleItemRow = forwardRef<HTMLInputElement, BulkSaleItemRowProps>(
  ({ row, onChange, onRemove, onLastFieldTab, disabled }, ref) => {
    const priceOptions = row.availablePrices.filter((price) => price.uomId === row.uomId)

    function updateRow(patch: Partial<BulkSaleRow>) {
      const draftRow = { ...row, ...patch }
      const nextRow = {
        ...draftRow,
        discountAmount: clampDiscount(draftRow.discountAmount, draftRow.qty, draftRow.unitPrice),
      }
      onChange({ ...nextRow, subtotal: safeSubtotal(nextRow) })
    }

    return (
      <tr className="border-t border-border">
        <td className="px-3 py-2">
          <div className="font-medium text-xs text-foreground">{row.productName}</div>
          <div className="text-xs text-muted-foreground">{row.productCode}</div>
        </td>
        <td className="px-2 py-2">
          <input
            ref={ref}
            type="text"
            inputMode="numeric"
            value={row.qty === 0 ? '' : String(row.qty)}
            onChange={(event) => updateRow({ qty: parseIntegerInput(event.target.value) })}
            onFocus={(event) => event.target.select()}
            disabled={disabled}
            placeholder="0"
            className="w-full border border-border rounded px-2 py-1 text-xs text-center bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
        </td>
        <td className="px-2 py-2">
          <select
            value={row.uomId}
            onChange={(event) => {
              const uomId = parseInt(event.target.value, 10)
              const selectedUom = row.availableUoms.find((uom) => uom.uomId === uomId)
              if (!selectedUom) return

              const selectedPrice = firstPriceForUom(row.availablePrices, uomId)
              updateRow({
                uomId,
                uomCode: selectedUom.uomCode,
                priceTier: selectedPrice?.priceTier ?? '',
                unitPrice: selectedPrice?.price ?? 0,
              })
            }}
            disabled={disabled}
            className="w-full border border-border rounded px-1.5 py-1 text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          >
            {row.availableUoms.map((uom) => (
              <option key={uom.uomId} value={uom.uomId}>
                {uom.uomCode}
              </option>
            ))}
          </select>
        </td>
        <td className="px-2 py-2">
          <select
            value={row.priceTier}
            onChange={(event) => {
              const priceTier = event.target.value
              const selectedPrice = priceOptions.find((price) => price.priceTier === priceTier)
              updateRow({ priceTier, unitPrice: selectedPrice?.price ?? 0 })
            }}
            disabled={disabled}
            className="w-full border border-border rounded px-1.5 py-1 text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          >
            {priceOptions.length === 0 ? (
              <option value="">Tidak ada harga</option>
            ) : (
              priceOptions.map((price) => (
                <option key={`${price.uomId}-${price.priceTier}`} value={price.priceTier}>
                  {price.priceTier}
                </option>
              ))
            )}
          </select>
        </td>
        <td className="px-2 py-2">
          <input
            type="text"
            inputMode="numeric"
            value={row.unitPrice === 0 ? '' : String(row.unitPrice)}
            onChange={(event) => updateRow({ unitPrice: parseIntegerInput(event.target.value) })}
            onFocus={(event) => event.target.select()}
            disabled={disabled}
            placeholder="0"
            className="w-full border border-border rounded px-2 py-1 text-xs text-right bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
        </td>
        <td className="px-2 py-2">
          <input
            type="text"
            inputMode="numeric"
            value={row.discountAmount === 0 ? '' : String(row.discountAmount)}
            onChange={(event) => updateRow({ discountAmount: parseIntegerInput(event.target.value) })}
            onFocus={(event) => event.target.select()}
            onKeyDown={(event) => {
              if (event.key === 'Tab' && !event.shiftKey) onLastFieldTab()
            }}
            disabled={disabled}
            placeholder="0"
            className="w-full border border-border rounded px-2 py-1 text-xs text-right bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
        </td>
        <td className="px-2 py-2 text-right text-xs font-medium text-foreground">
          {row.subtotal.toLocaleString('id-ID')}
        </td>
        <td className="px-2 py-2 text-center">
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            tabIndex={-1}
            className="text-destructive hover:text-destructive/80 text-xs px-1.5 py-1 rounded hover:bg-destructive/10 transition-colors disabled:opacity-50"
            aria-label={`Hapus ${row.productName}`}
          >
            x
          </button>
        </td>
      </tr>
    )
  },
)

BulkSaleItemRow.displayName = 'BulkSaleItemRow'

export default BulkSaleItemRow
