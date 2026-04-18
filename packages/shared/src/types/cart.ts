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
}

export interface CartTotals {
  subtotal: number;
  discountTotal: number;
  grandTotal: number;
  itemCount: number;
}
