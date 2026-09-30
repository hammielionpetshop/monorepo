export type {
  PosDebtor,
  PosDebtRow,
  PosDebtPaymentRow,
  PosCustomerDebtDetail,
  PayAtPosResult,
} from '@/lib/services/pos-debt-service'

export interface PiutangPaymentMethod {
  id: number
  name: string
  type: string
}
