import { PriceTier } from '../utils/pricing';
export type { PriceTier };

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

export interface ProductUomConversion {
  id: number;
  productId: number;
  uomId: number;
  uomCode: string;
  ratio: number; // 1 this UOM = ratio * base UOM
}

// TierType is an alias of PriceTier (from pricing.ts) — use PriceTier instead
export type TierType = PriceTier;

export interface ProductPrice {
  id: number;
  productId: number;
  branchId: number;
  uomId: number;
  tierType: PriceTier;
  price: number;
}
