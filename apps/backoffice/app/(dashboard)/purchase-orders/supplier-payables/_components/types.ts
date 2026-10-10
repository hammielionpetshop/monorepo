export interface SupplierPayment {
  id: number
  amount: number
  method: string
  referenceNumber: string | null
  note: string | null
  paidAt: string
  paidByName: string | null
}

export interface SupplierPayable {
  id: number
  poId: number
  poNumber: string
  invoiceNumber: string | null
  supplierId: number
  supplierName: string | null
  branchId: number
  branchName: string | null
  totalAmount: number
  paidAmount: number
  status: string
  createdAt: string
  /** Termin supplier saat ini (hari); null = belum diatur. */
  paymentTermDays: number | null
  /** Jatuh tempo YYYY-MM-DD (WIB); null = tanpa jatuh tempo. */
  dueDate: string | null
  payments: SupplierPayment[]
}

export interface Option {
  id: number
  name: string
}
