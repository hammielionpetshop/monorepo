import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import type { ActionName } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { todayWib } from '@/modules/employees';

/** Cuti/izin lebih dari 2 hari = tidak dianggap ada (spec F3-4 §2 butir 3). */
const AWAY_RUN_DAYS = 3;
const RUN = sql.raw(String(AWAY_RUN_DAYS));
const RUN_SPAN = sql.raw(String(AWAY_RUN_DAYS - 1));

/**
 * Pemegang hak `actions` yang hidup (PRI-43, 2.2 butir 6): penempatan aktif di jabatan aktif yang bukan akses penuh
 * (Pemilik/GM tidak dihitung sebagai penerima), punya akun HRIS aktif, dan hari ini tidak sedang izin/sakit/cuti
 * dalam rangkaian lebih dari 2 hari. Cabang tidak dibedakan: cukup satu pemegang di mana pun.
 */
export async function liveHolderIds(actions: readonly ActionName[], now: Date = new Date()): Promise<number[]> {
  if (!actions.length) return [];
  const today = todayWib(now);
  const rows = await db.execute<{ employee_id: number }>(sql`
    select distinct cp.employee_id
    from hris.current_placements cp
    join hris.positions p on p.id = cp.position_id and p.active and not p.full_access
    where cp.active
      and exists (select 1 from hris.position_grants g where g.position_id = p.id
        and g.action in (${sql.join(actions.map((action) => sql`${action}`), sql`, `)}))
      and not exists (
        select 1 from generate_series(${today}::date - ${RUN_SPAN}, ${today}::date, interval '1 day') s(start)
        where (select count(*) from hris.absence_days d
          where d.employee_id = cp.employee_id and d.active
            and d.work_date between s.start::date and s.start::date + ${RUN_SPAN}) = ${RUN})`);
  const ids = rows.map((row) => Number(row.employee_id));
  return [...(await activeHrisAccounts(ids)).keys()];
}

/** Penghitung untuk satu kali perangkaian kartu: tiap kumpulan hak hanya ditanyakan sekali. */
export function liveHolderLookup(now: Date = new Date()) {
  const cache = new Map<string, Promise<boolean>>();
  return (actions: readonly ActionName[]): Promise<boolean> => {
    const key = [...actions].sort().join(',');
    let hit = cache.get(key);
    if (!hit) {
      hit = liveHolderIds(actions, now).then((ids) => ids.length > 0);
      cache.set(key, hit);
    }
    return hit;
  };
}
