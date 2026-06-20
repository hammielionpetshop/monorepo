export interface Supplier {
  id: number
  name: string
  phone: string | null
  email: string | null
  contactPerson: string | null
  bankAccount: string | null
  address: string | null
  paymentTermDays: number | null
}

export interface SupplierFormData {
  name: string
  phone: string
  email: string
  contactPerson: string
  bankAccount: string
  address: string
  paymentTermDays: string
}
