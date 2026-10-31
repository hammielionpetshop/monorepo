import { db, branches, roles, permissions, rolePermissions, userPermissions, userBranchAssignments, eq, and } from '@/lib/db';
import type { BranchScope, JWTPayload, UserRole } from '@petshop/shared';

export type AccessUser = {
  id: number;
  name: string;
  staffNumber: string | null;
  roleId: number;
  branchId: number;
  mustChangeCredentials: boolean;
  mustChangePin: boolean;
};

export type AccessContext = {
  branchName: string;
  roleName: UserRole;
  permissionCodes: string[];
  branchScope: BranchScope;
  branchIds?: number[];
};

/**
 * Peran, izin, dan cabang milik satu user, dihitung dari tabel petshop. Dipakai bersama oleh
 * login mode legacy dan central: JWT lokal selalu diterbitkan backoffice dari data ini,
 * apa pun penerbit sesinya.
 */
export async function loadAccessContext(user: AccessUser): Promise<AccessContext> {
  const [branch] = await db.select().from(branches).where(eq(branches.id, user.branchId)).limit(1);
  const [role] = await db.select().from(roles).where(eq(roles.id, user.roleId)).limit(1);

  // Load kode permission role (sumbu capability) — 1 query join role_permissions ⋈ permissions
  const perms = await db
    .select({ code: permissions.code })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, user.roleId));

  // Izin yang ditunjuk ke orang ini secara khusus, di luar jatah role-nya
  // (mis. koreksi transaksi). Digabung — grant hanya menambah, tidak pernah mencabut.
  const userPerms = await db
    .select({ code: permissions.code })
    .from(userPermissions)
    .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
    .where(eq(userPermissions.userId, user.id));

  const permissionCodes = Array.from(
    new Set([...perms.map((p) => p.code), ...userPerms.map((p) => p.code)]),
  );

  // Sumbu scope cabang (parity GLOBAL_ROLES): OWNER/GM lihat semua, lainnya cabang sendiri
  const branchScope: BranchScope = role.name === 'OWNER' || role.name === 'GM' ? 'ALL' : 'OWN';

  // Cabang tempat orang ini boleh bertugas. Hanya dimuat untuk scope OWN — pemegang scope ALL
  // boleh memilih cabang aktif mana pun, jadi daftarnya tak perlu ikut ke dalam token.
  // Cabang utama disatukan supaya user yang penugasannya belum diisi tetap punya satu pilihan
  // (dan bukan nol) — tanpa itu ia terkunci dari layar pemilihan cabang.
  let branchIds: number[] | undefined;
  if (branchScope === 'OWN') {
    const assigned = await db
      .select({ branchId: userBranchAssignments.branchId })
      .from(userBranchAssignments)
      .innerJoin(branches, eq(userBranchAssignments.branchId, branches.id))
      .where(and(eq(userBranchAssignments.userId, user.id), eq(branches.isActive, true)));

    branchIds = Array.from(new Set([user.branchId, ...assigned.map((a) => a.branchId)]));
  }

  return { branchName: branch.name, roleName: role.name as UserRole, permissionCodes, branchScope, branchIds };
}

export function assemblePayload(
  user: AccessUser,
  context: AccessContext,
  sessions: { sessionId?: number; centralSessionId?: number },
): JWTPayload {
  return {
    userId: user.id,
    ...sessions,
    userName: user.name,
    staffNumber: user.staffNumber || null,
    branchId: user.branchId,
    branchName: context.branchName,
    role: context.roleName,
    permissions: context.permissionCodes,
    branchScope: context.branchScope,
    branchIds: context.branchIds,
    mustChangeCredentials: user.mustChangeCredentials,
    mustChangePin: user.mustChangePin,
  };
}
