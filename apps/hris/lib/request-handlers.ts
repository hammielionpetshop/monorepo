import { announceToOwners } from '@/lib/owner-notify';
import { advanceCancelHandler, advanceHandler, advanceNotReceivedHandler, advancePostponeHandler } from '@/modules/advances';
import { absenceHandler, clarificationHandler, overtimeHandler, relocationHandler } from '@/modules/attendance';
import { identityChangeHandler } from '@/modules/employees';
import type { RequestHandler, RequestTypeKey } from '@/modules/requests';
import {
  deductionObjectionHandler, driverFineHandler, freeBonusHandler, inventoryLossHandler, manualCashShortageHandler, otherDeductionHandler, payslipObjectionHandler, payslipReopenHandler,
  salaryChangeHandler,
} from '@/modules/payroll';
import { positionSettingHandler } from '@/modules/settings';

/**
 * Perangkai isi khas tiap jenis pengajuan (spec L2f-1 §3.1). Modul `requests` tidak mengimpor modul jenisnya;
 * jenis baru menambah satu baris di sini. Tes memastikan tiap jenis di daftar punya handler.
 */
export const REQUEST_HANDLERS: Record<RequestTypeKey, RequestHandler> = {
  identity_change: identityChangeHandler,
  position_setting_change: positionSettingHandler(announceToOwners),
  relocation: relocationHandler,
  absence: absenceHandler,
  clarification: clarificationHandler,
  overtime_claim: overtimeHandler,
  salary_change: salaryChangeHandler(announceToOwners),
  inventory_loss: inventoryLossHandler(announceToOwners),
  manual_cash_shortage: manualCashShortageHandler(announceToOwners),
  other_deduction: otherDeductionHandler(announceToOwners),
  deduction_objection: deductionObjectionHandler(announceToOwners),
  driver_fine: driverFineHandler(announceToOwners),
  free_bonus: freeBonusHandler(announceToOwners),
  payslip_reopen: payslipReopenHandler(announceToOwners),
  payslip_objection: payslipObjectionHandler(announceToOwners, 'payslip_objection'),
  payslip_objection_owner: payslipObjectionHandler(announceToOwners, 'payslip_objection_owner'),
  advance: advanceHandler(),
  advance_cancel: advanceCancelHandler(announceToOwners),
  advance_not_received: advanceNotReceivedHandler(),
  advance_postpone: advancePostponeHandler(),
};
