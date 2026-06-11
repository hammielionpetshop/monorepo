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
