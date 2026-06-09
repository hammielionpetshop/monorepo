export interface TransferItem {
  id: number
  transferId: number
  productId: number
  productName: string | null
  productSku: string | null
  uomId: number
  uomCode: string | null
  uomName: string | null
  qtyRequested: number
  qtyShipped: number
  qtyReceived: number
  costPriceAtTransfer: number
  expiryDate: string | null
  createdAt: string
}

export interface InternalTransferDetail {
  id: number
  ibtNumber: string
  sourceBranchId: number
  destinationBranchId: number
  requestedById: number
  approvedById: number | null
  status: string
  totalTransferValue: number
  notes: string | null
  createdAt: string
  updatedAt: string
  sourceBranchName: string | null
  destinationBranchName: string | null
  requestedByName: string | null
  approvedByName: string | null
  items: TransferItem[]
}
