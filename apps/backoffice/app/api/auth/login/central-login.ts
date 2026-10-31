import { NextResponse } from 'next/server';
import * as argon2 from 'argon2';
import { logoutSession, passwordLogin, startVerifiedPinSession } from '@petshop/auth';
import type { LoginInput } from '@petshop/shared';
import { db, users, roles, eq, and, or, sql } from '@/lib/db';
import { signAccessToken, signRefreshToken } from '@/lib/auth';
import { describeDevice } from '@/lib/device-label';
import {
  backofficePolicy,
  checkMutation,
  getAuthSql,
  readCentralToken,
  setCentralCookie,
} from '@/lib/central-auth';
import { findAccountIdForUser, findUserIdForSession } from '@/lib/services/central-session';
import { assemblePayload, loadAccessContext } from '@/lib/services/access-payload';
import { createLoginResponse } from './session-response';

const userColumns = {
  id: users.id,
  name: users.name,
  staffNumber: users.staffNumber,
  pinHash: users.pinHash,
  roleId: users.roleId,
  branchId: users.branchId,
  isActive: users.isActive,
  mustChangeCredentials: users.mustChangeCredentials,
  mustChangePin: users.mustChangePin,
};

const GENERIC_FAILURE = 'Login tidak berhasil. Periksa kredensial atau coba kembali nanti.';

async function roleName(roleId: number): Promise<string> {
  const [role] = await db.select({ name: roles.name }).from(roles).where(eq(roles.id, roleId)).limit(1);
  return role?.name ?? 'UNKNOWN';
}

/**
 * Login mode central. Password diperiksa layanan pusat; PIN tetap diperiksa di sini (khusus
 * backoffice) lalu sesi diminta lewat `startVerifiedPinSession`. JWT lokal tetap diterbitkan
 * backoffice dari peran/izin/cabang di tabel petshop.
 */
export async function centralLogin(req: Request, input: LoginInput): Promise<Response> {
  const denied = await checkMutation(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const deviceLabel = describeDevice(req.headers.get('user-agent')) ?? undefined;
  const previousToken = await readCentralToken();
  const sqlClient = getAuthSql();

  let token: string;
  let centralSessionId: number;
  let mustChangePassword = false;
  let localUserId: number;

  const usesPin = input.mode === 'staff_pin' || (input.mode === 'bo' && input.credentialType === 'pin');

  if (usesPin) {
    const [user] = input.mode === 'staff_pin'
      ? await db.select(userColumns).from(users)
          .where(and(eq(users.staffNumber, input.staffNumber), eq(users.isActive, true))).limit(1)
      : await db.select(userColumns).from(users)
          .where(and(
            or(
              sql`lower(${users.email}) = ${input.identifier.trim().toLowerCase()}`,
              sql`lower(${users.username}) = ${input.identifier.trim().toLowerCase()}`,
            ),
            eq(users.isActive, true),
          )).limit(1);
    const pin = input.mode === 'staff_pin' ? input.pin : input.credential;
    if (!user || !user.pinHash || !(await argon2.verify(user.pinHash, pin))) {
      return NextResponse.json({ error: 'Kredensial salah' }, { status: 401 });
    }
    const accountId = await findAccountIdForUser(user.id);
    if (accountId === null) {
      return NextResponse.json({ error: 'Akun belum tertaut ke akun pusat. Hubungi Owner.' }, { status: 403 });
    }
    const result = await startVerifiedPinSession(sqlClient, {
      accountId,
      localUserId: user.id,
      backoffice: backofficePolicy(await roleName(user.roleId)),
      previousToken,
      deviceLabel,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });
    ({ token, sessionId: centralSessionId } = result);
    localUserId = user.id;
  } else {
    const identifier = (input.mode === 'email_password' ? input.email : (input as { identifier: string }).identifier)
      .trim().toLowerCase();
    const password = input.mode === 'email_password' ? input.password : (input as { credential: string }).credential;
    // Peran dibutuhkan lebih dulu karena pengecualian OWNER ada di kebijakan akses. Pemeriksaan
    // silang setelah login memastikan akun yang masuk memang user yang peran-nya dipakai.
    const [candidate] = await db.select({ id: users.id, roleId: users.roleId }).from(users)
      .where(or(sql`lower(${users.email}) = ${identifier}`, sql`lower(${users.username}) = ${identifier}`)).limit(1);
    const result = await passwordLogin(sqlClient, {
      appCode: 'backoffice',
      identifier,
      password,
      backoffice: backofficePolicy(candidate ? await roleName(candidate.roleId) : 'UNKNOWN'),
      previousToken,
      deviceLabel,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });
    const linkedUserId = await findUserIdForSession(result.sessionId);
    if (linkedUserId === null || (candidate && linkedUserId !== candidate.id)) {
      await logoutSession(sqlClient, result.token);
      return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });
    }
    ({ token, sessionId: centralSessionId, mustChangePassword } = result);
    localUserId = linkedUserId;
  }

  const [user] = await db.select(userColumns).from(users)
    .where(and(eq(users.id, localUserId), eq(users.isActive, true))).limit(1);
  if (!user) {
    await logoutSession(sqlClient, token);
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });
  }

  const context = await loadAccessContext(user);
  const payload = assemblePayload(
    { ...user, mustChangeCredentials: mustChangePassword },
    context,
    { centralSessionId },
  );
  const response = createLoginResponse(
    { id: user.id, name: user.name, role: context.roleName, branch: context.branchName },
    await signAccessToken(payload),
    await signRefreshToken({ userId: user.id }),
  );
  setCentralCookie(response, token);
  return response;
}
