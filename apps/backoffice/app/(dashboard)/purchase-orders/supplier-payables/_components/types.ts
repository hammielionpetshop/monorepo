export interface SupplierPayment {
  id: number
  amount: number
  method: string
  referenceNumber: string | null
  note: string | null
  proofPhotoUrl?: string | null
  /** F2-4a: Tempat Uang asal; null + noMoney=false = pembayaran lama "belum diketahui". */
  moneyPlaceName: string | null
  /** Metode sistem tanpa uang (Retur, Saldo Supplier, Retur Batal). */
  noMoney: boolean
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
  /** Alasan & pelaku Bebaskan Hutang (status WAIVED dari tombol itu); null = bukan/tidak tercatat. */
  waiveReason: string | null
  waivedByName: string | null
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
  /** Jenis metode bayar (CASH, BANK_TRANSFER, ...) — menentukan tampil tidaknya foto bukti. */
  type?: string
}
