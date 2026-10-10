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
  payments: SupplierPayment[]
}

export interface Option {
  id: number
  name: string
}
