import { eq, sql } from 'drizzle-orm';
import { branches, positionGrants, positions } from '@petshop/hris-db/schema/access';
import { db } from '@/lib/db';
import type { Scope } from '../rules/actions';
import type { Actor } from '../rules/can';

/**
 * Pelaku dari tautan HRIS (`localUserId` = id karyawan). Jabatan/cabang dibaca dari penempatan hari ini
 * (WIB) lewat view baca `hris.current_placements` milik modul karyawan (KAR-56). Orang nonaktif atau
 * belum mulai bekerja tidak punya jabatan, jadi semua tindakan ditolak.
 * Tidak ada cache: jabatan/cabang berubah, permintaan berikutnya langsung memakai nilai baru.
 */
export async function loadActor(accountId: number, personId: number): Promise<Actor> {
  const none: Actor = {
    accountId, personId, positionId: null, fullAccess: false, highRights: false,
    branchId: null, departmentId: null, grants: new Map(),
  };
  const [placement] = await db.execute<{ position_id: number; branch_id: number }>(sql`
    select position_id, branch_id from hris.current_placements where employee_id = ${personId} and active`);
  if (!placement) return none;

  const [row] = await db
    .select({
      positionId: positions.id,
      positionActive: positions.active,
      fullAccess: positions.fullAccess,
      highRights: positions.highRights,
      departmentId: positions.departmentId,
      branchActive: branches.active,
    })
    .from(positions)
    .innerJoin(branches, eq(branches.id, Number(placement.branch_id)))
    .where(eq(positions.id, Number(placement.position_id)))
    .limit(1);
  if (!row || !row.positionActive) return none;

  const grants = new Map<string, Scope>();
  if (!row.fullAccess) {
    const rows = await db.select({ action: positionGrants.action, scope: positionGrants.scope })
      .from(positionGrants).where(eq(positionGrants.positionId, row.positionId));
    for (const grant of rows) grants.set(grant.action, grant.scope);
  }
  return {
    ...none,
    positionId: row.positionId,
    fullAccess: row.fullAccess,
    highRights: row.highRights,
    departmentId: row.departmentId,
    branchId: row.branchActive ? Number(placement.branch_id) : null,
    grants,
  };
}

/**
 * Karyawan aktif hari ini yang jabatannya punya salah satu tindakan ini (atau berhak penuh). Hanya penyaring
 * awal; pemanggil tetap memeriksa `can()` per orang (lingkup cabang/departemen). Daftar kosong = hanya Pemilik/GM.
 */
export async function listEmployeesWithAnyAction(actions: string[]): Promise<number[]> {
  const granted = actions.length
    ? sql`exists (select 1 from hris.position_grants g where g.position_id = p.id
        and g.action in (${sql.join(actions.map((action) => sql`${action}`), sql`, `)}))`
    : sql`false`;
  const rows = await db.execute<{ employee_id: number }>(sql`
    select distinct cp.employee_id
    from hris.current_placements cp
    join hris.positions p on p.id = cp.position_id and p.active
    where cp.active and (p.full_access or ${granted})`);
  return rows.map((row) => Number(row.employee_id));
}
