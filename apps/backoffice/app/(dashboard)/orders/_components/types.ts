export type CustomerOrderStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED'

export interface OrderSummary {
  id: number
  orderNumber: string
  customerName: string
  customerPhone: string | null
  status: CustomerOrderStatus
  estimatedTotal: number
  itemCount: number
  createdAt: string
}

export interface OrderItemDetail {
  productId: number
  productName: string
  uomId: number
  uomCode: string
  qty: number
  priceTier: string
  unitPriceSnapshot: number
  subtotalSnapshot: number
}

export interface OrderDetail {
  id: number
  orderNumber: string
  customerId: number
  customerName: string | null
  customerPhone: string | null
  branchId: number
  branchName: string | null
  status: CustomerOrderStatus
  note: string | null
  estimatedTotal: number
  convertedTransactionId: number | null
  convertedTrxNumber: string | null
  rejectReason: string | null
  createdAt: string
  items: OrderItemDetail[]
}

export const ORDER_STATUS_LABELS: Record<CustomerOrderStatus, { label: string; color: string }> = {
  PENDING: { label: 'Menunggu Konfirmasi', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'Dikonfirmasi', color: 'bg-green-100 text-green-800' },
  REJECTED: { label: 'Ditolak', color: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-gray-100 text-gray-600' },
}
