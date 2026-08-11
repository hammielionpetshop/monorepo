import { NextResponse } from 'next/server';
import { db, users, branches, roles, permissions, rolePermissions, userPermissions, userBranchAssignments, eq, and, or } from '@/lib/db';
import { loginSchema, UserRole, type BranchScope } from '@petshop/shared';
import * as argon2 from 'argon2';
import { signAccessToken, signRefreshToken } from '@/lib/auth';
import { createLoginResponse } from './session-response';
import { startSession } from '@/lib/services/user-session';
import { describeDevice } from '@/lib/device-label';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'Data tidak valid', details: result.error.format() }, { status: 400 });
    }

    const input = result.data;
    let user;

    if (input.mode === 'staff_pin') {
      [user] = await db
        .select({
          id: users.id,
          name: users.name,
          staffNumber: users.staffNumber,
          pinHash: users.pinHash,
          roleId: users.roleId,
          branchId: users.branchId,
          isActive: users.isActive,
          mustChangeCredentials: users.mustChangeCredentials,
          mustChangePin: users.mustChangePin,
        })
        .from(users)
        .where(and(eq(users.staffNumber, input.staffNumber), eq(users.isActive, true)))
        .limit(1);

      if (!user || !user.pinHash || !(await argon2.verify(user.pinHash, input.pin))) {
        return NextResponse.json({ error: 'Nomor staff atau PIN salah' }, { status: 401 });
      }
    } else if (input.mode === 'email_password') {
      [user] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          staffNumber: users.staffNumber,
          passwordHash: users.passwordHash,
          roleId: users.roleId,
          branchId: users.branchId,
          isActive: users.isActive,
          mustChangeCredentials: users.mustChangeCredentials,
          mustChangePin: users.mustChangePin,
        })
        .from(users)
        .where(and(eq(users.email, input.email), eq(users.isActive, true)))
        .limit(1);

      if (!user || !user.passwordHash || !(await argon2.verify(user.passwordHash, input.password))) {
        return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
      }
    } else {
      // mode 'bo': login backoffice via email ATAU username; kredensial password ATAU PIN.
      // Resolver TANPA staff_number (staf POS-only tak boleh masuk BO).
      [user] = await db
        .select({
          id: users.id,
          name: users.name,
          staffNumber: users.staffNumber,
          passwordHash: users.passwordHash,
          pinHash: users.pinHash,
          roleId: users.roleId,
          branchId: users.branchId,
          isActive: users.isActive,
          mustChangeCredentials: users.mustChangeCredentials,
          mustChangePin: users.mustChangePin,
        })
        .from(users)
        .where(
          and(
            or(eq(users.email, input.identifier), eq(users.username, input.identifier)),
            eq(users.isActive, true)
          )
        )
        .limit(1);

      const hash = input.credentialType === 'password' ? user?.passwordHash : user?.pinHash;
      // Error generik — jangan bocorkan apakah identifier valid.
      if (!user || !hash || !(await argon2.verify(hash, input.credential))) {
        return NextResponse.json({ error: 'Kredensial salah' }, { status: 401 });
      }
    }

    // Get Branch and Role info
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

    // Mencabut sesi lama sekaligus. Diletakkan SETELAH kredensial terverifikasi — percobaan
    // login yang gagal tidak boleh bisa dipakai menendang orang keluar dari sesinya.
    const sessionId = await startSession(user.id, describeDevice(req.headers.get('user-agent')));

    const payload = {
      userId: user.id,
      sessionId,
      userName: user.name,
      staffNumber: user.staffNumber || null,
      branchId: user.branchId,
      branchName: branch.name,
      role: role.name as UserRole,
      permissions: permissionCodes,
      branchScope,
      branchIds,
      mustChangeCredentials: user.mustChangeCredentials,
      mustChangePin: user.mustChangePin,
    };

    const accessToken = await signAccessToken(payload);
    const refreshToken = await signRefreshToken({ userId: user.id });

    return createLoginResponse(
      {
        id: user.id,
        name: user.name,
        role: role.name,
        branch: branch.name,
      },
      accessToken,
      refreshToken
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
  }
}
