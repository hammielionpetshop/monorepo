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

export interface BranchOption {
  id: number
  name: string
}

export interface ProductSearchResult {
  id: number
  sku: string | null
  barcode: string | null
  name: string
  baseUomId: number
  conversions: {
    uomId: number
    ratio: string | null
    uomCode: string | null
  }[]
}

export interface EditItemRow {
  key: number
  /** Terisi untuk item yang sudah ada di transfer — hanya qty yang boleh diubah untuknya. */
  id?: number
  productId: number
  productName: string
  productCode: string
  uomId: number
  uomCode: string
  /** Hanya relevan untuk item baru (id kosong) — pilihan satuan saat ditambahkan. */
  availableUoms: { id: number; code: string; ratio: number }[]
  qtyRequested: number
}
