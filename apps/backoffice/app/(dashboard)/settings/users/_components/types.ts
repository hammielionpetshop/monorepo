export interface UserListItem {
  id: number
  name: string
  username: string | null
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

/** Izin yang bisa ditunjuk ke orang tertentu di luar jatah role-nya */
export interface PermissionOption {
  id: number
  code: string
  name: string
  description: string | null
}

export interface BranchOption {
  id: number
  code: string
  name: string
}

export interface UserFormData {
  name: string
  username: string
  email: string
  staffNumber: string
  password: string
  pin: string
  roleId: number | ''
  branchId: number | ''
}