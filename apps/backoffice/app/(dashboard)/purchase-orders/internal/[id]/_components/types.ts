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
  receiveNotes: string | null
  costPriceAtTransfer: number
  expiryDate: Date | string | null
  createdAt: Date | string
}

export interface InternalTransferDetail {
  id: number
  ibtNumber: string
  sourceBranchId: number
  destinationBranchId: number
  requestedById: number
  approvedById: number | null
  receivedById: number | null
  receivedAt: Date | string | null
  status: string
  totalTransferValue: number
  convertedTransactionId: number | null
  convertedTransactionNumber: string | null
  notes: string | null
  createdAt: Date | string
  updatedAt: Date | string
  sourceBranchName: string | null
  destinationBranchName: string | null
  requestedByName: string | null
  approvedByName: string | null
  receivedByName: string | null
  items: TransferItem[]
}
