'use client'

import { useState } from 'react'

import type { SODetailItem } from '@/lib/services/stock-opname-report'
import { CATEGORY_LABELS, formatRupiah } from './format'

export default function SODetailItems({
  items,
  soId,
  isApproved,
}: {
  items: SODetailItem[]
  soId: number
  isApproved: boolean
}) {
  const [onlyMismatch, setOnlyMismatch] = useState(false)

  const visible = onlyMismatch ? items.filter((i) => i.varianceQty !== 0) : items
  const mismatchCount = items.filter((i) => i.varianceQty !== 0).length

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={onlyMismatch}
            onChange={(e) => setOnlyMismatch(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          Hanya tampilkan yang tidak match ({mismatchCount})
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 text-sm font-bold text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-all"
          >
            Print
          </button>
          <a
            href={`/api/bo/reports/stock-opname/${soId}/export`}
            className="px-4 py-2 text-sm font-bold text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-all"
          >
            Export Selisih CSV
          </a>
        </div>
      </div>

      <p className="hidden print:block text-sm mb-2">
        {onlyMismatch ? `Hanya produk tidak match (${mismatchCount} item)` : `Seluruh item (${items.length} item)`}
      </p>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Produk</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty System</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Real Stock</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Selisih</th>
                {isApproved && (
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Nilai</th>
                )}
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kategori</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Alasan</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={isApproved ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground">
                    Tidak ada item untuk ditampilkan.
                  </td>
                </tr>
              ) : (
                visible.map((item) => (
                  <tr key={item.productId} className="border-t border-border">
                    <td className="px-4 py-3 text-foreground">
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.sku ?? '—'} · {item.uomCode}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">{item.systemQty}</td>
                    <td className="px-4 py-3 text-right text-foreground">{item.physicalQty}</td>
                    <td className="px-4 py-3 text-right">
                      {item.varianceQty === 0 ? (
                        <span className="text-muted-foreground">0</span>
                      ) : (
                        <span
                          className={
                            item.varianceQty < 0
                              ? 'font-semibold text-destructive'
                              : 'font-semibold text-emerald-600 dark:text-emerald-400'
                          }
                        >
                          {item.varianceQty > 0 ? `+${item.varianceQty}` : item.varianceQty}
                        </span>
                      )}
                    </td>
                    {isApproved && (
                      <td className="px-4 py-3 text-right text-foreground">
                        {item.varianceQty === 0 ? '—' : formatRupiah(item.varianceCostValue)}
                      </td>
                    )}
                    <td className="px-4 py-3 text-foreground">
                      {item.varianceCategory
                        ? CATEGORY_LABELS[item.varianceCategory] ?? item.varianceCategory
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.varianceReason ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
