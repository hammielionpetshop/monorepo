// Pintu modul `employees` (data induk karyawan, spec L2c). Modul lain dan app/ hanya mengimpor dari sini.
export { todayWib, type IsoDate } from './rules/dates';
export { WORK_STATUSES, CHANGE_KINDS, type ChangeKind, type WorkStatus } from './rules/history';
export {
  createEmployee, getEmployeeBasic, getEmployeeDetail, getOwnProfile, listEmployeeBasics, listEmployees, loadTarget,
  updateOwnContact, updatePerson, type CreateEmployeeInput, type EmployeeBasic, type EmployeeDetail, type EmployeeFilter, type EmployeeListing, type OwnProfile,
} from './server/employees';
export {
  cancelPlacement, decidePromotion, deactivateEmployee, listPromotionQueue, reactivateEmployee, recordPlacement,
  setFieldPermit, type DeactivateInput, type PlacementInput, type PromotionInput, type StatusResult,
} from './server/changes';
export { applyDueEmploymentStatus } from './server/account-sync';
export { EmployeeListScreen } from './ui/employee-list';
export { EmployeeDetailScreen } from './ui/employee-detail';
export { NewEmployeeForm } from './ui/new-employee-form';
export { PromotionScreen } from './ui/promotion-screen';
export { ProfileScreen } from './ui/profile-screen';
export { identityChangeHandler, ownIdentityValues } from './server/identity-change';
export { IDENTITY_FIELDS, IDENTITY_LABELS, GENDER_LABELS, type IdentityField } from './rules/fields';
export { IdentityChangeForm } from './ui/identity-change-form';
