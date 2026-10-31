import { eq } from 'drizzle-orm';
import {
  branches, interimActorPositions, positionGrants, positions,
} from '@petshop/hris-db/schema/access';
import { db } from '@/lib/db';
import type { Scope } from '../rules/actions';
import type { Actor } from '../rules/can';

/**
 * Pelaku dari tautan HRIS (`localUserId`). Sampai L2c, jabatan/cabang dibaca dari tabel sementara
 * `interim_actor_positions`; L2c menggantinya dengan riwayat penempatan pada tanggal data.
 * Tidak ada cache: jabatan/cabang berubah, permintaan berikutnya langsung memakai nilai baru.
 */
export async function loadActor(accountId: number, personId: number): Promise<Actor> {
  const none: Actor = {
    accountId, personId, positionId: null, fullAccess: false, highRights: false,
    branchId: null, departmentId: null, grants: new Map(),
  };
  const [row] = await db
    .select({
      positionId: positions.id,
      positionActive: positions.active,
      fullAccess: positions.fullAccess,
      highRights: positions.highRights,
      departmentId: positions.departmentId,
      branchId: branches.id,
      branchActive: branches.active,
    })
    .from(interimActorPositions)
    .innerJoin(positions, eq(positions.id, interimActorPositions.positionId))
    .leftJoin(branches, eq(branches.id, interimActorPositions.branchId))
    .where(eq(interimActorPositions.personId, personId))
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
    branchId: row.branchActive ? row.branchId : null,
    grants,
  };
}
