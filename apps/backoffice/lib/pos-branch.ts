type CookieGetter = { get: (name: string) => { value: string } | undefined }

const MULTI_BRANCH_ROLES = ['OWNER', 'GM', 'MANAGER']

export function getPosBranchId(
  payload: { branchId: number; role: string },
  cookieStore: CookieGetter
): number {
  if (MULTI_BRANCH_ROLES.includes(payload.role)) {
    const override = cookieStore.get('posBranchId')?.value
    const parsed = override ? parseInt(override) : NaN
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return payload.branchId
}

export function getPosBranchName(
  payload: { branchName: string; role: string },
  cookieStore: CookieGetter
): string {
  if (MULTI_BRANCH_ROLES.includes(payload.role)) {
    const override = cookieStore.get('posBranchName')?.value
    if (override) return override
  }
  return payload.branchName
}

export function isMultiBranchRole(role: string): boolean {
  return MULTI_BRANCH_ROLES.includes(role)
}
