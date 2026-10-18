export const IBT_POST_SHIP_STATUSES = ['IN_TRANSIT', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'] as const

export interface FulfillmentItem {
  qtyRequested: number
  qtyShipped: number
}

/** Item diminta (>0) tapi tidak jadi dikirim (qtyShipped 0) — stok tak berpindah untuk item ini. */
export function isUnfulfilled(item: FulfillmentItem): boolean {
  return item.qtyRequested > 0 && item.qtyShipped === 0
}

/** Hanya bermakna setelah transfer melewati tahap kirim; selainnya 0. */
export function countUnfulfilled(items: FulfillmentItem[], status: string): number {
  if (!IBT_POST_SHIP_STATUSES.includes(status as (typeof IBT_POST_SHIP_STATUSES)[number])) return 0
  return items.filter(isUnfulfilled).length
}
