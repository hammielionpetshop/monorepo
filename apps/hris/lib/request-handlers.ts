import { announceToOwners } from '@/lib/owner-notify';
import { identityChangeHandler } from '@/modules/employees';
import type { RequestHandler, RequestTypeKey } from '@/modules/requests';
import { positionSettingHandler } from '@/modules/settings';

/**
 * Perangkai isi khas tiap jenis pengajuan (spec L2f-1 §3.1). Modul `requests` tidak mengimpor modul jenisnya;
 * jenis baru menambah satu baris di sini. Tes memastikan tiap jenis di daftar punya handler.
 */
export const REQUEST_HANDLERS: Record<RequestTypeKey, RequestHandler> = {
  identity_change: identityChangeHandler,
  position_setting_change: positionSettingHandler(announceToOwners),
};
