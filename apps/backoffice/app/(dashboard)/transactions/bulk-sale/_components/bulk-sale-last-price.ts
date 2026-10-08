import type { LastBulkPrice } from '@/lib/services/last-bulk-price'

export type { LastBulkPrice }

export function lastBulkPriceKey(productId: number, uomId: number) {
  return `${productId}-${uomId}`
}

export function parseLastBulkPrices(value: unknown): LastBulkPrice[] {
  const prices = (value as { prices?: unknown } | null)?.prices
  if (!Array.isArray(prices)) return []
  return prices.filter(
    (item): item is LastBulkPrice =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as LastBulkPrice).productId === 'number' &&
      typeof (item as LastBulkPrice).uomId === 'number' &&
      typeof (item as LastBulkPrice).unitPrice === 'number' &&
      typeof (item as LastBulkPrice).trxNumber === 'string',
  )
}

/** Harga yang sedang diketik berbeda dari harga per satuan nota terakhir customer ini. */
export function differsFromLastPrice(unitPrice: number, lastPrice: LastBulkPrice | null | undefined) {
  return Boolean(lastPrice) && unitPrice > 0 && unitPrice !== lastPrice!.unitPrice
}

export function formatLastPriceDate(soldAt: string) {
  const date = new Date(soldAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Jakarta' })
}
