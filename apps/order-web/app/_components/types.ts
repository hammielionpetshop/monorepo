export type StockStatus = 'TERSEDIA' | 'MENIPIS' | 'KOSONG';

export interface CatalogProductSummary {
  id: number;
  name: string;
  imageUrl: string | null;
  categoryId: number | null;
  brandId: number | null;
  baseUomId: number;
  baseUomCode: string;
  basePrice: number;
  stockQty: number;
  stockStatus: StockStatus;
}

export interface CatalogFilterOption {
  id: number;
  name: string;
}

export interface CatalogListResponse {
  products: CatalogProductSummary[];
  total: number;
  page: number;
  totalPages: number;
  filters: { categories: CatalogFilterOption[]; brands: CatalogFilterOption[] } | null;
}

export interface CatalogProductDetail {
  id: number;
  name: string;
  imageUrl: string | null;
  categoryId: number | null;
  brandId: number | null;
  baseUomId: number;
  stockQty: number;
  stockStatus: StockStatus;
  uoms: { uomId: number; uomCode: string; price: number }[];
}

export interface CartItemView {
  id: number;
  productId: number;
  productName: string;
  imageUrl: string | null;
  uomId: number;
  uomCode: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
  stockQty: number;
  stockStatus: StockStatus;
  isActive: boolean;
}

export interface CartView {
  items: CartItemView[];
  subtotal: number;
  minOrderAmount: number;
  meetsMinimum: boolean;
}

export const STOCK_LABEL: Record<StockStatus, string> = {
  TERSEDIA: 'Tersedia',
  MENIPIS: 'Stok menipis',
  KOSONG: 'Indent (stok kosong)',
};

export const STOCK_BADGE_CLASS: Record<StockStatus, string> = {
  TERSEDIA: 'bg-green-100 text-green-700',
  MENIPIS: 'bg-yellow-100 text-yellow-700',
  KOSONG: 'bg-gray-200 text-gray-600',
};
