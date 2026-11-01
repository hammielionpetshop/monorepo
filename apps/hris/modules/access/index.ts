// Pintu modul `access`. Modul lain dan app/ hanya mengimpor dari sini (@/modules/access).
export {
  ACTIONS, ACTION_NAMES, SCOPES, SCOPE_LABELS, isActionName,
  type ActionDefinition, type ActionName, type Scope,
} from './rules/actions';
export { can, hasAction, type Actor, type Target } from './rules/can';
export { validateGrantChanges, type GrantChange } from './rules/grant-changes';
export { listEmployeesWithAnyAction, loadActor } from './server/actor';
export {
  getOrgLookup, listOrganization, listPositionsWithHolders, saveBranch, saveDepartment, savePosition,
  type BranchInput, type DepartmentInput, type Organization, type OrgLookup, type PositionInput, type ServiceResult,
} from './server/org';
export { recordAudit, type AuditInput, type Tx } from './server/audit';
export { getPositionGrants, positionNamesByAction, savePositionGrants, type ChangeAnnounce } from './server/grants';
export { NoAccess } from './ui/no-access';
export { OrganizationScreen } from './ui/organization-screen';
export { GrantsScreen } from './ui/grants-screen';
