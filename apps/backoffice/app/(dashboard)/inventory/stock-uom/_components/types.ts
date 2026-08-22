export interface ProductOption {
  id: number
  name: string
  sku: string | null
  baseUomId: number
  baseUomCode: string | null
}

export interface UomOption {
  id: number
  code: string
  name: string
}

export interface StockRow {
  id: number
  branchId: number
  branchName: string
  uomId: number
  uomCode: string
  uomName: string
  qty: number
}

export interface BatchRow {
  id: number
  branchId: number
  branchName: string
  uomId: number
  qtyReceived: number
  qtyRemaining: number
  costPrice: number
  receivedAt: string
  expiryDate: string | null
}

export interface CountRow {
  branchId: number
  uomId: number
  n: number
}

export interface StockUomData {
  product: { id: number; name: string; baseUomId: number; baseUomCode: string | null; baseUomName: string | null }
  stocks: StockRow[]
  batches: BatchRow[]
  priceCounts: CountRow[]
  costCounts: CountRow[]
}

export interface UomGroup {
  branchId: number
  branchName: string
  uomId: number
  uomCode: string
  uomName: string
  stock: StockRow | null
  batches: BatchRow[]
  priceCount: number
  costCount: number
}
