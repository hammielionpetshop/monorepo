// Pintu modul `employees` (data induk karyawan, spec L2c). Modul lain dan app/ hanya mengimpor dari sini.
export { todayWib, type IsoDate } from './rules/dates';
export { WORK_STATUSES, CHANGE_KINDS, activeOn, placementOn, type ChangeKind, type EmploymentEventRecord, type PlacementRecord, type WorkStatus } from './rules/history';
export {
  checkRecoveryFacts, createEmployee, getEmployeeBasic, getEmployeeDetail, getOwnProfile, listEmployeeBasics, listEmployees, listPeopleForModules, loadTarget,
  updateOwnContact, updatePerson, type CreateEmployeeInput, type EmployeeBasic, type EmployeeDetail, type EmployeeFilter, type EmployeeListing, type OwnProfile,
  type PersonForModules,
} from './server/employees';
export {
  cancelPlacement, decidePromotion, deactivateEmployee, listPromotionQueue, moveBranchFromRequest, reactivateEmployee, recordPlacement,
  setFieldPermit, type DeactivateInput, type PlacementInput, type PromotionApproved, type PromotionInput, type StatusResult,
} from './server/changes';
export { applyDueEmploymentStatus, type KeepsHrisAccess } from './server/account-sync';
export { formerEmployees, formerStatus, type FormerStatus } from './server/former';
export { EmployeeListScreen } from './ui/employee-list';
export { EmployeeDetailScreen } from './ui/employee-detail';
export { NewEmployeeForm } from './ui/new-employee-form';
export { PromotionScreen } from './ui/promotion-screen';
export { ProfileScreen } from './ui/profile-screen';
export { identityChangeHandler, ownIdentityValues } from './server/identity-change';
export { IDENTITY_FIELDS, IDENTITY_LABELS, GENDER_LABELS, type IdentityField } from './rules/fields';
export { IdentityChangeForm } from './ui/identity-change-form';
export { bankAccountsOf, placementHistory, type BankAccount } from './server/data';
export {
  casualWorkersScreen, listCasualWorkers, normalizePhone, saveCasualWorker, saveCasualWorkerIn, setCasualWorkerActive, type CasualWorker,
} from './server/casual-workers';
export { CasualWorkersScreen } from './ui/casual-workers-screen';
