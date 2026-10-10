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
  /** > 0 = menunggu faktur: nominal tagihan masih perkiraan, belum bisa dibayar. */
  pricePendingItems: number
  /** Tagihan perkiraan (harga rencana / modal lama untuk barang yang belum berharga). */
  estimatedTotal: number
  payments: SupplierPayment[]
}

export interface SupplierCredit {
  supplierId: number
  supplierName: string
  /** Saldo kita di supplier (kelebihan retur) yang belum dipakai. */
  balance: number
}

export interface Option {
  id: number
  name: string
}
