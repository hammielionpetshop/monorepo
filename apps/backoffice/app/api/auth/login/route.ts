import { NextResponse } from 'next/server';
import { db, users, branches, roles, eq, and } from '@/lib/db';
import { loginSchema, UserRole } from '@petshop/shared';
import * as argon2 from 'argon2';
import { signAccessToken, signRefreshToken } from '@/lib/auth';
import { createLoginResponse } from './session-response';

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
        })
        .from(users)
        .where(and(eq(users.staffNumber, input.staffNumber), eq(users.isActive, true)))
        .limit(1);

      if (!user || !user.pinHash || !(await argon2.verify(user.pinHash, input.pin))) {
        return NextResponse.json({ error: 'Nomor staff atau PIN salah' }, { status: 401 });
      }
    } else {
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
        })
        .from(users)
        .where(and(eq(users.email, input.email), eq(users.isActive, true)))
        .limit(1);

      if (!user || !user.passwordHash || !(await argon2.verify(user.passwordHash, input.password))) {
        return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
      }
    }

    // Get Branch and Role info
    const [branch] = await db.select().from(branches).where(eq(branches.id, user.branchId)).limit(1);
    const [role] = await db.select().from(roles).where(eq(roles.id, user.roleId)).limit(1);

    const payload = {
      userId: user.id,
      userName: user.name,
      staffNumber: user.staffNumber || null,
      branchId: user.branchId,
      branchName: branch.name,
      role: role.name as UserRole,
      permissions: [], // TODO: Load permissions
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
