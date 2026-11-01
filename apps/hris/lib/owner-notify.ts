import { getEmployeeBasic } from '@/modules/employees';
import { activeHrisAccounts } from '@/modules/accounts';
import { listEmployeesWithAnyAction, type ChangeAnnounce } from '@/modules/access';
import { notify } from '@/modules/notifications';

/**
 * "Pemilik lain diberi tahu" (KAR-73, spec L2f-2 §3): kabar ke semua Pemilik/GM aktif kecuali pelakunya, di transaksi
 * perubahannya. Dirangkai di sini karena modul `access` dan `settings` tidak boleh mengimpor modul `accounts`.
 */
export const announceToOwners: ChangeAnnounce = async (tx, actorAccountId, change) => {
  const accounts = await activeHrisAccounts(await listEmployeesWithAnyAction([]));
  const actorEmployeeId = [...accounts].find(([, accountId]) => accountId === actorAccountId)?.[0];
  const actor = actorEmployeeId ? await getEmployeeBasic(actorEmployeeId) : null;
  await notify(tx, [...accounts.values()], {
    kind: 'owner.change',
    title: `${actor?.name ?? 'Pemilik/GM'} ${change.what}`,
    link: change.link, entity: change.entity, entityId: change.entityId,
  }, actorAccountId);
};
