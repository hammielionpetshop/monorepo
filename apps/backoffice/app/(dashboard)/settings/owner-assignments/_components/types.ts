export type BranchOwnerRow = {
  id: number
  code: string
  name: string
  isActive: boolean
  currentOwner: {
    id: number
    name: string
    username: string
  } | null
}

export type EligibleOwner = {
  id: number
  name: string
  username: string
}

export type OwnerAssignmentsData = {
  branches: BranchOwnerRow[]
  eligibleOwners: EligibleOwner[]
}
