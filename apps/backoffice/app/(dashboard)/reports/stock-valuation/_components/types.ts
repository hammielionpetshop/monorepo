export interface StockValuationItem {
  productId: number
  productName: string
  sku: string | null
  categoryName: string | null
  brandName: string | null
  branchId: number
  branchName: string
  totalQty: string
  totalValue: string
  stockDisplay: string
}
