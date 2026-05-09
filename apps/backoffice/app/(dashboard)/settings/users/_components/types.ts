export interface UserListItem {
  id: number
  name: string
  staffNumber: string | null
  email: string | null
  roleId: number
  roleName: string
  branchId: number
  branchName: string
  isActive: boolean
  createdAt: Date
}

export interface RoleOption {
  id: number
  name: string
}

export interface BranchOption {
  id: number
  code: string
  name: string
}

export interface UserFormData {
  name: string
  email: string
  staffNumber: string
  password: string
  roleId: number | ''
  branchId: number | ''
}