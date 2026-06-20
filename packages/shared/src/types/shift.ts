export interface Shift {
  id: number;
  branchId: number;
  openedById: number;
  shiftNumber: number;
  assignedCashiers: number[];
  openingCash: number;
  targetEndTime?: Date | null;
  status: 'OPEN' | 'CLOSED' | 'FORCE_CLOSED';
  openedAt: Date;
  closedAt?: Date | null;
  closedById?: number | null;
  totalClosingCashReal?: number | null;
  totalClosingCashExpected?: number | null;
  totalVariance?: number | null;
  settlementNotes?: string | null;
  forceClosedById?: number | null;
  forceClosedAt?: Date | null;
}

export interface ShiftCashierBreakdown {
  cashierId: number;
  cashierName?: string;
  totalSalesCash: number;
  totalSalesQris: number;
  totalSalesDebit: number;
  totalSalesCredit: number;
  totalSalesDebt: number;
  totalSales: number;
  totalTransactions: number;
  totalExpenses: number;
  modalShare?: number | null;
  expectedCash: number;
  realCash?: number | null;
  variance?: number | null;
  isVarianceFlagged: boolean;
}

export interface ShiftNonCashPayment {
  createdAt: Date | string;
  amount: number;
  paymentMethodName: string;
}

export interface ShiftBreakdownSummary {
  shift: Shift;
  breakdowns: ShiftCashierBreakdown[];
  totalExpectedCash: number;
  totalRealCash?: number;
  totalVariance?: number;
  nonCashPayments?: ShiftNonCashPayment[];
}

export interface ShiftCashierSession {
  id: number;
  shiftId: number;
  cashierId: number;
  joinedAt: Date;
  stoppedAt?: Date | null;
  status: 'ACTIVE' | 'STOPPED';
}

export interface ShiftExpense {
  id: number;
  shiftId: number;
  cashierId: number;
  cashierName?: string;
  categoryId?: number | null;
  categoryName?: string | null;
  categoryCustom?: string | null;
  amount: number;
  note: string;
  proofImage?: string | null;
  createdAt: Date;
}
