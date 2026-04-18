export type TransactionStatus = 'COMPLETED' | 'VOIDED' | 'PENDING_VOID';

export interface Transaction {
  id: number;
  trxNumber: string;
  branchId: number;
  shiftId: number;
  customerId: number | null;
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  payableAmount: number;
  paidAmount: number;
  changeAmount: number;
  status: TransactionStatus;
  createdOffline: boolean;
  offlineTimestamp: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
