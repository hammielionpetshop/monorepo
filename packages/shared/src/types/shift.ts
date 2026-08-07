export interface Shift {
  id: number;
  branchId: number;
  openedById: number;
  shiftNumber: number;
  assignedCashiers: number[];
  openingCash: number;
  targetEndTime?: Date | null;
  status: 'OPEN' | 'CLOSED' | 'FORCE_CLOSED';
  origin?: 'POS' | 'BACKOFFICE';
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
  totalDiscount: number;
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

export interface ShiftDebtPaymentReceived {
  createdAt: Date | string;
  amount: number;
  paymentMethodName: string;
  isCash: boolean;
  customerName: string | null;
  /** Nomor nota asal hutang. Null untuk hutang yang dicatat manual tanpa transaksi. */
  trxNumber: string | null;
  /** Petugas yang menerima & mencatat pelunasan — penelusuran bila kas selisih. */
  receivedByName: string | null;
}

export interface ShiftExpenseDetail {
  createdAt: Date | string;
  amount: number;
  note: string;
  categoryName?: string | null;
  categoryCustom?: string | null;
  cashierName?: string | null;
}

export interface ShiftBreakdownSummary {
  shift: Shift;
  breakdowns: ShiftCashierBreakdown[];
  /** Kas penjualan + pelunasan piutang tunai yang harus ada di laci (di luar modal). */
  totalExpectedCash: number;
  /** Pelunasan piutang tunai yang diterima selama shift ini. Bukan omzet — omzetnya sudah
   *  diakui saat transaksi hutang dibuat; ini murni uang masuk laci. */
  totalDebtPaymentCash?: number;
  totalDiscount?: number;
  totalRealCash?: number;
  totalVariance?: number;
  nonCashPayments?: ShiftNonCashPayment[];
  debtPaymentsReceived?: ShiftDebtPaymentReceived[];
  expenses?: ShiftExpenseDetail[];
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
