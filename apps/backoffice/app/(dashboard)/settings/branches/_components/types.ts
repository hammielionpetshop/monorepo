export interface BranchListItem {
  id: number
  code: string
  name: string
  address: string | null
  phone: string | null
  isActive: boolean
  lastSeenAt: Date | string | null
  createdAt: Date | string
}

export interface BranchFormData {
  name: string
  address: string
  phone: string
}