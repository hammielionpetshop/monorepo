import * as argon2 from 'argon2';
import { findBackofficeUserOfAccount, linkBackofficeUser } from '@petshop/auth';
import { getDefaultCredentials } from '@/lib/app-settings';
import { getAuthSql } from '@/lib/central-auth';
import { db, branches, roles, users, and, eq, inArray, ne, sql } from '@/lib/db';
import { findAccountIdForUser, revokeLegacySessionsForUser } from '@/lib/services/central-session';
import { listBranchAssignments, syncUserBranchAssignments } from '@/lib/services/user-branch-assignments';

/** Role backoffice yang boleh dipilih dari HRIS (PRD 04 §3.2). */
export const HRIS_BACKOFFICE_ROLES = ['OWNER', 'GM', 'MANAGER', 'KASIR', 'GUDANG', 'FINANCE'] as const;
export type HrisBackofficeRole = (typeof HRIS_BACKOFFICE_ROLES)[number];

export type BackofficeAccessInput = {
  accountId: number;
  employeeName: string;
  employeeCode: string;
  roleName: HrisBackofficeRole;
  branchId: number;
  assignedBranchIds: number[];
  active: boolean;
  actorUserId: number;
  actorAccountId: number;
};

export type BackofficeAccessOutcome =
  | { ok: true; userId: number | null; created: boolean }
  | { ok: false; status: 400 | 404 | 409; error: string };

export type BackofficeAccessView = {
  userId: number;
  username: string | null;
  staffNumber: string | null;
  roleName: string;
  branchId: number;
  branchName: string;
  assignedBranches: { id: number; name: string }[];
  isActive: boolean;
};

const fail = (status: 400 | 404 | 409, error: string) => ({ ok: false as const, status, error });

/** Username dari bagian depan email; diberi akhiran angka bila sudah dipakai. */
async function freeUsername(email: string | null, code: string): Promise<string> {
  const base = ((email ?? '').split('@')[0] || code).toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40) || code.toLowerCase();
  for (let n = 1; n < 100; n += 1) {
    const candidate = n === 1 ? base : `${base}${n}`;
    const [taken] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.username}) = ${candidate}`).limit(1);
    if (!taken) return candidate;
  }
  throw new Error('USERNAME_EXHAUSTED');
}

/** Cabut akses backoffice yang sedang terbuka (sesi pusat + sesi lama) supaya perubahan langsung berlaku. */
async function revokeOpenAccess(userId: number, accountId: number, reason: string) {
  await revokeLegacySessionsForUser(userId, reason);
  await getAuthSql()`update auth.session_app_access x set revoked_at = now(), revoked_reason = ${reason}
    from auth.account_links l
    where l.id = x.account_link_id and l.account_id = ${accountId} and l.app_code = 'backoffice' and x.revoked_at is null`;
}

/**
 * Menyetel akses kasir sebuah akun pusat (spec L2d §4). Bentuknya "setel keadaan", jadi aman diulang:
 * belum bertaut → buat pengguna + tautan; sudah bertaut → ubah role/cabang/aktif. Pengguna yang
 * terbuat tetapi gagal ditautkan dipakai ulang lewat nomor staf (= kode karyawan) pada percobaan berikutnya.
 */
export async function setBackofficeAccess(input: BackofficeAccessInput): Promise<BackofficeAccessOutcome> {
  const authSql = getAuthSql();
  const [account] = await authSql`select id, email, password_hash, is_active from auth.accounts where id = ${input.accountId}`;
  if (!account) return fail(404, 'Akun tidak ditemukan.');
  if (input.accountId === input.actorAccountId) return fail(400, 'Akses kasir akun sendiri tidak bisa diubah.');

  const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, input.roleName)).limit(1);
  if (!role) return fail(400, 'Role tidak ditemukan.');
  const branchIds = Array.from(new Set([input.branchId, ...input.assignedBranchIds]));
  const validBranches = await db.select({ id: branches.id }).from(branches)
    .where(and(inArray(branches.id, branchIds), eq(branches.isActive, true)));
  if (validBranches.length !== branchIds.length) return fail(400, 'Cabang tidak ditemukan atau tidak aktif.');

  let userId = await findBackofficeUserOfAccount(authSql, input.accountId);
  let created = false;

  if (userId === null) {
    if (!input.active) return { ok: true, userId: null, created: false };
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.staffNumber, input.employeeCode)).limit(1);
    if (existing) {
      if ((await findAccountIdForUser(existing.id)) !== null) {
        return fail(409, `Nomor staf ${input.employeeCode} sudah dipakai pengguna kasir akun lain.`);
      }
      userId = existing.id;
    } else {
      if (!account.password_hash) return fail(400, 'Akun belum punya password.');
      const email = account.email as string | null;
      const [emailTaken] = email
        ? await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1)
        : [];
      const { pin } = await getDefaultCredentials();
      const username = await freeUsername(email, input.employeeCode);
      const pinHash = await argon2.hash(pin);
      userId = await db.transaction(async (trx) => {
        const [row] = await trx.insert(users).values({
          name: input.employeeName.trim().slice(0, 100),
          username,
          email: emailTaken ? null : email,
          staffNumber: input.employeeCode,
          // Hash password akun pusat disalin, supaya jalur rollback ke login lama tetap bisa dipakai.
          passwordHash: account.password_hash as string,
          pinHash,
          roleId: role.id,
          branchId: input.branchId,
          isActive: true,
          mustChangeCredentials: true,
        }).returning({ id: users.id });
        await syncUserBranchAssignments(trx, row.id, input.branchId, input.assignedBranchIds, input.actorUserId);
        return row.id;
      });
      created = true;
    }
    const linked = await linkBackofficeUser(authSql, {
      accountId: input.accountId, localUserId: userId, actorAccountId: input.actorAccountId,
    });
    if (!linked.ok) return fail(409, linked.error);
    if (created) return { ok: true, userId, created };
  }

  const targetUserId = userId;
  const [before] = await db.select({ roleId: users.roleId, branchId: users.branchId, isActive: users.isActive })
    .from(users).where(eq(users.id, targetUserId)).limit(1);
  if (!before) return fail(404, 'Pengguna kasir tidak ditemukan.');

  try {
    await db.transaction(async (trx) => {
      const [ownerRole] = await trx.select({ id: roles.id }).from(roles).where(eq(roles.name, 'OWNER')).limit(1);
      const losingOwner = ownerRole && before.roleId === ownerRole.id && before.isActive
        && (!input.active || role.id !== ownerRole.id);
      if (losingOwner) {
        const others = await trx.select({ id: users.id }).from(users)
          .where(and(eq(users.roleId, ownerRole.id), eq(users.isActive, true), ne(users.id, targetUserId)));
        if (!others.length) throw new Error('LAST_OWNER');
      }
      await trx.update(users).set({
        name: input.employeeName.trim().slice(0, 100), roleId: role.id, branchId: input.branchId,
        isActive: input.active, updatedAt: new Date(),
      }).where(eq(users.id, targetUserId));
      await syncUserBranchAssignments(trx, targetUserId, input.branchId, input.assignedBranchIds, input.actorUserId);
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'LAST_OWNER') {
      return fail(409, 'Tidak bisa: ini satu-satunya Owner aktif di backoffice.');
    }
    throw error;
  }

  const changed = before.roleId !== role.id || before.branchId !== input.branchId || before.isActive !== input.active;
  if (changed) await revokeOpenAccess(targetUserId, input.accountId, input.active ? 'ACCESS_CHANGED' : 'ACCOUNT_DISABLED');
  return { ok: true, userId: targetUserId, created: false };
}

/** Keadaan akses kasir untuk daftar akun HRIS. Akun tanpa tautan backoffice tidak muncul. */
export async function getBackofficeAccess(accountIds: number[]): Promise<Record<number, BackofficeAccessView>> {
  const ids = accountIds.filter((id) => Number.isSafeInteger(id) && id > 0);
  if (!ids.length) return {};
  const links = await getAuthSql()`select account_id, local_user_id from auth.account_links
    where app_code = 'backoffice' and revoked_at is null and account_id in ${getAuthSql()(ids)}`;
  if (!links.length) return {};
  const userIds = links.map((link) => Number(link.local_user_id));
  const rows = await db.select({
    id: users.id, username: users.username, staffNumber: users.staffNumber, roleName: roles.name,
    branchId: users.branchId, branchName: branches.name, isActive: users.isActive,
  }).from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .innerJoin(branches, eq(branches.id, users.branchId))
    .where(inArray(users.id, userIds));
  const assignments = await listBranchAssignments(userIds);
  const byUser = new Map(rows.map((row) => [row.id, row]));
  const result: Record<number, BackofficeAccessView> = {};
  for (const link of links) {
    const row = byUser.get(Number(link.local_user_id));
    if (!row) continue;
    result[Number(link.account_id)] = {
      userId: row.id, username: row.username, staffNumber: row.staffNumber, roleName: row.roleName,
      branchId: row.branchId, branchName: row.branchName, isActive: row.isActive,
      assignedBranches: assignments.get(row.id) ?? [],
    };
  }
  return result;
}
