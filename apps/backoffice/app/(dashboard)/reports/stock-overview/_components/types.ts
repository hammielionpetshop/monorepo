export interface StockOverviewItem {
  productId: number
  productName: string
  sku: string | null
  categoryName: string | null
  brandName: string | null
  totalQty: string
  totalValue: string
  stockDisplay: string
  branchCount: number
  batchCount: number
  shortfallQty: string
  shortfallValue: string
}

export interface StockOverviewBatchDetail {
  id: number
  displayCode: string
  poNumber: string | null
  qtyReceived: string
  qtyRemaining: string
  costPrice: string
  receivedAt: string
  expiryDate: string | null
}

export interface StockOverviewBranchDetail {
  branchId: number
  branchName: string
  totalQty: string
  totalValue: string
  batchCount: number
  shortfallQty: string
  shortfallValue: string
  batches: StockOverviewBatchDetail[]
}

export interface StockOverviewDetail {
  productId: number
  productName: string
  sku: string | null
  branches: StockOverviewBranchDetail[]
}
