export type BulkSaleUomOption = {
  uomId: number;
  uomCode: string;
  conversionRate: number;
};

export type BulkSalePriceOption = {
  uomId: number;
  priceTier: string;
  price: number;
};

export type BulkSaleProduct = {
  id: number;
  code: string;
  name: string;
  barcode: string | null;
  baseUomId: number;
  baseUomCode: string;
  stock: number;
  availableUoms: BulkSaleUomOption[];
  prices: BulkSalePriceOption[];
};

export type BulkSaleRow = {
  id: string;
  productId: number;
  productCode: string;
  productName: string;
  uomId: number;
  uomCode: string;
  availableUoms: BulkSaleUomOption[];
  priceTier: string;
  availablePrices: BulkSalePriceOption[];
  qty: number;
  unitPrice: number;
  discountAmount: number;
  subtotal: number;
};

export type BulkSaleTotals = {
  subtotal: number;
  discountTotal: number;
  grandTotal: number;
  amountPaid: number;
  change: number;
  itemCount: number;
};
