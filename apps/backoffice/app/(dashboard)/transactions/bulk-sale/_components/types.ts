export type BulkSaleUomOption = {
  uomId: number;
  uomCode: string;
  conversionRate: number;
  // Berat 1 unit UOM ini (gram) dari product_uom_conversions; null = belum terdata.
  weightGram?: number | null;
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
  // Berat per 1 base UOM (gram); dipakai sebagai fallback bila UOM terpilih
  // tidak punya berat sendiri di konversi.
  weightGram?: number | null;
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
  // Berat 1 unit UOM terpilih (gram), sudah diselesaikan lewat resolveUomWeightGram.
  // null = produk belum punya data berat → baris tidak ikut dihitung tonase.
  weightGram?: number | null;
};

export type BulkSaleTotals = {
  subtotal: number;
  discountTotal: number;
  transactionDiscount: number;
  grandTotal: number;
  amountPaid: number;
  change: number;
  itemCount: number;
};
