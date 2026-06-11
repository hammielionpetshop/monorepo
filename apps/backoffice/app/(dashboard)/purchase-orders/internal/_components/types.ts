export interface Branch {
  id: number
  name: string
}

export interface InternalTransfer {
  id: number
  ibtNumber: string
  sourceBranchId: number
  destinationBranchId: number
  requestedById: number
  approvedById: number | null
  status: string
  totalTransferValue: number
  notes: string | null
  createdAt: string
  updatedAt: string
  sourceBranchName: string | null
  destinationBranchName: string | null
  requestedByName: string | null
}
