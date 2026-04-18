export type PaymentMethodType = 'CASH' | 'BANK_TRANSFER' | 'E-WALLET' | 'QRIS' | 'DEBT';

export interface PaymentMethod {
  id: number;
  name: string;
  type: PaymentMethodType;
}

export interface TransactionPayment {
  paymentMethodId: number;
  amount: number;
  referenceNumber?: string;
}

export interface SplitPaymentResult {
  isSufficient: boolean;
  totalPaid: number;
  changeAmount: number;
  remainingAmount: number;
}
