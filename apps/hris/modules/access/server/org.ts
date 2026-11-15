import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { branches, departments, positions } from '@petshop/hris-db/schema/access';
import { db } from '@/lib/db';
import { can, type Actor } from '../rules/can';
import { recordAudit, type Tx } from './audit';

export type ServiceResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 403 | 404 | 409 | 502; error: string };

const fail = (status: 400 | 403 | 404 | 409, error: string) => ({ ok: false as const, status, error });

function isUniqueViolation(error: unknown, constraint: string): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const pg = cause as { code?: string; constraint_name?: string; constraint?: string };
  return pg?.code === '23505' && (pg.constraint_name ?? pg.constraint) === constraint;
}

type Holder = { employeeId: number; name: string; branchId: number; positionId: number };

/**
 * Pemakai cabang/jabatan (KAR-27): penempatan hari ini orang aktif dan catatan bertanggal depan,
 * dari view baca modul karyawan `hris.placement_holders`.
 */
async function loadHolders(executor: Pick<Tx, 'execute'>, by: { branchId?: number; positionId?: number } = {}) {
  const branchId = by.branchId ?? null;
  const positionId = by.positionId ?? null;
  const rows = await executor.execute<{ employee_id: number; employee_name: string; branch_id: number; position_id: number }>(sql`
    select employee_id, employee_name, branch_id, position_id from hris.placement_holders
    where (${branchId}::int is null or branch_id = ${branchId}::int)
      and (${positionId}::int is null or position_id = ${positionId}::int)`);
  return rows.map((row): Holder => ({
    employeeId: Number(row.employee_id), name: row.employee_name,
    branchId: Number(row.branch_id), positionId: Number(row.position_id),
  }));
}

/** Nama untuk pesan "masih dipakai"; satu orang disebut sekali. */
function holderNames(holders: Holder[]): string[] {
  return [...new Map(holders.map((holder) => [holder.employeeId, holder.name])).values()];
}

/** Jumlah orang (bukan baris) per cabang atau jabatan. */
function countHolders(holders: Holder[], key: 'branchId' | 'positionId'): Map<number, number> {
  const people = new Map<number, Set<number>>();
  for (const holder of holders) {
    const set = people.get(holder[key]) ?? new Set<number>();
    set.add(holder.employeeId);
    people.set(holder[key], set);
  }
  return new Map([...people].map(([id, set]) => [id, set.size]));
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
    loadHolders(db),
  ]);
  const holdersByPosition = countHolders(holderRows, 'positionId');
  const holdersByBranch = countHolders(holderRows, 'branchId');
  return {
    departments: departmentRows,
    branches: branchRows.map((branch) => ({ ...branch, holders: holdersByBranch.get(branch.id) ?? 0 })),
    positions: positionRows.map((position) => ({ ...position, holders: holdersByPosition.get(position.id) ?? 0 })),
    kasirBranches: kasirRows.map((row) => ({ id: Number(row.id), code: row.code, name: row.name, active: row.active })),
  };
}

export type Organization = Awaited<ReturnType<typeof listOrganization>>;

/** Cabang dan jabatan untuk modul lain (pilihan, nama, departemen, tanda berhak tinggi). */
export async function getOrgLookup() {
  const [branchRows, positionRows, departmentRows] = await Promise.all([
    db.select({ id: branches.id, name: branches.name, active: branches.active }).from(branches).orderBy(asc(branches.name)),
    db.select({
      id: positions.id, name: positions.name, departmentId: positions.departmentId, highRights: positions.highRights,
      fullAccess: positions.fullAccess, active: positions.active,
    }).from(positions).orderBy(asc(positions.departmentId), asc(positions.name)),
    db.select({ id: departments.id, name: departments.name }).from(departments),
  ]);
  const departmentNames = new Map(departmentRows.map((d) => [d.id, d.name]));
  return {
    branches: branchRows,
    positions: positionRows.map((p) => ({ ...p, departmentName: departmentNames.get(p.departmentId) ?? '' })),
  };
}

export type OrgLookup = Awaited<ReturnType<typeof getOrgLookup>>;

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
        const users = holderNames(await loadHolders(tx, { branchId: before.id }));
        if (users.length) return fail(409, `Cabang masih dipakai: ${listNames(users)}.`);
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
        const users = holderNames(await loadHolders(tx, { positionId: before.id }));
        if (users.length) return fail(409, `Jabatan masih dipegang: ${listNames(users)}.`);
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

/** Untuk layar Hak Akses Jabatan: jabatan beserta jumlah pemegangnya (hari ini dan bertanggal depan). */
export async function listPositionsWithHolders() {
  const rows = await db.select().from(positions).orderBy(asc(positions.departmentId), asc(positions.name));
  const count = countHolders(await loadHolders(db), 'positionId');
  return rows.map((row) => ({ ...row, holders: count.get(row.id) ?? 0 }));
}
