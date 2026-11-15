import { PriceTier } from '../utils/pricing';

export interface CartItem {
  productId: number;
  productName: string;
  uomId: number;
  uomCode: string;
  qty: number;
  unitPrice: number;
  priceTier: PriceTier;
  discountAmount: number;
  subtotal: number;            // (unitPrice * qty) - discountAmount
  isOwnerOverride: boolean;
  overridePrice?: number;
  autoBreakTriggered?: boolean;
  autoBreakQty?: number;
  weightGram?: number;         // Berat per 1 unit UOM ini (dalam gram), null jika tidak ada data berat
}

export interface CartTotals {
  subtotal: number;
  discountTotal: number;
  grandTotal: number;
  itemCount: number;
  totalWeightGram: number;     // Total berat seluruh item di keranjang (dalam gram)
}

