import { and, asc, eq, ne, sql } from 'drizzle-orm';
import {
  branches, departments, interimActorPositions, positions,
} from '@petshop/hris-db/schema/access';
import { db } from '@/lib/db';
import { can, type Actor } from '../rules/can';
import { recordAudit, type Tx } from './audit';

export type ServiceResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string };

const fail = (status: 400 | 403 | 404 | 409, error: string) => ({ ok: false as const, status, error });

function isUniqueViolation(error: unknown, constraint: string): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const pg = cause as { code?: string; constraint_name?: string; constraint?: string };
  return pg?.code === '23505' && (pg.constraint_name ?? pg.constraint) === constraint;
}

/** Nama pemegang jabatan/cabang untuk pesan "masih dipakai" (KAR-27). */
async function holderLabels(tx: Tx, personIds: number[]): Promise<string[]> {
  if (!personIds.length) return [];
  const rows = await tx.execute<{ person_id: number; label: string | null }>(sql`
    select l.local_user_id as person_id, coalesce(a.username, a.email) as label
    from auth.account_links l join auth.accounts a on a.id = l.account_id
    where l.app_code = 'hris' and l.revoked_at is null and l.local_user_id in ${personIds}`);
  const byId = new Map(rows.map((row) => [Number(row.person_id), row.label]));
  return personIds.map((id) => byId.get(id) ?? `orang #${id}`);
}

function listNames(names: string[]): string {
  const shown = names.slice(0, 5).join(', ');
  return names.length > 5 ? `${shown}, dan ${names.length - 5} lainnya` : shown;
}

function cleanName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, ' ');
  return name && name.length <= 100 ? name : null;
}

export async function listOrganization() {
  const [departmentRows, branchRows, positionRows, kasirRows, holderRows] = await Promise.all([
    db.select().from(departments).orderBy(asc(departments.name)),
    db.select().from(branches).orderBy(asc(branches.name)),
    db.select().from(positions).orderBy(asc(positions.departmentId), asc(positions.name)),
    db.execute<{ id: number; code: string; name: string; active: boolean }>(
      sql`select id, code, name, active from hris.kasir_branches order by name`,
    ),
    db.select({ positionId: interimActorPositions.positionId, branchId: interimActorPositions.branchId })
      .from(interimActorPositions),
  ]);
  const holdersByPosition = new Map<number, number>();
  const holdersByBranch = new Map<number, number>();
  for (const holder of holderRows) {
    holdersByPosition.set(holder.positionId, (holdersByPosition.get(holder.positionId) ?? 0) + 1);
    if (holder.branchId != null) holdersByBranch.set(holder.branchId, (holdersByBranch.get(holder.branchId) ?? 0) + 1);
  }
  return {
    departments: departmentRows,
    branches: branchRows.map((branch) => ({ ...branch, holders: holdersByBranch.get(branch.id) ?? 0 })),
    positions: positionRows.map((position) => ({ ...position, holders: holdersByPosition.get(position.id) ?? 0 })),
    kasirBranches: kasirRows.map((row) => ({ id: Number(row.id), code: row.code, name: row.name, active: row.active })),
  };
}

export type Organization = Awaited<ReturnType<typeof listOrganization>>;

export type DepartmentInput = { id?: number; name: string; active: boolean };

export async function saveDepartment(actor: Actor | null, input: DepartmentInput): Promise<ServiceResult<{ id: number }>> {
  if (!actor || !can(actor, 'org.manage')) return fail(403, 'Anda tidak berhak mengubah departemen.');
  const name = cleanName(input.name);
  if (!name) return fail(400, 'Nama departemen wajib diisi (paling banyak 100 karakter).');
  try {
    return await db.transaction(async (tx) => {
      const [before] = input.id
        ? await tx.select().from(departments).where(eq(departments.id, input.id)).for('update')
        : [];
      if (input.id && !before) return fail(404, 'Departemen tidak ditemukan.');
      if (before?.active && !input.active) {
        const used = await tx.select({ name: positions.name }).from(positions)
          .where(and(eq(positions.departmentId, before.id), eq(positions.active, true)));
        if (used.length) {
          return fail(409, `Departemen masih dipakai jabatan aktif: ${listNames(used.map((p) => p.name))}.`);
        }
      }
      const [after] = before
        ? await tx.update(departments).set({ name, active: input.active, updatedAt: new Date() })
          .where(eq(departments.id, before.id)).returning()
        : await tx.insert(departments).values({ name, active: input.active }).returning();
      await recordAudit(tx, {
        actorAccountId: actor.accountId, entity: 'department', entityId: after.id,
        action: before ? 'update' : 'create', before: before ?? null, after,
      });
      return { ok: true as const, data: { id: after.id } };
    });
  } catch (error) {
    if (isUniqueViolation(error, 'departments_name_unique')) return fail(409, 'Nama departemen sudah dipakai.');
    throw error;
  }
}

export type BranchInput = {
  id?: number;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  kasirBranchId: number | null;
  mergedIntoBranchId: number | null;
  active: boolean;
};

export async function saveBranch(actor: Actor | null, input: BranchInput): Promise<ServiceResult<{ id: number }>> {
  if (!actor || !can(actor, 'org.manage')) return fail(403, 'Anda tidak berhak mengubah cabang.');
  const name = cleanName(input.name);
  if (!name) return fail(400, 'Nama cabang wajib diisi (paling banyak 100 karakter).');
  if ((input.latitude == null) !== (input.longitude == null)) {
    return fail(400, 'Titik lokasi harus berisi lintang dan bujur sekaligus, atau dikosongkan keduanya.');
  }
  if (input.latitude != null && (input.latitude < -90 || input.latitude > 90)) return fail(400, 'Lintang harus di antara -90 dan 90.');
  if (input.longitude != null && (input.longitude < -180 || input.longitude > 180)) return fail(400, 'Bujur harus di antara -180 dan 180.');
  if (input.id && input.mergedIntoBranchId === input.id) return fail(400, 'Cabang tidak bisa digabung ke dirinya sendiri.');
  const address = input.address?.trim() || null;

  try {
    return await db.transaction(async (tx) => {
      const [before] = input.id ? await tx.select().from(branches).where(eq(branches.id, input.id)).for('update') : [];
      if (input.id && !before) return fail(404, 'Cabang tidak ditemukan.');
      if (input.kasirBranchId != null && input.kasirBranchId !== before?.kasirBranchId) {
        const found = await tx.execute(sql`select 1 from hris.kasir_branches where id = ${input.kasirBranchId}`);
        if (!found.length) return fail(400, 'Cabang kasir yang dipilih tidak ditemukan.');
      }
      if (input.mergedIntoBranchId != null && input.mergedIntoBranchId !== before?.mergedIntoBranchId) {
        const [target] = await tx.select().from(branches).where(eq(branches.id, input.mergedIntoBranchId));
        if (!target || !target.active) return fail(400, 'Cabang tujuan gabungan harus cabang yang aktif.');
        if (target.mergedIntoBranchId != null) return fail(400, 'Cabang tujuan gabungan sendiri sudah digabung ke cabang lain.');
      }
      if (before?.active && !input.active) {
        const holders = await tx.select({ personId: interimActorPositions.personId }).from(interimActorPositions)
          .where(eq(interimActorPositions.branchId, before.id));
        if (holders.length) {
          const names = await holderLabels(tx, holders.map((h) => h.personId));
          return fail(409, `Cabang masih dipakai: ${listNames(names)}.`);
        }
        const merged = await tx.select({ name: branches.name }).from(branches)
          .where(and(eq(branches.mergedIntoBranchId, before.id), eq(branches.active, true), ne(branches.id, before.id)));
        if (merged.length) {
          return fail(409, `Cabang masih menjadi tujuan gabungan: ${listNames(merged.map((b) => b.name))}.`);
        }
      }
      const values = {
        name, address, latitude: input.latitude, longitude: input.longitude,
        kasirBranchId: input.kasirBranchId, mergedIntoBranchId: input.mergedIntoBranchId, active: input.active,
      };
      const [after] = before
        ? await tx.update(branches).set({ ...values, updatedAt: new Date() }).where(eq(branches.id, before.id)).returning()
        : await tx.insert(branches).values(values).returning();
      await recordAudit(tx, {
        actorAccountId: actor.accountId, entity: 'branch', entityId: after.id,
        action: before ? 'update' : 'create', before: before ?? null, after,
      });
      return { ok: true as const, data: { id: after.id } };
    });
  } catch (error) {
    if (isUniqueViolation(error, 'branches_name_unique')) return fail(409, 'Nama cabang sudah dipakai.');
    if (isUniqueViolation(error, 'branches_kasir_branch_unique')) return fail(409, 'Cabang kasir itu sudah ditautkan ke cabang lain.');
    throw error;
  }
}

export type PositionInput = { id?: number; name: string; departmentId: number; highRights: boolean; active: boolean };

export async function savePosition(actor: Actor | null, input: PositionInput): Promise<ServiceResult<{ id: number }>> {
  if (!actor || !can(actor, 'org.manage')) return fail(403, 'Anda tidak berhak mengubah jabatan.');
  const name = cleanName(input.name);
  if (!name) return fail(400, 'Nama jabatan wajib diisi (paling banyak 100 karakter).');
  try {
    return await db.transaction(async (tx) => {
      const [before] = input.id ? await tx.select().from(positions).where(eq(positions.id, input.id)).for('update') : [];
      if (input.id && !before) return fail(404, 'Jabatan tidak ditemukan.');

      const highRightsChanged = before ? before.highRights !== input.highRights : input.highRights;
      if (before?.fullAccess && (input.highRights !== before.highRights || !input.active)) {
        return fail(400, `Jabatan ${before.name} berhak penuh: tanda dan status aktifnya tidak bisa diubah dari layar.`);
      }
      if (highRightsChanged && !can(actor, 'position.high_rights.update')) {
        return fail(403, 'Hanya Pemilik dan GM yang bisa mengubah tanda berhak tinggi.');
      }
      if (!before || before.departmentId !== input.departmentId) {
        const [department] = await tx.select().from(departments).where(eq(departments.id, input.departmentId));
        if (!department || !department.active) return fail(400, 'Pilih departemen yang aktif.');
      }
      if (before?.active && !input.active) {
        const holders = await tx.select({ personId: interimActorPositions.personId }).from(interimActorPositions)
          .where(eq(interimActorPositions.positionId, before.id));
        if (holders.length) {
          const names = await holderLabels(tx, holders.map((h) => h.personId));
          return fail(409, `Jabatan masih dipegang: ${listNames(names)}.`);
        }
      }
      const values = { name, departmentId: input.departmentId, highRights: input.highRights, active: input.active };
      const [after] = before
        ? await tx.update(positions).set({ ...values, updatedAt: new Date() }).where(eq(positions.id, before.id)).returning()
        : await tx.insert(positions).values(values).returning();
      await recordAudit(tx, {
        actorAccountId: actor.accountId, entity: 'position', entityId: after.id,
        action: before ? 'update' : 'create', before: before ?? null, after,
      });
      return { ok: true as const, data: { id: after.id } };
    });
  } catch (error) {
    if (isUniqueViolation(error, 'positions_name_unique')) return fail(409, 'Nama jabatan sudah dipakai.');
    throw error;
  }
}

/** Untuk layar Hak Akses Jabatan: jabatan beserta jumlah pemegangnya. */
export async function listPositionsWithHolders() {
  const rows = await db.select().from(positions).orderBy(asc(positions.departmentId), asc(positions.name));
  const holders = await db.select({ positionId: interimActorPositions.positionId }).from(interimActorPositions);
  const count = new Map<number, number>();
  for (const h of holders) count.set(h.positionId, (count.get(h.positionId) ?? 0) + 1);
  return rows.map((row) => ({ ...row, holders: count.get(row.id) ?? 0 }));
}
