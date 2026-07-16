export interface PermissionItem {
  id: number
  code: string
  name: string
  description: string | null
}

export interface RoleItem {
  id: number
  name: string
  description: string | null
  userCount: number
  permissionIds: number[]
}
