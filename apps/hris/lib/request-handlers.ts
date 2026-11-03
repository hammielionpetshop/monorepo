import { announceToOwners } from '@/lib/owner-notify';
import { absenceHandler, clarificationHandler, overtimeHandler, relocationHandler } from '@/modules/attendance';
import { identityChangeHandler } from '@/modules/employees';
import type { RequestHandler, RequestTypeKey } from '@/modules/requests';
import {
  deductionObjectionHandler, freeBonusHandler, inventoryLossHandler, manualCashShortageHandler, otherDeductionHandler, salaryChangeHandler,
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
  free_bonus: freeBonusHandler(announceToOwners),
};
