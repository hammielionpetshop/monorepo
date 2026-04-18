export interface UnitOfMeasure {
  id: number;
  code: string;
  name: string;
  isBase: boolean;
}

export interface Product {
  id: number;
  sku: string | null;
  barcode: string | null;
  name: string;
  categoryId: number | null;
  brandId: number | null;
  baseUomId: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductPrice {
  id: number;
  productId: number;
  branchId: number;
  uomId: number;
  tierType: string;
  price: number;
}
