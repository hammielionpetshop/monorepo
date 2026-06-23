export interface ItemRow {
  id: number
  productId: number
  productName: string
  productCode: string
  uomId: number
  uomName: string
  availableUoms: { id: number; name: string; ratio: number }[]
  baseDefaultCostPrice: number
  qtyRequested: number
  costPrice: number
}

export interface BranchOption {
  id: number
  name: string
  code: string
}

export interface TransferListItem {
  id: number
  ibtNumber: string
  sourceBranchId: number
  sourceBranchName: string | null
  destinationBranchId: number
  destinationBranchName: string | null
  status: string
  totalTransferValue: number
  notes: string | null
  createdAt: string
  requestedByName: string | null
}

export interface TransferDetailItem {
  id: number
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
  expiryDate: string | null
}

export interface TransferDetail extends TransferListItem {
  approvedById: number | null
  approvedByName: string | null
  updatedAt: string
  items: TransferDetailItem[]
}

export interface ProductSearchResult {
  id: number
  sku: string | null
  barcode: string | null
  name: string
  baseUomId: number
  defaultCostPrice: number | null
  conversions: {
    id: number
    uomId: number
    ratio: string | null
    uomCode: string | null
  }[]
}
