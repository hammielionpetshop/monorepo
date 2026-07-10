// Tier harga tetap yang otomatis dipakai customer online (menentukan harga yang dilihat di katalog).
export type CustomerTierType = 'RETAIL' | 'RESELLER' | 'GROSIR';

export type CustomerOrderStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';

// Payload JWT customer portal (order.hammielion.com) — terpisah total dari JWTPayload staff.
export interface CustomerJWTPayload {
  customerId: number;
  name: string;
  phone: string;
  tierType: CustomerTierType;
  branchId: number;
  iat?: number;
  exp?: number;
}
