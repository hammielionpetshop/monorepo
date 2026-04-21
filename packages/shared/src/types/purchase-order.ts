export type PurchaseOrderStatus = 
  | 'DRAFT' 
  | 'PENDING_APPROVAL' 
  | 'APPROVED' 
  | 'IN_TRANSIT' 
  | 'PARTIALLY_RECEIVED' 
  | 'FULLY_RECEIVED' 
  | 'CANCELLED';

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  branchId: number;
  supplierId: number;
  status: PurchaseOrderStatus;
  totalAmount: number;
  createdById: number;
  approvedById?: number;
  approvedAt?: string;
  rejectedById?: number;
  rejectedAt?: string;
  rejectionNote?: string;
  notes?: string;
  targetDeliveryDate?: string;
  invoiceNumber?: string;
  invoiceUpdatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: number;
  poId: number;
  productId: number;
  uomId: number;
  qtyOrdered: number;
  qtyReceived: number;
  qtyDamaged: number;
  unitCost: number;
  invoiceUnitCost?: number;
  expiryDate?: string;
}

export interface POReceivingLog {
  id: number;
  poId: number;
  receivedById: number;
  receivedAt: string;
  invoiceReceived: boolean;
  photoUrls?: string;
  note?: string;
}

export interface POReceivingItem {
  id: number;
  poItemId: number;
  logId: number;
  qtyReceived: number;
  qtyDamaged: number;
  expiryDate?: string;
  note?: string;
}
