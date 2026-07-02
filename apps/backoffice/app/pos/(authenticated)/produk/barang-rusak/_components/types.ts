export type DamagedReason = 'RUSAK' | 'EXPIRED' | 'HILANG'

export interface ProductSearchUom {
  id: number
  code: string
  name: string
  isBase: boolean
}

export interface ProductSearchResult {
  id: number
  sku: string | null
  name: string
  baseUomId: number
  stock: number
  uoms: ProductSearchUom[]
}

export interface DraftItem {
  productId: number
  productName: string
  uomId: number
  uomCode: string
  qty: number
}

export interface DamagedHistoryItem {
  productName: string
  uomCode: string
  qty: number
  lossValue: number
}

export interface DamagedHistoryEntry {
  id: number
  reason: DamagedReason
  notes: string | null
  totalLossValue: number
  reportedAt: string
  reportedByName: string
  items: DamagedHistoryItem[]
}

export const REASON_LABELS: Record<DamagedReason, string> = {
  RUSAK: 'Rusak',
  EXPIRED: 'Kadaluarsa',
  HILANG: 'Hilang',
}
