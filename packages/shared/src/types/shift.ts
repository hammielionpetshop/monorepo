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

/** Ringkasan satu shift untuk bagian "Rekap Hari Ini" di struk settlement estafet. */
export interface ShiftDayRecapShift {
  shiftId: number;
  shiftNumber: number;
  status: 'OPEN' | 'CLOSED' | 'FORCE_CLOSED';
  openedAt: Date | string;
  closedAt: Date | string | null;
  closedByName: string | null;
  /** Kas penjualan net kembalian, sebelum dipotong pengeluaran. */
  cashSales: number;
  nonCash: number;
  debt: number;
  discount: number;
  expenses: number;
  /** Pelunasan piutang tunai yang masuk laci — bukan omzet, tapi ikut disetor. */
  debtPaymentCash: number;
  /** cashSales + nonCash + debt — rumus yang sama dengan OMZET di struk. */
  omzet: number;
  /** Kas yang disetor kasir. Null bila shift ditutup paksa tanpa hitung laci. */
  realCash: number | null;
}

export interface ShiftDayRecapNonCash extends ShiftNonCashPayment {
  shiftId: number;
}

/**
 * Rekap semua shift cabang yang dibuka di hari (WIB) yang sama, sampai shift yang dicetak.
 * Hanya tampilan struk — setoran & rekonsiliasi tetap per shift.
 */
export interface ShiftDayRecap {
  shifts: ShiftDayRecapShift[];
  nonCashPayments: ShiftDayRecapNonCash[];
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
  /** Ada hanya bila hari itu sudah ada shift lain sebelum shift ini (estafet). */
  dayRecap?: ShiftDayRecap | null;
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
