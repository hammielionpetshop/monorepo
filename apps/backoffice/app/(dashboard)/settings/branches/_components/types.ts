export interface BranchListItem {
  id: number
  code: string
  name: string
  receiptName: string
  address: string | null
  phone: string | null
  isActive: boolean
  lastSeenAt: Date | string | null
  createdAt: Date | string
}

export interface BranchFormData {
  code: string
  name: string
  receiptName: string
  address: string
  phone: string
}