export type DamagedGoodsReason = 'RUSAK' | 'EXPIRED' | 'HILANG';

export interface DamagedGoods {
  id: number;
  branchId: number;
  shiftId?: number;
  reportedById: number;
  reportedAt: string;
  reason: DamagedGoodsReason;
  notes?: string;
  totalLossValue: number;
}

export interface DamagedGoodsItem {
  id: number;
  damagedGoodsId: number;
  productId: number;
  uomId: number;
  qty: number;
  costPrice: number;
  lossValue: number;
}
