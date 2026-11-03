import { headers } from 'next/headers';
import { limitedActor, limitedPathAllowed, type Actor } from '@/modules/access';
import { formerStatus, todayWib } from '@/modules/employees';
import { hasMoneyMatters } from '@/modules/payroll';

/** Alamat permintaan ini dari middleware (`x-hris-path`, selalu ditimpa server); null di luar permintaan. */
export async function currentPath(): Promise<string | null> {
  try {
    return (await headers()).get('x-hris-path');
  } catch {
    return null;
  }
}

/**
 * Akses terbatas mantan karyawan (spec L4g §3.7). Orang tanpa jabatan hari ini yang berhenti/diberhentikan dan masih
 * punya urusan gaji menjadi pelaku terbatas: hanya `profile.view` dirinya, dan hanya di alamat yang dibuka.
 */
export async function withFormerAccess(actor: Actor): Promise<Actor> {
  if (actor.positionId != null) return actor;
  const former = await formerStatus(actor.personId, todayWib());
  if (!former || !(await hasMoneyMatters(actor.personId))) return actor;
  return limitedActor(actor, former.since, limitedPathAllowed(await currentPath()));
}
