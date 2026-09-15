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
  photoUrl: string | null
  uploadingPhoto?: boolean
}

export type DamagedGoodsStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface DamagedHistoryItem {
  productName: string
  uomCode: string
  qty: number
  lossValue: number
  photoUrl: string | null
}

export interface DamagedHistoryEntry {
  id: number
  reason: DamagedReason
  notes: string | null
  totalLossValue: number
  reportedAt: string
  reportedByName: string
  status: DamagedGoodsStatus
  resolutionAction: string | null
  rejectionReason: string | null
  items: DamagedHistoryItem[]
}

export const REASON_LABELS: Record<DamagedReason, string> = {
  RUSAK: 'Rusak',
  EXPIRED: 'Kadaluarsa',
  HILANG: 'Hilang',
}

export const STATUS_LABELS: Record<DamagedGoodsStatus, string> = {
  PENDING: 'Menunggu Approval',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
}
