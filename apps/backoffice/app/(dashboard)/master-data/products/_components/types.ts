export interface Product {
  id: number
  sku: string | null
  barcode: string | null
  name: string
  categoryId: number | null
  categoryName: string | null
  brandId: number | null
  brandName: string | null
  baseUomId: number
  uomCode: string | null
  uomName: string | null
  weightGram: string | null
  isActive: boolean
  createdAt?: Date | string | null
  updatedAt?: Date | string | null
}

export interface Category {
  id: number
  name: string
}

export interface Brand {
  id: number
  name: string
}

export interface Uom {
  id: number
  code: string
  name: string
  isBase: boolean
}

export interface ProductFormData {
  name: string
  sku: string
  barcode: string
  categoryId: string
  brandId: string
  baseUomId: string
  weightGram: string
}
