import { and, eq, inArray } from 'drizzle-orm';
import { positionGrants, positions } from '@petshop/hris-db/schema/access';
import { db } from '@/lib/db';
import type { Scope } from '../rules/actions';
import { can, type Actor } from '../rules/can';
import { validateGrantChanges, type GrantChange } from '../rules/grant-changes';
import { recordAudit } from './audit';
import type { ServiceResult } from './org';

export async function getPositionGrants(positionId: number): Promise<Record<string, Scope>> {
  const rows = await db.select({ action: positionGrants.action, scope: positionGrants.scope })
    .from(positionGrants).where(eq(positionGrants.positionId, positionId));
  return Object.fromEntries(rows.map((row) => [row.action, row.scope]));
}

/**
 * Simpan perubahan hak satu jabatan: satu transaksi, satu baris jejak (sebelum/sesudah lengkap).
 * Batas keras diperiksa ulang di dalam transaksi setelah jabatan dikunci.
 */
export async function savePositionGrants(
  actor: Actor | null,
  positionId: number,
  changes: GrantChange[],
): Promise<ServiceResult<{ changed: number }>> {
  if (!actor || !can(actor, 'position.grants.update')) {
    return { ok: false, status: 403, error: 'Anda tidak berhak mengubah Hak Akses Jabatan.' };
  }
  return db.transaction(async (tx) => {
    const [position] = await tx.select().from(positions).where(eq(positions.id, positionId)).for('update');
    if (!position) return { ok: false as const, status: 404 as const, error: 'Jabatan tidak ditemukan.' };
    const errors = validateGrantChanges(actor, position, changes);
    if (errors.length) return { ok: false as const, status: 400 as const, error: errors.join(' ') };

    const current = await tx.select({ action: positionGrants.action, scope: positionGrants.scope })
      .from(positionGrants).where(eq(positionGrants.positionId, positionId));
    const before = Object.fromEntries(current.map((row) => [row.action, row.scope])) as Record<string, Scope>;
    const effective = changes.filter((change) => (before[change.action] ?? null) !== change.scope);
    if (!effective.length) return { ok: false as const, status: 400 as const, error: 'Tidak ada perubahan untuk disimpan.' };

    const removed = effective.filter((change) => change.scope === null).map((change) => change.action);
    if (removed.length) {
      await tx.delete(positionGrants)
        .where(and(eq(positionGrants.positionId, positionId), inArray(positionGrants.action, removed)));
    }
    const now = new Date();
    for (const change of effective) {
      if (change.scope === null) continue;
      await tx.insert(positionGrants).values({ positionId, action: change.action, scope: change.scope })
        .onConflictDoUpdate({
          target: [positionGrants.positionId, positionGrants.action],
          set: { scope: change.scope, updatedAt: now },
        });
    }
    const after = { ...before };
    for (const change of effective) {
      if (change.scope === null) delete after[change.action];
      else after[change.action] = change.scope;
    }
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'position_grant', entityId: positionId,
      action: 'update', before, after,
    });
    return { ok: true as const, data: { changed: effective.length } };
  });
}

/** Nama jabatan aktif per tindakan (layar Jenis Pengajuan, BER-L42). Jabatan berhak penuh selalu ikut. */
export async function positionNamesByAction(): Promise<(action: string) => string[]> {
  const all = await db.select({ id: positions.id, name: positions.name, fullAccess: positions.fullAccess, active: positions.active })
    .from(positions);
  const grants = await db.select({ positionId: positionGrants.positionId, action: positionGrants.action }).from(positionGrants);
  const active = all.filter((p) => p.active);
  const owners = active.filter((p) => p.fullAccess).map((p) => p.name);
  return (action) => [
    ...owners,
    ...active.filter((p) => !p.fullAccess && grants.some((g) => g.positionId === p.id && g.action === action)).map((p) => p.name),
  ];
}
