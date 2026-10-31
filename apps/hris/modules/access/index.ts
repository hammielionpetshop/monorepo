// Pintu modul `access`. Modul lain dan app/ hanya mengimpor dari sini (@/modules/access).
export {
  ACTIONS, ACTION_NAMES, SCOPES, SCOPE_LABELS, isActionName,
  type ActionDefinition, type ActionName, type Scope,
} from './rules/actions';
export { can, hasAction, type Actor, type Target } from './rules/can';
export { validateGrantChanges, type GrantChange } from './rules/grant-changes';
export { loadActor } from './server/actor';
export {
  listOrganization, listPositionsWithHolders, saveBranch, saveDepartment, savePosition,
  type BranchInput, type DepartmentInput, type Organization, type PositionInput, type ServiceResult,
} from './server/org';
export { getPositionGrants, savePositionGrants } from './server/grants';
export { NoAccess } from './ui/no-access';
export { OrganizationScreen } from './ui/organization-screen';
export { GrantsScreen } from './ui/grants-screen';
