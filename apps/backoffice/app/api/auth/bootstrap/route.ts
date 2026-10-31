import { NextResponse, type NextRequest } from 'next/server';
import { isCentralMode } from '@/lib/central-cookie-name';

const ACCESS_TOKEN_MAX_AGE = 60 * 60 * 24;

// Hanya path internal; cegah pengalihan terbuka lewat `next`.
function safeNext(value: string | null): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/api/') ? value : null;
}

function redirectTo(location: string) {
  // Location RELATIF, alasannya sama dengan session-ended (HOSTNAME=0.0.0.0 di Docker).
  return new NextResponse(null, { status: 307, headers: { Location: location } });
}

/**
 * Terbitkan JWT backoffice dari sesi pusat yang masih hidup, tanpa login ulang. Dipakai saat
 * JWT 1 hari habis atau pengguna datang dari app lain dengan cookie pusat.
 *
 * Aman dari loop: path ini publik di middleware, dan kegagalan selalu berujung ke /login
 * yang tidak dibootstrap. Akses yang sudah dicabut (mis. TAKEN_OVER) tidak pernah dihidupkan
 * lagi di sini — `openAppAccess` menolaknya, dan pengguna harus login eksplisit.
 */
export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  if (!isCentralMode()) return redirectTo('/login');

  const [{ hashSessionToken, openAppAccess }, central, access, { db, users, roles, eq, and }] = await Promise.all([
    import('@petshop/auth'),
    import('@/lib/central-auth'),
    import('@/lib/services/access-payload'),
    import('@/lib/db'),
  ]);
  const { signAccessToken, signRefreshToken } = await import('@/lib/auth');

  const token = await central.readCentralToken();
  if (!token) return redirectTo('/login');

  const sql = central.getAuthSql();
  const [linked] = await sql`select l.local_user_id from auth.sessions s
    join auth.account_links l on l.account_id = s.account_id and l.app_code = 'backoffice' and l.revoked_at is null
    where s.token_hash = ${hashSessionToken(token)}`;
  if (!linked) {
    const response = redirectTo('/login?reason=taken_over');
    return response;
  }

  const [user] = await db
    .select({
      id: users.id, name: users.name, staffNumber: users.staffNumber, roleId: users.roleId,
      branchId: users.branchId, mustChangeCredentials: users.mustChangeCredentials,
      mustChangePin: users.mustChangePin,
    })
    .from(users)
    .where(and(eq(users.id, Number(linked.local_user_id)), eq(users.isActive, true)))
    .limit(1);
  const [role] = user ? await db.select({ name: roles.name }).from(roles).where(eq(roles.id, user.roleId)).limit(1) : [];
  if (!user || !role) return redirectTo('/login?reason=taken_over');

  const result = await openAppAccess(sql, token, 'backoffice', central.backofficePolicy(role.name));
  if (!result.ok) {
    const response = redirectTo(result.code === 'INVALID_SESSION' ? '/login' : '/login?reason=taken_over');
    if (result.code === 'INVALID_SESSION') central.clearCentralCookie(response);
    return response;
  }

  const context = await access.loadAccessContext(user);
  // Bootstrap tidak pernah melewati gerbang onboarding: openAppAccess sudah menolak
  // PASSWORD_CHANGE_REQUIRED, jadi sampai di sini kredensial sudah beres.
  const payload = access.assemblePayload(
    { ...user, mustChangeCredentials: false },
    context,
    { centralSessionId: result.sessionId },
  );
  const response = redirectTo(next ?? '/dashboard');
  const cookieBase = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/' };
  response.cookies.set('accessToken', await signAccessToken(payload), { ...cookieBase, maxAge: ACCESS_TOKEN_MAX_AGE });
  response.cookies.set('refreshToken', await signRefreshToken({ userId: user.id }), { ...cookieBase, maxAge: 60 * 60 * 24 * 7 });
  return response;
}
