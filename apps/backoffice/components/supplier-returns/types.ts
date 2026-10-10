export type SupplierReturnReason = 'EXPIRED' | 'RUSAK' | 'SALAH_KIRIM' | 'LAINNYA'
export type SupplierReturnStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export const REASONS: SupplierReturnReason[] = ['EXPIRED', 'RUSAK', 'SALAH_KIRIM', 'LAINNYA']

export const REASON_LABELS: Record<string, string> = {
  EXPIRED: 'Kadaluarsa',
  RUSAK: 'Rusak',
  SALAH_KIRIM: 'Salah Kirim',
  LAINNYA: 'Lainnya',
}

export const STATUS_LABELS: Record<SupplierReturnStatus, string> = {
  PENDING: 'Menunggu Persetujuan',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
}

export const STATUS_BADGE: Record<SupplierReturnStatus, string> = {
  PENDING: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  APPROVED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  REJECTED: 'bg-destructive/10 text-destructive',
}

export interface SupplierOption {
  id: number
  name: string
}

export interface PoOption {
  id: number
  poNumber: string
  invoiceNumber: string | null
  totalAmount: number
  createdAt: string
}

export interface PoItemOption {
  poItemId: number
  productId: number
  productName: string
  productSku: string | null
  uomId: number
  uomCode: string
  qtyReceived: number
  alreadyReturned: number
  returnableQty: number
  /** null = harga faktur belum diisi (menunggu faktur) — belum bisa diretur. */
  claimPrice: number | null
}

export interface ProductSearchResult {
  id: number
  sku: string | null
  name: string
  baseUomId: number
  stock: number
  uoms: { id: number; code: string; name: string; isBase: boolean }[]
}

export interface SupplierReturnItemView {
  id: number
  productId: number
  productName: string
  productSku: string | null
  uomCode: string
  qty: number
  unitPrice: number
  lineValue: number
  cogs: number | null
  photoUrl: string | null
  fromPo: boolean
}

export interface SupplierReturnView {
  id: number
  returnNumber: string
  status: SupplierReturnStatus
  reason: string
  notes: string
  source: string
  supplierId: number
  supplierName: string
  supplierPhone: string | null
  supplierAddress: string | null
  branchId: number
  branchName: string
  poId: number | null
  poNumber: string | null
  totalValue: number
  totalCogs: number | null
  payableDeduction: number
  creditAmount: number
  requestedAt: string
  requestedByName: string
  resolvedAt: string | null
  resolvedByName: string | null
  rejectionReason: string | null
  items: SupplierReturnItemView[]
}

export function formatRupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`
}

export function formatDateTimeWib(iso: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function formatDateWib(iso: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(new Date(iso))
  } catch {
    return iso
  }
}
