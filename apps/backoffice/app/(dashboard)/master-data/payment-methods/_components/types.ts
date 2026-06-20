export type PaymentMethodType = 'CASH' | 'BANK_TRANSFER' | 'E-WALLET' | 'QRIS' | 'DEBT'

export interface PaymentMethod {
  id: number
  name: string
  type: PaymentMethodType
}

export interface PaymentMethodFormData {
  name: string
  type: PaymentMethodType
}

export const PAYMENT_METHOD_TYPE_OPTIONS: { value: PaymentMethodType; label: string }[] = [
  { value: 'CASH', label: 'Tunai' },
  { value: 'BANK_TRANSFER', label: 'Transfer Bank' },
  { value: 'E-WALLET', label: 'E-Wallet' },
  { value: 'QRIS', label: 'QRIS' },
  { value: 'DEBT', label: 'Hutang' },
]

export function paymentMethodTypeLabel(type: PaymentMethodType): string {
  return PAYMENT_METHOD_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
}
